// /app/leaderboards/page.tsx
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
  totalWins: number;
  totalLosses: number;
  winPct: number; // kept for lifetime; not shown in table
  // client-side only – movement vs previous load
  rankDelta?: number;
};

type UserLifetimeStats = {
  totalWins: number;
  totalLosses: number;
  winPct: number; // used for lifetime %
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "overall", label: "Overall Live Leaderboard" },
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
  return p.toFixed(3).replace(/^0/, "");
}

// Small helper to describe “most common streak band”
function describeStreakBand(entries: LeaderboardEntry[]): string | null {
  if (!entries.length) return null;

  const bands: { label: string; min: number; max: number | null }[] = [
    { label: "0", min: 0, max: 0 },
    { label: "1–2", min: 1, max: 2 },
    { label: "3–4", min: 3, max: 4 },
    { label: "5–7", min: 5, max: 7 },
    { label: "8+", min: 8, max: null },
  ];

  const counts = new Map<string, number>();
  for (const e of entries) {
    const s = e.currentStreak ?? 0;
    const band = bands.find(
      (b) => s >= b.min && (b.max === null || s <= b.max)
    );
    const label = band?.label ?? "0";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let topLabel: string | null = null;
  let topCount = 0;
  for (const [label, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topLabel = label;
    }
  }

  if (!topLabel) return null;
  if (topLabel === "0") return "Most players have already busted back to 0.";
  return `Most players are sitting on a ${topLabel} streak.`;
}

export default function LeaderboardsPage() {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userLifetime, setUserLifetime] =
    useState<UserLifetimeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [showLeadersOnly, setShowLeadersOnly] = useState(false);

  const hasLoadedRef = useRef(false);
  const previousEntriesRef = useRef<LeaderboardEntry[]>([]);

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
        const incoming = data.entries || [];

        // Compute rankDelta vs previous snapshot
        const prevByUid = new Map<string, LeaderboardEntry>();
        previousEntriesRef.current.forEach((e) =>
          prevByUid.set(e.uid, e)
        );

        const withDelta: LeaderboardEntry[] = incoming.map((e) => {
          const prev = prevByUid.get(e.uid);
          if (!prev) return { ...e };
          const delta = prev.rank - e.rank; // positive = moved up
          return { ...e, rankDelta: delta };
        });

        previousEntriesRef.current = withDelta;
        setEntries(withDelta);
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

  // Base top 10 list
  const top10Base = entries.slice(0, 10);

  // Apply "leaders only" (3+) toggle for table rows
  const LEADER_MIN_STREAK = 3;
  const tableRows = showLeadersOnly
    ? top10Base.filter((e) => (e.currentStreak ?? 0) >= LEADER_MIN_STREAK)
    : top10Base;

  const userOutsideTop10 =
    userEntry && top10Base.every((e) => e.uid !== userEntry.uid);

  const totalPlayers = entries.length;
  const streakBandDescription = describeStreakBand(entries);

  const leaderStreak = top10Base[0]?.currentStreak ?? null;

  const top3 = top10Base.slice(0, 3);

  const renderRankDelta = (delta?: number) => {
    if (!delta || delta === 0) {
      return (
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
          •
        </span>
      );
    }
    if (delta > 0) {
      return (
        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
          ▲ {delta}
        </span>
      );
    }
    return (
      <span className="text-[10px] text-rose-400 flex items-center gap-0.5">
        ▼ {Math.abs(delta)}
      </span>
    );
  };

  const renderStreakPill = (streak: number) => {
    const s = streak ?? 0;
    const isHot = s >= 5;
    const isOnFire = s >= 10;

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
          isOnFire
            ? "bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-black shadow-[0_0_18px_rgba(248,113,22,0.9)]"
            : isHot
            ? "bg-orange-500/20 text-orange-300 border border-orange-500/70"
            : "bg-slate-800 text-slate-100 border border-slate-600"
        }`}
      >
        {isOnFire ? "🔥🔥" : isHot ? "🔥" : "●"}
        <span>Streak {s}</span>
      </span>
    );
  };

  const renderSkeletonRows = () => (
    <ul className="divide-y divide-slate-800 animate-pulse">
      {Array.from({ length: 6 }).map((_, idx) => (
        <li
          key={idx}
          className="grid grid-cols-12 px-4 py-3 items-center text-sm"
        >
          <div className="col-span-3 sm:col-span-2">
            <div className="h-3 w-10 bg-slate-700 rounded" />
          </div>
          <div className="col-span-7 sm:col-span-8 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-700" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-slate-700 rounded mb-1" />
              <div className="h-2 w-16 bg-slate-800 rounded" />
            </div>
          </div>
          <div className="col-span-2 flex justify-end sm:justify-center">
            <div className="h-5 w-16 bg-slate-700 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Leaderboards</h1>
          <p className="mt-1 text-sm text-white/70 max-w-md">
            Live ranking of players with the{" "}
            <span className="font-semibold text-orange-300">
              highest current streak
            </span>
            .
          </p>
          <p className="mt-1 text-xs text-orange-300">
            Ties at the top?{" "}
            <span className="font-semibold">
              Prizes are split between all leaders.
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wide text-white/60">
              Scope
            </span>
            <select
              value={scope}
              onChange={handleScopeChange}
              className="rounded-full bg-[#020617] border border-orange-400/80 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(248,144,35,0.3)] focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowLeadersOnly((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
              showLeadersOnly
                ? "bg-orange-500/15 border-orange-400 text-orange-200"
                : "bg-slate-900/80 border-slate-600 text-slate-200"
            }`}
          >
            <span
              className={`inline-flex h-3 w-6 items-center rounded-full p-0.5 transition bg-slate-700`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full bg-white transform transition ${
                  showLeadersOnly ? "translate-x-3" : "translate-x-0"
                }`}
              />
            </span>
            Leaders only (3+)
          </button>
        </div>
      </div>

      {/* TOP 3 HERO STRIP */}
      {top3.length > 0 && (
        <div className="mb-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-700/80 px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Live leaders
              </p>
              <p className="text-xs text-slate-200">
                Top 3 based on current streak right now.
              </p>
            </div>
            {leaderStreak !== null && (
              <div className="text-right text-xs text-slate-300">
                <p>Current top streak</p>
                <p className="text-xl font-bold text-orange-300">
                  {leaderStreak}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((entry, index) => {
              const isYou = user && entry.uid === user.uid;
              const hasAvatar =
                typeof entry.avatarUrl === "string" &&
                entry.avatarUrl.trim().length > 0;

              const baseCard =
                index === 0
                  ? "border-yellow-400/60 shadow-[0_0_26px_rgba(250,204,21,0.5)]"
                  : index === 1
                  ? "border-slate-300/60 shadow-[0_0_20px_rgba(148,163,184,0.45)]"
                  : "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.45)]";

              return (
                <div
                  key={entry.uid}
                  className={`rounded-2xl border bg-[#020617]/90 px-3 py-3 flex items-center gap-3 ${baseCard}`}
                >
                  <div className="flex-shrink-0">
                    {hasAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.avatarUrl as string}
                        alt={entry.displayName}
                        className="h-10 w-10 rounded-full border border-white/30 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          #{entry.rank} {entry.displayName}
                          {isYou && (
                            <span className="ml-1 text-[10px] text-orange-300">
                              (You)
                            </span>
                          )}
                        </p>
                        {entry.username && (
                          <p className="text-[10px] text-slate-400 truncate">
                            @{entry.username}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        {renderStreakPill(entry.currentStreak)}
                        {renderRankDelta(entry.rankDelta)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SOCIAL PROOF / CONTEXT LINE */}
      <div className="mb-4 rounded-xl bg-[#020617] border border-slate-700/80 px-4 py-3 text-xs sm:text-sm text-white/75 flex flex-col gap-1">
        <span>
          {totalPlayers > 0
            ? `${totalPlayers} player${
                totalPlayers === 1 ? "" : "s"
              } currently have a streak in this leaderboard.`
            : "No players on the board yet – first streak takes top spot."}
        </span>
        {streakBandDescription && (
          <span className="text-[11px] text-slate-300">
            {streakBandDescription}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400">
          {error} Try refreshing the page.
        </p>
      )}

      {/* Top 10 table */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#020617] to-[#020617] border border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.8)] mb-6">
        <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-white/60 border-b border-slate-800">
          <div className="col-span-3 sm:col-span-2">Rank</div>
          <div className="col-span-7 sm:col-span-8">Player</div>
          <div className="col-span-2 text-right sm:text-center">Streak</div>
        </div>

        {loading && !hasLoadedRef.current && renderSkeletonRows()}

        {!loading && tableRows.length === 0 && (
          <div className="px-4 py-6 text-sm text-white/70">
            No players on the board yet. Make a streak to claim top spot.
          </div>
        )}

        {!loading && tableRows.length > 0 && (
          <ul className="divide-y divide-slate-800">
            {tableRows.map((entry) => {
              const isYou = user && entry.uid === user.uid;
              const hasAvatar =
                typeof entry.avatarUrl === "string" &&
                entry.avatarUrl.trim().length > 0;

              const rankClass =
                entry.rank === 1
                  ? "bg-gradient-to-r from-yellow-500/15 via-yellow-400/10 to-transparent"
                  : entry.rank === 2
                  ? "bg-gradient-to-r from-slate-300/10 via-slate-400/5 to-transparent"
                  : entry.rank === 3
                  ? "bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent"
                  : "bg-transparent";

              return (
                <li
                  key={entry.uid}
                  className={`grid grid-cols-12 px-4 py-3 items-center text-sm transform transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-800/40 ${
                    isYou
                      ? "ring-1 ring-orange-400/60"
                      : ""
                  } ${rankClass}`}
                >
                  {/* Rank + movement */}
                  <div className="col-span-3 sm:col-span-2 font-semibold text-white/80 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1">
                      <span>#{entry.rank}</span>
                      {entry.rank === 1 && (
                        <span
                          className="text-yellow-300 text-lg"
                          aria-label="Leader"
                        >
                          👑
                        </span>
                      )}
                    </div>
                    {renderRankDelta(entry.rankDelta)}
                  </div>

                  {/* Player + avatar */}
                  <div className="col-span-7 sm:col-span-8 flex items-center gap-2">
                    {hasAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.avatarUrl as string}
                        alt={entry.displayName}
                        className="h-8 w-8 rounded-full border border-white/20 object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                        {entry.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {entry.displayName}
                        {isYou && (
                          <span className="ml-1 text-[11px] text-orange-300 font-semibold">
                            (You)
                          </span>
                        )}
                      </span>
                      {entry.username && (
                        <span className="text-[11px] text-white/60 truncate">
                          @{entry.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Current streak pill */}
                  <div className="col-span-2 text-right sm:text-center">
                    {renderStreakPill(entry.currentStreak)}
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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {userEntry.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userEntry.avatarUrl}
                    alt={userEntry.displayName}
                    className="h-8 w-8 rounded-full border border-white/20 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                    {userEntry.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
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
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/60">Current streak</p>
                <p className="text-xl font-bold text-sky-300">
                  {userEntry.currentStreak}
                </p>
                {leaderStreak !== null && leaderStreak > userEntry.currentStreak && (
                  <p className="mt-1 text-[11px] text-slate-300">
                    Need{" "}
                    <span className="font-semibold text-orange-300">
                      {leaderStreak - userEntry.currentStreak}
                    </span>{" "}
                    more to catch the leaders.
                  </p>
                )}
                {leaderStreak !== null &&
                  leaderStreak === userEntry.currentStreak && (
                    <p className="mt-1 text-[11px] text-emerald-300">
                      You’re tied with the leaders.
                    </p>
                  )}
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

      {/* Lifetime box – WINS / LOSSES / LIFETIME WIN % */}
      {user && userLifetime && (
        <div className="rounded-2xl bg-[#020617] border border-slate-700/80 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
          <p className="text-xs uppercase tracking-wide text-white/60 mb-2">
            Lifetime record
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
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
            <div>
              <p className="text-xs text-white/60 mb-1">Win %</p>
              <p className="text-2xl font-bold text-emerald-300 font-mono">
                {formatPct(userLifetime.winPct)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
