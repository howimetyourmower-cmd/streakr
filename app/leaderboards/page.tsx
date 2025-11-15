// app/leaderboards/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type DemoPlayer = {
  username: string;
  team: string;
  currentStreak: number;
  longestStreak: number;
};

const demoPlayers: DemoPlayer[] = [
  { username: "HotStreak23", team: "Collingwood", currentStreak: 9, longestStreak: 12 },
  { username: "LionHeart", team: "Brisbane Lions", currentStreak: 8, longestStreak: 10 },
  { username: "BlueBagger", team: "Carlton", currentStreak: 7, longestStreak: 9 },
  { username: "TigerTime", team: "Richmond", currentStreak: 6, longestStreak: 8 },
  { username: "SaintsFan", team: "St Kilda", currentStreak: 5, longestStreak: 7 },
];

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export default function LeaderboardsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Gate page behind auth
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-300">
        Loading leaderboards…
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 text-white">
      {/* Header + toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Leaderboards</h1>
          <p className="text-sm text-gray-400 mt-1">
            See who&apos;s on a heater. Live data coming soon – this is a demo layout.
          </p>
        </div>
        <div className="inline-flex rounded-full bg-black/40 border border-white/10 p-1 text-xs">
          <button className="px-3 py-1 rounded-full bg-orange-500 font-semibold">
            Global streak
          </button>
          <button className="px-3 py-1 rounded-full text-gray-300 hover:bg-white/5">
            This round
          </button>
        </div>
      </div>

      {/* Leaderboard card */}
      <div className="rounded-2xl bg-[#050818] border border-white/10 shadow-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold">
              S
            </span>
            <div>
              <div className="text-sm font-semibold">Global longest streak</div>
              <div className="text-[11px] text-gray-400">
                Demo data – we&apos;ll wire this to real stats soon.
              </div>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 hidden sm:block">
            Showing top 5
          </div>
        </div>

        {/* Header row (desktop) */}
        <div className="hidden sm:grid grid-cols-[3rem,2fr,2fr,1.2fr,1.2fr] text-[11px] text-gray-400 px-6 py-2 border-b border-white/5">
          <div>#</div>
          <div>Player</div>
          <div>Team</div>
          <div className="text-right">Current streak</div>
          <div className="text-right">Longest streak</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {demoPlayers.map((p, index) => {
            const rank = index + 1;
            const isLeader = rank === 1;

            return (
              <div
                key={p.username}
                className="px-4 sm:px-6 py-3 sm:py-3.5 grid grid-cols-[auto,1fr] sm:grid-cols-[3rem,2fr,2fr,1.2fr,1.2fr] gap-3 sm:gap-2 items-center bg-gradient-to-r from-transparent to-transparent hover:from-orange-500/5 hover:to-purple-500/10 transition"
              >
                {/* Rank (mobile + desktop) */}
                <div className="flex items-center gap-2 sm:gap-0">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 border border-white/10 text-xs font-semibold">
                    {rank}
                  </span>
                  {/* Mobile player block */}
                  <div className="sm:hidden">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                        {getInitials(p.username)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {p.username}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {p.team}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Player (desktop) */}
                <div className="hidden sm:flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                    {getInitials(p.username)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.username}</div>
                    {isLeader && (
                      <div className="text-[11px] text-orange-300">
                        🔥 On a hot streak
                      </div>
                    )}
                  </div>
                </div>

                {/* Team (desktop only) */}
                <div className="hidden sm:block text-sm text-gray-200">
                  {p.team}
                </div>

                {/* Current streak */}
                <div className="text-right text-sm">
                  <span className="inline-flex items-center justify-end gap-1">
                    <span className="font-semibold">{p.currentStreak}</span>
                    <span className="text-[11px] text-gray-400">in a row</span>
                  </span>
                </div>

                {/* Longest streak */}
                <div className="text-right text-sm">
                  <span
                    className={`inline-flex items-center justify-end gap-1 ${
                      isLeader ? "text-orange-300" : ""
                    }`}
                  >
                    <span className="font-semibold">
                      {p.longestStreak}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      longest
                    </span>
                  </span>
                </div>

                {/* Mobile streak summary */}
                <div className="col-span-2 sm:hidden text-[11px] text-gray-400 flex justify-between mt-1">
                  <span>
                    Current:{" "}
                    <span className="font-semibold text-gray-100">
                      {p.currentStreak}
                    </span>
                  </span>
                  <span>
                    Longest:{" "}
                    <span className="font-semibold text-orange-300">
                      {p.longestStreak}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-6 py-3 bg-black/40 text-[11px] text-gray-400">
          This is a visual preview only. Later we&apos;ll pull live data from
          your picks and show full global / round / private league ladders.
        </div>
      </div>
    </div>
  );
}
