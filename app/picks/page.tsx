"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import customParse from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(customParse);

const LOCAL_TZ = "Australia/Melbourne";

function formatStartTime(raw: any): string {
  if (!raw) return "TBD";
  if (raw?.toDate) return dayjs(raw.toDate()).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
  if (typeof raw === "string") {
    let d = dayjs(raw);
    if (!d.isValid()) d = dayjs.tz(raw, ["ddd, D MMM YYYY, h:mm A", "YYYY-MM-DDTHH:mm:ssZ"], LOCAL_TZ);
    return d.isValid() ? d.tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z") : "TBD";
  }
  if (raw instanceof Date) return dayjs(raw).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
  return "TBD";
}

function PicksInner() {
  const params = useSearchParams();
  const roundId = params.get("round") || "round-1";
  const [round, setRound] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "rounds", roundId);
    getDoc(ref).then((snap) => {
      setRound(snap.data());
      setLoading(false);
    });
  }, [roundId]);

  const rows = useMemo(() => {
    if (!round?.games) return [];
    const list: any[] = [];
    for (const g of round.games) {
      const startStr = formatStartTime(g.startTime);
      const startSort = g.startTime?.toDate ? g.startTime.toDate().getTime() : dayjs(g.startTime).valueOf();
      for (const q of g.questions) {
        const yes = q.yesCount ?? 0;
        const no = q.noCount ?? 0;
        const total = yes + no;
        list.push({
          start: startStr,
          match: g.match,
          venue: g.venue,
          qnum: q.quarter,
          text: q.question,
          yesPct: total ? Math.round((yes / total) * 100) : 0,
          noPct: total ? 100 - Math.round((yes / total) * 100) : 0,
          status: q.status ?? "open",
          startSort,
        });
      }
    }
    return list.sort((a, b) => a.startSort - b.startSort);
  }, [round]);

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-6">
          Make Picks
        </h1>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/40 backdrop-blur">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 text-xs uppercase tracking-wider text-gray-300/70 border-b border-white/10">
            <div className="col-span-3">Start</div>
            <div className="col-span-3">Match · Venue</div>
            <div className="col-span-1">Q#</div>
            <div className="col-span-3">Question</div>
            <div className="col-span-1 text-right">Yes %</div>
            <div className="col-span-1 text-right">No %</div>
          </div>

          {loading && <div className="px-6 py-6 text-gray-400">Loading…</div>}
          {!loading && rows.length === 0 && (
            <div className="px-6 py-6 text-gray-400">No questions available.</div>
          )}

          {!loading &&
            rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-t border-white/5 items-center"
              >
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
                    {r.status.toUpperCase()}
                  </span>
                </div>

                <div className="col-span-3">
                  <div className="font-semibold text-orange-300">
                    {r.match}
                  </div>
                  {r.venue && (
                    <div className="text-xs text-gray-400">{r.venue}</div>
                  )}
                </div>

                <div className="col-span-1">
                  <span className="inline-flex h-6 items-center justify-center rounded-md bg-white/5 px-2 text-xs font-semibold text-gray-200 border border-white/10">
                    Q{r.qnum}
                  </span>
                </div>

                <div className="col-span-3">
                  <div className="font-semibold text-white">{r.text}</div>
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

export default function PicksPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-6">Loading picks…</div>}>
      <PicksInner />
    </Suspense>
  );
}
