"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { app } from "../config/firebaseClient"; // <- your path is app/config/firebaseClient.ts

type Row = {
  id: string;
  displayName: string;
  handle?: string;                 // optional: e.g. @glenn
  currentStreak: number;           // positive = W, negative = L (e.g. 7 = W7, -3 = L3)
  longestStreak: number;           // e.g. 17
  currentPick: "PICK_SELECTED" | "NO_PICK";
  record: { w: number; l: number; v?: number }; // v = voids (optional)
};

type SortKey = "displayName" | "currentStreak" | "longestStreak" | "currentPick" | "record";

export default function LeaderboardsPage() {
  const db = useMemo(() => getFirestore(app), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("currentStreak");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // --- FETCH ---
  useEffect(() => {
    (async () => {
      try {
        // Adjust collection name if you store leaderboard elsewhere:
        // e.g. "leaderboard" or "users"
        const COL = "users";

        // If you have a precomputed leaderboard collection, swap to that and keep orderBy.
        let qRef = query(collection(db, COL), limit(200));
        const snap = await getDocs(qRef);

        const data: Row[] = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            displayName: v.displayName ?? "Player",
            handle: v.handle,
            currentStreak: typeof v.currentStreak === "number" ? v.currentStreak : 0,
            longestStreak: typeof v.longestStreak === "number" ? v.longestStreak : 0,
            currentPick: v.currentPick === "PICK_SELECTED" ? "PICK_SELECTED" : "NO_PICK",
            record: {
              w: Number(v.record?.w ?? v.wins ?? 0),
              l: Number(v.record?.l ?? v.losses ?? 0),
              v: v.record?.v ?? v.voids, // optional
            },
          };
        });

        setRows(data);
      } catch (e) {
        // Fallback demo rows so page still renders
        setRows([
          {
            id: "demo1",
            displayName: "Wormzilla",
            handle: "spurrier69",
            currentStreak: 17,
            longestStreak: 17,
            currentPick: "NO_PICK",
            record: { w: 17, l: 1, v: 0 },
          },
          {
            id: "demo2",
            displayName: "Bigfatty100",
            handle: "Bigfatty100",
            currentStreak: 1,
            longestStreak: 17,
            currentPick: "NO_PICK",
            record: { w: 26, l: 8, v: 0 },
          },
          {
            id: "demo3",
            displayName: "scott100062",
            handle: "scott100062",
            currentStreak: 2,
            longestStreak: 17,
            currentPick: "PICK_SELECTED",
            record: { w: 26, l: 9, v: 0 },
          },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  // --- SORT ---
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "displayName") {
        return a.displayName.localeCompare(b.displayName) * dir;
      }
      if (sortKey === "currentPick") {
        const av = a.currentPick === "PICK_SELECTED" ? 1 : 0;
        const bv = b.currentPick === "PICK_SELECTED" ? 1 : 0;
        return (av - bv) * dir;
      }
      if (sortKey === "record") {
        // Sort by win % then wins
        const aPct = a.record.w + a.record.l > 0 ? a.record.w / (a.record.w + a.record.l) : 0;
        const bPct = b.record.w + b.record.l > 0 ? b.record.w / (b.record.w + b.record.l) : 0;
        if (aPct !== bPct) return (aPct - bPct) * dir;
        return (a.record.w - b.record.w) * dir;
      }
      // numeric keys
      return ((a as any)[sortKey] - (b as any)[sortKey]) * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "displayName" ? "asc" : "desc");
    }
  };

  const headerBtn = (label: string, key: SortKey) => (
    <button
      onClick={() => setSort(key)}
      className="inline-flex items-center gap-2 text-left hover:opacity-80"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span className="text-xs opacity-70">
        {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );

  const streakLabel = (n: number) => (n >= 0 ? `W${n}` : `L${Math.abs(n)}`);
  const pickBadge = (p: Row["currentPick"]) =>
    p === "PICK_SELECTED" ? (
      <span className="px-2 py-1 rounded-full text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">
        Pick Selected
      </span>
    ) : (
      <span className="px-2 py-1 rounded-full text-xs bg-zinc-600/20 text-zinc-300 border border-zinc-600/40">
        No Pick
      </span>
    );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-white">
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">Leaderboards</h1>

      <div className="rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 shadow-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-zinc-800/60 backdrop-blur sticky top-0">
          <div className="col-span-4">{headerBtn("Player Name", "displayName")}</div>
          <div className="col-span-2">{headerBtn("Current", "currentStreak")}</div>
          <div className="col-span-2">{headerBtn("Longest", "longestStreak")}</div>
          <div className="col-span-2">{headerBtn("Current Pick", "currentPick")}</div>
          <div className="col-span-2">{headerBtn("Record", "record")}</div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="px-5 py-10 text-zinc-300">Loading leaderboard…</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-10 text-zinc-300">No players yet.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {sorted.map((r, i) => (
              <li key={r.id} className="grid grid-cols-12 gap-4 px-5 py-3 items-center">
                {/* Player */}
                <div className="col-span-4 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.displayName}</span>
                    {r.handle && (
                      <Link
                        href={`/profile/${encodeURIComponent(r.id)}`}
                        className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                      >
                        {r.handle}
                      </Link>
                    )}
                  </div>
                  {/* Optional subtle row stripe like the reference */}
                  <div className="h-[6px] mt-2 bg-gradient-to-r from-orange-500/30 via-orange-400/10 to-transparent rounded-full"></div>
                </div>

                {/* Current */}
                <div className="col-span-2">
                  <span
                    className={
                      "inline-block min-w-[3.5rem] text-center rounded-md px-2 py-1 text-sm font-semibold " +
                      (r.currentStreak >= 0
                        ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/40"
                        : "bg-rose-600/20 text-rose-300 ring-1 ring-rose-600/40")
                    }
                  >
                    {streakLabel(r.currentStreak)}
                  </span>
                </div>

                {/* Longest */}
                <div className="col-span-2">
                  <span className="inline-block min-w-[3.5rem] text-center rounded-md px-2 py-1 text-sm font-semibold bg-zinc-700/40 text-zinc-200 ring-1 ring-white/10">
                    {r.longestStreak}
                  </span>
                </div>

                {/* Current Pick */}
                <div className="col-span-2">{pickBadge(r.currentPick)}</div>

                {/* Record */}
                <div className="col-span-2 font-mono text-sm">
                  {r.record.w}-{r.record.l}
                  {typeof r.record.v === "number" ? `-${r.record.v}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-zinc-400 mt-4">
        Tip: click the headers to sort (e.g., by Current, Longest, or Record).
      </p>
    </main>
  );
}
