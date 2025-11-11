// app/picks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

// ---- dayjs setup (same as home) ----
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import customParse from "dayjs/plugin/customParseFormat";
dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(customParse);

const LOCAL_TZ = "Australia/Melbourne";

/** Robust formatter that handles Firestore Timestamp, ISO strings, or readable strings */
function formatStartTime(raw: any): string {
  if (!raw) return "TBD";

  // Firestore Timestamp?
  if (raw?.toDate && typeof raw.toDate === "function") {
    return dayjs(raw.toDate()).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
  }

  // String? Try ISO first
  if (typeof raw === "string") {
    let d = dayjs(raw);
    if (!d.isValid()) {
      // try a couple of common human formats used during seeding
      const candidates = [
        "YYYY-MM-DDTHH:mm:ssZ",
        "YYYY-MM-DDTHH:mmZ",
        "ddd, D MMM YYYY, h:mm A",
        "dddd, D MMMM YYYY, h.mma",
        "dddd, D MMMM YYYY, h:mm A",
      ];
      for (const f of candidates) {
        d = dayjs.tz(raw, f, LOCAL_TZ);
        if (d.isValid()) break;
      }
    }
    if (d.isValid()) {
      return d.tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
    }
  }

  // Date instance?
  if (raw instanceof Date) {
    return dayjs(raw).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
  }

  return "TBD";
}

type Question = {
  quarter: number;
  question: string;
  status?: "open" | "pending" | "final" | "void";
  yesCount?: number;
  noCount?: number;
};

type Game = {
  match: string;
  venue?: string;
  startTime?: any; // Timestamp | string | Date
  questions: Question[];
};

type RoundDoc = {
  roundLabel?: string; // e.g. "Round 1" or "Opening Round"
  season?: number;
  games: Game[];
};

export default function PicksPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Allow ?round=round-1 or default to round-1
  const roundId = params.get("round") || "round-1";

  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // live subscribe to this round
  useEffect(() => {
    setLoading(true);
    const ref = doc(db, "rounds", roundId);
    getDoc(ref)
      .then((snap) => {
        setRound((snap.data() as RoundDoc) ?? null);
      })
      .finally(() => setLoading(false));

    // If you prefer true realtime updates, use onSnapshot:
    // const unsub = onSnapshot(ref, (snap) => {
    //   setRound((snap.data() as RoundDoc) ?? null);
    //   setLoading(false);
    // });
    // return () => unsub();
  }, [roundId]);

  // Flatten games → rows
  const rows = useMemo(() => {
    if (!round?.games) return [];

    const list: Array<{
      start: string;
      startSort: number;
      status: Question["status"];
      match: string;
      venue?: string;
      qnum: number;
      text: string;
      yesPct: number;
      noPct: number;
    }> = [];

    for (const g of round.games) {
      const startStr = formatStartTime(g.startTime);
      const startSort =
        g.startTime?.toDate?.() instanceof Date
          ? (g.startTime.toDate() as Date).getTime()
          : typeof g.startTime === "string"
          ? dayjs(g.startTime).isValid()
            ? dayjs(g.startTime).valueOf()
            : dayjs.tz(g.startTime, LOCAL_TZ).valueOf()
          : 0;

      for (const q of g.questions) {
        const yes = q.yesCount ?? 0;
        const no = q.noCount ?? 0;
        const total = yes + no;
        const yesPct = total ? Math.round((yes / total) * 100) : 0;
        const noPct = total ? 100 - yesPct : 0;

        list.push({
          start: startStr,
          startSort,
          status: q.status ?? "open",
          match: g.match,
          venue: g.venue,
          qnum: q.quarter,
          text: q.question,
          yesPct,
          noPct,
        });
      }
    }

    // sort by start time then quarter
    return list.sort((a, b) =>
      a.startSort === b.startSort
        ? a.qnum - b.qnum
        : a.startSort - b.startSort
    );
  }, [round]);

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-6">
          Make Picks
        </h1>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs uppercase tracking-wider text-gray-300/70 border-b border-white/10">
            <div className="col-span-3">Start</div>
            <div className="col-span-3">Match · Venue</div>
            <div className="col-span-1">Q#</div>
            <div className="col-span-3">Question</div>
            <div className="col-span-1 text-right">Yes %</div>
            <div className="col-span-1 text-right">No %</div>
          </div>

          {loading && (
            <div className="px-6 py-6 text-gray-400">Loading…</div>
          )}

          {!loading && rows.length === 0 && (
            <div className="px-6 py-6 text-gray-400">
              No questions available.
            </div>
          )}

          {!loading &&
            rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-t border-white/5 items-center"
              >
                {/* Start + status badge */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="text-sm text-gray-200">{r.start}</div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full ${
                      r.status === "open"
                        ? "bg-emerald-900/50 text-emerald-300 border border-emerald-400/30"
                        : r.status === "pending"
                        ? "bg-amber-900/40 text-amber-300 border border-amber-300/30"
                        : r.status === "final"
                        ? "bg-sky-900/40 text-sky-300 border border-sky-300/30"
                        : "bg-red-900/40 text-red-300 border border-red-300/30"
                    }`}
                  >
                    {r.status?.toUpperCase()}
                  </span>
                </div>

                {/* Match + venue */}
                <div className="col-span-3">
                  <div className="font-semibold text-orange-300">
                    <Link href={`/picks?round=${roundId}`} className="hover:underline">
                      {r.match}
                    </Link>
                  </div>
                  {r.venue && (
                    <div className="text-xs text-gray-400">{r.venue}</div>
                  )}
                </div>

                {/* Q# */}
                <div className="col-span-1">
                  <span className="inline-flex h-6 items-center justify-center rounded-md bg-white/5 px-2 text-xs font-semibold text-gray-200 border border-white/10">
                    Q{r.qnum}
                  </span>
                </div>

                {/* Question */}
                <div className="col-span-3">
                  <div className="font-semibold text-white">
                    {r.text}
                  </div>
                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <button className="rounded-md px-3 py-1 text-sm font-semibold bg-orange-500/90 hover:bg-orange-500 text-black">
                      Yes
                    </button>
                    <button className="rounded-md px-3 py-1 text-sm font-semibold bg-purple-500/90 hover:bg-purple-500 text-white">
                      No
                    </button>
                    <Link
                      href={`/picks?round=${roundId}`}
                      className="ml-3 text-sm text-gray-300 hover:text-white"
                    >
                      See other picks →
                    </Link>
                  </div>
                </div>

                {/* Yes/No % */}
                <div className="col-span-1 text-right text-emerald-300 font-semibold">
                  {r.yesPct}%
                </div>
                <div className="col-span-1 text-right text-rose-300 font-semibold">
                  {r.noPct}%
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
