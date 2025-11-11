"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";

dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

/* ----------------------- Types ----------------------- */
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
  id: string;
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

/* ----------------------- Helpers ----------------------- */
const toDate = (v: Row["startTime"]): Date | null => {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof (v as any)?.toDate === "function") {
    try {
      return (v as Timestamp).toDate();
    } catch {
      /* ignore */
    }
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "string") {
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;
  }
  return null;
};

const formatStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  const z = dayjs(d).tz(LOCAL_TZ);
  return `${z.format("ddd D Mar,")}\n${z.format("h:mm a")} AEDT`;
};

const statusBadge = (s: Row["status"]) => {
  const cls =
    s === "open"
      ? "bg-emerald-700/30 text-emerald-300"
      : s === "pending"
      ? "bg-amber-700/30 text-amber-300"
      : s === "final"
      ? "bg-sky-700/30 text-sky-300"
      : "bg-rose-700/30 text-rose-300";

  return (
    <span className={`mt-1 w-fit px-2 py-0.5 rounded-md text-[10px] ${cls}`}>
      {s?.toUpperCase()}
    </span>
  );
};

/* ----------------------- Component ----------------------- */
export default function PicksClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<"open" | "pending" | "final" | "void" | "all">("open");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const out: Row[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;

          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            const qs = Array.isArray(g.questions) ? g.questions : [];
            qs.forEach((q, qi) => {
              out.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "",
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

        // Sort by time then quarter
        out.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          return a.quarter - b.quarter;
        });

        setRows(out);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    if (status === "all") return rows;
    return rows.filter((r) => r.status === status);
  }, [rows, status]);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 lg:px-8 py-6">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-extrabold text-orange-400 text-center">
        Make Picks
      </h1>

      {/* Banner */}
      <div className="mt-4 mb-6">
        <div className="mx-auto max-w-[970px] rounded-2xl border border-white/10 bg-white/5 text-white/70 text-center text-sm py-6">
          Sponsor Banner • 970×90
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 justify-center mb-4">
        {(["open", "final", "pending", "void", "all"] as const).map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition
                ${active ? "bg-orange-500 text-black" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Table wrapper */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {/* Header */}
        <div
          className="
            grid items-center
            px-3 py-3
            text-xs tracking-wide text-white/70
            border-b border-white/10
            "
          style={{
            gridTemplateColumns:
              "minmax(160px, 180px) minmax(260px, 1.3fr) 56px 1fr 160px",
          }}
        >
          <div>Start</div>
          <div className="pl-3">Match · Venue</div>
          <div>Q#</div>
          <div>Question</div>
          <div className="text-right pr-1">Pick · Yes % · No %</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/8">
          {loading && (
            <div className="px-4 py-6 text-white/70 text-sm">Loading…</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-6 text-white/70 text-sm">
              No questions found.
            </div>
          )}

          {!loading &&
            filtered.map((r) => (
              <div
                key={r.id}
                className="grid items-center px-3 py-3 text-sm"
                style={{
                  gridTemplateColumns:
                    "minmax(160px, 180px) minmax(260px, 1.3fr) 56px 1fr 160px",
                }}
              >
                {/* START (date + status stacked) */}
                <div className="text-[11px] leading-tight whitespace-pre-wrap text-white/80">
                  {formatStart(r.startTime)}
                  <div>{statusBadge(r.status)}</div>
                </div>

                {/* MATCH · VENUE (nudged right so pill never overlaps) */}
                <div className="pl-3">
                  <div className="text-orange-300 font-semibold">
                    <Link href="#" className="hover:underline">
                      {r.match}
                    </Link>
                  </div>
                  <div className="text-[12px] text-white/70">
                    {r.venue || "TBD"}
                  </div>
                </div>

                {/* Q# */}
                <div className="text-white/70 font-semibold">Q{r.quarter}</div>

                {/* QUESTION */}
                <div className="text-white font-medium">{r.question}</div>

                {/* ACTIONS / PERCENTS */}
                <div className="flex items-center justify-end gap-2">
                  <button className="px-2.5 py-1 rounded-md bg-orange-500 text-black text-xs font-semibold hover:bg-orange-400">
                    Yes
                  </button>
                  <button className="px-2.5 py-1 rounded-md bg-white/20 text-white text-xs font-semibold hover:bg-white/25">
                    No
                  </button>
                  <div className="ml-2 text-[12px] text-white/70 tabular-nums">
                    {Math.round(r.yesPercent)}% · {Math.round(r.noPercent)}%
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
