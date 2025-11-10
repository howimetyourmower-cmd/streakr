// app/leaderboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type LeaderboardRow = {
  name?: string;
  team?: string;
  currentStreak?: number;
  longestStreak?: number;
  updatedAt?: any;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof LeaderboardRow>("currentStreak");

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const snapshot = await getDocs(collection(db, "leaderboard"));
        const data: LeaderboardRow[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LeaderboardRow[];

        // Sort leaderboard by chosen field (default: currentStreak)
        const sorted = [...data].sort((a, b) => {
          const aVal = a[sortKey] ?? 0;
          const bVal = b[sortKey] ?? 0;
          return (bVal as number) - (aVal as number);
        });

        setRows(sorted);
      } catch (error) {
        console.error("🔥 Error loading leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [sortKey]);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading leaderboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6 text-center">
          🏆 Streakr Leaderboard
        </h1>

        <div className="flex justify-end mb-4">
          <label className="text-sm text-zinc-400">
            Sort by:&nbsp;
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as keyof LeaderboardRow)}
              className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2 py-1 text-sm"
            >
              <option value="currentStreak">Current Streak</option>
              <option value="longestStreak">Longest Streak</option>
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-zinc-400">
            No leaderboard data found yet.
          </p>
        ) : (
          <table className="w-full border-collapse border border-zinc-700 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-zinc-900 text-orange-400 text-left">
                <th className="p-3 border-b border-zinc-700">Rank</th>
                <th className="p-3 border-b border-zinc-700">Name</th>
                <th className="p-3 border-b border-zinc-700">Team</th>
                <th className="p-3 border-b border-zinc-700">Current Streak</th>
                <th className="p-3 border-b border-zinc-700">Longest Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.name || i}
                  className="odd:bg-zinc-950 even:bg-zinc-900 hover:bg-zinc-800 transition"
                >
                  <td className="p-3 text-zinc-400">{i + 1}</td>
                  <td className="p-3">{row.name ?? "Unknown"}</td>
                  <td className="p-3 text-zinc-400">{row.team ?? "-"}</td>
                  <td className="p-3 text-orange-400 font-semibold">
                    {row.currentStreak ?? 0}
                  </td>
                  <td className="p-3 text-zinc-300">
                    {row.longestStreak ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
