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
  correctOutcome?: QuestionOutcome;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

type FlatQuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  isSponsorQuestion?: boolean;
  correctOutcome?: QuestionOutcome;
};

// Actions we send to /api/settlement
type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

function formatStart(iso: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };

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

function statusColour(status: QuestionStatus) {
  switch (status) {
    case "open":
      return "bg-green-600";
    case "pending":
      return "bg-yellow-500";
    case "final":
      return "bg-blue-600";
    case "void":
      return "bg-red-600";
    default:
      return "bg-gray-600";
  }
}

export default function SettlementPage() {
  // 0 = Opening Round, 1 = Round 1, etc.
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [rows, setRows] = useState<FlatQuestionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Friendly label for the header dropdown
  const roundLabel = useMemo(() => {
    const opt = ROUND_OPTIONS[roundNumber];
    return opt ? opt.label : (roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`);
  }, [roundNumber]);

  // Load questions for selected round
  const loadRound = async (round: number) => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/picks?round=${round}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load picks for round ${round}`);
      }

      const data: PicksApiResponse = await res.json();

      const flat: FlatQuestionRow[] = data.games.flatMap((g) =>
        g.questions.map((q) => ({
          id: q.id,
          gameId: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          isSponsorQuestion: q.isSponsorQuestion,
          correctOutcome: q.correctOutcome,
        }))
      );

      setRows(flat);
    } catch (err) {
      console.error("[Settlement] loadRound error", err);
      setError("Failed to load questions for this round.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial + when roundNumber changes
  useEffect(() => {
    loadRound(roundNumber);
  }, [roundNumber]);

  const handleRoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    if (!Number.isNaN(value)) {
      setRoundNumber(value);
    }
  };

  // Send settlement action for a specific question
  const sendAction = async (questionId: string, action: SettlementAction) => {
    try {
      setSavingId(questionId);
      setError("");

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId,
          action,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update settlement");
      }

      // Refresh questions so status + badges update
      await loadRound(roundNumber);
    } catch (err) {
      console.error("[Settlement] sendAction error", err);
      setError("Failed to update this question. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement Console
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Lock questions before bounce, then mark them as correct, wrong or
              void once stats are confirmed. Reopen is a safety net if you lock
              or settle the wrong question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Season {CURRENT_SEASON}
            </span>
            <div className="inline-flex items-center gap-2">
              <span className="text-xs text-white/60">Round</span>
              <select
                value={roundNumber}
                onChange={handleRoundChange}
                className="rounded-full bg-black border border-white/25 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
              >
                {/* Map numeric index → ROUND_OPTIONS label */}
                {ROUND_OPTIONS.map((opt, idx) => (
                  <option key={opt.key} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-white/50">
              Currently editing: <span className="font-semibold">{roundLabel}</span>
            </p>
          </div>
        </header>

        {/* Info strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 text-xs md:text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              Admin only
            </span>
            <p className="mt-1 text-white/80">
              Status is pulled into the player Picks page live. Make sure each
              quarter&apos;s questions are locked before the quarter starts.
            </p>
          </div>
          <div className="text-white/60">
            <span className="font-semibold">Lock</span> →{" "}
            <span className="font-semibold">Final YES / NO / VOID</span> →{" "}
            <span className="font-semibold">Reopen</span> only if you need to
            fix a mistake.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-900/40 border border-red-500/60 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {/* Main table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Header row */}
          <div className="px-4 py-3 border-b border-white/10 grid grid-cols-12 text-[11px] uppercase tracking-wide text-white/60 gap-2">
            <div className="col-span-3">Match • Question</div>
            <div className="col-span-2">Start</div>
            <div className="col-span-1 text-center">Qtr</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-4 text-right">Set outcome</div>
          </div>

          {/* Loading / empty */}
          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading questions…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions found for this round.
            </div>
          )}

          {/* Rows */}
          {!loading && rows.length > 0 && (
            <div className="divide-y divide-white/10">
              {rows.map((row) => {
                const { date, time } = formatStart(row.startTime);
                const isSaving = savingId === row.id;

                return (
                  <div
                    key={row.id}
                    className="px-4 py-3 grid grid-cols-12 gap-2 items-center text-sm bg-black/60"
                  >
                    {/* Match + question */}
                    <div className="col-span-3">
                      <div className="font-semibold text-white">
                        {row.match}
                      </div>
                      <div className="text-[11px] text-white/70">
                        {row.question}
                      </div>
                      {row.isSponsorQuestion && (
                        <span className="inline-flex mt-1 items-center rounded-full bg-amber-400 text-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          Sponsor Question
                        </span>
                      )}
                      {row.correctOutcome && (
                        <span className="inline-flex mt-1 ml-1 items-center rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
                          Final result: {row.correctOutcome.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Start */}
                    <div className="col-span-2 text-xs text-white/80">
                      <div>{date}</div>
                      <div>{time} AEDT</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        {row.venue}
                      </div>
                    </div>

                    {/* Quarter */}
                    <div className="col-span-1 text-center font-bold">
                      Q{row.quarter}
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-bold ${statusColour(
                          row.status
                        )}`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="col-span-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {/* YES = final_yes */}
                        <button
                          type="button"
                          onClick={() => sendAction(row.id, "final_yes")}
                          disabled={isSaving}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-green-600 hover:bg-green-700 disabled:opacity-40"
                        >
                          YES
                        </button>

                        {/* NO = final_no */}
                        <button
                          type="button"
                          onClick={() => sendAction(row.id, "final_no")}
                          disabled={isSaving}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-red-600 hover:bg-red-700 disabled:opacity-40"
                        >
                          NO
                        </button>

                        {/* VOID (final) */}
                        <button
                          type="button"
                          onClick={() => sendAction(row.id, "final_void")}
                          disabled={isSaving}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-gray-500 hover:bg-gray-600 disabled:opacity-40"
                        >
                          VOID
                        </button>

                        {/* LOCK → pending */}
                        <button
                          type="button"
                          onClick={() => sendAction(row.id, "lock")}
                          disabled={isSaving}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40"
                        >
                          LOCK
                        </button>

                        {/* REOPEN → open (clear outcome) */}
                        <button
                          type="button"
                          onClick={() => sendAction(row.id, "reopen")}
                          disabled={isSaving || row.status === "open"}
                          className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-500 hover:bg-slate-400 disabled:opacity-30"
                        >
                          REOPEN
                        </button>
                      </div>
                      {isSaving && (
                        <p className="mt-1 text-[10px] text-white/50 text-right">
                          Saving…
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
