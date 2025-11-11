"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";

// ---- Day.js (timezone) ----
import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

// ---- Types (lightweight) ----
type Question = { quarter?: number; question: string };
type GameInRound = { match: string; questions: Question[] };
type RoundDoc = { games?: GameInRound[] };
type FixtureDoc = {
  startTime?: string | Date | Timestamp;
  venue?: string;
  status?: "open" | "pending" | "final" | "void";
};

type Row = {
  id: string;
  match: string;
  venue: string;
  startLabel: string;
  qNum: string;
  question: string;
  yesPct: number;
  noPct: number;
  status: "OPEN" | "PENDING" | "FINAL" | "VOID";
};

// ---- Helpers ----
function toDate(raw: string | Date | Timestamp | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  if (typeof raw === "string") {
    // Try strict ISO first, then a looser parse
    const d1 = dayjs.tz(raw, "YYYY-MM-DDTHH:mm:ssZ", LOCAL_TZ);
    const d2 = dayjs.tz(raw, LOCAL_TZ);
    const d = d1.isValid() ? d1 : d2;
    return d.isValid() ? d.toDate() : null;
  }
  return null;
}

function formatStart(raw?: string | Date | Timestamp): string {
  const d = toDate(raw);
  if (!d) return "TBD";
  return dayjs(d).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
}

function deriveStatus(fix?: FixtureDoc): "OPEN" | "PENDING" | "FINAL" | "VOID" {
  const s = (fix?.status ?? "open").toLowerCase();
  if (s === "pending") return "PENDING";
  if (s === "final") return "FINAL";
  if (s === "void") return "VOID";
  return "OPEN";
}

// Try to find fixture by doc id first, then by match field
async function fetchFixtureForMatch(match: string): Promise<FixtureDoc | null> {
  // 1) direct doc id
  const direct = await getDoc(doc(db, "fixtures", match));
  if (direct.exists()) return (direct.data() as FixtureDoc) ?? {};

  // 2) where("match","==", match) first result
  const qFix = query(
    collection(db, "fixtures"),
    where("match", "==", match),
    limit(1)
  );
  const snap = await getDocs(qFix);
  if (!snap.empty) return (snap.docs[0].data() as FixtureDoc) ?? {};
  return null;
}

export default function PicksClient() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) Round (always visible)
        const roundSnap = await getDoc(doc(db, "rounds", "round-1"));
        const round = (roundSnap.data() as RoundDoc) ?? {};

        // 2) Build rows with per-match fixture lookup (robust against id/field differences)
        const out: Row[] = [];
        for (const g of round.games ?? []) {
          const fix = await fetchFixtureForMatch(g.match);
          const startLabel = formatStart(fix?.startTime);
          const venue = fix?.venue ?? "TBD";
          const status = deriveStatus(fix ?? undefined);

          for (let i = 0; i < (g.questions?.length ?? 0); i++) {
            const q = g.questions[i];
            out.push({
              id: `${g.match}::${i}`,
              match: g.match,
              venue,
              startLabel,
              status,
              qNum: `Q${q?.quarter ?? 1}`,
              question: q?.question ?? "",
              yesPct: 0,
              noPct: 0,
            });
          }
        }

        setRows(out);
      } catch (e) {
        console.error("Error loading picks:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handlePick = async (row: Row, choice: "yes" | "no") => {
    const user = auth.currentUser;
    if (!user) {
      // visible prompt; send to login
      router.push("/login");
      return;
    }
    // TODO: wire to your real write path
    // Example placeholder:
    // await setDoc(doc(collection(db, "picks")), {
    //   uid: user.uid,
    //   match: row.match,
    //   question: row.question,
    //   choice,
    //   ts: Timestamp.now(),
    // });
    console.log("Picked", choice, "for", row.id);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-extrabold text-white mb-6">Make Picks</h1>

      <div className="overflow-hidden rounded-2xl shadow-lg bg-[#0C1A2A]/60 ring-1 ring-white/10">
        {/* Header */}
        <div className="grid grid-cols-12 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300/90 border-b border-white/10">
          <div className="col-span-3 sm:col-span-3">Start</div>
          <div className="col-span-4 sm:col-span-4">Match · Venue</div>
          <div className="col-span-1 text-center">Q#</div>
          <div className="hidden sm:block col-span-2">Question</div>
          <div className="col-span-1 text-right">Yes %</div>
          <div className="col-span-1 text-right pr-2">No %</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-slate-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-slate-300">No questions found.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-12 gap-y-2 px-4 py-4 items-center">
                {/* Start + status */}
                <div className="col-span-3 sm:col-span-3 flex items-center gap-3">
                  <span className="text-slate-200 text-sm">{r.startLabel}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                      r.status === "OPEN"
                        ? "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-500/30"
                        : r.status === "PENDING"
                        ? "bg-amber-900/40 text-amber-300 ring-1 ring-amber-500/30"
                        : r.status === "FINAL"
                        ? "bg-slate-700 text-slate-200 ring-1 ring-slate-400/30"
                        : "bg-rose-900/40 text-rose-200 ring-1 ring-rose-500/30"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Match / Venue */}
                <div className="col-span-4 sm:col-span-4">
                  <div className="font-semibold text-orange-300">
                    <Link href={`/picks?match=${encodeURIComponent(r.match)}`} prefetch={false}>
                      {r.match}
                    </Link>
                  </div>
                  <div className="text-xs text-slate-400">{r.venue}</div>
                </div>

                {/* Q# */}
                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center justify-center text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-800 text-slate-200 ring-1 ring-white/10">
                    {r.qNum}
                  </span>
                </div>

                {/* Question + Yes/No buttons (desktop) */}
                <div className="hidden sm:flex col-span-2 flex-col">
                  <div className="font-semibold text-slate-100">{r.question}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handlePick(r, "yes")}
                      className="px-3 py-1 rounded-md bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-semibold"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handlePick(r, "no")}
                      className="px-3 py-1 rounded-md bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold"
                    >
                      No
                    </button>
                    <Link
                      href={`/picks?match=${encodeURIComponent(r.match)}`}
                      prefetch={false}
                      className="text-xs text-slate-400 hover:text-slate-300 ml-2"
                    >
                      See other picks →
                    </Link>
                  </div>
                </div>

                {/* Yes / No % */}
                <div className="col-span-1 text-right font-semibold text-emerald-300">{r.yesPct}%</div>
                <div className="col-span-1 text-right pr-2 font-semibold text-rose-300">{r.noPct}%</div>

                {/* Mobile question + buttons */}
                <div className="sm:hidden col-span-12 mt-2">
                  <div className="font-semibold text-slate-100">{r.question}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handlePick(r, "yes")}
                      className="px-3 py-1 rounded-md bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-semibold"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handlePick(r, "no")}
                      className="px-3 py-1 rounded-md bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold"
                    >
                      No
                    </button>
                    <Link
                      href={`/picks?match=${encodeURIComponent(r.match)}`}
                      prefetch={false}
                      className="text-xs text-slate-400 hover:text-slate-300 ml-2"
                    >
                      See other picks →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

