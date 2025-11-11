"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  DocumentData,
  Timestamp,
} from "firebase/firestore";

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
  match: string;
  venue: string;
  quarter: number;
  question: string;
  yesPercent: number;
  noPercent: number;
  startTime: Timestamp | string | Date | null;
  status: "open" | "pending" | "final" | "void";
};

const toDate = (v: Row["startTime"]): Date | null => {
  if (!v) return null;
  if (typeof (v as any)?.toDate === "function") {
    try {
      return (v as Timestamp).toDate();
    } catch {}
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const formatStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return fmt.replace(",", "") + " AEDT";
};

const STATUS_TABS: Array<Row["status"] | "all"> = [
  "open",
  "final",
  "pending",
  "void",
  "all",
];

export default function PicksClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<(typeof STATUS_TABS)[number]>("open");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const items: Row[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            (Array.isArray(g.questions) ? g.questions : []).forEach((q, qi) => {
              items.push({
                id: `${doc.id}-${gi}-${qi}`,
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

        items.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          if (a.match !== b.match) return a.match.localeCompare(b.match);
          return a.quarter - b.quarter;
        });

        setRows(items);
      } catch (e) {
        console.error("picks fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const view = useMemo(() => {
    const list = active === "all" ? rows : rows.filter((r) => r.status === active);
    return list;
  }, [rows, active]);

  return (
    <div className="min-h-screen text-white">
      <h1 className="text-4xl font-extrabold tracking-tight mb-6">Make Picks</h1>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={`px-3 py-1.5 rounded-xl text-sm ${
              active === s ? "bg-white/20" : "bg-white/10 hover:bg-white/15"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table-ish list */}
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
        <div className="grid grid-cols-[140px_1fr_50px_1.6fr_120px] gap-4 px-5 py-3 bg-white/5 text-white/70 text-sm">
          <div>Start</div>
          <div>Match · Venue</div>
          <div>Q#</div>
          <div>Question</div>
          <div className="text-right pr-2">Yes % · No %</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-white/70">Loading…</div>
        ) : view.length === 0 ? (
          <div className="px-5 py-6 text-white/70">No questions found.</div>
        ) : (
          view.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[140px_1fr_50px_1.6fr_120px] gap-4 px-5 py-4 border-t border-white/10 items-center"
            >
              <div className="flex items-center gap-2">
                <span className="text-white/80">{formatStart(r.startTime)}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs ${
                    r.status === "open"
                      ? "bg-emerald-700/30 text-emerald-300"
                      : r.status === "pending"
                      ? "bg-amber-700/30 text-amber-300"
                      : r.status === "final"
                      ? "bg-sky-700/30 text-sky-300"
                      : "bg-rose-700/30 text-rose-300"
                  }`}
                >
                  {r.status.toUpperCase()}
                </span>
              </div>

              <div>
                <div className="font-semibold text-orange-300">{r.match}</div>
                <div className="text-xs text-white/60">{r.venue}</div>
              </div>

              <div className="text-white/80">Q{r.quarter}</div>

              <div className="text-white font-medium">{r.question}</div>

              <div className="flex justify-end items-center gap-3">
                <span className="text-white/70 text-sm">
                  {r.yesPercent}% · {r.noPercent}%
                </span>
                <Link
                  href={`/`}
                  className="text-sm underline text-white/80 hover:text-white"
                >
                  Make a pick →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
