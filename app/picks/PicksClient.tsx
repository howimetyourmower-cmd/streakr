"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

// ---------- Types ----------
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

type CardRow = {
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

// ---------- Helpers ----------
const toDate = (v: CardRow["startTime"]): Date | null => {
  if (!v) return null;
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

    const formats = [
      "dddd, D MMMM YYYY, h.mm a",
      "ddd, D MMM YYYY, h.mm a",
      "D MMMM YYYY, h.mm a",
      "D MMM YYYY, h.mm a",
      "dddd D MMMM YYYY, h.mm a",
      "dddd, D MMMM YYYY, h.mm a [AEDT]",
      "ddd, D MMM YYYY, h.mm a [AEDT]",
    ];
    for (const fmt of formats) {
      const p = dayjs(v, fmt, true);
      if (p.isValid()) return p.toDate();
    }
  }
  return null;
};

const formatStart = (v: CardRow["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  return `${dayjs(d).format("ddd, D MMM")} • ${dayjs(d).format("h:mm A")} AEDT`;
};

// ---------- Component ----------
export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: CardRow[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            (Array.isArray(g.questions) ? g.questions : []).forEach((q, qi) => {
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
                status: (g.status as CardRow["status"]) ?? "open",
              });
            });
          });
        });

        const openOnly = all
          .filter((r) => r.status === "open")
          .sort((a, b) => {
            const ta = toDate(a.startTime)?.getTime() ?? 0;
            const tb = toDate(b.startTime)?.getTime() ?? 0;
            if (ta !== tb) return ta - tb;
            return a.quarter - b.quarter;
          });

        setCards(openOnly);
      } catch (e) {
        console.error("picks fetch rounds error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePick = (row: CardRow, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    console.log("pick", { row, choice, uid: user.uid });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-extrabold text-white mb-6">Make Picks</h1>

      {loading ? (
        <div className="text-slate-300 py-8">Loading...</div>
      ) : cards.length === 0 ? (
        <div className="text-slate-300 py-8">No open picks found.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl shadow-lg bg-[#0C1A2A]/60 ring-1 ring-white/10">
          <div className="grid grid-cols-12 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300/90 border-b border-white/10">
            <div className="col-span-3 sm:col-span-3">Start</div>
            <div className="col-span-4 sm:col-span-4">Match · Venue</div>
            <div className="col-span-1 text-center">Q#</div>
            <div className="hidden sm:block col-span-2">Question</div>
            <div className="col-span-1 text-right">Yes %</div>
            <div className="col-span-1 text-right pr-2">No %</div>
          </div>

          <ul className="divide-y divide-white/10">
            {cards.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-12 gap-y-2 px-4 py-4 items-center"
              >
                {/* Start */}
                <div className="col-span-3 sm:col-span-3 flex items-center gap-3">
                  <span className="text-slate-200 text-sm">
                    {formatStart(r.startTime)}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-500/30">
                    {r.status.toUpperCase()}
                  </span>
                </div>

                {/* Match */}
                <div className="col-span-4 sm:col-span-4">
                  <div className="font-semibold text-orange-300">
                    <Link
                      href={`/picks?match=${encodeURIComponent(r.match)}`}
                      prefetch={false}
                    >
                      {r.match}
                    </Link>
                  </div>
                  <div className="text-xs text-slate-400">{r.venue}</div>
                </div>

                {/* Q# */}
                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center justify-center text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-800 text-slate-200 ring-1 ring-white/10">
                    Q{r.quarter}
                  </span>
                </div>

                {/* Question + Buttons */}
                <div className="hidden sm:flex col-span-2 flex-col">
                  <div className="font-semibold text-slate-100">
                    {r.question}
                  </div>
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
                  </div>
                </div>

                {/* Percentages */}
                <div className="col-span-1 text-right font-semibold text-emerald-300">
                  {r.yesPercent}%
                </div>
                <div className="col-span-1 text-right pr-2 font-semibold text-rose-300">
                  {r.noPercent}%
                </div>

                {/* Mobile view */}
                <div className="sm:hidden col-span-12 mt-2">
                  <div className="font-semibold text-slate-100">
                    {r.question}
                  </div>
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
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
