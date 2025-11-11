"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import Image from "next/image";

type Scope = "overall" | "round";
type Row = {
  uid: string;
  displayName: string;
  photoURL?: string;

  // totals for the chosen scope (overall or this round)
  picks: number;
  wins: number;
  losses: number;

  currentStreak: number; // W#
  bestStreak: number;    // W#

  // optional; falls back to "No Pick"
  currentPickStatus?: string; // "Pick Selected" | "No Pick" | etc.
};

const seasons = Array.from({ length: 6 }, (_, i) => 2026 - i);
const rounds = Array.from({ length: 23 }, (_, i) => i + 1);

export default function LeaderboardClient() {
  const [season, setSeason] = useState<number>(2026);
  const [round, setRound] = useState<number>(1);
  const [scope, setScope] = useState<Scope>("overall");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // Preferred aggregate doc ids:
        //   overall -> leaderboards/{season}-overall
        //   round   -> leaderboards/{season}-round-{round}
        const aggId = scope === "overall" ? `${season}-overall` : `${season}-round-${round}`;
        const agg = await getDoc(doc(db, "leaderboards", aggId));
        if (!cancelled && agg.exists()) {
          setRows(normalize((agg.data() as any)?.standings ?? []));
          setLoading(false);
          return;
        }

        // Fallback flat collections:
        //   overall -> user_stats_{season}
        //   round   -> user_stats_{season}_round_{round}
        const coll =
          scope === "overall" ? `user_stats_${season}` : `user_stats_${season}_round_${round}`;
        const snap = await getDocs(query(collection(db, coll), orderBy("wins", "desc")));
        const list: Row[] = [];
        snap.forEach((d) => list.push(fallbackRow(d.id, d.data())));

        if (!cancelled) {
          setRows(list);
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
  }, [season, round, scope]);

  // Sort like ESPN: by CURRENT streak, then LONGEST streak, then fewest picks
  const table = useMemo(() => {
    return [...rows]
      .sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.picks - b.picks;
      })
      .map((r, i) => ({
        rank: i + 1,
        ...r,
        record: `${r.picks}-${r.wins}-${r.losses}`,
        currentPickStatus: r.currentPickStatus || "No Pick",
      }));
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* Title */}
      <div className="pt-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-orange-400 mb-6">
          Leaderboards
        </h1>
      </div>

      {/* Sponsor banner */}
      <div className="mt-6 mb-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-6 text-center text-white/70 shadow-lg">
          Sponsor Banner • 970×90
        </div>
      </div>

      {/* Controls: Season + Round inline, scope toggles on right */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center flex-wrap gap-3">
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

          <label className="ml-2 text-white/70">Round</label>
          <select
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
            className="rounded-lg bg-white/10 text-white px-3 py-2 border border-white/10 focus:outline-none"
            disabled={scope === "overall"}
            title={scope === "overall" ? "Switch to Round to change the round" : ""}
          >
            {rounds.map((r) => (
              <option key={r} value={r}>
                {r}
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
                <th className="px-4 py-3">Current Streak</th>
                <th className="px-4 py-3">Longest Streak</th>
                <th className="px-4 py-3">Current Pick</th>
                <th className="px-4 py-3">
                  {scope === "round" ? "Total Round Record" : "Total Record"}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/70">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && table.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <p className="text-white/80">No leaderboard data yet.</p>
                    <p className="text-white/50 text-sm mt-1">
                      Standings update after picks settle. Ties broken by current streak, then best streak, then fewest picks.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                table.map((r) => (
                  <tr key={r.uid} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-white/80">{r.rank}</td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.displayName} photoURL={r.photoURL} />
                        <span className="font-medium text-white">{r.displayName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-lg bg-emerald-500/15 text-emerald-300 px-2 py-1 text-xs font-semibold">
                        W{r.currentStreak}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white/90">W{r.bestStreak}</td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex rounded-lg px-2 py-1 text-xs font-semibold " +
                          (r.currentPickStatus === "Pick Selected"
                            ? "bg-orange-500/20 text-orange-300"
                            : "bg-white/10 text-white/70")
                        }
                      >
                        {r.currentPickStatus}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white/80">{r.record}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/50">
        Standings update as picks settle. Ties: current streak → best streak → fewest picks.
      </p>
    </div>
  );
}

/* ---------- helpers ---------- */
function fallbackRow(id: string, v: any): Row {
  return {
    uid: id,
    displayName: String(v?.displayName ?? "Player"),
    photoURL: v?.photoURL,
    picks: num(v?.picks),
    wins: num(v?.wins),
    losses: num(v?.losses),
    currentStreak: num(v?.currentStreak),
    bestStreak: num(v?.bestStreak),
    currentPickStatus: v?.currentPickStatus || (v?.currentPick ? "Pick Selected" : "No Pick"),
  };
}

function normalize(list: any[]): Row[] {
  return (list ?? []).map((v) => ({
    uid: String(v.uid ?? v.id ?? Math.random().toString(36).slice(2)),
    displayName: String(v.displayName ?? "Player"),
    photoURL: v.photoURL,
    picks: num(v.picks),
    wins: num(v.wins),
    losses: num(v.losses),
    currentStreak: num(v.currentStreak),
    bestStreak: num(v.bestStreak),
    currentPickStatus: v.currentPickStatus || (v.currentPick ? "Pick Selected" : "No Pick"),
  }));
}

function num(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function Avatar({ name, photoURL }: { name: string; photoURL?: string }) {
  if (photoURL) {
    return (
      <span className="relative inline-block h-8 w-8 overflow-hidden rounded-full bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={name} src={photoURL} className="h-full w-full object-cover" />
      </span>
    );
  }
  const inits = name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <div className="h-8 w-8 rounded-full bg-white/10 text-white/70 text-xs flex items-center justify-center">
      {inits || "P"}
    </div>
  );
}
