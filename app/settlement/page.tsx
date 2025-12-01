"use client";

import { useEffect, useMemo, useState } from "react";

type QuestionStatus = "open" | "pending" | "final" | "void";
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

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion: boolean;
  correctOutcome?: QuestionOutcome;
};

type FilterTab = "open" | "pending" | "final" | "void" | "all";

/** Simple round dropdown options just for this page */
const ROUND_OPTIONS_SIMPLE = [
  { value: 0, label: "Opening Round" },
  // R1–R24
  ...Array.from({ length: 24 }, (_, i) => ({
    value: i + 1,
    label: `Round ${i + 1}`,
  })),
];

export default function SettlementPage() {
  const [roundNumber, setRoundNumber] = useState<number>(0); // default Opening Round
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Label for header dropdown
  const roundLabel = useMemo(() => {
    const match = ROUND_OPTIONS_SIMPLE.find((r) => r.value === roundNumber);
    return match ? match.label : "Round";
  }, [roundNumber]);

  // Fetch questions for a round from /api/picks
  const loadRound = async (round: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/picks?round=${round}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`Failed to load picks: ${res.status}`);
      }
      const data: PicksApiResponse = await res.json();

      const rows: QuestionRow[] = [];
      for (const game of data.games) {
        for (const q of game.questions) {
          rows.push({
            id: q.id,
            gameId: game.id,
            match: game.match,
            venue: game.venue,
            startTime: game.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
            sport: q.sport,
            isSponsorQuestion: !!q.isSponsorQuestion,
            correctOutcome: q.correctOutcome,
          });
        }
      }

      setQuestions(rows);
    } catch (err: any) {
      console.error("Error loading round", err);
      setError(err?.message || "Failed to load questions.");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial + whenever roundNumber changes
  useEffect(() => {
    loadRound(roundNumber);
  }, [roundNumber]);

  // Filtered list for the table
  const filteredQuestions = useMemo(() => {
    if (filter === "all") return questions;
    return questions.filter((q) => q.status === filter);
  }, [questions, filter]);

  // Core helper to call /api/settlement with an action
  const sendSettlementAction = async (
    questionId: string,
    action:
      | "lock"
      | "reopen"
      | "final_yes"
      | "final_no"
      | "final_void"
      | "void"
  ) => {
    setSavingId(questionId);
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

      const json = await res.json();

      if (!res.ok) {
        console.error("/api/settlement error", json);
        alert(json.error || "Failed to update settlement");
        return;
      }

      // ✅ Re-load this round so status updates without manual refresh
      await loadRound(roundNumber);
    } catch (err: any) {
      console.error("Error calling /api/settlement", err);
      alert("Failed to update settlement, please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const handleLock = (q: QuestionRow) => {
    if (q.status === "pending") return;
    sendSettlementAction(q.id, "lock");
  };

  const handleReopen = (q: QuestionRow) => {
    if (q.status === "open") return;
    sendSettlementAction(q.id, "reopen");
  };

  const handleFinalYes = (q: QuestionRow) => {
    if (!confirm("Set FINAL outcome to YES for this question?")) return;
    sendSettlementAction(q.id, "final_yes");
  };

  const handleFinalNo = (q: QuestionRow) => {
    if (!confirm("Set FINAL outcome to NO for this question?")) return;
    sendSettlementAction(q.id, "final_no");
  };

  const handleFinalVoid = (q: QuestionRow) => {
    if (
      !confirm(
        "Set this question to VOID? This will not affect player streaks."
      )
    )
      return;
    sendSettlementAction(q.id, "final_void");
  };

  const statusChipClass = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "bg-emerald-600 text-white";
      case "pending":
        return "bg-amber-400 text-black";
      case "final":
        return "bg-sky-500 text-white";
      case "void":
        return "bg-slate-500 text-white";
      default:
        return "bg-slate-600 text-white";
    }
  };

  const isSaving = (q: QuestionRow) => savingId === q.id;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Settlement
            </h1>
            <p className="mt-2 text-sm text-slate-200 max-w-xl">
              Lock questions before bounce, then settle with the correct result.
              This page writes to <code>questionStatus</code> and updates
              player streaks. Reopen is a safety net if you lock or settle the
              wrong question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Round
            </span>
            <select
              value={roundNumber}
              onChange={(e) => setRoundNumber(Number(e.target.value))}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS_SIMPLE.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400">
              Currently editing: <span className="font-semibold">{roundLabel}</span>
            </span>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(["open", "final", "pending", "void", "all"] as FilterTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                  filter === tab
                    ? "bg-orange-500 text-black border-orange-400"
                    : "bg-black/40 text-slate-200 border-white/15 hover:bg-white/5"
                }`}
              >
                {tab === "all"
                  ? "All"
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Table */}
        <section className="rounded-2xl bg-black/80 border border-white/10 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Header row */}
          <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wide text-slate-300 grid grid-cols-[0.5fr_4fr_1fr_3fr] gap-2">
            <span>Qtr</span>
            <span>Question</span>
            <span>Status</span>
            <span className="text-right pr-4">Set outcome</span>
          </div>

          {/* States */}
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
            <div className="divide-y divide-white/8">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="px-4 py-3 grid grid-cols-[0.5fr_4fr_1fr_3fr] gap-2 items-center text-sm bg-black/40"
                >
                  <div className="text-xs text-slate-200">Q{q.quarter}</div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-50">
                      {q.question}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {q.match} • {q.venue}
                    </span>
                    {q.isSponsorQuestion && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-sky-500/15 border border-sky-400/60 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                        Sponsor question
                      </span>
                    )}
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${statusChipClass(
                        q.status
                      )}`}
                    >
                      {q.status.toUpperCase()}
                    </span>
                    {q.status === "final" && q.correctOutcome && (
                      <div className="mt-1 text-[11px] text-slate-300">
                        Result:{" "}
                        <span className="font-semibold">
                          {q.correctOutcome.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap justify-end gap-2">
                    {/* YES / NO / VOID – finalise */}
                    <button
                      onClick={() => handleFinalYes(q)}
                      disabled={isSaving(q)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
                    >
                      YES
                    </button>
                    <button
                      onClick={() => handleFinalNo(q)}
                      disabled={isSaving(q)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
                    >
                      NO
                    </button>
                    <button
                      onClick={() => handleFinalVoid(q)}
                      disabled={isSaving(q)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500 text-white hover:bg-slate-400 disabled:opacity-50"
                    >
                      VOID
                    </button>

                    {/* LOCK / REOPEN */}
                    <button
                      onClick={() => handleLock(q)}
                      disabled={isSaving(q) || q.status === "pending"}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50"
                    >
                      LOCK
                    </button>
                    <button
                      onClick={() => handleReopen(q)}
                      disabled={isSaving(q) || q.status === "open"}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                    >
                      REOPEN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-400">
          Uses <code>/api/picks</code> for data and{" "}
          <code>/api/settlement</code> for updates. Reopen is a safety net if
          you lock or settle the wrong question.
        </p>
      </section>
    </main>
  );
}
