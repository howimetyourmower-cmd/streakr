// /app/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  correctOutcome?: QuestionOutcome;
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void";

type StatusFilter = "all" | QuestionStatus;

function formatKickoff(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * Map ROUND_OPTIONS key ("OR", "R1", "R2", ...) to the numeric roundNumber
 * used by the API (?round=0,1,2,...)
 */
function keyToRoundNumber(key: string): number {
  if (key === "OR") return 0;
  if (key.startsWith("R")) {
    const n = Number(key.slice(1));
    if (!Number.isNaN(n) && n >= 1) return n;
  }
  // fallback
  return 0;
}

/**
 * Reverse mapping: numeric -> label using ROUND_OPTIONS so everything stays in sync.
 */
function roundNumberToLabel(roundNumber: number): string {
  const match = ROUND_OPTIONS.find((r) => keyToRoundNumber(r.key) === roundNumber);
  return match ? match.label : "Round";
}

export default function SettlementPage() {
  // 0 = Opening Round, 1 = Round 1, etc.
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sponsorOnly, setSponsorOnly] = useState(false);

  // Track which question is currently sending a settlement request
  const [busyQuestionIds, setBusyQuestionIds] = useState<Set<string>>(new Set());

  const roundLabel = useMemo(
    () => roundNumberToLabel(roundNumber),
    [roundNumber]
  );

  // ─────────────────────────────────────────────
  // Load picks for the selected round
  // ─────────────────────────────────────────────
  const loadPicks = async (round: number) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/picks?round=${round}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load picks: ${res.status}`);
      }

      const data: PicksApiResponse = await res.json();
      setGames(data.games || []);
    } catch (err: any) {
      console.error("[Settlement] loadPicks error", err);
      setError(
        err?.message || "Failed to load picks for settlement. Please try again."
      );
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPicks(roundNumber);
  }, [roundNumber]);

  // ─────────────────────────────────────────────
  // Call /api/settlement with an action
  // ─────────────────────────────────────────────
  const sendSettlementAction = async (
    questionId: string,
    action: SettlementAction
  ) => {
    try {
      setBusyQuestionIds((prev) => new Set(prev).add(questionId));

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId,
          action,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (json && (json.error as string)) ||
          `Failed to update settlement (${res.status})`;
        alert(msg);
        return;
      }

      // Update local UI state optimistically so the status chips change immediately
      setGames((prevGames) =>
        prevGames.map((game) => ({
          ...game,
          questions: game.questions.map((q) => {
            if (q.id !== questionId) return q;

            let status: QuestionStatus = q.status;
            let correctOutcome: QuestionOutcome | undefined = q.correctOutcome;

            switch (action) {
              case "lock":
                status = "pending";
                // outcome stays undefined here – final will set it
                break;
              case "reopen":
                status = "open";
                correctOutcome = undefined;
                break;
              case "final_yes":
                status = "final";
                correctOutcome = "yes";
                break;
              case "final_no":
                status = "final";
                correctOutcome = "no";
                break;
              case "final_void":
                status = "void";
                correctOutcome = "void";
                break;
              default:
                break;
            }

            return {
              ...q,
              status,
              correctOutcome,
            };
          }),
        }))
      );
    } catch (err: any) {
      console.error("[Settlement] sendSettlementAction error", err);
      alert(
        err?.message ||
          "Failed to update settlement. Please check the console/logs."
      );
    } finally {
      setBusyQuestionIds((prev) => {
        const copy = new Set(prev);
        copy.delete(questionId);
        return copy;
      });
    }
  };

  const filteredGames = useMemo(() => {
    let result = games;

    if (sponsorOnly) {
      result = result.map((g) => ({
        ...g,
        questions: g.questions.filter((q) => q.isSponsorQuestion),
      }));
    }

    if (statusFilter !== "all") {
      result = result.map((g) => ({
        ...g,
        questions: g.questions.filter((q) => q.status === statusFilter),
      }));
    }

    // remove any games that have no questions after filtering
    result = result.filter((g) => g.questions.length > 0);

    return result;
  }, [games, sponsorOnly, statusFilter]);

  const isBusy = (questionId: string) => busyQuestionIds.has(questionId);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Lock questions once they go live, then mark the final outcome to
              update player streaks and leaderboards. Reopen is a safety net if
              you lock or settle the wrong question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Current round
            </span>
            <select
              value={roundNumber.toString()}
              onChange={(e) => {
                const n = Number(e.target.value);
                setRoundNumber(Number.isNaN(n) ? 0 : n);
              }}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => {
                const numeric = keyToRoundNumber(r.key);
                return (
                  <option key={r.key} value={numeric.toString()}>
                    {r.label}
                  </option>
                );
              })}
            </select>
          </div>
        </header>

        {/* Meta strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              AFL Season {CURRENT_SEASON}
            </span>
            <span className="text-white/80">
              Settlement scope:{" "}
              <span className="font-semibold text-white">{roundLabel}</span>
            </span>
          </div>
          <div className="text-white/60">
            Changes here drive question status on the Picks page and streaks on
            player profiles.
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-white/60 mr-2">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                statusFilter === "all"
                  ? "bg-orange-500 text-black border-orange-500"
                  : "bg-black border-white/25 text-white/80"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("open")}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                statusFilter === "open"
                  ? "bg-emerald-500 text-black border-emerald-500"
                  : "bg-black border-white/25 text-white/80"
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                statusFilter === "pending"
                  ? "bg-yellow-400 text-black border-yellow-400"
                  : "bg-black border-white/25 text-white/80"
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("final")}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                statusFilter === "final"
                  ? "bg-sky-500 text-black border-sky-500"
                  : "bg-black border-white/25 text-white/80"
              }`}
            >
              Final
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("void")}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                statusFilter === "void"
                  ? "bg-slate-500 text-black border-slate-500"
                  : "bg-black border-white/25 text-white/80"
              }`}
            >
              Void
            </button>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sponsorOnly}
              onChange={(e) => setSponsorOnly(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-black"
            />
            <span className="text-xs md:text-sm text-white/80">
              Show sponsor question only
            </span>
          </label>
        </div>

        {/* Table / content */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Header row */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wide text-white/60 bg-black/80">
            <div className="flex items-center gap-4">
              <span className="w-8 text-left">Qtr</span>
              <span>Question</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Status</span>
              <span className="hidden sm:inline">Set outcome</span>
            </div>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading questions…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && filteredGames.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions found for this round / filter.
            </div>
          )}

          {!loading && !error && filteredGames.length > 0 && (
            <div className="divide-y divide-white/10">
              {filteredGames.map((game) => (
                <div key={game.id} className="bg-black/60">
                  {/* Game header */}
                  <div className="px-4 py-3 bg-slate-900/80 border-b border-white/10 text-xs md:text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                    <div className="font-semibold">
                      {game.match}{" "}
                      <span className="text-white/60">• {game.venue}</span>
                    </div>
                    <div className="text-white/60">
                      {formatKickoff(game.startTime)}
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="divide-y divide-white/10">
                    {game.questions.map((q) => {
                      const busy = isBusy(q.id);
                      const statusChip =
                        q.status === "open"
                          ? "bg-emerald-500 text-black"
                          : q.status === "pending"
                          ? "bg-yellow-400 text-black"
                          : q.status === "final"
                          ? "bg-sky-500 text-black"
                          : "bg-slate-500 text-black";

                      return (
                        <div
                          key={q.id}
                          className="px-4 py-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-8 text-xs font-semibold text-white/80">
                              Q{q.quarter}
                            </span>
                            <div>
                              <div className="font-semibold">
                                {q.question}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                                {q.isSponsorQuestion && (
                                  <span className="inline-flex items-center rounded-full bg-yellow-300/15 border border-yellow-400/60 px-2 py-0.5 text-[10px] font-semibold text-yellow-300 uppercase tracking-wide">
                                    Sponsor question
                                  </span>
                                )}
                                {typeof q.yesPercent === "number" &&
                                  typeof q.noPercent === "number" && (
                                    <span>
                                      Yes: {q.yesPercent}% • No: {q.noPercent}%
                                    </span>
                                  )}
                                {typeof q.commentCount === "number" && (
                                  <span>Comments: {q.commentCount}</span>
                                )}
                                {q.correctOutcome && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 uppercase tracking-wide">
                                    Result:{" "}
                                    {q.correctOutcome.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Status + buttons */}
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${statusChip}`}
                            >
                              {q.status.toUpperCase()}
                            </span>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {/* YES */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  sendSettlementAction(q.id, "final_yes")
                                }
                                className="px-3 py-1 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-black font-semibold disabled:opacity-50"
                              >
                                YES
                              </button>
                              {/* NO */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  sendSettlementAction(q.id, "final_no")
                                }
                                className="px-3 py-1 rounded-full bg-red-500/90 hover:bg-red-400 text-black font-semibold disabled:opacity-50"
                              >
                                NO
                              </button>
                              {/* VOID */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  sendSettlementAction(q.id, "final_void")
                                }
                                className="px-3 py-1 rounded-full bg-slate-500/90 hover:bg-slate-400 text-black font-semibold disabled:opacity-50"
                              >
                                VOID
                              </button>
                              {/* LOCK */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  sendSettlementAction(q.id, "lock")
                                }
                                className="px-3 py-1 rounded-full bg-yellow-400/90 hover:bg-yellow-300 text-black font-semibold disabled:opacity-50"
                              >
                                LOCK
                              </button>
                              {/* REOPEN */}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  sendSettlementAction(q.id, "reopen")
                                }
                                className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold border border-white/40 disabled:opacity-50"
                              >
                                REOPEN
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-white/60">
          Settlement feeds both the Picks page and the Leaderboards. Lock when a
          question goes live, then set the final result after the relevant
          quarter or match finishes.
        </p>
      </section>
    </main>
  );
}
