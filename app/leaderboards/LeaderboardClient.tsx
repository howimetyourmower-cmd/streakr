"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  ChangeEvent,
} from "react";
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
  currentStreak: number;
  longestStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number; // 0–1
};

type UserLifetimeStats = {
  currentStreak: number;
  longestStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "overall", label: "Overall (longest streak)" },
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

function formatPct(p: number): string {
  if (p <= 0) return ".000";
  const fixed = p.toFixed(3);
  // turn "0.683" into ".683"
  return fixed.replace(/^0/, "");
}

export default function LeaderboardsPage() {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("opening-round");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userLifetime, setUserLifetime] = useState<UserLifetimeStats | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const hasLoadedRef = useRef(false);

  const isOverall = scope === "overall";

  const loadLeaderboard = useCallback(
    async (selectedScope: Scope, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setLoading(true);
          setError("");
        }

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
        setUserLifetime(data.userLifetime || null);

        hasLoadedRef.current = true;
      } catch (err) {
        console.error(err);
        if (!silent) {
          setError("Could not load leaderboard right now.");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [user]
  );

  // initial + scope-change load
  useEffect(() => {
    loadLeaderboard(scope);
  }, [scope, loadLeaderboard]);

  // silent refresh every 15s (no flicker)
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const id = setInterval(() => {
      loadLeaderboard(scope, { silent: true });
    }, 15000);

    return () => clearInterval(id);
  }, [scope, loadLeaderboard]);

  const handleScopeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setScope(event.target.value as Scope);
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
              ? "See who holds the longest STREAKr run."
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
          <div className="col-span-3 sm:col-span-2">Rank</div>
          <div className="col-span-5 sm:col-span-4">Player</div>
          <div className="col-span-2 text-right sm:text-center">Curr</div>
          <div className="col-span-2 text-right sm:text-center">Long</div>
          <div className="col-span-2 text-right">Pct</div>
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
                  className={`grid grid-cols-12 px-4 py-3 items-center text-sm transform transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-800/40 ${
                    isYou
                      ? "bg-gradient-to-r from-orange-500/10 via-sky-500/5 to-transparent"
                      : "bg-transparent"
                  }`}
                >
                  {/* Rank + crown for #1 */}
                  <div className="col-span-3 sm:col-span-2 font-semibold text-white/80 flex items-center gap-1">
                    <span>#{entry.rank}</span>
                    {entry.rank === 1 && (
                      <span className="text-yellow-300 text-lg" aria-label="Leader">
                        👑
                      </span>
                    )}
                  </div>

                  {/* Player */}
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
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

                  {/* Curr */}
                  <div className="col-span-2 text-right sm:text-center font-semibold text-sky-300">
                    {entry.currentStreak}
                  </div>

                  {/* Long */}
                  <div className="col-span-2 text-right sm:text-center font-semibold text-emerald-300">
                    {entry.longestStreak}
                  </div>

                  {/* Pct */}
                  <div className="col-span-2 text-right font-mono text-sm text-white/85">
                    {formatPct(entry.winPct)}
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
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-sky-500/10 to-transparent border border-orange-500/60 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.8)] transform transition-all duration-300 ease-out">
            <p className="text-xs uppercase tracking-wide text-orange-300 mb-1">
              Your position
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-1">
                  #{userEntry.rank}
                  {userEntry.rank === 1 && (
                    <span
                      className="text-yellow-300 text-lg"
                      aria-label="Leader"
                    >
                      👑
                    </span>
                  )}
                  <span>– {userEntry.displayName}</span>
                </p>
                <p className="text-xs text-white/75">
                  Keep building your streak to climb the ladder.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/60">Current streak</p>
                <p className="text-xl font-bold text-sky-300">
                  {userEntry.currentStreak}
                </p>
                <p className="text-[11px] text-white/60 mt-1">Best</p>
                <p className="text-lg font-semibold text-emerald-300">
                  {userEntry.longestStreak}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-xs text-white/60">
            {userEntry
              ? "You’re in the top 10 – nice work!"
              : "Make some picks to appear on the leaderboard."}
          </p>
        )
      ) : (
        <p className="mb-4 text-xs text-white/60">
          Log in to see where you sit on the leaderboard.
        </p>
      )}

      {/* Lifetime box – BEST / WINS / LOSSES */}
      {user && userLifetime && (
        <div className="rounded-2xl bg-[#020617] border border-slate-700/80 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
          <p className="text-xs uppercase tracking-wide text-white/60 mb-2">
            Lifetime record
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-white/60 mb-1">Best streak</p>
              <p className="text-2xl font-bold text-emerald-300">
                {userLifetime.longestStreak}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Wins</p>
              <p className="text-2xl font-bold text-sky-300">
                {userLifetime.totalWins}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Losses</p>
              <p className="text-2xl font-bold text-rose-300">
                {userLifetime.totalLosses}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/70 text-center">
            Win rate:{" "}
            <span className="font-mono">
              {formatPct(userLifetime.winPct)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
