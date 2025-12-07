// app/admin/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";
import { db } from "@/lib/firebaseClient";
import { doc, setDoc } from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

type RoundKey = (typeof ROUND_OPTIONS)[number]["key"];

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
  sport?: string;
  isUnlocked?: boolean;
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

type QuestionRow = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  match: string;
  isSponsorQuestion?: boolean;
};

type GameRow = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  isUnlocked?: boolean;
};

// Map ROUND_OPTIONS.key → numeric roundNumber used by /api/picks & /api/settlement
function keyToRoundNumber(key: string): number {
  if (key === "OR") return 0; // Opening Round
  if (key.startsWith("R")) {
    const num = Number(key.slice(1));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function formatStart(startTime: string) {
  if (!startTime) return { date: "", time: "" };
  const d = new Date(startTime);
  if (isNaN(d.getTime())) return { date: "", time: "" };

  return {
    date: d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Australia/Melbourne",
    }),
    time: d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    }),
  };
}

function isGameUpcoming(startTime: string): boolean {
  if (!startTime) return true;
  const d = new Date(startTime);
  if (isNaN(d.getTime())) return true;
  return d.getTime() > Date.now();
}

export default function SettlementPage() {
  const [roundKey, setRoundKey] = useState<RoundKey>("OR");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "pending" | "final" | "void"
  >("all");

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [togglingGameId, setTogglingGameId] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);

  // Derived roundNumber from key
  const roundNumber = useMemo(() => {
    return keyToRoundNumber(roundKey);
  }, [roundKey]);

  const roundLabel = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found?.label ?? "Round";
  }, [roundKey]);

  // Load questions + games for the selected round
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setGameError(null);

        const res = await fetch(`/api/picks?round=${roundNumber}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load picks (status ${res.status})`);
        }

        const json: PicksApiResponse = await res.json();

        // Flatten questions
        const flatQuestions: QuestionRow[] = [];
        for (const game of json.games || []) {
          for (const q of game.questions || []) {
            flatQuestions.push({
              id: q.id,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              match: game.match,
              isSponsorQuestion: q.isSponsorQuestion,
            });
          }
        }

        setQuestions(flatQuestions);

        // Extract games for this round (one row per game)
        const gameRows: GameRow[] = (json.games || []).map((g) => ({
          id: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          sport: g.sport ?? "AFL",
          isUnlocked:
            typeof g.isUnlocked === "boolean" ? g.isUnlocked : true,
        }));
        setGames(gameRows);
      } catch (err: any) {
        console.error("[Settlement] load error", err);
        setError(
          err?.message || "Failed to load questions for settlement console."
        );
        setQuestions([]);
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [roundNumber]);

  const filteredQuestions = useMemo(() => {
    if (statusFilter === "all") return questions;
    return questions.filter((q) => q.status === statusFilter);
  }, [questions, statusFilter]);

  async function handleAction(questionId: string, action: SettlementAction) {
    try {
      setSavingId(questionId);
      setError(null);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message =
          data?.error || `Settlement API failed (status ${res.status})`;
        throw new Error(message);
      }

      // Optimistic local status update so you see it instantly
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;

          let newStatus: QuestionStatus = q.status;

          switch (action) {
            case "lock":
              newStatus = "pending";
              break;
            case "reopen":
              newStatus = "open";
              break;
            case "final_yes":
            case "final_no":
              newStatus = "final";
              break;
            case "final_void":
            case "void":
              newStatus = "void";
              break;
            default:
              break;
          }

          return { ...q, status: newStatus };
        })
      );

      // Hard refresh from /api/picks so everything is in sync
      const refresh = await fetch(`/api/picks?round=${roundNumber}`, {
        cache: "no-store",
      });
      if (refresh.ok) {
        const json: PicksApiResponse = await refresh.json();

        const flat: QuestionRow[] = [];
        for (const game of json.games || []) {
          for (const q of game.questions || []) {
            flat.push({
              id: q.id,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              match: game.match,
              isSponsorQuestion: q.isSponsorQuestion,
            });
          }
        }
        setQuestions(flat);

        const refreshedGames: GameRow[] = (json.games || []).map((g) => ({
          id: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          sport: g.sport ?? "AFL",
          isUnlocked:
            typeof g.isUnlocked === "boolean" ? g.isUnlocked : true,
        }));
        setGames(refreshedGames);
      }
    } catch (err: any) {
      console.error("[Settlement] action error", err);
      alert(err?.message || "Failed to update settlement.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleGameUnlock(
    gameId: string,
    currentValue: boolean | undefined
  ) {
    try {
      setTogglingGameId(gameId);
      setGameError(null);

      const newValue = !currentValue;

      // If your games live somewhere else, adjust this path:
      // e.g. doc(db, "rounds", String(roundNumber), "games", gameId)
      const gameRef = doc(db, "games", gameId);

      // ✅ Use setDoc with merge so it creates the doc if it doesn't exist
      await setDoc(
        gameRef,
        {
          isUnlocked: newValue,
        },
        { merge: true }
      );

      // Optimistic UI update
      setGames((prev) =>
        prev.map((g) =>
          g.id === gameId ? { ...g, isUnlocked: newValue } : g
        )
      );
    } catch (err: any) {
      console.error("[Settlement] game unlock error", err);
      setGameError(
        err?.message || "Failed to update game unlock status."
      );
    } finally {
      setTogglingGameId(null);
    }
  }

  function statusBadge(status: QuestionStatus) {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/40">
            OPEN
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-400/40">
            PENDING
          </span>
        );
      case "final":
        return (
          <span className="inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-400/40">
            FINAL
          </span>
        );
      case "void":
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/15 px-3 py-1 text-xs font-semibold text-slate-200 border border-slate-400/40">
            VOID
          </span>
        );
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Settlement console
            </h1>
            <p className="mt-2 text-sm text-slate-200/80 max-w-xl">
              Lock questions when they&apos;re live, then settle them with the
              correct outcome. Uses{" "}
              <code className="text-xs">/api/picks</code> for data and{" "}
              <code className="text-xs">/api/settlement</code> for updates.
              Reopen is a safety net if you lock or settle the wrong
              question. Game unlocks below control which matches are open
              for picks on the player side.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 text-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center rounded-full bg-white/5 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
                AFL Season {CURRENT_SEASON}
              </span>
              <span className="text-xs text-slate-300">
                Round:{" "}
                <span className="font-semibold text-white">
                  {roundLabel}
                </span>
              </span>
            </div>

            <select
              value={roundKey}
              onChange={(e) => setRoundKey(e.target.value as RoundKey)}
              className="rounded-full bg-black border border-white/25 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* GAME UNLOCK CONTROL */}
        <section className="rounded-2xl bg-black/70 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.7)] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                Game unlocks for this round
              </h2>
              <p className="text-xs text-slate-400 max-w-xl mt-1">
                Control which matches are unlocked for players to make picks.
                Only games that are upcoming, not busted for the player,{" "}
                and <code>isUnlocked = true</code> will allow picks on the
                Picks page.
              </p>
            </div>
          </div>

          {loading && (
            <p className="text-xs text-slate-300">Loading games…</p>
          )}
          {gameError && (
            <p className="text-xs text-red-400">{gameError}</p>
          )}

          {!loading && !games.length && !error && (
            <p className="text-xs text-slate-300">
              No games found for this round.
            </p>
          )}

          {!loading && games.length > 0 && (
            <div className="space-y-2">
              {games.map((g) => {
                const { date, time } = formatStart(g.startTime);
                const upcoming = isGameUpcoming(g.startTime);
                const unlocked = g.isUnlocked ?? true;
                const isBusy = togglingGameId === g.id;

                return (
                  <div
                    key={g.id}
                    className="rounded-xl border border-slate-700 bg-gradient-to-r from-slate-900 via-slate-950 to-black px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {g.match || "Untitled match"}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/40 border border-slate-600 uppercase tracking-wide text-gray-200">
                          {g.sport || "AFL"}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 text-gray-100">
                          {g.venue || "Venue TBC"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-300">
                        {date && time ? (
                          <>
                            <span className="font-mono">{date}</span>
                            <span className="mx-1">•</span>
                            <span className="font-mono">
                              {time} AEDT
                            </span>
                          </>
                        ) : (
                          <span className="italic text-gray-500">
                            No start time set
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                            upcoming
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-400/40"
                              : "bg-red-500/10 text-red-300 border border-red-400/40"
                          }`}
                        >
                          {upcoming ? "Upcoming game" : "Started / finished"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold border ${
                            unlocked
                              ? "bg-orange-500/15 text-orange-300 border-orange-400/50"
                              : "bg-slate-800 text-slate-100 border-slate-500"
                          }`}
                        >
                          {unlocked
                            ? "Unlocked for picks"
                            : "Locked for picks"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                      <div className="text-right text-[11px] text-gray-300">
                        <p className="font-semibold">
                          {unlocked
                            ? "Players can pick"
                            : "Players can’t pick"}
                        </p>
                        <p className="text-gray-400">
                          {upcoming
                            ? "Toggle this to open or close picks for this match."
                            : "Game has started – unlocking won’t reopen old picks."}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleToggleGameUnlock(g.id, unlocked)
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
                          unlocked
                            ? "bg-emerald-500 border-emerald-300"
                            : "bg-slate-700 border-slate-500"
                        } ${isBusy ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-black shadow transition ${
                            unlocked ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FILTER ROW */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Filter by status
          </span>
          {(["open", "final", "pending", "void", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-orange-500 text-black border-orange-400"
                  : "bg-slate-900/70 text-slate-200 border-slate-600 hover:bg-slate-800"
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* TABLE */}
        <section className="rounded-2xl bg-slate-950/90 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.7)] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wide text-slate-300 bg-black/80">
            <div className="flex items-center gap-6">
              <span className="w-10 text-left">Qtr</span>
              <span>Question</span>
            </div>
            <div className="flex items-center gap-6">
              <span>Status</span>
              <span>Set outcome</span>
            </div>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-slate-200">
              Loading questions…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && filteredQuestions.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-200">
              No questions found for this round / filter.
            </div>
          )}

          {!loading && !error && filteredQuestions.length > 0 && (
            <div className="divide-y divide-white/10">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-black/40"
                >
                  <div className="flex items-start gap-4 md:w-2/3">
                    <div className="w-10 mt-1 text-sm font-semibold text-slate-200">
                      Q{q.quarter}
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-0.5">
                        {q.match}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {q.question}
                      </div>
                      {q.isSponsorQuestion && (
                        <div className="mt-1 inline-flex items-center rounded-full bg-yellow-400/15 border border-yellow-400/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-200">
                          Sponsor Question
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 md:w-1/3">
                    <div>{statusBadge(q.status)}</div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* YES / NO / VOID */}
                      <button
                        type="button"
                        disabled={savingId === q.id}
                        onClick={() =>
                          handleAction(q.id, "final_yes")
                        }
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/80 text-black hover:bg-emerald-400 disabled:opacity-60"
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        disabled={savingId === q.id}
                        onClick={() =>
                          handleAction(q.id, "final_no")
                        }
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/80 text-black hover:bg-red-400 disabled:opacity-60"
                      >
                        NO
                      </button>
                      <button
                        type="button"
                        disabled={savingId === q.id}
                        onClick={() =>
                          handleAction(q.id, "final_void")
                        }
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/80 text-black hover:bg-slate-400 disabled:opacity-60"
                      >
                        VOID
                      </button>

                      {/* LOCK / REOPEN */}
                      <button
                        type="button"
                        disabled={savingId === q.id}
                        onClick={() => handleAction(q.id, "lock")}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-60"
                      >
                        LOCK
                      </button>
                      <button
                        type="button"
                        disabled={savingId === q.id}
                        onClick={() => handleAction(q.id, "reopen")}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-500 hover:bg-slate-700 disabled:opacity-60"
                      >
                        REOPEN
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-400">
          Changes here update the live picks feed and player streaks. If a
          question is settled incorrectly, hit <strong>REOPEN</strong> and then
          settle it again with the correct outcome. Use the game unlock
          toggles above to control which matches are available for players
          to make picks in this round.
        </p>
      </section>
    </main>
  );
}
