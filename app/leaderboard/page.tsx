"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  DocumentData,
} from "firebase/firestore";

type Row = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  season: number;          // e.g. 2026
  round?: number | null;   // null/undefined means overall
  points: number;          // leaderboard points
  picks: number;           // total picks submitted
  correct: number;         // correct picks
  currentStreak?: number;
  bestStreak?: number;
};

const seasons = [2026, 2025];          // add more as needed
const rounds = Array.from({ length: 23 }, (_, i) => i + 1);

export default function LeaderboardClient() {
  const [season, setSeason] = useState<number>(2026);
  const [scope, setScope] = useState<"overall" | "round">("overall");
  const [round, setRound] = useState<number>(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Expecting a top-level "leaderboards" collection with docs shaped like Row
        // For round leaderboard: { season: 2026, round: 1, ... }
        // For overall leaderboard: { season: 2026, round: null (or missing), ... }
        const base = collection(db, "leaderboards");
        const filters = [
          where("season", "==", season),
          scope === "round" ? where("round", "==", round) : where("round", "in", [null, 0]),
        ] as any[];

        // If your "overall" docs omit the round field entirely, change the where to:
        //   where("isOverall", "==", true)
        // and store that boolean on your overall docs.
        // ^ Easy tweak later if needed.

        const q = query(base, ...filters, orderBy("points", "desc"), limit(100));
        const snap = await getDocs(q);

        const data: Row[] = [];
        snap.forEach((d) => {
          const v = d.data() as DocumentData;
          data.push({
            id: d.id,
            displayName: String(v.displayName ?? "Anonymous"),
            avatarUrl: v.avatarUrl ?? "",
            season: Number(v.season ?? season),
            round: typeof v.round === "number" ? v.round : null,
            points: Number(v.points ?? 0),
            picks: Number(v.picks ?? 0),
            correct: Number(v.correct ?? 0),
            currentStreak: Number(v.currentStreak ?? 0),
            bestStreak: Number(v.bestStreak ?? 0),
          });
        });

        setRows(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [season, scope, round]);

  const table = useMemo(() => {
    return rows.map((r, i) => {
      const rank = i + 1;
      const winRate = r.picks > 0 ? (r.correct / r.picks) * 100 : 0;
      return { ...r, rank, winRate };
    });
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 lg:px-8 py-6">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-orange-400 text-center">
        Leaderboards
      </h1>

      {/* Sponsor banner */}
      <div className="mt-4 mb-6">
        <div className="mx-auto max-w-[970px] rounded-2xl border border-white/10 bg-white/5 text-white/70 text-center text-sm py-6">
          Sponsor Banner • 970×90
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-white/70 text-sm">Season</label>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none"
          >
            {seasons.map((s) => (
              <option key={s} value={s} className="bg-slate-900">
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            {(["overall", "round"] as const).map((s) => {
              const active = scope === s;
              return (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition
                  ${active ? "bg-orange-500 text-black" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
                >
                  {s === "overall" ? "Overall" : "Round"}
                </button>
              );
            })}
          </div>

          {scope === "round" && (
            <select
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
              className="ml-2 bg-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none"
            >
              {rounds.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  Round {r}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {/* Head */}
        <div
          className="grid items-center px-3 py-3 text-xs tracking-wide text-white/70 border-b border-white/10"
          style={{
            gridTemplateColumns: "72px minmax(220px,1.2fr) 120px 120px 120px 120px",
          }}
        >
          <div>Rank</div>
          <div>Player</div>
          <div className="text-right pr-2">Points</div>
          <div className="text-right pr-2">Picks</div>
          <div className="text-right pr-2">Win Rate</div>
          <div className="text-right pr-2">Streak (Best)</div>
        </div>

        {/* Body */}
        <div className="divide-y divide-white/8">
          {loading && (
            <div className="px-4 py-6 text-white/70 text-sm">Loading…</div>
          )}
          {!loading && table.length === 0 && (
            <div className="px-4 py-6 text-white/70 text-sm">
              No leaderboard data yet.
            </div>
          )}

          {!loading &&
            table.map((r) => (
              <div
                key={r.id}
                className="grid items-center px-3 py-3 text-sm"
                style={{
                  gridTemplateColumns:
                    "72px minmax(220px,1.2fr) 120px 120px 120px 120px",
                }}
              >
                {/* Rank with medals for top 3 */}
                <div className="font-semibold">
                  {r.rank <= 3 ? (
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-black text-sm font-extrabold
                        ${r.rank === 1 ? "bg-yellow-400" : r.rank === 2 ? "bg-slate-300" : "bg-amber-600"}`}
                    >
                      {r.rank}
                    </span>
                  ) : (
                    <span className="text-white/80">{r.rank}</span>
                  )}
                </div>

                {/* Player */}
                <div className="flex items-center gap-3">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10" />
                  )}
                  <div className="text-white font-medium">{r.displayName}</div>
                </div>

                {/* Points */}
                <div className="text-right pr-2 font-semibold">
                  {Math.round(r.points)}
                </div>

                {/* Picks */}
                <div className="text-right pr-2 text-white/80 tabular-nums">
                  {r.picks}
                </div>

                {/* Win Rate */}
                <div className="text-right pr-2 text-white/80 tabular-nums">
                  {r.winRate.toFixed(1)}%
                </div>

                {/* Streaks */}
                <div className="text-right pr-2 text-white/80 tabular-nums">
                  {r.currentStreak ?? 0} ({r.bestStreak ?? 0})
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Footnote */}
      <p className="mt-3 text-xs text-white/50">
        Points and standings update as picks settle. Ties are broken by best
        streak, then earliest achieved.
      </p>
    </div>
  );
}
