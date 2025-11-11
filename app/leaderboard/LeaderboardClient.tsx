"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import Link from "next/link";

type Row = {
  uid: string;
  displayName: string;
  photoURL?: string;
  points: number;          // total points
  picks: number;           // total picks made
  wins: number;            // total wins
  losses: number;          // total losses
  currentStreak: number;   // e.g. 5
  bestStreak: number;      // e.g. 17
};

type Scope = "overall" | "round";

const seasons = Array.from({ length: 6 }, (_, i) => 2026 - i); // 2026 → 2021

export default function LeaderboardClient() {
  const [season, setSeason] = useState<number>(2026);
  const [scope, setScope] = useState<Scope>("overall");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // 1) Try a doc that aggregates a whole table:
        //    /leaderboards/{season}-{scope}  -> { standings: Row[] }
        const aggId = `${season}-${scope}`;
        const aggRef = doc(db, "leaderboards", aggId);
        const aggSnap = await getDoc(aggRef);

        if (!cancelled && aggSnap.exists()) {
          const data = aggSnap.data() as any;
          const standings = (data?.standings ?? []) as Row[];
          setRows(normalize(standings));
          setLoading(false);
          return;
        }

        // 2) Otherwise fall back to a flat collection of user stats, ordered:
        //    /user_stats_{season}  (fields include scope-agnostic totals)
        const collName = `user_stats_${season}`;
        const collRef = collection(db, collName);
        const q = query(collRef, orderBy("points", "desc"));
        const snap = await getDocs(q);

        const fallback: Row[] = [];
        snap.forEach((d) => {
          const v = d.data() as any;
          // you can adapt these keys to your final schema
          fallback.push({
            uid: d.id,
            displayName: v.displayName ?? "Player",
            photoURL: v.photoURL,
            points: Number(v.points ?? 0),
            picks: Number(v.picks ?? 0),
            wins: Number(v.wins ?? 0),
            losses: Number(v.losses ?? 0),
            currentStreak: Number(v.currentStreak ?? 0),
            bestStreak: Number(v.bestStreak ?? 0),
          });
        });

        if (!cancelled) {
          setRows(normalize(fallback));
          setLoading(false);
        }
      } catch (e) {
        console.error("leaderboard load error:", e);
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [season, scope]);

  const table = useMemo(() => {
    // Sort by scope preference:
    //  - overall: points desc, tiebreak = bestStreak desc, picks asc
    //  - round:   currentStreak desc, tiebreak = bestStreak desc, picks asc
    const sorted = [...rows].sort((a, b) => {
      if (scope === "overall") {
        if (b.points !== a.points) return b.points - a.points;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.picks - b.picks;
      } else {
        if (b.currentStreak !== a.currentStreak)
          return b.currentStreak - a.currentStreak;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.picks - b.picks;
      }
    });

    return sorted.map((r, i) => {
      const rank = i + 1;
      const record = `${r.wins}-${r.losses}-${Math.max(
        0,
        r.picks - r.wins - r.losses
      )}`;
      const winRate =
        r.picks > 0 ? `${Math.round((r.wins / r.picks) * 100)}%` : "—";
      return { rank, record, ...r, winRate };
    });
  }, [rows, scope]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* Title */}
      <div className="pt-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-orange-500 tracking-tight">
          Leaderboards
        </h1>
      </div>

      {/* Sponsor banner */}
      <div className="mt-6 mb-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-6 text-center text-white/70 shadow-lg">
          Sponsor Banner • 970×90
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-white/70">Season</label>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-lg bg-white/10 text-white px-3 py-2 border border-white/10 focus:outline-none"
          >
            {seasons.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(["overall", "round"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={
                "px-4 py-2 rounded-xl border text-sm font-semibold transition " +
                (scope === s
                  ? "bg-orange-500 text-black border-orange-400"
                  : "bg-white/10 text-white/80 border-white/10 hover:bg-white/15")
              }
            >
              {s === "overall" ? "Overall" : "Round"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-white/70 text-xs uppercase tracking-wide bg-white/5">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Picks</th>
                <th className="px-4 py-3">Wins</th>
                <th className="px-4 py-3">Win Rate</th>
                <th className="px-4 py-3">Streak (Current)</th>
                <th className="px-4 py-3">Streak (Best)</th>
                <th className="px-4 py-3">Record</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-white/70">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && table.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <p className="text-white/80">
                      No leaderboard data yet.
                    </p>
                    <p className="text-white/50 text-sm mt-1">
                      Points and standings update after picks settle. Ties are
                      broken by best streak, then earliest achieved.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                table.map((r) => (
                  <tr key={r.uid} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-white/80">
                      {r.rank}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/70">
                          {initials(r.displayName)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-white">
                            {r.displayName}
                          </span>
                          <Link
                            href={`/profile/${r.uid}`}
                            className="text-xs text-white/50 hover:text-white/70"
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">{r.points}</td>
                    <td className="px-4 py-3 text-white/90">{r.picks}</td>
                    <td className="px-4 py-3 text-white/90">{r.wins}</td>
                    <td className="px-4 py-3 text-white/90">{r.winRate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-lg bg-emerald-500/15 text-emerald-300 px-2 py-1 text-xs font-semibold">
                        W{r.currentStreak}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/90">W{r.bestStreak}</td>
                    <td className="px-4 py-3 text-white/70">{r.record}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-4 text-xs text-white/50">
        Points & standings update as picks settle. Ties are broken by best
        streak, then earliest achieved.
      </p>
    </div>
  );
}

/* ---------- helpers ---------- */

function normalize(list: any[]): Row[] {
  return (list ?? []).map((v) => ({
    uid: String(v.uid ?? v.id ?? cryptoRandomId()),
    displayName: String(v.displayName ?? "Player"),
    photoURL: v.photoURL,
    points: num(v.points),
    picks: num(v.picks),
    wins: num(v.wins),
    losses: num(v.losses),
    currentStreak: num(v.currentStreak),
    bestStreak: num(v.bestStreak),
  }));
}

function num(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
