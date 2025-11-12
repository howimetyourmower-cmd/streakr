"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
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

type Question = {
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  match: string;
  venue?: string;
  startTime?: Timestamp | string | Date | null;
  status?: "open" | "pending" | "final" | "void";
  questions: Question[];
};

type RoundDoc = { games: Game[] };

type Row = {
  id: string; // roundId-gi-qi
  roundId: string;
  match: string;
  venue: string;
  quarter: number;
  question: string;
  yesPercent: number;
  noPercent: number;
  startTime: Timestamp | string | Date | null;
  status: "open" | "pending" | "final" | "void";
};

const LOCAL_TZ = "Australia/Melbourne";

function toDate(raw: Row["startTime"]): Date | null {
  if (!raw) return null;
  // Firestore Timestamp
  if (typeof (raw as any)?.toDate === "function") {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      // ignore
    }
  }
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatStart(raw: Row["startTime"]) {
  const d = toDate(raw);
  if (!d) return "TBD";
  const dayjs = dayjsBase.tz(d, LOCAL_TZ);
  return `${dayjs.format("ddd DD Mar, h:mm a")} AEDT`;
}

const statusOptions = ["open", "final", "pending", "void", "all"] as const;
type StatusFilter = (typeof statusOptions)[number];

export default function PicksClient() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("open");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: Row[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            const qArr = Array.isArray(g.questions) ? g.questions : [];
            qArr.forEach((q, qi) => {
              all.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "TBD",
                quarter: Number(q.quarter ?? 1),
                question: q.question ?? "",
                yesPercent: Number(q.yesPercent ?? 0),
                noPercent: Number(q.noPercent ?? 0),
                startTime: g.startTime ?? null,
                status: (g.status as Row["status"]) ?? "open",
              });
            });
          });
        });

        // sort by start time then quarter
        all.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          return a.quarter - b.quarter;
        });

        setRows(all);
      } catch (e) {
        console.error("picks load error", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const handlePick = (row: Row, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    // TODO: write pick to Firestore (collection 'picks')
    console.log("pick", { rowId: row.id, choice, uid: user.uid });
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

        {/* Rows */}
        <div className="divide-y divide-white/10">
          {loading && (
            <div className="px-4 py-6 text-white/70">Loading picks…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-white/70">
              No questions for this filter.
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
                  }`}
                >
                  {row.status.toUpperCase()}
                </div>
              </div>

              {/* Match · Venue */}
              <div className="pl-6">
                <Link
                  href="#"
                  className="font-semibold text-orange-400 hover:underline"
                >
                  {row.match}
                </Link>
                <div className="text-sm text-white/60">{row.venue}</div>
              </div>

              {/* Q# */}
              <div className="font-semibold text-white/80">{`Q${row.quarter}`}</div>

              {/* Question (bold & slightly larger) */}
              <div className="pr-4">
                <div className="font-semibold text-white tracking-tight">
                  {row.question}
                </div>

                {/* Comments (compact pill) */}
<div className="mt-2">
  <CommentsSection
    pickId={row.id}
    userName={user?.displayName || "Anonymous"}
    compact
  />
</div>

              </div>

              {/* Pick actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handlePick(row, "yes")}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-orange-400"
                >
                  Yes
                </button>
                <button
                  onClick={() => handlePick(row, "no")}
                  className="rounded-md bg-white/20 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/30"
                >
                  No
                </button>

                <div className="ml-3 text-right text-sm text-white/70 tabular-nums">
                  <div>Yes {row.yesPercent}% ·</div>
                  <div>No {row.noPercent}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
