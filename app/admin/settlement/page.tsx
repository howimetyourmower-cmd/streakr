"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "pending" | "final" | "void";

type SettlementQuestion = {
  id: string;          // questionId
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  round?: number;
};

type OutcomeAction = "lock" | "yes" | "no" | "void";

export default function SettlementPage() {
  const { user, loading, isAdmin } = useAuth();
  const [questions, setQuestions] = useState<SettlementQuestion[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | QuestionStatus>(
    "all"
  );
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);

  // Load questions from /api/settlement
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingData(true);
        setError(null);
        const res = await fetch("/api/settlement");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load settlement data");
        }
        setQuestions(data.questions || []);
      } catch (err: any) {
        console.error("[Settlement] load error", err);
        setError(err.message || "Failed to load questions");
      } finally {
        setLoadingData(false);
      }
    };

    if (!loading && user && isAdmin) {
      load();
    }
  }, [user, loading, isAdmin]);

  const handleSetOutcome = async (q: SettlementQuestion, action: OutcomeAction) => {
    try {
      setSubmittingKey(`${q.id}-${action}`);
      setError(null);

      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: q.id,
          action,
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
        setQuestions((prev) =>
          prev.map((row) =>
            row.id === q.id ? { ...row, status: newStatus } : row
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

  const filtered = 
    statusFilter === "all"
      ? questions
      : questions.filter((q) => q.status === statusFilter);

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
      default:
        return "px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-black hover:bg-amber-500";
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
        Lock and settle questions for published rounds. These actions update
        user streaks and picks, and now also feed the Picks API via
        <code>questionStatus</code>.
      </p>

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

      <div className="w-full border border-slate-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1.8fr,0.5fr,3fr,1fr,2fr] gap-2 px-4 py-2 bg-slate-900 text-xs font-semibold text-gray-300">
          <div>Match</div>
          <div>Qtr</div>
          <div>Question</div>
          <div>Status</div>
          <div className="text-right pr-4">Set outcome</div>
        </div>

        <div className="divide-y divide-slate-800">
          {filtered.map((q) => {
            const key = q.id;
            return (
              <div
                key={key}
                className="grid grid-cols-[1.8fr,0.5fr,3fr,1fr,2fr] gap-2 px-4 py-3 items-center text-sm bg-slate-900/60 hover:bg-slate-900"
              >
                <div>
                  <div className="font-semibold text-white">
                    {q.match}
                  </div>
                  <div className="text-xs text-gray-400">
                    {q.venue}
                  </div>
                </div>
                <div className="text-xs font-semibold">Q{q.quarter}</div>
                <div className="text-xs text-gray-100">{q.question}</div>
                <div>
                  <span className={statusClass(q.status)}>
                    {q.status.toUpperCase()}
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
                          onClick={() => handleSetOutcome(q, action)}
                          className={`${outcomeButtonClass(
                            action
                          )} disabled:opacity-50 disabled:cursor-not-allowed text-xs`}
                        >
                          {label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && !loadingData && (
            <div className="px-4 py-4 text-xs text-gray-400">
              No questions match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
