"use client";

import { useEffect, useState } from "react";

type QuestionStatus = "open" | "final" | "pending" | "void";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
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

type ApiResponse = {
  games: Game[];
};

type FlatRow = {
  id: string;
  startTime: string;
  status: QuestionStatus;
  match: string;
  venue: string;
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
};

const FILTER_TABS: { key: QuestionStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "final", label: "Final" },
  { key: "pending", label: "Pending" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

function formatStart(startTime: string) {
  const d = new Date(startTime);
  const date = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { date, time: `${time} AEDT` };
}

export default function PicksClient() {
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    QuestionStatus | "all"
  >("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPicks = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch picks: ${res.status}`);
        }

        const data: ApiResponse = await res.json();

        const flat: FlatRow[] = [];

        (data.games ?? []).forEach((game) => {
          (game.questions ?? []).forEach((q) => {
            flat.push({
              id: q.id,
              startTime: game.startTime,
              status: q.status,
              match: game.match,
              venue: game.venue,
              quarter: q.quarter,
              question: q.question,
              yesPercent: q.yesPercent,
              noPercent: q.noPercent,
            });
          });
        });

        setRows(flat);
      } catch (err) {
        console.error("Error loading picks", err);
        setError("Failed to load picks");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadPicks();
  }, []);

  const filteredRows =
    activeFilter === "all"
      ? rows
      : rows.filter((r) => r.status === activeFilter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-6">Picks</h1>

      {/* Filter tabs */}
      <div className="flex gap-3 mb-6">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition
                ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "bg-[#141b2f] text-gray-200 hover:bg-[#1c2438]"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Header row */}
      <div className="hidden md:grid grid-cols-[1.5fr,1.1fr,2fr,0.5fr,3fr,2fr] text-xs uppercase text-gray-400 mb-2 px-4">
        <span>Start</span>
        <span>Status</span>
        <span>Match • Venue</span>
        <span>Q#</span>
        <span>Question</span>
        <span className="text-right">Pick • Yes % • No %</span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-300">
            Loading picks...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16 text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && filteredRows.length === 0 && (
          <div className="flex items-center justify-center py-16 text-gray-300">
            No picks in this category.
          </div>
        )}

        {!loading &&
          !error &&
          filteredRows.map((row) => {
            const { date, time } = formatStart(row.startTime);

            return (
              <div
                key={row.id}
                className="grid md:grid-cols-[1.5fr,1.1fr,2fr,0.5fr,3fr,2fr] grid-cols-1 gap-3 px-4 py-3 items-center text-sm bg-[#111827] border border-[#1f2937] rounded-2xl"
              >
                {/* Start */}
                <div className="flex flex-col text-xs text-gray-300">
                  <span className="font-medium">{date}</span>
                  <span className="text-gray-400">{time}</span>
                </div>

                {/* Status */}
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-600/20 text-green-400">
                    {row.status.toUpperCase()}
                  </span>
                </div>

                {/* Match + venue */}
                <div className="flex flex-col">
                  <span className="font-semibold text-orange-400">
                    {row.match}
                  </span>
                  <span className="text-xs text-gray-400">{row.venue}</span>
                </div>

                {/* Q# */}
                <div className="md:text-center text-xs font-semibold text-gray-300">
                  Q{row.quarter}
                </div>

                {/* Question */}
                <div className="text-sm">
                  <p className="font-medium">{row.question}</p>
                </div>

                {/* Pick buttons + percents */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2">
                  <div className="inline-flex rounded-full border border-[#374151] overflow-hidden">
                    <button
                      type="button"
                      className="px-4 py-1 text-sm font-semibold bg-orange-500 text-white"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="px-4 py-1 text-sm font-semibold bg-purple-600 text-white"
                    >
                      No
                    </button>
                  </div>
                  <div className="flex justify-end gap-3 text-xs text-gray-400">
                    <span>
                      Yes:{" "}
                      {row.yesPercent !== undefined
                        ? `${row.yesPercent}%`
                        : "0%"}
                    </span>
                    <span>
                      No:{" "}
                      {row.noPercent !== undefined
                        ? `${row.noPercent}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
