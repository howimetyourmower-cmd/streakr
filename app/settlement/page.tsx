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

type StatusFilter = "all" | "open" | "pending" | "final" | "void";

export default function SettlementPage() {
  const [roundNumber, setRoundNumber] = useState<number>(0); // 0 = Opening Round
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showSponsorOnly, setShowSponsorOnly] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Label for header dropdown
  const roundLabel = useMemo(() => {
    const match = ROUND_OPTIONS.find((r) => r.roundNumber === roundNumber);
    return match ? match.label : "Round";
  }, [roundNumber]);

  // Load questions for the selected round
  const loadPicks = async (r: number) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/picks?round=${r}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load picks for round ${r}`);
      }
      const json: PicksApiResponse = await res.json();
      setGames(json.games || []);
    } catch (err) {
      console.error("Settlement load error", err);
      setError("Failed to load questions for settlement.");
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

  // Call /api/settlement with an explicit action
  const sendAction = async (questionId: string, action: SettlementAction) => {
    try {
      setActionLoadingId(`${questionId}:${action}`);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId,
          action, // 👈 ALWAYS send action so API never complains
        }),
      });

      if (!res.ok) {
        let msg = "Failed to update settlement.";
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          // ignore
        }
        alert(msg);
        return;
      }

      // Reload questions so status updates on screen
      await loadPicks(roundNumber);
    } catch (err) {
      console.error("Settlement action error", err);
      alert("Failed to update settlement. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredQuestions = useMemo(() => {
    const rows: {
      gameId: string;
      match: string;
      venue: string;
      question: ApiQuestion;
    }[] = [];

    games.forEach((g) => {
      g.questions.forEach((q) => {
        if (showSponsorOnly && !q.isSponsorQuestion) return;
        if (statusFilter !== "all" && q.status !== statusFilter) return;
        rows.push({ gameId: g.id, match: g.match, venue: g.venue, question: q });
      });
    });

    return rows;
  }, [games, statusFilter, showSponsorOnly]);

  const isBusy = (questionId: string, action: SettlementAction) =>
    actionLoadingId === `${questionId}:${action}`;

  const statusBadgeClass = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "bg-emerald-500 text-black";
      case "pending":
        return "bg-amber-400 text-black";
      case "final":
        return "bg-sky-500 text-black";
      case "void":
        return "bg-slate-500 text-white";
      default:
        return "bg-slate-600 text-white";
    }
  };

  const outcomeLabel = (q: ApiQuestion) => {
    if (!q.correctOutcome) return "";
    if (q.correctOutcome === "yes") return "Correct answer: YES";
    if (q.correctOutcome === "no") return "Correct answer: NO";
    return "Question void";
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="space-y-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-2xl">
              Use this page to lock questions before the game starts, then
              settle them as FINAL once the result is known. The picks page
              reads from <code>questionStatus</code> and streaks are updated via{" "}
              <code>/api/settlement</code>.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Current season
            </span>
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              AFL Season {CURRENT_SEASON}
            </span>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs uppercase tracking-wide text-white/60">
                Round
              </span>
              <select
                value={roundNumber}
                onChange={(e) => setRoundNumber(Number(e.target.value))}
                className="rounded-full bg-black border border-white/30 px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
              >
                {ROUND_OPTIONS.map((r) => (
                  <option key={r.key} value={r.roundNumber}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-white/60">{roundLabel}</span>
            </div>
          </div>

          {/* Info note */}
          <p className="text-xs text-white/60">
            This page calls <code>/api/picks</code> for data and{" "}
            <code>/api/settlement</code> for updates.{" "}
            <span className="font-semibold text-white">
              Reopen is a safety net
            </span>{" "}
            if you lock or settle the wrong question.
          </p>
        </header>

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-1">
            {(["all", "open", "pending", "final", "void"] as StatusFilter[]).map(
              (key) => {
                const label =
                  key === "all"
                    ? "ALL"
                    : key === "open"
                    ? "OPEN"
                    : key === "pending"
                    ? "PENDING"
                    : key === "final"
                    ? "FINAL"
                    : "VOID";

                const isActive = statusFilter === key;

                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                      isActive
                        ? "bg-orange-500 text-black border-orange-400"
                        : "bg-black/40 text-white/80 border-white/20 hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          <button
            onClick={() => setShowSponsorOnly((v) => !v)}
            className={`ml-2 px-3 py-1 rounded-full border text-xs font-semibold ${
              showSponsorOnly
                ? "bg-sky-500 text-black border-sky-400"
                : "bg-black/40 text-white/80 border-white/20 hover:bg-white/5"
            }`}
          >
            Sponsor question only
          </button>
        </section>

        {/* Table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wide text-white/60 flex items-center justify-between">
            <div className="flex gap-8">
              <span className="w-10">Qtr</span>
              <span>Question</span>
            </div>
            <div className="flex items-center gap-6">
              <span>Status</span>
              <span>Set outcome</span>
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

          {!loading && !error && filteredQuestions.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions for this filter. Try switching status or sponsor
              filter.
            </div>
          )}

          {!loading && !error && filteredQuestions.length > 0 && (
            <ul className="divide-y divide-white/10">
              {filteredQuestions.map(({ match, venue, question: q }) => {
                const canLock = q.status === "open";
                const canFinalise = q.status === "pending" || q.status === "open";
                const canReopen = q.status === "final" || q.status === "void";

                return (
                  <li
                    key={q.id}
                    className="px-4 py-3 flex items-center justify-between gap-4 text-sm bg-black/40"
                  >
                    {/* Left side: quarter + text */}
                    <div className="flex items-start gap-4">
                      <div className="w-10 text-xs font-semibold text-white/80">
                        Q{q.quarter}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {q.question}
                        </div>
                        <div className="text-[11px] text-white/50">
                          {match} • {venue}
                          {q.isSponsorQuestion && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-300/15 px-2 py-[2px] text-[10px] font-semibold text-yellow-300 border border-yellow-300/40">
                              Sponsor Question
                            </span>
                          )}
                        </div>
                        {q.correctOutcome && (
                          <div className="mt-1 text-[11px] text-sky-300">
                            {outcomeLabel(q)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: status + buttons */}
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={
                          "px-3 py-1 rounded-full text-xs font-semibold " +
                          statusBadgeClass(q.status)
                        }
                      >
                        {q.status.toUpperCase()}
                      </span>

                      <div className="flex flex-wrap justify-end gap-2 text-xs">
                        {/* YES */}
                        <button
                          disabled={!canFinalise || isBusy(q.id, "final_yes")}
                          onClick={() => sendAction(q.id, "final_yes")}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            canFinalise
                              ? "bg-emerald-500 text-black hover:bg-emerald-400"
                              : "bg-emerald-900/40 text-emerald-200/50 cursor-not-allowed"
                          } ${
                            isBusy(q.id, "final_yes") ? "opacity-70" : ""
                          }`}
                        >
                          YES
                        </button>

                        {/* NO */}
                        <button
                          disabled={!canFinalise || isBusy(q.id, "final_no")}
                          onClick={() => sendAction(q.id, "final_no")}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            canFinalise
                              ? "bg-red-500 text-black hover:bg-red-400"
                              : "bg-red-900/40 text-red-200/60 cursor-not-allowed"
                          } ${
                            isBusy(q.id, "final_no") ? "opacity-70" : ""
                          }`}
                        >
                          NO
                        </button>

                        {/* VOID */}
                        <button
                          disabled={!canFinalise || isBusy(q.id, "final_void")}
                          onClick={() => sendAction(q.id, "final_void")}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            canFinalise
                              ? "bg-slate-500 text-white hover:bg-slate-400"
                              : "bg-slate-900/40 text-slate-300/60 cursor-not-allowed"
                          } ${
                            isBusy(q.id, "final_void") ? "opacity-70" : ""
                          }`}
                        >
                          VOID
                        </button>

                        {/* LOCK */}
                        <button
                          disabled={!canLock || isBusy(q.id, "lock")}
                          onClick={() => sendAction(q.id, "lock")}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            canLock
                              ? "bg-amber-400 text-black hover:bg-amber-300"
                              : "bg-amber-900/40 text-amber-100/60 cursor-not-allowed"
                          } ${isBusy(q.id, "lock") ? "opacity-70" : ""}`}
                        >
                          LOCK
                        </button>

                        {/* REOPEN */}
                        <button
                          disabled={!canReopen || isBusy(q.id, "reopen")}
                          onClick={() => sendAction(q.id, "reopen")}
                          className={`px-3 py-1 rounded-full font-semibold ${
                            canReopen
                              ? "bg-white/10 text-white hover:bg-white/20"
                              : "bg-white/5 text-white/40 cursor-not-allowed"
                          } ${isBusy(q.id, "reopen") ? "opacity-70" : ""}`}
                        >
                          REOPEN
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
