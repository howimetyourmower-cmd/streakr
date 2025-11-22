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

const SEASON = 2026;

export default function SettlementPage() {
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | "all">(
    "open"
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roundInfo, setRoundInfo] = useState<string>("");

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) return;

    const load = async () => {
      try {
        setError(null);

        // Re-use the same API as the Picks page
        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: {
          games: ApiGame[];
          roundNumber: number;
          roundKey: string;
        } = await res.json();

        const list: QuestionRow[] = [];
        data.games.forEach((game) => {
          game.questions.forEach((q) => {
            list.push({
              id: q.id,
              gameId: game.id,
              match: game.match,
              venue: game.venue,
              startTime: game.startTime,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              sport: game.sport,
            });
          });
        });

        setRows(list);
        setRoundInfo(
          `Season ${SEASON} • Round ${data.roundNumber} (${data.roundKey || "no key"})`
        );
      } catch (err) {
        console.error("Failed to load settlement questions", err);
        setError("Failed to load questions for the current round.");
      }
    };

    load();
  }, [user, isAdmin, loading]);

  const filteredRows =
    filterStatus === "all"
      ? rows
      : rows.filter((q) => q.status === filterStatus);

  const handleAction = async (q: QuestionRow, outcome: Outcome) => {
    try {
      setBusyId(q.id);
      setError(null);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          outcome,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body: { status: QuestionStatus } = await res.json();

      // Update local status
      setRows((prev) =>
        prev.map((row) =>
          row.id === q.id ? { ...row, status: body.status } : row
        )
      );
    } catch (err) {
      console.error("Settlement error", err);
      setError("Failed to apply that action.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-white">Checking admin access…</div>;
  }

  if (!user || !isAdmin) {
    return <div className="p-6 text-white">Admins only.</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Settlement console</h1>
      <p className="mb-2 text-sm text-gray-300">
        Internal tool to lock and settle STREAKr questions for{" "}
        <span className="font-semibold">
          {roundInfo || "the current round"}
        </span>
        . Use carefully – these actions update player streaks.
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-700/80 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-2 text-sm">
        {(["open", "final", "pending", "void", "all"] as const).map((status) => (
          <button
            key={status}
            onClick={() =>
              setFilterStatus(
                status === "all" ? "all" : (status as QuestionStatus)
              )
            }
            className={clsx(
              "rounded-full px-3 py-1 font-semibold",
              filterStatus === status ||
                (status === "all" && filterStatus === "all")
                ? "bg-orange-500"
                : "bg-slate-700"
            )}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className="text-sm text-gray-300">
          No questions found for this filter.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">Sport</th>
              <th className="px-3 py-2 text-left">QTR</th>
              <th className="px-3 py-2 text-left">Match</th>
              <th className="px-3 py-2 text-left">Question</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Lock / Settle</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800">
                <td className="px-3 py-2">{row.startTime}</td>
                <td className="px-3 py-2">{row.sport}</td>
                <td className="px-3 py-2">Q{row.quarter}</td>
                <td className="px-3 py-2">{row.match}</td>
                <td className="px-3 py-2">{row.question}</td>
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      "rounded px-2 py-1 text-xs font-semibold",
                      row.status === "open" && "bg-green-700/70",
                      row.status === "final" && "bg-emerald-700/70",
                      row.status === "pending" && "bg-yellow-600/80",
                      row.status === "void" && "bg-slate-500/80"
                    )}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row, "lock")}
                    className="rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold disabled:opacity-60"
                  >
                    Lock
                  </button>
                  <button
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row, "yes")}
                    className="rounded-full bg-green-600 px-3 py-1 text-xs font-bold disabled:opacity-60"
                  >
                    Settle YES
                  </button>
                  <button
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row, "no")}
                    className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold disabled:opacity-60"
                  >
                    Settle NO
                  </button>
                  <button
                    disabled={busyId === row.id}
                    onClick={() => handleAction(row, "void")}
                    className="rounded-full bg-slate-500 px-3 py-1 text-xs font-bold disabled:opacity-60"
                  >
                    Void
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
