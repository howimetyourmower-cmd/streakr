"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "pending" | "final" | "void";

type ApiQuestion = {
  id: string; // questionId e.g. "OR-G1-Q1"
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
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

type OutcomeAction = "lock" | "yes" | "no" | "void" | "reopen";

type SettlementRow = {
  questionId: string;
  roundNumber: number;
  gameId: string;
  match: string;
  venue: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
};

const DEFAULT_ROUND = 0; // 0 = Opening Round

export default function SettlementPage() {
  const { user, loading, isAdmin } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number>(DEFAULT_ROUND);
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | QuestionStatus>(
    "all"
  );
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  // Load questions for this round from /api/picks
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingData(true);
        setError(null);

        const res = await fetch(`/api/picks?round=${roundNumber}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load picks for settlement");
        }

        const apiData = data as PicksApiResponse;

        const flattened: SettlementRow[] = [];
        for (const game of apiData.games) {
          for (const q of game.questions) {
            flattened.push({
              questionId: q.id,
              roundNumber: apiData.roundNumber,
              gameId: game.id,
              match: game.match,
              venue: game.venue,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              sport: q.sport,
            });
          }
        }

        setRows(flattened);
      } catch (err: any) {
        console.error("[Settlement] load error", err);
        setError(err.message || "Failed to load questions for settlement");
      } finally {
        setLoadingData(false);
      }
    };

    if (!loading && user && isAdmin) {
      load();
    }
  }, [roundNumber, user, loading, isAdmin]);

  const handleSetOutcome = async (row: SettlementRow, action: OutcomeAction) => {
    try {
      setSubmittingKey(`${row.questionId}-${action}`);
      setError(null);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: row.questionId,
          action,
          roundNumber: row.roundNumber, // 🔹 pass roundNumber to backend
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[Settlement] POST error", data);
        alert(data.error || "Failed to update settlement");
        return;
      }

      const newStatus = data.status as QuestionStatus | undefined;

      if (newStatus) {
        setRows((prev) =>
          prev.map((r) =>
            r.questionId === row.questionId ? { ...r, status: newStatus } : r
          )
        );
      }
    } catch (err: any) {
      console.error("[Settlement] handleSetOutcome error", err);
      alert("Unexpected error updating settlement");
    } finally {
      setSubmittingKey(null);
    }
  };

  const filteredRows =
    statusFilter === "all"
      ? rows
      : rows.filter((r) => r.status === statusFilter);

  const statusClass = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-green-700 text-white";
      case "pending":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-black";
      case "final":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-blue-700 text-white";
      case "void":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-gray-600 text-white";
      default:
        return "px-3 py-1 rounded-full text-xs font-semibold bg-gray-600 text-white";
    }
  };

  const outcomeButtonClass = (type: OutcomeAction) => {
    switch (type) {
      case "yes":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700";
      case "no":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white hover:bg-red-700";
      case "void":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-gray-600 text-white hover:bg-gray-700";
      case "lock":
        return "px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500";
      case "reopen":
      default:
        return "px-3 py-1 rounded-full text-xs font-semibold bg-slate-500 text-white hover:bg-slate-400";
    }
  };

  if (loading) {
    return <div className="p-6 text-white">Checking admin access…</div>;
  }

  if (!user || !isAdmin) {
    return <div className="p-6 text-white">Admins only.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 text-white">
      <h1 className="text-2xl font-bold mb-2">Settlement console</h1>
      <p className="text-sm text-gray-300 mb-4">
        Lock and settle questions. Uses <code>/api/picks</code> for data and{" "}
        <code>/api/settlement</code> for updates.{" "}
        <strong>Reopen</strong> is a safety net if you lock or settle the wrong
        question.
      </p>

      {/* Round selector */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <span>Round:</span>
        <select
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
          value={roundNumber}
          onChange={(e) => setRoundNumber(Number(e.target.value))}
        >
          <option value={0}>Opening Round (OR)</option>
          <option value={1}>Round 1</option>
          <option value={2}>Round 2</option>
          <option value={3}>Round 3</option>
          {/* add more as needed */}
        </select>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-4 text-sm">
        {["open", "pending", "final", "void", "all"].map((f) => {
          const key = f as "open" | "pending" | "final" | "void" | "all";
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                isActive
                  ? "bg-orange-500 border-orange-500 text-black"
                  : "bg-slate-800 border-slate-600 text-gray-200"
              }`}
            >
              {key.toUpperCase()}
            </button>
          );
        })}
      </div>

      {loadingData && (
        <p className="text-sm text-gray-300 mb-2">Loading questions…</p>
      )}
      {error && (
        <p className="text-sm text-red-400 mb-2">Error: {error}</p>
      )}

      {/* Table */}
      <div className="w-full border border-slate-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1.8fr,0.5fr,3fr,1fr,2.4fr] gap-2 px-4 py-2 bg-slate-900 text-xs font-semibold text-gray-300">
          <div>Match</div>
          <div>Qtr</div>
          <div>Question</div>
          <div>Status</div>
          <div className="text-right pr-4">Set outcome</div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredRows.map((row) => {
            const key = row.questionId;
            const canReopen = row.status !== "open";

            return (
              <div
                key={key}
                className="grid grid-cols-[1.8fr,0.5fr,3fr,1fr,2.4fr] gap-2 px-4 py-3 items-center text-sm bg-slate-900/60 hover:bg-slate-900"
              >
                <div>
                  <div className="font-semibold text-white">
                    {row.match}
                  </div>
                  <div className="text-xs text-gray-400">
                    {row.venue}
                  </div>
                </div>
                <div className="text-xs font-semibold">Q{row.quarter}</div>
                <div className="text-xs text-gray-100">{row.question}</div>
                <div>
                  <span className={statusClass(row.status)}>
                    {row.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  {(["yes", "no", "void", "lock"] as OutcomeAction[]).map(
                    (action) => {
                      const keyAction = `${key}-${action}`;
                      const isBusy = submittingKey === keyAction;
                      const label =
                        action === "yes"
                          ? "YES"
                          : action === "no"
                          ? "NO"
                          : action === "void"
                          ? "VOID"
                          : "LOCK";

                      return (
                        <button
                          key={action}
                          disabled={isBusy}
                          onClick={() => handleSetOutcome(row, action)}
                          className={`${outcomeButtonClass(
                            action
                          )} disabled:opacity-50 disabled:cursor-not-allowed text-xs`}
                        >
                          {label}
                        </button>
                      );
                    }
                  )}

                  {/* REOPEN button */}
                  <button
                    disabled={!canReopen || submittingKey === `${key}-reopen`}
                    onClick={() => handleSetOutcome(row, "reopen")}
                    className={`${outcomeButtonClass(
                      "reopen"
                    )} disabled:opacity-40 disabled:cursor-not-allowed text-xs`}
                  >
                    REOPEN
                  </button>
                </div>
              </div>
            );
          })}

          {filteredRows.length === 0 && !loadingData && (
            <div className="px-4 py-4 text-xs text-gray-400">
              No questions match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
