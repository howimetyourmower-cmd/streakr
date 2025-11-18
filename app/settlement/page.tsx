"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";
type Outcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = { games: ApiGame[] };

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

export default function SettlementPage() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingRowId, setWorkingRowId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // --- Helpers ---
  const formatStart = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    });
  };

  const statusColour = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "bg-green-600";
      case "pending":
        return "bg-yellow-500";
      case "final":
        return "bg-gray-600";
      case "void":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  // --- Load current questions from existing picks API ---
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      setMessage(null);

      try {
        const res = await fetch("/api/picks");
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data: PicksApiResponse = await res.json();

        const flat: QuestionRow[] = data.games.flatMap((g) =>
          (g.questions || []).map((q) => ({
            id: q.id,
            gameId: g.id,
            match: g.match,
            venue: g.venue,
            startTime: g.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
          }))
        );

        // Sort: open first, then pending, then final/void, then by start time
        flat.sort((a, b) => {
          const order: Record<QuestionStatus, number> = {
            open: 0,
            pending: 1,
            final: 2,
            void: 3,
          };
          const diff = order[a.status] - order[b.status];
          if (diff !== 0) return diff;
          return a.startTime.localeCompare(b.startTime);
        });

        setRows(flat);
      } catch (err) {
        console.error("Failed to load questions for settlement", err);
        setError("Failed to load questions. Check /api/picks and try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // --- LOCK / UNLOCK ---
  const lockQuestion = async (
    row: QuestionRow,
    action: "lock" | "unlock"
  ) => {
    const confirmText =
      action === "lock"
        ? `Lock this question (no more picks)?\n\n"${row.question}"`
        : `Re-open this question for picks?\n\n"${row.question}"`;

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    setMessage(null);
    setError("");
    setWorkingRowId(row.id);

    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: row.id,
          action,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          payload?.error ||
          `Lock action failed (${res.status})`;
        throw new Error(msg);
      }

      const payload = await res.json();
      console.log("Lock/unlock response", payload);

      const newStatus: QuestionStatus =
        action === "lock" ? "pending" : "open";

      setRows((prev) =>
        prev.map((q) =>
          q.id === row.id
            ? {
                ...q,
                status: newStatus,
              }
            : q
        )
      );

      setMessage(
        action === "lock"
          ? `Locked question: "${row.question}"`
          : `Re-opened question: "${row.question}"`
      );
    } catch (err: any) {
      console.error("Error locking/unlocking question", err);
      setError(err?.message || "Failed to update lock status.");
    } finally {
      setWorkingRowId(null);
    }
  };

  // --- SETTLE ---
  const settleQuestion = async (row: QuestionRow, outcome: Outcome) => {
    const confirmText =
      outcome === "void"
        ? `Void this question?\n\n"${row.question}"`
        : `Settle this question as '${outcome.toUpperCase()}'?\n\n"${row.question}"`;

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    setMessage(null);
    setError("");
    setWorkingRowId(row.id);

    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: row.id,
          outcome,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          payload?.error ||
          `Settlement failed (${res.status})`;
        throw new Error(msg);
      }

      const payload = await res.json();
      console.log("Settlement response", payload);

      const newStatus: QuestionStatus =
        outcome === "void" ? "void" : "final";

      setRows((prev) =>
        prev.map((q) =>
          q.id === row.id
            ? {
                ...q,
                status: newStatus,
              }
            : q
        )
      );

      setMessage(
        `Settled: "${row.question}" → ${outcome.toUpperCase()} (updated ${
          payload.picksUpdated ?? 0
        } picks)`
      );
    } catch (err: any) {
      console.error("Error settling question", err);
      setError(err?.message || "Failed to settle question.");
    } finally {
      setWorkingRowId(null);
    }
  };

  // --- Render ---
  if (!user) {
    return (
      <div className="py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Settlement (admin)</h1>
        <p className="text-sm text-white/70">
          You must be logged in to use the settlement console.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8 space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settlement console</h1>
        <p className="mt-1 text-sm text-white/70 max-w-2xl">
          Internal tool to lock and settle Streakr questions. This calls{" "}
          <code className="px-1 py-0.5 bg-black/40 rounded text-xs">
            /api/settlement
          </code>{" "}
          and updates picks and question status. Use carefully.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-white/70">Loading questions…</p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {!loading && message && (
        <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
          {message}
        </p>
      )}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-white/70">
          No questions found. Check that your <code>rounds</code> collection for
          the 2026 season has games and questions.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-semibold text-orange-300">
              Questions to settle
            </div>
            <div className="text-[11px] text-gray-400">
              Showing {rows.length} questions
            </div>
          </div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[160px,minmax(0,1.3fr),60px,minmax(0,2fr),140px] px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wide bg-black/40">
            <div>Start</div>
            <div>Match</div>
            <div className="text-center">Q#</div>
            <div>Question</div>
            <div className="text-right">Lock / Settle</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {rows.map((row) => {
              const start = formatStart(row.startTime);
              const isWorking = workingRowId === row.id;

              return (
                <div
                  key={row.id}
                  className="px-4 py-3 flex flex-col gap-3 md:grid md:grid-cols-[160px,minmax(0,1.3fr),60px,minmax(0,2fr),140px] md:items-center bg-black/20 hover:bg-black/30 transition"
                >
                  {/* Start time + status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-white/90">
                      {start || "TBD"}
                    </span>
                    <span
                      className={`inline-flex w-max items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColour(
                        row.status
                      )}`}
                    >
                      {row.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Match + venue */}
                  <div>
                    <div className="text-sm font-semibold">
                      {row.match || "Match"}
                    </div>
                    <div className="text-[11px] text-white/70">
                      {row.venue || "Venue"}
                    </div>
                    <div className="md:hidden mt-1 flex items-center gap-1 text-[11px] text-white/60">
                      <span>{start || "TBD"}</span>
                    </div>
                  </div>

                  {/* Q# */}
                  <div className="md:text-center text-sm font-bold">
                    Q{row.quarter}
                  </div>

                  {/* Question text */}
                  <div className="text-sm leading-snug">
                    {row.question}
                    <div className="mt-1 text-[11px] text-white/50 break-all">
                      <span className="font-mono text-white/60">
                        ID: {row.id}
                      </span>
                    </div>
                  </div>

                  {/* Lock / Settle buttons */}
                  <div className="flex md:flex-col items-end md:items-end gap-1">
                    {/* Lock / Unlock */}
                    {row.status === "open" && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => lockQuestion(row, "lock")}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold text-white w-24 text-center ${
                          isWorking
                            ? "bg-yellow-700/70 opacity-70"
                            : "bg-yellow-500 hover:bg-yellow-600 text-black"
                        }`}
                      >
                        {isWorking ? "Working…" : "Lock"}
                      </button>
                    )}

                    {row.status === "pending" && (
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => lockQuestion(row, "unlock")}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold text-white w-24 text-center ${
                          isWorking
                            ? "bg-gray-700/70 opacity-70"
                            : "bg-gray-600 hover:bg-gray-500"
                        }`}
                      >
                        {isWorking ? "Working…" : "Re-open"}
                      </button>
                    )}

                    {/* Settle */}
                    <div className="flex md:flex-col items-end gap-1">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => settleQuestion(row, "yes")}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold text-white w-24 text-center ${
                          isWorking
                            ? "bg-green-900/70 opacity-70"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {isWorking ? "Working…" : "Settle YES"}
                      </button>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => settleQuestion(row, "no")}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold text-white w-24 text-center ${
                          isWorking
                            ? "bg-red-900/70 opacity-70"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {isWorking ? "Working…" : "Settle NO"}
                      </button>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => settleQuestion(row, "void")}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold text-white w-24 text-center ${
                          isWorking
                            ? "bg-gray-800/80 opacity-70"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                      >
                        {isWorking ? "Working…" : "Void"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
