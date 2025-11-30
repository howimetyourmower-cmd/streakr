// /app/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "pending" | "final" | "void";
type QuestionOutcome = "yes" | "no" | "void";

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

type RoundKey = (typeof ROUND_OPTIONS)[number]["key"];
type StatusFilter = QuestionStatus | "all";

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

// Map "OR" / "R1" / "R2" → numeric roundNumber for APIs
function roundKeyToNumber(key: RoundKey): number {
  if (key === "OR") return 0;
  const m = key.match(/^R(\d+)$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Nicely formatted start time for each game row
function formatStartTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettlementPage() {
  // Round is keyed by "OR", "R1", "R2"...
  const [roundKey, setRoundKey] = useState<RoundKey>("OR");
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);

  const roundNumberForApi = useMemo(
    () => roundKeyToNumber(roundKey),
    [roundKey]
  );

  const roundLabel = useMemo(() => {
    const match = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return match ? match.label : "Round";
  }, [roundKey]);

  // Fetch picks for the selected round
  const loadPicks = async (roundKeyParam: RoundKey) => {
    try {
      setLoading(true);
      setError(null);

      const roundNum = roundKeyToNumber(roundKeyParam);

      const res = await fetch(`/api/picks?round=${roundNum}`, {
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

  // Initial load + whenever round changes
  useEffect(() => {
    loadPicks(roundKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey]);

  // Call settlement API, then reload picks so UI updates automatically
  const handleSettlementAction = async (
    questionId: string,
    action: SettlementAction
  ) => {
    try {
      setSavingQuestionId(questionId);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber: roundNumberForApi,
          questionId,
          action,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("[Settlement] API error:", json);
        alert(json.error || "Failed to update settlement.");
        return;
      }

      // 👇 THIS is the important bit:
      // After any lock / reopen / final action, pull fresh data
      await loadPicks(roundKey);
    } catch (err: any) {
      console.error("[Settlement] handleSettlementAction error", err);
      alert(err?.message || "Failed to update settlement.");
    } finally {
      setSavingQuestionId(null);
    }
  };

  // Flatten all questions for filtering + display
  const allQuestions = useMemo(() => {
    const rows: {
      gameId: string;
      match: string;
      venue: string;
      startTime: string;
      question: ApiQuestion;
    }[] = [];

    for (const g of games) {
      for (const q of g.questions) {
        rows.push({
          gameId: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          question: q,
        });
      }
    }

    return rows;
  }, [games]);

  const filteredQuestions = useMemo(() => {
    if (statusFilter === "all") return allQuestions;
    return allQuestions.filter((row) => row.question.status === statusFilter);
  }, [allQuestions, statusFilter]);

  const statusChipClasses = (status: QuestionStatus) => {
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
        return "bg-slate-500 text-white";
    }
  };

  const filterButtonClasses = (value: StatusFilter) =>
    `px-3 py-1 rounded-full text-xs font-semibold border ${
      statusFilter === value
        ? "bg-orange-500 text-black border-orange-400"
        : "bg-black/40 text-white/80 border-white/20 hover:bg-white/10"
    }`;

  const outcomeLabel = (q: ApiQuestion) => {
    if (!q.correctOutcome) return "";
    if (q.correctOutcome === "void") return "VOID";
    return q.correctOutcome.toUpperCase();
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
            <p className="mt-2 text-sm text-white/70 max-w-2xl">
              Lock questions before bounce, then settle them as the game
              finishes. Reopen is a safety net if you lock or settle the wrong
              question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Current round
            </span>
            <select
              value={roundKey}
              onChange={(e) => setRoundKey(e.target.value as RoundKey)}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-white/60">
              AFL Season {CURRENT_SEASON} • {roundLabel}
            </span>
          </div>
        </header>

        {/* Status filter strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <span className="text-white/70 mr-3 font-semibold">
            Sponsor question
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={filterButtonClasses("all")}
          >
            ALL
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={filterButtonClasses("open")}
          >
            OPEN
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={filterButtonClasses("pending")}
          >
            PENDING
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("final")}
            className={filterButtonClasses("final")}
          >
            FINAL
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("void")}
            className={filterButtonClasses("void")}
          >
            VOID
          </button>
        </div>

        {/* Table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Header row */}
          <div className="px-4 py-3 border-b border-white/10 grid grid-cols-[0.7fr_3fr_1fr_2.5fr_2.4fr] text-[11px] uppercase tracking-wide text-white/60 bg-black/80 gap-2">
            <span>Start</span>
            <span>Question</span>
            <span className="text-center">Qtr</span>
            <span className="text-center">Status</span>
            <span className="text-center">Set outcome</span>
          </div>

          {/* Loading / error / empty */}
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
              No questions found for this round / filter.
            </div>
          )}

          {!loading && !error && filteredQuestions.length > 0 && (
            <div className="divide-y divide-white/10">
              {filteredQuestions.map(({ match, venue, startTime, question }) => {
                const isSaving = savingQuestionId === question.id;
                return (
                  <div
                    key={question.id}
                    className="px-4 py-3 grid grid-cols-[0.7fr_3fr_1fr_2.5fr_2.4fr] gap-2 items-center text-sm bg-black/40"
                  >
                    {/* Start time + match */}
                    <div className="text-xs text-white/80">
                      <div>{formatStartTime(startTime)}</div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        {match}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {venue}
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-white">
                        {question.question}
                      </div>
                      {question.isSponsorQuestion && (
                        <span className="inline-flex w-fit items-center rounded-full bg-yellow-400/20 px-2 py-[2px] text-[10px] font-semibold text-yellow-300 border border-yellow-400/60">
                          Sponsor question
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
                        <span>Yes: {question.yesPercent ?? 0}%</span>
                        <span>No: {question.noPercent ?? 0}%</span>
                        <span>Comments: {question.commentCount ?? 0}</span>
                        {question.correctOutcome && (
                          <span className="font-semibold text-emerald-300">
                            Result: {outcomeLabel(question)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quarter */}
                    <div className="text-center text-sm font-semibold text-white/90">
                      Q{question.quarter}
                    </div>

                    {/* Status pill */}
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusChipClasses(
                          question.status
                        )}`}
                      >
                        {question.status.toUpperCase()}
                      </span>
                      {question.status === "pending" && (
                        <span className="text-[10px] text-white/50">
                          Locked – waiting result
                        </span>
                      )}
                      {question.status === "final" && (
                        <span className="text-[10px] text-white/60">
                          Settled
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap justify-center gap-2 text-xs">
                      {/* YES / NO / VOID only when pending or open */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          handleSettlementAction(question.id, "final_yes")
                        }
                        className="px-3 py-1 rounded-full bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-60"
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          handleSettlementAction(question.id, "final_no")
                        }
                        className="px-3 py-1 rounded-full bg-red-500 text-black font-semibold hover:bg-red-400 disabled:opacity-60"
                      >
                        NO
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          handleSettlementAction(question.id, "final_void")
                        }
                        className="px-3 py-1 rounded-full bg-slate-500 text-white font-semibold hover:bg-slate-400 disabled:opacity-60"
                      >
                        VOID
                      </button>
                      {/* LOCK */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          handleSettlementAction(question.id, "lock")
                        }
                        className="px-3 py-1 rounded-full bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-60"
                      >
                        LOCK
                      </button>
                      {/* REOPEN */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          handleSettlementAction(question.id, "reopen")
                        }
                        className="px-3 py-1 rounded-full bg-sky-500 text-black font-semibold hover:bg-sky-400 disabled:opacity-60"
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

        <p className="text-xs text-white/60">
          Changes are pushed to picks and leaderboards automatically via
          <code className="mx-1 bg-white/10 px-1 rounded">
            /api/picks
          </code>{" "}
          and <code className="mx-1 bg-white/10 px-1 rounded">/api/settlement</code>. If
          something doesn&apos;t look right, double-check the question status or
          reopen and settle again.
        </p>
      </section>
    </main>
  );
}
