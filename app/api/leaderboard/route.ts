"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useAuth } from "@/hooks/useAuth";

type Scope =
  | "overall"
  | "opening-round"
  | "round-1"
  | "round-2"
  | "round-3"
  | "round-4"
  | "round-5"
  | "round-6"
  | "round-7"
  | "round-8"
  | "round-9"
  | "round-10"
  | "round-11"
  | "round-12"
  | "round-13"
  | "round-14"
  | "round-15"
  | "round-16"
  | "round-17"
  | "round-18"
  | "round-19"
  | "round-20"
  | "round-21"
  | "round-22"
  | "round-23"
  | "finals";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  streak: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "opening-round", label: "Opening Round" },
  { value: "round-1", label: "Round 1" },
  { value: "round-2", label: "Round 2" },
  { value: "round-3", label: "Round 3" },
  { value: "round-4", label: "Round 4" },
  { value: "round-5", label: "Round 5" },
  { value: "round-6", label: "Round 6" },
  { value: "round-7", label: "Round 7" },
  { value: "round-8", label: "Round 8" },
  { value: "round-9", label: "Round 9" },
  { value: "round-10", label: "Round 10" },
  { value: "round-11", label: "Round 11" },
  { value: "round-12", label: "Round 12" },
  { value: "round-13", label: "Round 13" },
  { value: "round-14", label: "Round 14" },
  { value: "round-15", label: "Round 15" },
  { value: "round-16", label: "Round 16" },
  { value: "round-17", label: "Round 17" },
  { value: "round-18", label: "Round 18" },
  { value: "round-19", label: "Round 19" },
  { value: "round-20", label: "Round 20" },
  { value: "round-21", label: "Round 21" },
  { value: "round-22", label: "Round 22" },
  { value: "round-23", label: "Round 23" },
  { value: "finals", label: "Finals" },
];

export default function LeaderboardsPage() {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("opening-round");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const isOverall = scope === "overall";

  const loadLeaderboard = async (selectedScope: Scope) => {
    try {
      setLoading(true);
      setError("");

      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch (err) {
          console.error("Failed to get ID token for leaderboard", err);
        }
      }

      const res = await fetch(`/api/leaderboard?scope=${selectedScope}`, {
        headers: {
          ...authHeader,
        },
      });

      if (!res.ok) {
        console.error("Leaderboard API error:", await res.text());
        throw new Error("Failed to load leaderboard");
      }

      const data: LeaderboardApiResponse = await res.json();
      setEntries(data.entries || []);
      setUserEntry(data.userEntry || null);
    } catch (err) {
      console.error(err);
      setError("Could not load leaderboard right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, user]);

  const handleScopeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Scope;
    setScope(value);
  };

  const top10 = entries.slice(0, 10);

  const userOutsideTop10 =
    userEntry && top10.every((e) => e.uid !== userEntry.uid);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Leaderboards</h1>
          <p className="mt-1 text-sm text-white/70 max-w-md">
            {isOverall
              ? "See who holds the longest STREAKr run for the season."
              : "See how players stack up for this round’s streak."}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-1">
          <span className="text-[11px] uppercase tracking-wide text-white/60">
            Showing
          </span>
          <select
            value={scope}
            onChange={handleScopeChange}
            className="mt-0.5 rounded-full bg-[#020617] border border-orange-400/80 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(248,144,35,0.3)] focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-[#020617] border border-slate-700/80 px-4 py-3 text-xs sm:text-sm text-white/75">
        Top 10 players shown. If you&apos;re outside the top 10, we&apos;ll
        still show your position below.
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400">
          {error} Try refreshing the page.
        </p>
      )}

      {loading && (
        <p className="mb-3 text-sm text-white/70">Loading leaderboard…</p>
      )}

      {/* Top 10 table */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#020617] to-[#020617] border border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.8)] mb-6">
        <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-white/60 border-b border-slate-800">
          <div className="col-span-2 sm:col-span-1">Rank</div>
          <div className="col-span-6 sm:col-span-7">Player</div>
          <div className="col-span-4 sm:col-span-4 text-right">
            {isOverall ? "Longest streak" : "Streak this round"}
          </div>
        </div>

        {top10.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/70">
            No players on the board yet. Make a streak to claim top spot.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {top10.map((entry) => {
              const isYou = user && entry.uid === user.uid;
              const hasAvatar =
                typeof entry.avatarUrl === "string" &&
                entry.avatarUrl.trim().length > 0;

              return (
                <li
                  key={entry.uid}
                  className={`grid grid-cols-12 px-4 py-3 items-center text-sm ${
                    isYou
                      ? "bg-gradient-to-r from-orange-500/10 via-sky-500/5 to-transparent"
                      : "bg-transparent"
                  }`}
                >
                  <div className="col-span-2 sm:col-span-1 font-semibold text-white/80">
                    #{entry.rank}
                  </div>
                  <div className="col-span-6 sm:col-span-7 flex items-center gap-2">
                    {hasAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.avatarUrl as string}
                        alt={entry.displayName}
                        className="h-7 w-7 rounded-full border border-white/20 object-cover"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {entry.displayName}
                        {isYou && (
                          <span className="ml-1 text-[11px] text-orange-300 font-semibold">
                            (You)
                          </span>
                        )}
                      </span>
                      {entry.username && (
                        <span className="text-[11px] text-white/60">
                          @{entry.username}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-4 sm:col-span-4 text-right font-bold text-sky-300">
                    {entry.streak}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Your position if outside top 10 */}
      {user ? (
        userOutsideTop10 && userEntry ? (
          <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 via-sky-500/10 to-transparent border border-orange-500/60 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
            <p className="text-xs uppercase tracking-wide text-orange-300 mb-1">
              Your position
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  #{userEntry.rank} – {userEntry.displayName}
                </p>
                <p className="text-xs text-white/75">
                  Keep building your streak to climb the ladder.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/60">
                  {isOverall ? "Longest streak" : "Streak this round"}
                </p>
                <p className="text-2xl font-bold text-sky-300">
                  {userEntry.streak}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/60">
            {userEntry
              ? "You’re in the top 10 – nice work!"
              : "Make some picks to appear on the leaderboard."}
          </p>
        )
      ) : (
        <p className="text-xs text-white/60">
          Log in to see where you sit on the leaderboard.
        </p>
      )}
    </div>
  );
}
