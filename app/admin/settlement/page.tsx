"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import clsx from "clsx";
import type { QuestionStatus, ApiGame } from "@/types/questions";

type Outcome = "yes" | "no" | "void" | "lock";

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
};

type FilterStatus = QuestionStatus | "all";

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
  roundKey: string;
};

export default function SettlementPage() {
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("open");
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      try {
        setIsLoadingRows(true);
        setError(null);

        const res = await fetch("/api/picks");
        if (!res.ok) {
          throw new Error(`Failed to load picks: ${res.status}`);
        }

        const data: PicksApiResponse = await res.json();

        const flattened: QuestionRow[] =
          data.games.flatMap((game) =>
            game.questions.map((q) => ({
              id: q.id,
              gameId: game.id,
              match: game.match,
              venue: game.venue,
              startTime: game.startTime,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              sport: q.sport,
            }))
          ) ?? [];

        // Sort by start time then quarter
        flattened.sort((a, b) => {
          if (a.startTime < b.startTime) return -1;
          if (a.startTime > b.startTime) return 1;
          return a.quarter - b.quarter;
        });

        setRows(flattened);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load questions");
      } finally {
        setIsLoadingRows(false);
      }
    }

    loadQuestions();
  }, []);

  const filteredRows =
    statusFilter === "all"
      ? rows
      : rows.filter((row) => row.status === statusFilter);

  if (loading || isLoadingRows) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-4">Settlement console</h1>
        <p>Loading questions…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-4">Settlement console</h1>
        <p>You must be an admin to view this page.</p>
      </main>
    );
  }

  const handleSetOutcome = (rowId: string, outcome: Outcome) => {
    // TODO: hook up to a real API route later
    // For now, keep it safe & front-end only
    // so we don't break builds.
    alert(`Would settle ${rowId} as ${outcome}. Backend still to wire up.`);
  };

  const statusTabs: { label: string; value: FilterStatus }[] = [
    { label: "Open", value: "open" },
    { label: "Pending", value: "pending" },
    { label: "Final", value: "final" },
    { label: "Void", value: "void" },
    { label: "All", value: "all" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 text-white">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Settlement console</h1>
        <p className="text-sm text-gray-300 max-w-2xl">
          Internal tool to lock and settle STREAKr questions for the current
          round. Use carefully – these actions update player streaks.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/60 border border-red-500 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-semibold border",
              statusFilter === tab.value
                ? "bg-orange-500 border-orange-400 text-black"
                : "bg-slate-800 border-slate-600 text-gray-200 hover:bg-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-slate-900/70 border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 border-b border-slate-700">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Start</th>
              <th className="px-4 py-3 font-semibold">Sport</th>
              <th className="px-4 py-3 font-semibold">Match</th>
              <th className="px-4 py-3 font-semibold">Qtr</th>
              <th className="px-4 py-3 font-semibold">Question</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Set outcome</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  No questions found for this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-800 hover:bg-slate-800/60"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-300">
                    {row.startTime}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold">
                    {row.sport}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">{row.match}</div>
                    <div className="text-gray-400">{row.venue}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    Q{row.quarter}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-md">
                    {row.question}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        row.status === "open" &&
                          "bg-green-900/60 text-green-300 border border-green-600/70",
                        row.status === "pending" &&
                          "bg-yellow-900/60 text-yellow-300 border border-yellow-600/70",
                        row.status === "final" &&
                          "bg-blue-900/60 text-blue-300 border border-blue-600/70",
                        row.status === "void" &&
                          "bg-slate-800 text-slate-200 border border-slate-500/70"
                      )}
                    >
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      {(["yes", "no", "void", "lock"] as Outcome[]).map(
                        (o) => (
                          <button
                            key={o}
                            type="button"
                            onClick={() => handleSetOutcome(row.id, o)}
                            className={clsx(
                              "px-2 py-1 rounded-full border text-[11px] font-semibold",
                              o === "yes" &&
                                "bg-green-800/70 border-green-500/80 text-green-100",
                              o === "no" &&
                                "bg-red-800/70 border-red-500/80 text-red-100",
                              o === "void" &&
                                "bg-slate-800 border-slate-500 text-slate-100",
                              o === "lock" &&
                                "bg-yellow-800/70 border-yellow-500/80 text-yellow-100"
                            )}
                          >
                            {o.toUpperCase()}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
