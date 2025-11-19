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
          limit(50)
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

  // Heading & subtitle change depending on selected round
  const headingLabel = (() => {
    if (selectedRound === "overall") return "Global longest streak";
    if (selectedRound === "OR") return "Opening Round leaderboard";
    if (selectedRound === "finals") return "Finals leaderboard";
    return `Round ${selectedRound} leaderboard`;
  })();

  const subtitleText = (() => {
    if (selectedRound === "overall") {
      return `Showing top ${Math.min(
        sortedPlayers.length,
        50
      )} players (overall season stats).`;
    }
    if (selectedRound === "OR") {
      return `Showing top ${Math.min(
        sortedPlayers.length,
        50
      )} players for Opening Round. Streak numbers currently reflect season totals while we wire round-specific stats.`;
    }
    if (selectedRound === "finals") {
      return `Showing top ${Math.min(
        sortedPlayers.length,
        50
      )} players for Finals (all 5 weeks combined). Streak numbers currently reflect season totals while we wire finals-specific stats.`;
    }
    return `Showing top ${Math.min(
      sortedPlayers.length,
      50
    )} players for Round ${selectedRound}. Streak numbers currently reflect season totals while we wire round-based stats.`;
  })();

  const roundSelectValue =
    selectedRound === "overall" || selectedRound === "OR" || selectedRound === "finals"
      ? selectedRound
      : String(selectedRound);

  const handleRoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
            Showing top {Math.min(sortedPlayers.length, 50)}
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

        {sortedPlayers.map((p, index) => {
          const isCurrentUser = currentUserUid === p.uid;
          const avatarSrc = p.avatarUrl || "/default-avatar.png";

          return (
            <div
              key={p.uid}
              className={`px-4 py-3 flex flex-col gap-2 sm:grid sm:grid-cols-[40px,minmax(0,2fr),minmax(0,1.4fr),110px,110px] sm:items-center ${
                isCurrentUser ? "bg:white/5" : "bg-black/10"
              } hover:bg-white/8 transition`}
            >
              {/* Rank */}
              <div className="flex items-center gap-2 sm:block">
                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  {index + 1}
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
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-gray-400">
        Opening Round (OR), Rounds 1–23 and Finals (all 5 weeks combined) are
        now selectable. As we wire settlement, this view will show true
        per-round and finals ladders – for now, streak numbers reflect season
        totals.
      </div>
    </div>
  );
}
