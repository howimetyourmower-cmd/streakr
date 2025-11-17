"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";
import type { SportType } from "@/lib/sports";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  sport?: SportType | string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
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
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  sport?: SportType | string;
};

type PicksApiResponse = { games: ApiGame[] };

type FilterType = QuestionStatus | "all";

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("open");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ------------------------
  // Data loading
  // ------------------------
  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/picks");
      if (!res.ok) {
        throw new Error("Failed to load picks");
      }

      const data: PicksApiResponse = await res.json();

      const flat: QuestionRow[] = [];
      data.games.forEach((game) => {
        game.questions.forEach((q) => {
          flat.push({
            id: q.id,
            gameId: game.id,
            match: game.match,
            venue: game.venue,
            startTime: game.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
            userPick: q.userPick,
            yesPercent: q.yesPercent,
            noPercent: q.noPercent,
            sport: q.sport ?? "afl",
          });
        });
      });

      setRows(flat);
      applyFilter(flat, activeFilter);
    } catch (err: any) {
      console.error("Failed to load picks", err);
      setError(err?.message ?? "Failed to load picks");
      setRows([]);
      setFilteredRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  function applyFilter(allRows: QuestionRow[], filter: FilterType) {
    if (filter === "all") {
      setFilteredRows(allRows);
    } else {
      setFilteredRows(allRows.filter((r) => r.status === filter));
    }
  }

  function handleFilterClick(filter: FilterType) {
    setActiveFilter(filter);
    applyFilter(rows, filter);
  }

  // ------------------------
  // Picks
  // ------------------------
  async function handlePick(questionId: string, pick: "yes" | "no") {
    if (!user) {
      alert("Please log in to make picks.");
      return;
    }

    try {
      await addDoc(collection(db, "picks"), {
        questionId,
        pick,
        uid: user.uid,
        createdAt: serverTimestamp(),
      });

      setRows((prev) =>
        prev.map((row) =>
          row.id === questionId ? { ...row, userPick: pick } : row
        )
      );
      setFilteredRows((prev) =>
        prev.map((row) =>
          row.id === questionId ? { ...row, userPick: pick } : row
        )
      );
    } catch (err) {
      console.error("Failed to save pick", err);
      alert("Failed to save pick. Please try again.");
    }
  }

  // ------------------------
  // Helpers
  // ------------------------
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
    });
    return { day, time };
  }

  function statusStyles(status: QuestionStatus) {
    switch (status) {
      case "open":
        return "bg-emerald-500/10 text-emerald-200 border border-emerald-300/40";
      case "final":
        return "bg-amber-500/10 text-amber-200 border border-amber-300/40";
      case "pending":
        return "bg-sky-500/10 text-sky-200 border border-sky-300/40";
      case "void":
      default:
        return "bg-slate-500/10 text-slate-200 border border-slate-300/40";
    }
  }

  function rowBackground(status: QuestionStatus) {
    switch (status) {
      case "open":
        return "bg-orange-500/95 hover:bg-orange-500";
      case "final":
        return "bg-emerald-800/90 hover:bg-emerald-800";
      case "pending":
        return "bg-sky-800/90 hover:bg-sky-800";
      case "void":
      default:
        return "bg-slate-700/90 hover:bg-slate-700";
    }
  }

  const filters: { id: FilterType; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "final", label: "Final" },
    { id: "pending", label: "Pending" },
    { id: "void", label: "Void" },
    { id: "all", label: "All" },
  ];

  // ------------------------
  // Render
  // ------------------------
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50">Picks</h1>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => handleFilterClick(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition
              ${
                activeFilter === f.id
                  ? "bg-orange-500 text-slate-900 shadow-sm"
                  : "bg-slate-800/80 text-slate-200 hover:bg-slate-700/80"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header row – now with SPORT between START and STATUS */}
          <div className="grid grid-cols-[1.4fr,0.6fr,0.8fr,2fr,0.4fr,3fr] gap-4 px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <div>Start</div>
            <div>Sport</div>
            <div>Status</div>
            <div>Match + Venue</div>
            <div className="text-center">Q</div>
            <div>Question</div>
          </div>

          {/* States */}
          {isLoading && (
            <div className="px-4 py-10 text-sm text-slate-300">
              Loading picks…
            </div>
          )}

          {!isLoading && error && (
            <div className="px-4 py-10 text-sm text-red-300">
              {error} Please refresh to try again.
            </div>
          )}

          {!isLoading && !error && filteredRows.length === 0 && (
            <div className="px-4 py-10 text-sm text-slate-300">
              No questions in this filter yet.
            </div>
          )}

          {/* Question rows */}
          <div className="space-y-2">
            {filteredRows.map((row) => {
              const { day, time } = formatDate(row.startTime);
              const bg = rowBackground(row.status);

              const yesActive = row.userPick === "yes";
              const noActive = row.userPick === "no";

              return (
                <div
                  key={row.id}
                  className={`${bg} rounded-xl text-slate-50 shadow-sm transition`}
                >
                  <div className="grid grid-cols-[1.4fr,0.6fr,0.8fr,2fr,0.4fr,3fr] items-center gap-3 px-4 py-3 text-xs sm:text-sm">
                    {/* START (date + time) */}
                    <div className="space-y-0.5">
                      <div className="font-semibold">{day}</div>
                      <div className="text-[11px] text-slate-100/90">
                        {time} AEDT
                      </div>
                    </div>

                    {/* SPORT – between start and status */}
                    <div className="flex justify-center">
                      <SportBadge sport={(row.sport as SportType) ?? "afl"} />
                    </div>

                    {/* STATUS */}
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${statusStyles(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </div>

                    {/* MATCH + VENUE */}
                    <div className="space-y-0.5">
                      <div className="font-semibold">{row.match}</div>
                      <div className="text-[11px] text-slate-100/85">
                        {row.venue}
                      </div>
                    </div>

                    {/* QUARTER */}
                    <div className="text-center font-semibold text-slate-50">
                      Q{row.quarter}
                    </div>

                    {/* QUESTION + actions */}
                    <div className="space-y-2">
                      <div className="font-medium leading-snug">
                        {row.question}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* YES button */}
                        <button
                          onClick={() => handlePick(row.id, "yes")}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition
                            ${
                              yesActive
                                ? "bg-slate-900 text-emerald-300 border border-emerald-400/60"
                                : "bg-slate-900/20 text-slate-50 border border-slate-200/40 hover:bg-slate-900/40"
                            }`}
                        >
                          Yes
                          {row.yesPercent != null && (
                            <span className="ml-1 text-[10px] text-slate-200/90">
                              {row.yesPercent}%
                            </span>
                          )}
                        </button>

                        {/* NO button */}
                        <button
                          onClick={() => handlePick(row.id, "no")}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition
                            ${
                              noActive
                                ? "bg-slate-900 text-red-300 border border-red-400/60"
                                : "bg-slate-900/20 text-slate-50 border border-slate-200/40 hover:bg-slate-900/40"
                            }`}
                        >
                          No
                          {row.noPercent != null && (
                            <span className="ml-1 text-[10px] text-slate-200/90">
                              {row.noPercent}%
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
