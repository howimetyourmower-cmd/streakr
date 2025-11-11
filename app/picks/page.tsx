// app/picks/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { auth, db } from "@/lib/firebaseClient";
import {
  Timestamp,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// ---- Types that match your Firestore shape ----
type RoundQuestion = {
  quarter?: number;
  question: string;
};

type RoundGame = {
  match: string; // e.g., "Richmond vs Carlton"
  questions: RoundQuestion[];
};

type RoundDoc = {
  round?: number;
  games: RoundGame[];
};

type FixtureDoc = {
  match: string;
  startTime?: Timestamp; // Firestore timestamp
  venue?: string; // e.g., "MCG, Melbourne"
  status?: "open" | "pending" | "final" | "void";
  finalAt?: Timestamp; // optional: when game finished
};

type Row = {
  id: string; // match+index
  match: string;
  venue: string;
  startLabel: string; // "Thu, 19 Mar • 7:20 PM AEDT" or "TBD"
  status: "OPEN" | "PENDING" | "FINAL" | "VOID";
  qLabel: string; // "Q1", "Q2", ...
  question: string;
};

// ---- Local helpers ----
const LOCAL_TZ = dayjs.tz.guess();

function formatStart(ts?: Timestamp): string {
  if (!ts) return "TBD";
  const d = dayjs(ts.toDate()).tz(LOCAL_TZ);
  if (!d.isValid()) return "TBD";
  return d.format("ddd, D MMM • h:mm A z");
}

function deriveStatus(fix?: FixtureDoc): Row["status"] {
  if (!fix) return "OPEN";
  if (fix.status === "void") return "VOID";
  if (fix.status === "final") return "FINAL";

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

function StatusPill({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], string> = {
    OPEN: "bg-emerald-900/40 text-emerald-200 border-emerald-500/40",
    PENDING: "bg-amber-900/40 text-amber-200 border-amber-500/40",
    FINAL: "bg-slate-700/60 text-slate-200 border-slate-400/30",
    VOID: "bg-rose-900/40 text-rose-200 border-rose-500/40",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold border ${map[status]}`}
    >
      {status}
    </span>
  );
}

function YesNoButtons() {
  return (
    <div className="flex gap-2">
      <button className="px-3 py-1 rounded-md bg-amber-500/90 hover:bg-amber-500 text-black font-semibold">
        Yes
      </button>
      <button className="px-3 py-1 rounded-md bg-indigo-300/80 hover:bg-indigo-300 text-black font-semibold">
        No
      </button>
    </div>
  );
}

// ---- Content component (kept separate so we can wrap in Suspense cleanly) ----
function PicksContent() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // if you later add ?round=2 support, swap this to read search params
  const roundDocId = "round-1";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        // 1) Load the round doc
        const rdRef = doc(db, "rounds", roundDocId);
        const rdSnap = await getDoc(rdRef);
        if (!rdSnap.exists()) {
          if (!cancelled) setRows([]);
          return;
        }

        const rd = rdSnap.data() as RoundDoc;
        const games = Array.isArray(rd.games) ? rd.games : [];

        // 2) For each game, fetch its fixture (time/venue/status)
        const all: Row[] = [];
        for (const game of games) {
          const fix = await getFixtureByMatch(game.match);
          const startLabel = formatStart(fix?.startTime);
          const venue = fix?.venue ?? "—";
          const status = deriveStatus(fix);

          // 3) Expand questions as rows
          (game.questions || []).forEach((q, idx) => {
            const qLabel = `Q${q.quarter ?? idx + 1}`;
            all.push({
              id: `${game.match}__${idx}`,
              match: game.match,
              venue,
              startLabel,
              status,
              qLabel,
              question: q.question,
            });
          });
        }

        // 4) Sort: by start time label (TBD last), then match, then Q#
        const sorted = all.sort((a, b) => {
          const aTBD = a.startLabel === "TBD";
          const bTBD = b.startLabel === "TBD";
          if (aTBD && !bTBD) return 1;
          if (!aTBD && bTBD) return -1;
          if (a.match !== b.match) return a.match.localeCompare(b.match);
          return a.qLabel.localeCompare(b.qLabel, undefined, { numeric: true });
        });

        if (!cancelled) setRows(sorted);
      } catch (e) {
        console.error("Error loading picks:", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [roundDocId]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-6 mb-6">
        Make Picks
      </h1>

      <div className="rounded-2xl border border-white/10 bg-slate-900/40 shadow-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-0 px-4 sm:px-6 py-3 text-xs font-semibold tracking-wide text-slate-300 border-b border-white/10">
          <div className="col-span-2">Start</div>
          <div className="col-span-4">Match · Venue</div>
          <div className="col-span-1">Q#</div>
          <div className="col-span-5">Question</div>
        </div>

        {loading ? (
          <div className="p-6 text-slate-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-slate-300">No questions found.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-12 gap-0 px-4 sm:px-6 py-4">
                {/* Start */}
                <div className="col-span-2 flex items-center gap-3">
                  <div className="text-slate-200">{r.startLabel}</div>
                  <StatusPill status={r.status} />
                </div>

                {/* Match · Venue */}
                <div className="col-span-4">
                  <div className="text-amber-300 font-semibold">
                    {r.match}
                  </div>
                  <div className="text-slate-400 text-sm">{r.venue}</div>
                </div>

                {/* Q# */}
                <div className="col-span-1 flex items-center">
                  <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-slate-800 text-slate-200 text-xs font-bold">
                    {r.qLabel}
                  </span>
                </div>

                {/* Question + buttons */}
                <div className="col-span-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-white font-semibold">{r.question}</div>
                  <YesNoButtons />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---- Page export wrapped in Suspense (satisfies Next warning) ----
export default function PicksPage() {
  return (
    <Suspense fallback={<div className="text-center text-white mt-10">Loading…</div>}>
      <PicksContent />
    </Suspense>
  );
}
