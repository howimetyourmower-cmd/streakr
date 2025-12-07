// app/admin/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

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
  isUnlockedForPicks?: boolean;
  questions: ApiQuestion[];
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

type GameUnlock = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  isUnlockedForPicks: boolean;
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

function formatStart(iso: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };

  const date = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Melbourne",
  });

  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
  });

  return { date, time };
}

export default function SettlementPage() {
  const [roundKey, setRoundKey] = useState<RoundKey>("OR");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "pending" | "final" | "void"
  >("all");

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [gameUnlocks, setGameUnlocks] = useState<GameUnlock[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lockSavingId, setLockSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  // Derived roundNumber from key
  const roundNumber = useMemo(() => {
    return keyToRoundNumber(roundKey);
  }, [roundKey]);

  const roundLabel = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found?.label ?? "Round";
  }, [roundKey]);

  // Load questions + game unlocks for the selected round
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setLockError(null);

        const res = await fetch(`/api/picks?round=${roundNumber}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load picks (status ${res.status})`);
        }

        const json: PicksApiResponse = await res.json();

        // Flatten questions
        const flatQuestions: QuestionRow[] = [];
        const gameUnlockList: GameUnlock[] = [];

        for (const game of json.games || []) {
          // game unlock row
          gameUnlockList.push({
            id: game.id,
            match: game.match,
            venue: game.venue,
            startTime: game.startTime,
            isUnlockedForPicks: !!game.isUnlockedForPicks,
          });

          // settlement rows
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
        setGameUnlocks(gameUnlockList);
      } catch (err: any) {
        console.error("[Settlement] load error", err);
        setError(
          err?.message || "Failed to load questions for settlement console."
        );
        setQuestions([]);
        setGameUnlocks([]);
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

  // ─────────────────────────────────────────────
  // Game unlock / lock for picks
  // ─────────────────────────────────────────────
  async function handleToggleGameLock(gameId: string, nextUnlocked: boolean) {
    setLockError(null);
    setLockSavingId(gameId);

    // Optimistic update
    setGameUnlocks((prev) =>
      prev.map((g) =>
        g.id === gameId ? { ...g, isUnlockedForPicks: nextUnlocked } : g
      )
    );

    try {
      const res = await fetch("/api/admin/game-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          gameId,
          isUnlockedForPicks: nextUnlocked,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.error ||
          `Failed to update game lock (status ${res.status})`;
        throw new Error(msg);
      }
    } catch (err: any) {
      console.error("[Settlement] game lock error", err);
      setLockError(
        err?.message || "Failed to update game lock. Please try again."
      );
      // revert optimistic update
      setGameUnlocks((prev) =>
        prev.map((g) =>
          g.id === gameId ? { ...g, isUnlockedForPicks: !nextUnlocked } : g
        )
      );
    } finally {
      setLockSavingId(null);
    }
  }

  // ─────────────────────────────────────────────
  // Question settlement
  // ─────────────────────────────────────────────
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
        const flatQuestions: QuestionRow[] = [];
        const gameUnlockList: GameUnlock[] = [];

        for (const game of json.games || []) {
          gameUnlockList.push({
            id: game.id,
            match: game.match,
            venue: game.venue,
            startTime: game.startTime,
            isUnlockedForPicks: !!game.isUnlockedForPicks,
          });

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
        setGameUnlocks(gameUnlockList);
      }
    } catch (err: any) {
      console.error("[Settlement] action error", err);
      alert(err?.message || "Failed to update settlement.");
    } finally {
      setSavingId(null);
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
              correct outcome. Uses <code className="text-xs">/api/picks</code>{" "}
              for data and <code className="text-xs">/api/settlement</code> for
              updates. Reopen is a safety net if you lock or settle the wrong
              question.
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

        {/* GAME UNLOCKS PANEL */}
        <section className="rounded-2xl bg-slate-950/90 border border-sky-500/40 shadow-[0_0_40px_rgba(15,23,42,0.9)] overflow-hidden">
          <div className="px-4 py-3 border-b border-sky-500/30 bg-gradient-to-r from-sky-900/60 via-slate-900 to-slate-950">
            <h2 className="text-sm font-bold tracking-wide uppercase text-sky-100">
              Game unlocks for this round
            </h2>
            <p className="mt-1 text-xs text-slate-100/80 max-w-2xl">
              Control which matches are unlocked for players to make picks. Only
              upcoming games, not busted for the player, and{" "}
              <span className="font-semibold text-sky-200">
                &quot;Players can pick&quot;
              </span>{" "}
              = <code className="text-[11px]">true</code> will allow picks on
              the Picks page.
            </p>
            {lockError && (
              <p className="mt-1 text-xs text-red-300 font-medium">
                {lockError}
              </p>
            )}
          </div>

          {gameUnlocks.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-200">
              No games found for this round.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {gameUnlocks.map((g) => {
                const { date, time } = formatStart(g.startTime);
                const unlocked = g.isUnlockedForPicks;

                return (
                  <div
                    key={g.id}
                    className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-slate-950 via-slate-950 to-slate-950"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300 border border-emerald-400/40">
                          Upcoming game
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold border text-xs ${
                            unlocked
                              ? "bg-lime-500/10 text-lime-200 border-lime-400/60"
                              : "bg-slate-700/40 text-slate-200 border-slate-400/70"
                          }`}
                        >
                          {unlocked ? "Unlocked for picks" : "Locked for picks"}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {g.match}
                      </div>
                      <div className="text-xs text-slate-300">
                        {date && time ? `${date} · ${time} AEDT` : ""}
                      </div>
                      <div className="text-xs text-slate-400">
                        {g.venue}
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1">
                      <p className="text-xs text-slate-300">
                        {unlocked ? "Players can pick" : "Players can’t pick"}
                      </p>

                      {/* Toggle switch */}
                      <button
                        type="button"
                        disabled={lockSavingId === g.id}
                        onClick={() =>
                          handleToggleGameLock(g.id, !unlocked)
                        }
                        className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                          unlocked
                            ? "bg-emerald-500 border-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.8)]"
                            : "bg-slate-700 border-slate-500"
                        } ${lockSavingId === g.id ? "opacity-70" : ""}`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                            unlocked ? "translate-x-7" : "translate-x-1"
                          }`}
                        />
                      </button>

                      <p className="text-[11px] text-slate-400">
                        Toggle this to open or close picks for this match.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* FILTER ROW FOR QUESTIONS */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Filter questions by status
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

        {/* QUESTIONS TABLE */}
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
          settle it again with the correct outcome. Game unlocks above control
          which matches are open for picks on the player side.
        </p>
      </section>
    </main>
  );
}
