"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
@@ -11,22 +9,14 @@ import {
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

// 🔽 use a RELATIVE import so no alias issues on Vercel
import CommentsSection from "../components/CommentsSection";

dayjsBase.extend(utc);
dayjsBase.extend(tz);
import dayjs from "dayjs";

type Question = {
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
  commentsCount?: number; // optional
};

type Game = {
@@ -40,7 +30,7 @@ type Game = {
type RoundDoc = { games: Game[] };

type Row = {
  id: string; // roundId-gi-qi
  id: string;
  roundId: string;
  match: string;
  venue: string;
@@ -50,43 +40,39 @@ type Row = {
  noPercent: number;
  startTime: Timestamp | string | Date | null;
  status: "open" | "pending" | "final" | "void";
  commentsCount?: number;
};

const LOCAL_TZ = "Australia/Melbourne";

function toDate(raw: Row["startTime"]): Date | null {
  if (!raw) return null;
  // Firestore Timestamp
  if (typeof (raw as any)?.toDate === "function") {
// --- helpers ---
const toDate = (v: Row["startTime"]): Date | null => {
  if (!v) return null;
  if (typeof (v as any)?.toDate === "function") {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      // ignore
    }
      return (v as Timestamp).toDate();
    } catch {}
  }
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string") {
    const d = new Date(raw);
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
};

function formatStart(raw: Row["startTime"]) {
  const d = toDate(raw);
const formatStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  const dayjs = dayjsBase.tz(d, LOCAL_TZ);
  return `${dayjs.format("ddd DD Mar, h:mm a")} AEDT`;
}

const statusOptions = ["open", "final", "pending", "void", "all"] as const;
type StatusFilter = (typeof statusOptions)[number];
  return `${dayjs(d).format("ddd, D MMM")}, ${dayjs(d).format("h:mm A")} AEDT`;
};

// --- component ---
export default function PicksClient() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [tab, setTab] = useState<"open" | "final" | "pending" | "void" | "all">(
    "open"
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
@@ -97,15 +83,15 @@ export default function PicksClient() {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: Row[] = [];
        const acc: Row[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            const qArr = Array.isArray(g.questions) ? g.questions : [];
            qArr.forEach((q, qi) => {
              all.push({
            const qs = Array.isArray(g.questions) ? g.questions : [];
            qs.forEach((q, qi) => {
              acc.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
@@ -116,20 +102,22 @@ export default function PicksClient() {
                noPercent: Number(q.noPercent ?? 0),
                startTime: g.startTime ?? null,
                status: (g.status as Row["status"]) ?? "open",
                commentsCount: q.commentsCount ?? 0,
              });
            });
          });
        });

        // sort by start time then quarter
        all.sort((a, b) => {
        // sort compact list
        acc.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          if (a.match !== b.match) return a.match.localeCompare(b.match);
          return a.quarter - b.quarter;
        });

        setRows(all);
        setRows(acc);
      } catch (e) {
        console.error("picks load error", e);
      } finally {
@@ -140,148 +128,210 @@ export default function PicksClient() {
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const handlePick = (row: Row, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    // TODO: write pick to Firestore (collection 'picks')
    console.log("pick", { rowId: row.id, choice, uid: user.uid });
    // TODO: write to Firestore and update %s via Cloud Function later
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* Title + Tabs */}
      <div className="pt-8 pb-4">
        <h1 className="text-center text-4xl font-extrabold text-orange-500">
          Make Picks
        </h1>

        {/* sponsor banner under title */}
        <div className="mx-auto mt-4 w-full max-w-3xl rounded-2xl bg-white/5 px-4 py-3 text-center text-white/80 shadow">
          Sponsor Banner • 970×90
        </div>

        <div className="mt-6 flex gap-2 justify-center">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                filter === s
                  ? "bg-orange-500 text-black"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { k: "open", label: "Open" },
          { k: "final", label: "Final" },
          { k: "pending", label: "Pending" },
          { k: "void", label: "Void" },
          { k: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.k
                ? "bg-[#ff6a1a] text-black"
                : "bg-[#1a2230] text-gray-200 hover:bg-[#223044]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[220px_1fr_56px_1.4fr_220px] gap-3 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
          <div>Start</div>
          <div className="pl-6">Match · Venue</div>
          <div>Q#</div>
          <div>Question</div>
          <div className="text-right pr-2">Pick · Yes % · No %</div>
        </div>
      {/* Table header — tighter padding & line-height */}
      <div className="hidden md:grid grid-cols-[200px_1fr_54px_1.8fr_220px] text-xs uppercase tracking-wide text-gray-300/80 px-3 py-2 bg-[#0f141c] rounded-t-lg border border-[#253244]">
        <div>Start</div>
        <div className="pl-2">Match • Venue</div>
        <div className="text-center">Q#</div>
        <div className="pl-2">Question</div>
        <div className="text-right pr-1">Pick · Yes % · No %</div>
      </div>

        {/* Rows */}
        <div className="divide-y divide-white/10">
          {loading && (
            <div className="px-4 py-6 text-white/70">Loading picks…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-white/70">
              No questions for this filter.
      {/* Rows */}
      <div className="rounded-b-lg overflow-hidden border-x border-b border-[#253244]">
        {loading && (
          <div className="px-3 py-4 text-sm text-gray-300">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-300">
            No selections for this filter yet.
          </div>
        )}

        {filtered.map((r, idx) => (
          <div
            key={r.id}
            className={`grid md:grid-cols-[200px_1fr_54px_1.8fr_220px] items-center px-3
                        ${idx % 2 ? "bg-[#0d1219]" : "bg-[#0b1016]"}`}
            style={{
              paddingTop: "8px", // compact (~30% less)
              paddingBottom: "8px",
              rowGap: "4px",
            }}
          >
            {/* Start */}
            <div className="text-[13px] leading-tight text-gray-200">
              <div>{formatStart(r.startTime).split(",").slice(0, 2).join(",")}</div>
              <div className="text-gray-400">AEDT</div>
            </div>
          )}

          {filtered.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[220px_1fr_56px_1.4fr_220px] items-start gap-3 px-4 py-4"
            >
              {/* Start */}
              <div className="text-white/90">
                <div>{formatStart(row.startTime)}</div>
                <div
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.status === "open"
                      ? "bg-emerald-600/20 text-emerald-300"
                      : row.status === "final"
                      ? "bg-indigo-600/20 text-indigo-300"
                      : row.status === "pending"
                      ? "bg-amber-600/20 text-amber-300"
                      : "bg-zinc-600/20 text-zinc-300"
            {/* Match & Venue (with status pill placed left of match on md+) */}
            <div className="pl-2 leading-tight">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                    r.status === "open"
                      ? "bg-emerald-900/40 text-emerald-300"
                      : r.status === "final"
                      ? "bg-sky-900/40 text-sky-300"
                      : r.status === "pending"
                      ? "bg-amber-900/40 text-amber-300"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {row.status.toUpperCase()}
                </div>
              </div>

              {/* Match · Venue */}
              <div className="pl-6">
                <Link
                  {r.status.toUpperCase()}
                </span>
                <a
                  className="font-semibold text-[15px] text-[#ff9c4d] hover:underline"
                  href="#"
                  className="font-semibold text-orange-400 hover:underline"
                >
                  {row.match}
                </Link>
                <div className="text-sm text-white/60">{row.venue}</div>
                  {r.match}
                </a>
              </div>
              <div className="text-[12px] text-gray-400">{r.venue}</div>
            </div>

              {/* Q# */}
              <div className="font-semibold text-white/80">{`Q${row.quarter}`}</div>

              {/* Question (bold & slightly larger) */}
              <div className="pr-4">
                <div className="font-semibold text-white tracking-tight">
                  {row.question}
                </div>
            {/* Q# */}
            <div className="text-center">
              <span className="inline-block rounded-md bg-[#1a2230] px-2 py-[2px] text-[11px] text-gray-200">
                Q{r.quarter}
              </span>
            </div>

                {/* Comments (compact pill) */}
<div className="mt-2">
  <CommentsSection
    pickId={row.id}
    userName={user?.displayName || "Anonymous"}
    compact
  />
</div>
            {/* Question (bold, compact) */}
            <div className="pl-2">
              <div className="font-semibold text-[15px] leading-snug text-gray-100">
                {r.question}
              </div>
              {/* comments pill */}
              <a
                href="#"
                className="mt-1 inline-flex items-center rounded-full border border-[#2a384b] px-2 py-[2px] text-[11px] text-gray-300 hover:border-[#415471] hover:text-white"
                title="View comments"
              >
                Comments ({r.commentsCount ?? 0})
              </a>
            </div>

            {/* Pick / % */}
            <div className="flex items-center justify-end gap-2 pr-1">
              <button
                onClick={() => handlePick(r, "yes")}
                className="rounded-md bg-[#ff6a1a] text-black text-[13px] font-semibold px-3 py-1 hover:brightness-105 active:translate-y-[1px]"
              >
                Yes
              </button>
              <button
                onClick={() => handlePick(r, "no")}
                className="rounded-md bg-[#2a384b] text-gray-100 text-[13px] font-semibold px-3 py-1 hover:bg-[#344761] active:translate-y-[1px]"
              >
                No
              </button>

              <div className="ml-2 text-[12px] tabular-nums text-gray-300">
                <span className="mr-1">{Math.round(r.yesPercent)}%</span>
                <span className="mx-1 text-gray-500">·</span>
                <span>{Math.round(r.noPercent)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3 mt-3">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#253244] bg-[#0b1016] p-3">
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <div>{formatStart(r.startTime)}</div>
              <span
                className={`ml-2 rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                  r.status === "open"
                    ? "bg-emerald-900/40 text-emerald-300"
                    : r.status === "final"
                    ? "bg-sky-900/40 text-sky-300"
                    : r.status === "pending"
                    ? "bg-amber-900/40 text-amber-300"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {r.status.toUpperCase()}
              </span>
            </div>
            <div className="text-[#ff9c4d] font-semibold">{r.match}</div>
            <div className="text-xs text-gray-400">{r.venue}</div>
            <div className="mt-2 text-[13.5px] font-semibold text-gray-100">
              Q{r.quarter} · {r.question}
            </div>

              {/* Pick actions */}
              <div className="flex items-center justify-end gap-2">
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePick(row, "yes")}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-orange-400"
                  onClick={() => handlePick(r, "yes")}
                  className="rounded-md bg-[#ff6a1a] text-black text-[13px] font-semibold px-3 py-1"
                >
                  Yes
                </button>
                <button
                  onClick={() => handlePick(row, "no")}
                  className="rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
                  onClick={() => handlePick(r, "no")}
                  className="rounded-md bg-[#2a384b] text-gray-100 text-[13px] font-semibold px-3 py-1"
                >
                  No
                </button>

                <div className="ml-3 text-right text-sm text-white/70 tabular-nums">
                  <div>Yes {row.yesPercent}% ·</div>
                  <div>No {row.noPercent}%</div>
                </div>
              </div>
              <a
                href="#"
                className="rounded-full border border-[#2a384b] px-2 py-[2px] text-[11px] text-gray-300"
              >
                Comments ({r.commentsCount ?? 0})
              </a>
            </div>

            <div className="mt-1 text-xs tabular-nums text-gray-300 text-right">
              Yes {Math.round(r.yesPercent)}% · No {Math.round(r.noPercent)}%
            </div>
          ))}
        </div>
          </div>
        ))}
      </div>
    </main>
    </div>
  );
}
