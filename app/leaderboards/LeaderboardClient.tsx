"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeaderboardEntry = {
  uid: string;
  username: string;
  team: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
};

type PicksApiResponse = {
  games: any[];
  roundNumber?: number;
};

type RoundFilter = "overall" | "OR" | "finals" | number;

const DISPLAY_LIMIT = 10; // 👈 show top 10

export default function LeaderboardClient() {
  const { user } = useAuth();

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Round selection
  const [selectedRound, setSelectedRound] = useState<RoundFilter>("overall");
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number | null>(
    null
  );

  // Load users from Firestore ordered by longest streak
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const q = query(
          collection(db, "users"),
          orderBy("longestStreak", "desc"),
          limit(50) // still fetch up to 50 so we can find user's rank
        );
        const snap = await getDocs(q);

        const rows: LeaderboardEntry[] = snap.docs.map((docSnap, index) => {
          const data = docSnap.data() as any;
          return {
            uid: docSnap.id,
            username: data.username || `Player ${index + 1}`,
            team: data.team || "",
            avatarUrl: data.avatarUrl || "",
            currentStreak:
              typeof data.currentStreak === "number" ? data.currentStreak : 0,
            longestStreak:
              typeof data.longestStreak === "number" ? data.longestStreak : 0,
          };
        });

        setPlayers(rows);
      } catch (err) {
        console.error("Failed to load leaderboards", err);
        setError("Failed to load leaderboards. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Load current round from /api/picks so we can default the selector
  useEffect(() => {
    const loadCurrentRound = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) return;

        const data: PicksApiResponse = await res.json();
        if (typeof data.roundNumber === "number") {
          setCurrentRoundNumber(data.roundNumber);
          setSelectedRound(data.roundNumber);
        }
      } catch (err) {
        console.error("Failed to load current round for leaderboard", err);
      }
    };

    loadCurrentRound();
  }, []);

  const sortedPlayers = useMemo(() => {
    // Firestore already orders by longestStreak desc, but we
    // defensively sort again in case data changes later.
    return [...players].sort(
      (a, b) => (b.longestStreak ?? 0) - (a.longestStreak ?? 0)
    );
  }, [players]);

  const currentUserUid = user?.uid || null;

  // Top 10 for main display
  const displayedPlayers = useMemo(
    () => sortedPlayers.slice(0, DISPLAY_LIMIT),
    [sortedPlayers]
  );

  // Find logged in player's rank (within what we fetched)
  const currentUserIndex = useMemo(
    () => sortedPlayers.findIndex((p) => p.uid === currentUserUid),
    [sortedPlayers, currentUserUid]
  );
  const currentUserRank =
    currentUserIndex >= 0 ? currentUserIndex + 1 : null;
  const currentUserEntry =
    currentUserIndex >= 0 ? sortedPlayers[currentUserIndex] : null;

  const headingLabel = (() => {
    if (selectedRound === "overall") return "Global longest streak";
    if (selectedRound === "OR") return "Opening Round leaderboard";
    if (selectedRound === "finals") return "Finals leaderboard";
    return `Round ${selectedRound} leaderboard`;
  })();

  const subtitleText = (() => {
    const baseTop = Math.min(DISPLAY_LIMIT, sortedPlayers.length);
    if (selectedRound === "overall") {
      return `Showing top ${baseTop} players (overall season stats). If you're logged in, you'll also see your position even if you're outside the top ${DISPLAY_LIMIT}.`;
    }
    if (selectedRound === "OR") {
      return `Showing top ${baseTop} players for Opening Round. Streak numbers currently reflect season totals while we wire round-specific stats.`;
    }
    if (selectedRound === "finals") {
      return `Showing top ${baseTop} players for Finals (all 5 weeks combined). Streak numbers currently reflect season totals while we wire finals-specific stats.`;
    }
    return `Showing top ${baseTop} players for Round ${selectedRound}. Streak numbers currently reflect season totals while we wire round-based stats.`;
  })();

  const roundSelectValue =
    selectedRound === "overall" ||
    selectedRound === "OR" ||
    selectedRound === "finals"
      ? selectedRound
      : String(selectedRound);

  const handleRoundChange = (e: any) => {
    const value = e.target.value;
    if (value === "overall" || value === "OR" || value === "finals") {
      setSelectedRound(value);
    } else {
      const n = Number(value);
      if (!Number.isNaN(n)) setSelectedRound(n);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 text-sm text-gray-300">
        Loading leaderboards…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!sortedPlayers.length) {
    return (
      <div className="mt-6 text-sm text-gray-300">
        No players on the board yet. Be the first to start a streak!
      </div>
    );
  }

  return (
    <div className="mt-4 bg-black/30 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header row with round selector */}
      <div className="px-4 py-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-orange-300">
            {headingLabel}
          </div>
          {currentRoundNumber !== null && (
            <div className="text-[11px] text-gray-400 mt-1">
              Current round:{" "}
              <span className="font-semibold text-orange-400">
                Round {currentRoundNumber}
              </span>
            </div>
          )}
          <div className="text-[11px] text-gray-400 mt-1">
            {subtitleText}
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="text-[11px] text-gray-400">
            Showing top {Math.min(DISPLAY_LIMIT, sortedPlayers.length)}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">
              View by
            </span>
            <select
              value={roundSelectValue}
              onChange={handleRoundChange}
              className="text-xs bg-black/40 border border-white/20 rounded-full px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
            >
              <option value="overall">Overall (Season 2026)</option>
              <option value="OR">Opening Round (OR)</option>
              {Array.from({ length: 23 }).map((_, i) => {
                const r = i + 1;
                const isCurrent = currentRoundNumber === r;
                return (
                  <option key={r} value={String(r)}>
                    {isCurrent ? `Round ${r} (Current)` : `Round ${r}`}
                  </option>
                );
              })}
              <option value="finals">Finals (All 5 weeks)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="divide-y divide-white/5">
        {/* Table header (hidden on very small screens) */}
        <div className="hidden sm:grid grid-cols-[40px,minmax(0,2fr),minmax(0,1.4fr),110px,110px] px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wide">
          <div>#</div>
          <div>Player</div>
          <div>Team</div>
          <div className="text-right">Current streak</div>
          <div className="text-right">Longest streak</div>
        </div>

        {/* Top 10 */}
        {displayedPlayers.map((p, index) => {
          const rank = index + 1;
          const isCurrentUser = currentUserUid === p.uid;
          const avatarSrc = p.avatarUrl || "/default-avatar.png";

          return (
            <div
              key={p.uid}
              className={`px-4 py-3 flex flex-col gap-2 sm:grid sm:grid-cols-[40px,minmax(0,2fr),minmax(0,1.4fr),110px,110px] sm:items-center ${
                isCurrentUser ? "bg-white/5" : "bg-black/10"
              } hover:bg-white/8 transition`}
            >
              {/* Rank */}
              <div className="flex items-center gap-2 sm:block">
                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  {rank}
                </span>
                <span className="sm:hidden text-[11px] text-gray-400 ml-2">
                  Rank
                </span>
              </div>

              {/* Player + avatar */}
              <div className="flex items-center gap-3">
                <img
                  src={avatarSrc}
                  alt={p.username}
                  className="w-9 h-9 rounded-full border border-white/15 object-cover"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {p.username}
                    {isCurrentUser && (
                      <span className="ml-2 text-[11px] text-emerald-400">
                        (You)
                      </span>
                    )}
                  </div>
                  {p.team && (
                    <div className="sm:hidden text-[11px] text-gray-400 truncate">
                      {p.team}
                    </div>
                  )}
                </div>
              </div>

              {/* Team (desktop only) */}
              <div className="hidden sm:block text-sm text-gray-200 truncate">
                {p.team || "—"}
              </div>

              {/* Current streak */}
              <div className="flex sm:block justify-between text-sm">
                <span className="sm:hidden text-[11px] text-gray-400 mr-2">
                  Current
                </span>
                <span className="font-semibold">
                  {p.currentStreak ?? 0}
                  <span className="text-[11px] text-gray-400 ml-1">
                    in a row
                  </span>
                </span>
              </div>

              {/* Longest streak */}
              <div className="flex sm:block justify-between text-sm">
                <span className="sm:hidden text-[11px] text-gray-400 mr-2">
                  Longest
                </span>
                <span className="font-semibold text-orange-300">
                  {p.longestStreak ?? 0}
                  <span className="text-[11px] text-gray-400 ml-1">
                    longest
                  </span>
                </span>
              </div>
            </div>
          );
        })}

        {/* "Your position" row if you're outside top 10 but still in fetched list */}
        {currentUserEntry &&
          currentUserRank !== null &&
          currentUserRank > DISPLAY_LIMIT && (
            <div className="px-4 py-3 border-t border-white/10 bg-sky-500/10">
              <div className="text-[11px] text-sky-300 mb-1 uppercase tracking-wide">
                Your position
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold border border-sky-400/60">
                    {currentUserRank}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {currentUserEntry.username}
                      <span className="ml-2 text-[11px] text-emerald-400">
                        (You)
                      </span>
                    </div>
                    {currentUserEntry.team && (
                      <div className="text-[11px] text-gray-300 truncate">
                        {currentUserEntry.team}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-300">Current: </span>
                    <span className="font-semibold">
                      {currentUserEntry.currentStreak ?? 0}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-1">
                      in a row
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-300">Longest: </span>
                    <span className="font-semibold text-orange-300">
                      {currentUserEntry.longestStreak ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-gray-400">
        Showing the top {Math.min(DISPLAY_LIMIT, sortedPlayers.length)} players.
        If you&apos;re logged in and outside the top {DISPLAY_LIMIT}, your
        position still appears below the main table.
      </div>
    </div>
  );
}
