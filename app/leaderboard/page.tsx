"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  username: string;
  favouriteTeam: string;
  currentStreak: number;
  bestStreak: number;
};

type LeaderboardData = {
  round: number;
  season: number;
  roundLeaderboard: LeaderboardEntry[];
  seasonLeaderboard: LeaderboardEntry[];
  yourPosition: {
    roundRank: number | null;
    seasonRank: number | null;
    currentStreak: number;
    bestStreak: number;
  };
};

export default function LeaderboardsPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"round" | "season">("round");

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/leaderboards");
        if (!res.ok) throw new Error("Failed to load leaderboards");
        const json: LeaderboardData = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load leaderboards");
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-lg font-medium">Loading leaderboards...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="bg-slate-900/70 border border-red-500/40 rounded-2xl px-6 py-4 max-w-md text-center">
          <p className="text-red-400 font-semibold mb-2">
            Couldn&apos;t load leaderboards
          </p>
          <p className="text-sm text-slate-300 mb-4">
            {error ?? "Something went wrong. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const { round, season, roundLeaderboard, seasonLeaderboard, yourPosition } =
    data;

  const activeList = tab === "round" ? roundLeaderboard : seasonLeaderboard;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Leaderboards
            </h1>
            <p className="text-sm md:text-base text-slate-400">
              See where your streak stacks up against the rest of the comp.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end text-xs text-slate-400">
            <span>Season {season}</span>
            <span>Current round: {round}</span>
          </div>
        </div>

        {/* YOUR POSITION CARD */}
        <div className="bg-slate-900/60 border border-slate-700/70 rounded-3xl p-4 md:p-6 mb-6 md:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-1">
              Your position
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Keep your streak alive to climb the ladder.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
            <MiniStat
              label="Round rank"
              value={
                yourPosition.roundRank ? `#${yourPosition.roundRank}` : "—"
              }
            />
            <MiniStat
              label="Season rank"
              value={
                yourPosition.seasonRank ? `#${yourPosition.seasonRank}` : "—"
              }
            />
            <MiniStat
              label="Current streak"
              value={yourPosition.currentStreak}
            />
            <MiniStat label="Best streak" value={yourPosition.bestStreak} />
          </div>
        </div>

        {/* TABS */}
        <div className="mb-4 md:mb-5 flex items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-full bg-slate-900/70 border border-slate-700/70">
            <TabButton
              active={tab === "round"}
              onClick={() => setTab("round")}
            >
              This round
            </TabButton>
            <TabButton
              active={tab === "season"}
              onClick={() => setTab("season")}
            >
              Season
            </TabButton>
          </div>
          <span className="text-[11px] md:text-xs text-slate-400">
            Longest active streaks are ranked highest.
          </span>
        </div>

        {/* TABLE */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-[11px] md:text-xs uppercase tracking-wide text-slate-400 flex">
            <div className="w-10">Rank</div>
            <div className="flex-1">Player</div>
            <div className="w-28 text-right hidden md:block">
              Favourite team
            </div>
            <div className="w-28 text-right">Current streak</div>
            <div className="w-24 text-right hidden md:block">Best streak</div>
          </div>

          {activeList.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              No players on the board yet. Make your picks to start the
              leaderboard.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {activeList.map((entry) => (
                <LeaderboardRow key={entry.rank} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl px-3 py-2 border border-slate-700/80 bg-slate-950/60 text-xs md:text-sm">
      <div className="text-[10px] md:text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">
        {label}
      </div>
      <div className="text-base md:text-lg font-semibold">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium transition ${
        active
          ? "bg-orange-500 text-black"
          : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const isYou = entry.username === "glennmadds"; // later: replace with real user id

  return (
    <li
      className={`px-4 py-3 text-xs md:text-sm flex items-center ${
        isYou ? "bg-orange-500/5" : ""
      }`}
    >
      <div className="w-10 font-semibold text-slate-100">
        {entry.rank <= 3 ? (
          <span>
            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
          </span>
        ) : (
          <>#{entry.rank}</>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-100">
            {entry.displayName}
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            @{entry.username}
          </span>
          {isYou && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/60 text-orange-300">
              You
            </span>
          )}
        </div>
      </div>
      <div className="w-28 text-right text-[11px] md:text-xs text-slate-300 hidden md:block">
        {entry.favouriteTeam}
      </div>
      <div className="w-28 text-right font-semibold text-slate-100">
        {entry.currentStreak} in a row
      </div>
      <div className="w-24 text-right text-[11px] md:text-xs text-slate-300 hidden md:block">
        Best {entry.bestStreak}
      </div>
    </li>
  );
}
