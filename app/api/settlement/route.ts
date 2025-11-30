// /app/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS } from "@/lib/rounds";

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

type QuestionRow = ApiQuestion & {
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
};

type StatusFilter = "all" | "open" | "pending" | "final" | "void";

/** Map a round key like "OR", "R1", "R2" → numeric roundNumber used by /api/picks */
function roundKeyToNumber(key: string): number {
  if (key === "OR") return 0;
  const match = key.match(/^R(\d+)$/i);
  if (match) {
    const n = Number(match[1]);
    if (!Number.isNaN(n) && n >= 1) return n;
  }
  // fallback
  return 0;
}

export default function SettlementPage() {
  const [roundKey, setRoundKey] = useState<string>(ROUND_OPTIONS[0].key);
  const [roundNumber, setRoundNumber] = useState<number>(
    roundKeyToNumber(ROUND_OPTIONS[0].key)
  );

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  // Load questions whenever roundKey changes
  useEffect(() => {
    const num = roundKeyToNumber(roundKey);
    setRoundNumber(num);

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/picks?round=${num}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Failed to load picks: ${res.status}`);
        }
        const data: PicksApiResponse = await res.json();
        const allRows: QuestionRow[] = [];

        data.games.forEach((g) => {
          g.questions.forEach((q) => {
            allRows.push({
              ...q,
              gameId: g.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
            });
          });
        });

        setRows(allRows);
      } catch (err) {
        console.error("Settlement load error", err);
        setError("Failed to load questions for this round.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [roundKey]);

  const roundLabel = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found ? found.label : "Round";
  }, [roundKey]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  async function callSettlement(
    question: QuestionRow,
    action:
      | "lock"
      | "reopen"
      | "final_yes"
      | "final_no"
      | "final_void"
  ) {
    setSavingId(question.id);
    setError(null);
    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId: question.id,
          action,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Settlement error: ${res.status} ${text}`);
      }

      // Update local state based on action so UI responds immediately
      setRows((prev) =>
        prev.map((q) => {
          if (q.id !== question.id) return q;

          if (action === "lock") {
            return { ...q, status: "pending" };
          }

          if (action === "reopen") {
            // 👇 THIS is the important bit – clear status & correctOutcome
            const { correctOutcome, ...rest } = q;
            return {
              ...rest,
              status: "open",
              correctOutcome: undefined,
            };
          }

          if (action === "final_yes") {
            return { ...q, status: "final", correctOutcome: "yes" };
          }
          if (action === "final_no") {
            return { ...q, status: "final", correctOutcome: "no" };
          }
          if (action === "final_void") {
            return { ...q, status: "void", correctOutcome: "void" };
          }
          return q;
        })
      );
    } catch (err) {
      console.error(err);
      setError("Failed to update that question. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  function statusBadge(status: QuestionStatus) {
    const base =
      "inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide";
    switch (status) {
      case "open":
        return `${base} bg-emerald-600/15 text-emerald-300 border border-emerald-500/40`;
      case "pending":
        return `${base} bg-amber-500/15 text-amber-300 border border-amber-400/40`;
      case "final":
        return `${base} bg-sky-600/15 text-sky-300 border border-sky-500/40`;
      case "void":
      default:
        return `${base} bg-slate-600/15 text-slate-200 border border-slate-400/40`;
    }
  }

  function outcomeLabel(row: QuestionRow) {
    if (!row.correctOutcome) return "";
    if (row.correctOutcome === "void") return "Void";
    return row.correctOutcome === "yes" ? "YES correct" : "NO correct";
  }

  const isBusy = (id: string) => savingId === id;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement centre
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Lock questions, mark the correct outcome, or reopen if you
              made a mistake. Reopen is a safety net – it clears the result
              and returns the question to OPEN.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Round
            </span>
            <select
              value={roundKey}
              onChange={(e) => setRoundKey(e.target.value)}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Meta strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              Settlement • {roundLabel}
            </span>
            <span className="text-white/80">
              Click{" "}
              <span className="font-semibold text-amber-300">
                Lock
              </span>{" "}
              to freeze picks, then{" "}
              <span className="font-semibold text-sky-300">
                YES / NO / VOID
              </span>{" "}
              when you know the result.{" "}
              <span className="font-semibold text-white">
                Reopen
              </span>{" "}
              sends the question back to OPEN.
            </span>
          </div>
        </div>

        {/* Status filter row */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(["all", "open", "pending", "final", "void"] as StatusFilter[]).map(
            (s) => {
              const label =
                s === "all"
                  ? "All"
                  : s.charAt(0).toUpperCase() + s.slice(1);
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1 border ${
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

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wide text-white/60 grid grid-cols-[minmax(0,3fr)_auto_auto_auto] gap-4">
            <span>Question</span>
            <span className="text-center">Quarter</span>
            <span className="text-center">Status</span>
            <span className="text-center">Set outcome</span>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading questions…
            </div>
          )}

          {!loading && filteredRows.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions for this filter.
            </div>
          )}

          {!loading && filteredRows.length > 0 && (
            <div className="divide-y divide-white/10">
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className="px-4 py-3 text-sm grid grid-cols-[minmax(0,3fr)_auto_auto_auto] gap-4 items-center bg-black/40"
                >
                  {/* Question text */}
                  <div>
                    <div className="font-semibold text-white">
                      {row.question}
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5">
                      {row.match} • {row.venue}
                    </div>
                    {row.correctOutcome && (
                      <div className="mt-1 text-[11px] text-sky-300">
                        Outcome: {outcomeLabel(row)}
                      </div>
                    )}
                  </div>

                  {/* Quarter */}
                  <div className="text-center text-xs">
                    Q{row.quarter}
                  </div>

                  {/* Status badge */}
                  <div className="text-center">
                    <span className={statusBadge(row.status)}>
                      {row.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-wrap justify-center gap-1 text-[11px]">
                    <button
                      disabled={
                        row.status !== "open" || isBusy(row.id)
                      }
                      onClick={() => callSettlement(row, "lock")}
                      className="px-3 py-1 rounded-full bg-amber-500/90 text-black font-semibold disabled:opacity-40"
                    >
                      Lock
                    </button>
                    <button
                      disabled={
                        (row.status !== "pending" &&
                          row.status !== "open") ||
                        isBusy(row.id)
                      }
                      onClick={() => callSettlement(row, "final_yes")}
                      className="px-3 py-1 rounded-full bg-emerald-500/90 text-black font-semibold disabled:opacity-40"
                    >
                      YES
                    </button>
                    <button
                      disabled={
                        (row.status !== "pending" &&
                          row.status !== "open") ||
                        isBusy(row.id)
                      }
                      onClick={() => callSettlement(row, "final_no")}
                      className="px-3 py-1 rounded-full bg-red-500/90 text-black font-semibold disabled:opacity-40"
                    >
                      NO
                    </button>
                    <button
                      disabled={
                        (row.status !== "pending" &&
                          row.status !== "open") ||
                        isBusy(row.id)
                      }
                      onClick={() => callSettlement(row, "final_void")}
                      className="px-3 py-1 rounded-full bg-slate-400 text-black font-semibold disabled:opacity-40"
                    >
                      VOID
                    </button>
                    <button
                      disabled={isBusy(row.id)}
                      onClick={() => callSettlement(row, "reopen")}
                      className="px-3 py-1 rounded-full bg-slate-700 text-white font-semibold disabled:opacity-40"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
