"use client";

import { useEffect, useState } from "react";

type QuestionStatus = "open" | "final" | "pending" | "void";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  // optional, for future %
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string from /api/picks
  questions: Question[];
};

type PicksResponse = {
  games: Game[];
};

type FilterTab = "open" | "final" | "pending" | "void" | "all";

export default function PicksClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("open");

  useEffect(() => {
    const loadPicks = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/picks", { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const data: PicksResponse = await res.json();
        setGames(data.games || []);
      } catch (err) {
        console.error("Failed to load picks", err);
        setError("Failed to load picks");
      } finally {
        setLoading(false);
      }
    };

    loadPicks();
  }, []);

  const formatStartDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Australia/Melbourne",
    });
    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    });
    return { date, time };
  };

  const filteredGames = games
    .map((game) => {
      const questions =
        activeFilter === "all"
          ? game.questions
          : game.questions.filter((q) => q.status === activeFilter);

      return { ...game, questions };
    })
    .filter((g) => g.questions.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020617] via-[#020617] to-[#020617] text-white">
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6">Picks</h1>

        {/* Error message */}
        {error && (
          <p className="text-red-500 font-medium mb-4">{error}</p>
        )}

        {/* Filter tabs */}
        <div className="inline-flex rounded-full bg-slate-900/60 p-1 mb-6">
          {(["open", "final", "pending", "void", "all"] as FilterTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                  activeFilter === tab
                    ? "bg-orange-500 text-white"
                    : "text-slate-300 hover:bg-slate-800/80"
                }`}
              >
                {tab === "open"
                  ? "Open"
                  : tab === "final"
                  ? "Final"
                  : tab === "pending"
                  ? "Pending"
                  : tab === "void"
                  ? "Void"
                  : "All"}
              </button>
            )
          )}
        </div>

        {/* Table header */}
        <div className="hidden md:grid grid-cols-[140px,90px,1.4fr,60px,2fr,190px] text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-4">
          <span>Start</span>
          <span>Status</span>
          <span>Match • Venue</span>
          <span>Q#</span>
          <span>Question</span>
          <span className="text-right">Pick · Yes % · No %</span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="mt-8 text-slate-300">Loading picks…</div>
        )}

        {/* No data */}
        {!loading && !error && filteredGames.length === 0 && (
          <div className="mt-8 text-slate-300">
            No picks in this category.
          </div>
        )}

        {/* Games & questions */}
        <div className="space-y-3 mt-2">
          {filteredGames.map((game) => {
            const { date, time } = formatStartDate(game.startTime);
            return (
              <div
                key={game.id}
                className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden"
              >
                {/* Game row (desktop header style) */}
                <div className="hidden md:grid grid-cols-[140px,90px,1.4fr,60px,2fr,190px] items-center px-4 py-3 text-sm border-b border-slate-800">
                  <div className="text-slate-200">
                    <div>{date}</div>
                    <div className="text-xs text-slate-400">{time} AEDT</div>
                  </div>

                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
                      OPEN
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-orange-400">
                      {game.match}
                    </div>
                    <div className="text-xs text-slate-400">
                      {game.venue}
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 text-center">
                    {/* column header space */}
                  </div>

                  <div />

                  <div className="text-xs text-right text-slate-500">
                    {/* column header space */}
                  </div>
                </div>

                {/* Questions */}
                <div className="divide-y divide-slate-800">
                  {game.questions.map((q) => (
                    <div
                      key={q.id}
                      className="grid grid-cols-1 md:grid-cols-[140px,90px,1.4fr,60px,2fr,190px] items-center px-4 py-3 gap-2 text-sm"
                    >
                      {/* Mobile start + match stacked */}
                      <div className="md:hidden">
                        <div className="text-slate-200 text-xs">
                          {date} · {time} AEDT
                        </div>
                        <div className="mt-1 font-semibold text-orange-400">
                          {game.match}
                        </div>
                        <div className="text-xs text-slate-400">
                          {game.venue}
                        </div>
                      </div>

                      {/* Desktop: empty cell under start */}
                      <div className="hidden md:block" />

                      {/* Status (mobile & desktop) */}
                      <div className="md:flex md:items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
                          {q.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Match + venue column for desktop only */}
                      <div className="hidden md:block" />

                      {/* Question number */}
                      <div className="text-xs font-semibold text-slate-400">
                        Q{q.quarter}
                      </div>

                      {/* Question text */}
                      <div className="text-slate-100 leading-snug">
                        {q.question}
                      </div>

                      {/* Pick buttons + percentages */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="inline-flex rounded-full bg-slate-900/80 p-1 border border-slate-700/70">
                          <button className="px-4 py-1 text-xs font-semibold rounded-full bg-orange-500 hover:bg-orange-400 text-white transition-colors">
                            Yes
                          </button>
                          <button className="px-4 py-1 text-xs font-semibold rounded-full bg-purple-600 hover:bg-purple-500 text-white transition-colors ml-1">
                            No
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span>Yes: {q.yesPercent ?? 0}%</span>
                          <span>No: {q.noPercent ?? 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
