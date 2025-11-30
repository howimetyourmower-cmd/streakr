// /app/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

type StatusFilter = "all" | "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
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

export default function SettlementPage() {
  // Round selection uses the ROUND_OPTIONS "key" value
  const [roundNumber, setRoundNumber] = useState<number>(0); // 0 = Opening Round (OR)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Label for the header dropdown
  const roundLabel = useMemo(() => {
    const match = ROUND_OPTIONS.find((r) => r.key === roundNumber);
    return match ? match.label : "Round";
  }, [roundNumber]);

  // Fetch questions for selected round
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
      setError(err?.message || "Failed to load picks for settlement.");
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadPicks(roundNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  // Call /api/settlement for an action
  const sendSettlementAction = async (
    questionId: string,
    action: SettlementAction
  ) => {
    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roundNumber,
          questionId,
          action,
        }),
      });

      if (!res.ok) {
        let message = "Failed to update settlement.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse error
        }
        alert(message);
        return;
      }

      // Success – refresh picks so status / outcomes are up to date
      await loadPicks(roundNumber);
    } catch (err: any) {
      console.error("[Settlement] sendSettlementAction error", err);
      alert(err?.message || "Failed to update settlement.");
    }
  };

  // Convenience handlers for each button
  const handleLock = (questionId: string) =>
    sendSettlementAction(questionId, "lock");
  const handleReopen = (questionId: string) =>
    sendSettlementAction(questionId, "reopen");
  const handleFinalYes = (questionId: string) =>
    sendSettlementAction(questionId, "final_yes");
  const handleFinalNo = (questionId: string) =>
    sendSettlementAction(questionId, "final_no");
  const handleFinalVoid = (questionId: string) =>
    sendSettlementAction(questionId, "final_void");

  // Flatten questions for display + apply status filter
  type Row = ApiQuestion & {
    match: string;
    venue: string;
    startTime: string;
  };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of games) {
      for (const q of g.questions) {
        if (
          statusFilter !== "all" &&
          q.status.toLowerCase() !== statusFilter
        ) {
          continue;
        }
        out.push({
          ...q,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
        });
      }
    }
    // Optional sort by start time / quarter
    out.sort((a, b) => {
      if (a.startTime < b.startTime) return -1;
      if (a.startTime > b.startTime) return 1;
      return a.quarter - b.quarter;
    });
    return out;
  }, [games, statusFilter]);

  const statusBadgeClass = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "bg-emerald-500 text-white";
      case "pending":
        return "bg-amber-400 text-black";
      case "final":
        return "bg-sky-500 text-white";
      case "void":
        return "bg-slate-400 text-black";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const correctOutcomeLabel = (q: ApiQuestion) => {
    if (!q.correctOutcome) return "";
    if (q.correctOutcome === "void") return "VOID";
    if (q.correctOutcome === "yes") return "Correct: YES";
    if (q.correctOutcome === "no") return "Correct: NO";
    return "";
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
              Lock questions, set final outcomes and reopen if needed. This
              page drives player streaks, profile stats and leaderboards.
            </p>
            <p className="mt-1 text-xs text-amber-300">
              Reopen is a safety net if you lock or settle the wrong
              question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Current round
            </span>
            <select
              value={roundNumber}
              onChange={(e) => setRoundNumber(Number(e.target.value))}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-white/50">
              AFL Season {CURRENT_SEASON} – {roundLabel}
            </span>
          </div>
        </header>

        {/* Status filter bar (ALL first as you requested) */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-white/60 mr-2">
              Sponsor question
            </span>
            {/* Just a label section to match your UI; the actual sponsor tag
                is per-question coming from isSponsorQuestion */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "open", "final", "pending", "void"] as StatusFilter[]).map(
              (val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStatusFilter(val)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${
                    statusFilter === val
                      ? "bg-orange-500 text-black border-orange-400"
                      : "bg-black/40 text-white/70 border-white/20 hover:bg-white/10"
                  }`}
                >
                  {val === "all" ? "All" : val}
                </button>
              )
            )}
          </div>
        </div>

        {/* Questions table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Table header row */}
          <div className="px-4 py-3 border-b border-white/10 grid grid-cols-[0.6fr_2.4fr_0.8fr_1.2fr_1.4fr] gap-3 text-[11px] uppercase tracking-wide text-white/60 bg-black/80">
            <span>Quarter</span>
            <span>Question</span>
            <span>Status</span>
            <span>Match &amp; venue</span>
            <span className="text-right">Set outcome</span>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading questions…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions match this filter for {roundLabel}.
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="divide-y divide-white/8">
              {rows.map((q) => {
                const isLocked =
                  q.status === "pending" || q.status === "final";
                const isFinal = q.status === "final";
                const isVoid = q.status === "void";

                return (
                  <div
                    key={q.id}
                    className="px-4 py-3 grid grid-cols-[0.6fr_2.4fr_0.8fr_1.2fr_1.4fr] gap-3 text-sm bg-black/40"
                  >
                    {/* Quarter */}
                    <div className="flex items-center text-xs text-white/80">
                      Q{q.quarter}
                    </div>

                    {/* Question + sponsor tag + stats */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">
                          {q.question}
                        </p>
                        {q.isSponsorQuestion && (
                          <span className="inline-flex items-center rounded-full bg-yellow-400/90 px-2 py-[2px] text-[10px] font-bold text-black">
                            Sponsor Question
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                        <span>
                          Yes: {q.yesPercent ?? 0}% • No:{" "}
                          {q.noPercent ?? 0}%
                        </span>
                        <span>Comments: {q.commentCount ?? 0}</span>
                        {q.correctOutcome && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-[1px] text-[10px] font-semibold text-emerald-300 border border-emerald-500/40">
                            {correctOutcomeLabel(q)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold uppercase ${statusBadgeClass(
                          q.status
                        )}`}
                      >
                        {q.status}
                      </span>
                    </div>

                    {/* Match + venue */}
                    <div className="flex flex-col justify-center text-xs text-white/70">
                      <span className="font-semibold">{q.match}</span>
                      <span className="text-white/60">{q.venue}</span>
                      <span className="text-white/40">
                        {formatTime(q.startTime)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px]">
                      {/* YES / NO / VOID */}
                      <button
                        type="button"
                        onClick={() => handleFinalYes(q.id)}
                        disabled={isVoid}
                        className={`px-3 py-1 rounded-full font-semibold ${
                          q.correctOutcome === "yes"
                            ? "bg-emerald-500 text-black"
                            : "bg-emerald-600/80 text-white"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFinalNo(q.id)}
                        disabled={isVoid}
                        className={`px-3 py-1 rounded-full font-semibold ${
                          q.correctOutcome === "no"
                            ? "bg-red-500 text-white"
                            : "bg-red-600/80 text-white"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        NO
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFinalVoid(q.id)}
                        className={`px-3 py-1 rounded-full font-semibold ${
                          q.status === "void"
                            ? "bg-slate-300 text-black"
                            : "bg-slate-500/80 text-white"
                        }`}
                      >
                        VOID
                      </button>

                      {/* LOCK / REOPEN */}
                      <button
                        type="button"
                        onClick={() => handleLock(q.id)}
                        disabled={isLocked || isVoid}
                        className="px-3 py-1 rounded-full font-semibold bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        LOCK
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReopen(q.id)}
                        disabled={q.status === "open"}
                        className="px-3 py-1 rounded-full font-semibold bg-slate-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        REOPEN
                      </button>
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
