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

export default function LeaderboardClient() {
  const { user } = useAuth();

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const sortedPlayers = useMemo(() => {
    // Firestore already orders by longestStreak desc, but we
    // defensively sort again in case data changes later.
    return [...players].sort(
      (a, b) => (b.longestStreak ?? 0) - (a.longestStreak ?? 0)
    );
  }, [players]);

  const currentUserUid = user?.uid || null;

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
      {/* Header row */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="text-sm font-semibold text-orange-300">
          Global longest streak
        </div>
        <div className="text-[11px] text-gray-400">
          Showing top {Math.min(sortedPlayers.length, 50)}
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
                isCurrentUser ? "bg-white/5" : "bg-black/10"
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
        This is a visual preview. As players build streaks, these stats will
        update from live data.
      </div>
    </div>
  );
}
