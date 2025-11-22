"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { QuestionStatus } from "@/types/questions"; // if you don't have this, see note below
import clsx from "clsx";

type Outcome = "yes" | "no";

type ActionType = "lock" | "settle" | "void" | "reopen";

type ApiQuestion = {
  id: string;                // e.g. "sydney-vs-carlton-q1-1"
  gameId: string;            // optional – keep if you already use it
  match: string;             // "Sydney vs Carlton"
  venue: string;             // "SCG, Sydney"
  startTime: string;         // ISO string
  quarter: number;           // 1–4
  question: string;          // full text
  status: QuestionStatus;    // "open" | "pending" | "final" | "void"
  sport: string;             // "AFL"
};

type SettlementApiResponse = {
  questions: ApiQuestion[];
  roundKey: string;   // "OR", "R1" etc
  roundLabel: string; // "Opening Round", "Round 1" etc
};

function formatKickoff(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { date: "-", time: "-" };

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

export default function SettlementPage() {
  const { user, loading: authLoading } = useAuth();

  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [roundLabel, setRoundLabel] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Fetch questions for current round from API
  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settlement?round=current", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const json: SettlementApiResponse = await res.json();
        setQuestions(json.questions);
        setRoundLabel(json.roundLabel);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load questions");
      } finally {
        setDataLoading(false);
      }
    };

    load();
  }, []);

  const filteredQuestions =
    statusFilter === "all"
      ? questions
      : questions.filter((q) => q.status === statusFilter);

  async function handleAction(
    q: ApiQuestion,
    action: ActionType,
    outcome?: Outcome
  ) {
    try {
      setSubmittingId(q.id);
      setError(null);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          action,
          outcome: outcome ?? null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Settlement API error: ${res.status}`);
      }

      // Optimistic UI update
      setQuestions((prev) =>
        prev.map((item) => {
          if (item.id !== q.id) return item;

          if (action === "lock") {
            return { ...item, status: "pending" as QuestionStatus };
          }

          if (action === "void") {
            return { ...item, status: "void" as QuestionStatus };
          }

          if (action === "reopen") {
            return { ...item, status: "open" as QuestionStatus };
          }

          if (action === "settle") {
            return { ...item, status: "final" as QuestionStatus };
          }

          return item;
        })
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Something went wrong");
    } finally {
      setSubmittingId(null);
    }
  }

  if (authLoading || dataLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">
          Settlement console
        </h1>
        <p className="text-sm text-slate-300">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">
          Settlement console
        </h1>
        <p className="text-sm text-slate-300">
          You must be logged in to access the admin settlement console.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settlement console</h1>
          <p className="mt-1 text-sm text-slate-300">
            Internal tool to lock and settle STREAKr questions for{" "}
            <span className="font-semibold text-orange-300">
              {roundLabel || "current round"}
            </span>
            . Use carefully – these actions update player streaks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Filter by status
          </span>
          <div className="flex overflow-hidden rounded-full bg-slate-800/70">
            {(["open", "pending", "final", "void", "all"] as const).map(
              (status) => (
                <button
                  key={status}
                  onClick={() =>
                    setStatusFilter(
                      status === "all" ? "all" : (status as QuestionStatus)
                    )
                  }
                  className={clsx(
                    "px-3 py-1 text-xs font-semibold",
                    statusFilter === status
                      ? "bg-orange-500 text-slate-900"
                      : "text-slate-300"
                  )}
                >
                  {status.toUpperCase()}
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="rounded-2xl bg-slate-900/60 shadow-lg ring-1 ring-slate-800/80">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
          <span>
            Showing {filteredQuestions.length} question
            {filteredQuestions.length === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-slate-300">
            LOCK / SETTLE / VOID / REOPEN
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">Qtr</th>
                <th className="px-4 py-3 text-left">Match</th>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-400"
                  >
                    No questions found for this filter.
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q) => {
                  const kickoff = formatKickoff(q.startTime);
                  return (
                    <tr
                      key={q.id}
                      className="border-t border-slate-800/70 odd:bg-slate-900/40 even:bg-slate-900/20"
                    >
                      <td className="px-4 py-3 align-top text-xs text-slate-300">
                        <div className="font-semibold text-slate-100">
                          {kickoff.date}
                        </div>
                        <div className="text-xs text-slate-300">
                          {kickoff.time} AEDT
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-xs font-semibold text-slate-100">
                        Q{q.quarter}
                      </td>

                      <td className="px-4 py-3 align-top text-xs text-slate-200">
                        <div className="font-semibold">{q.match}</div>
                        <div className="text-[11px] text-slate-400">
                          {q.venue}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-sm text-slate-100">
                        {q.question}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <span
                          className={clsx(
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            q.status === "open" && "bg-emerald-500/15 text-emerald-300",
                            q.status === "pending" && "bg-amber-500/15 text-amber-300",
                            q.status === "final" && "bg-sky-500/15 text-sky-300",
                            q.status === "void" && "bg-slate-600/40 text-slate-200"
                          )}
                        >
                          {q.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">

                          {/* Lock */}
                          <button
                            disabled={
                              submittingId === q.id || q.status !== "open"
                            }
                            onClick={() => handleAction(q, "lock")}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/90 text-slate-900 disabled:opacity-40"
                          >
                            Lock
                          </button>

                          {/* Settle YES */}
                          <button
                            disabled={
                              submittingId === q.id ||
                              (q.status !== "pending" && q.status !== "open")
                            }
                            onClick={() => handleAction(q, "settle", "yes")}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500 text-slate-900 disabled:opacity-40"
                          >
                            Settle YES
                          </button>

                          {/* Settle NO */}
                          <button
                            disabled={
                              submittingId === q.id ||
                              (q.status !== "pending" && q.status !== "open")
                            }
                            onClick={() => handleAction(q, "settle", "no")}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-rose-500 text-slate-50 disabled:opacity-40"
                          >
                            Settle NO
                          </button>

                          {/* Void */}
                          <button
                            disabled={submittingId === q.id}
                            onClick={() => handleAction(q, "void")}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-600 text-slate-50 disabled:opacity-40"
                          >
                            Void
                          </button>

                          {/* Reopen */}
                          <button
                            disabled={submittingId === q.id}
                            onClick={() => handleAction(q, "reopen")}
                            className="rounded-full px-3 py-1 text-xs font-semibold bg-blue-500 text-slate-900 disabled:opacity-40"
                          >
                            Reopen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
