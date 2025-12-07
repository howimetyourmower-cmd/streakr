// /app/leaderboards/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";
import { useAuth } from "@/hooks/useAuth";

// Leaderboard scope – unchanged, still allows round views if API supports
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

// Updated — LONGEST removed
type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

// Updated — no more longestStreak here
type UserLifetimeStats = {
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
};

// NEW label text for leaderboard scopes
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

export default function LeaderboardsPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userLifetime, setUserLifetime] = useState<UserLifetimeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasLoadedRef = useRef(false);

  const loadLeaderboard = useCallback(
    async (selectedScope: Scope, opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;

      try {
        if (!silent) { setLoading(true); setError(""); }

        let authHeader: Record<string, string> = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          } catch {}
        }

        const res = await fetch(`/api/leaderboard?scope=${selectedScope}`, { headers: { ...authHeader }});
        if (!res.ok) throw new Error("Leaderboard API error");

        const data: LeaderboardApiResponse = await res.json();
        setEntries(data.entries ?? []);
        setUserEntry(data.userEntry ?? null);
        setUserLifetime(data.userLifetime ?? null);

        hasLoadedRef.current = true;
      } catch (err) {
        console.error(err);
        if (!silent) setError("Could not load leaderboard.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => { loadLeaderboard(scope); }, [scope, loadLeaderboard]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const id = setInterval(() => loadLeaderboard(scope, { silent:true }), 15000);
    return () => clearInterval(id);
  }, [scope, loadLeaderboard]);

  const top10 = entries.slice(0, 10);
  const userOutsideTop10 = userEntry && top10.every(e => e.uid !== userEntry.uid);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Leaderboards</h1>
          <p className="text-sm text-white/70">
            Live ranking — players with the **highest current streak**.
          </p>
          <p className="text-xs text-orange-300 mt-1">
            If multiple players tie for #1 — **prizes split equally**.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end">
          <span className="text-[11px] uppercase tracking-wide text-white/60 mb-1">Scope</span>
          <select
            value={scope}
            onChange={(e)=>setScope(e.target.value as Scope)}
            className="rounded-full bg-[#020617] border border-orange-400 px-4 py-1.5 text-sm font-semibold shadow-[0_0_20px_rgba(248,144,35,0.3)]"
          >
            {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* TOP 10 TABLE */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-white/60 border-b border-slate-700">
          <div className="col-span-3 sm:col-span-2">Rank</div>
          <div className="col-span-5 sm:col-span-6">Player</div>
          <div className="col-span-2 text-right sm:text-center">Streak</div>
          <div className="col-span-2 text-right">Win %</div>
        </div>

        {loading && <div className="px-4 py-6 text-sm">Loading…</div>}
        {error && <p className="text-red-400 p-4">{error}</p>}

        {!loading && !error && top10.length>0 && (
          <ul className="divide-y divide-slate-800">
            {top10.map(entry => {
              const isYou = user && entry.uid===user.uid;
              return (
                <li key={entry.uid}
                    className={`grid grid-cols-12 px-4 py-3 items-center text-sm ${isYou?'bg-orange-500/10':''}`}>
                  
                  <div className="col-span-3 sm:col-span-2 font-bold">#{entry.rank}</div>

                  <div className="col-span-5 sm:col-span-6 font-medium">{entry.displayName}{isYou&&" (You)"}</div>

                  <div className="col-span-2 text-right sm:text-center text-sky-300 font-bold">
                    {entry.currentStreak}
                  </div>

                  <div className="col-span-2 text-right font-mono">{formatPct(entry.winPct)}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* USER IF OUTSIDE TOP 10 */}
      {userOutsideTop10 && userEntry && (
        <div className="mt-4 rounded-xl bg-orange-500/10 border border-orange-500 p-4 text-sm">
          <p>Your rank: <b>#{userEntry.rank}</b></p>
          <p className="text-sky-300 font-bold text-xl">{userEntry.currentStreak}</p>
          <p className="text-xs text-white/60">Keep pushing — every pick counts.</p>
        </div>)
      }

      {/* LIFETIME STATS - no best streak anymore */}
      {user && userLifetime && (
        <div className="mt-6 rounded-xl bg-[#020617] border border-slate-700 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-white/60 mb-2">Lifetime Record</p>
          <div className="flex justify-center gap-6">
            <div><p className="text-xs">Wins</p><p className="text-2xl text-sky-300 font-bold">{userLifetime.totalWins}</p></div>
            <div><p className="text-xs">Losses</p><p className="text-2xl text-rose-300 font-bold">{userLifetime.totalLosses}</p></div>
          </div>
          <p className="mt-3 text-xs text-white/70">Win % <span className="font-mono">{formatPct(userLifetime.winPct)}</span></p>
        </div>
      )}

    </div>
  );
}
