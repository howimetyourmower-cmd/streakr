"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- TYPES ----------
type Question = { quarter: number; question: string };
type GameInRound = { match: string; questions: Question[] };
type RoundDoc = { games: GameInRound[] };

type FixtureDoc = {
  match: string;
  venue?: string;
  startTime?: Timestamp | null;
  status?: "open" | "pending" | "final" | "void";
  finalAt?: Timestamp | null;
};

type Row = {
  id: string;
  qnum: string;
  question: string;
  match: string;
  venue: string;
  startLabel: string;
  status: "OPEN" | "PENDING" | "FINAL" | "VOID";
};

// ---------- HELPERS ----------
function formatStart(ts?: Timestamp | null): string {
  if (!ts) return "TBD";
  const d = dayjs(ts.toDate()).tz(LOCAL_TZ);
  return d.isValid() ? d.format("ddd, D MMM • h:mm A z") : "TBD";
}

function deriveStatus(fix?: FixtureDoc | null): Row["status"] {
  if (!fix) return "OPEN";
  const s = fix.status;
  if (s === "void") return "VOID";
  if (s === "final") return "FINAL";
  if (s === "pending") return "PENDING";
  if (s === "open") return "OPEN";

  const now = dayjs();
  const start = fix.startTime ? dayjs(fix.startTime.toDate()) : null;
  const finalAt = fix.finalAt ? dayjs(fix.finalAt.toDate()) : null;
  if (finalAt && finalAt.isBefore(now)) return "FINAL";
  if (start && start.isAfter(now)) return "OPEN";
  if (start && start.isBefore(now)) return "PENDING";
  return "OPEN";
}

async function getFixtureByMatch(match: string): Promise<FixtureDoc | null> {
  const qref = query(
    collection(db, "fixtures"),
    where("match", "==", match),
    limit(1)
  );
  const snap = await getDocs(qref);
  if (snap.empty) return null;
  return snap.docs[0].data() as FixtureDoc;
}

async function getRound(roundId: string): Promise<RoundDoc | null> {
  const ref = doc(db, "rounds", roundId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as RoundDoc) : null;
}

// ---------- PAGE ----------
export default function PicksPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const CURRENT_ROUND_ID = "round-1";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const round = await getRound(CURRENT_ROUND_ID);
        if (!round?.games?.length) {
          setRows([]);
          setLoading(false);
          return;
        }

        const allRows: Row[] = [];
        for (const g of round.games) {
          const fix = await getFixtureByMatch(g.match);
          const startLabel = formatStart(fix?.startTime ?? null);
          const venue = fix?.venue ?? "—";
          const status = deriveStatus(fix);

          (g.questions || []).forEach((q, i) => {
            allRows.push({
              id: `${g.match}_${i}`,
              qnum: `Q${q.quarter}`,
              question: q.question,
              match: g.match,
              venue,
              startLabel,
              status,
            });
          });
        }

        const weight: Record<Row["status"], number> = {
          OPEN: 0,
          PENDING: 1,
          FINAL: 2,
          VOID: 3,
        };
        allRows.sort((a, b) => weight[a.status] - weight[b.status]);
        setRows(allRows);
      } catch (err) {
        console.error("Error fetching picks:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-8">
        Make Picks
      </h1>

      <div className="rounded-2xl bg-[#0c2436]/70 ring-1 ring-white/10 overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-3 text-xs md:text-sm font-semibold text-slate-300 uppercase tracking-wider bg-white/5">
          <div className="col-span-3">Start</div>
          <div className="col-span-5">Match · Venue</div>
          <div className="col-span-1">Q#</div>
          <div className="col-span-3">Question</div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-slate-300">No questions found.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-12 items-center px-4 py-4">
                <div className="col-span-3 flex items-center gap-3">
                  <span className="text-slate-200">{r.startLabel}</span>
                  <span
                    className={[
                      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                      r.status === "OPEN"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : r.status === "PENDING"
                        ? "bg-amber-900/50 text-amber-300"
                        : r.status === "FINAL"
                        ? "bg-indigo-900/50 text-indigo-300"
                        : "bg-rose-900/50 text-rose-300",
                    ].join(" ")}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="col-span-5">
                  <div className="text-orange-300 font-semibold">{r.match}</div>
                  <div className="text-slate-400 text-sm">{r.venue}</div>
                </div>

                <div className="col-span-1">
                  <span className="inline-flex h-6 items-center px-2 rounded-md bg-white/5 text-slate-200 text-xs font-semibold">
                    {r.qnum}
                  </span>
                </div>

                <div className="col-span-3">
                  <div className="text-white font-semibold">{r.question}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      className="px-3 py-1 rounded-md bg-orange-600/90 hover:bg-orange-600 text-white text-sm font-semibold"
                      disabled={r.status !== "OPEN"}
                    >
                      Yes
                    </button>
                    <button
                      className="px-3 py-1 rounded-md bg-purple-700/90 hover:bg-purple-700 text-white text-sm font-semibold"
                      disabled={r.status !== "OPEN"}
                    >
                      No
                    </button>
                    <Link
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="ml-auto text-slate-300 hover:text-white text-sm"
                    >
                      See other picks →
                    </Link>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Yes 0% • No 0%</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="text-slate-300 text-sm">
          Showing <span className="font-semibold text-white">OPEN</span> &
          <span className="font-semibold text-white"> PENDING</span> selections for this round.
        </div>
        <Link
          href="/picks?view=final"
          className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
        >
          View finalised selections →
        </Link>
      </div>
    </div>
  );
}
