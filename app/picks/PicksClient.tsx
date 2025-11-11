"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebaseClient";
import { onAuthStateChanged, User } from "firebase/auth";
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
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

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

  const onPick = (row: Row, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    console.log("pick", { choice, rowId: row.id, uid: user.uid });
  };

  return (
    <div className="min-h-screen text-white max-w-6xl mx-auto px-3">
      {/* Title */}
      <h1 className="text-5xl font-extrabold text-center mb-3 text-orange-500 tracking-tight">
        Make Picks
      </h1>

      {/* Sponsor banner */}
      <div className="flex justify-center mb-6">
        <div className="bg-white/10 border border-white/10 rounded-xl text-white/60 text-sm py-5 w-[970px] max-w-full text-center">
          Sponsor Banner · 970×90
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 flex-wrap justify-center">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              active === s ? "bg-orange-500" : "bg-white/10 hover:bg-white/15"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
        <div className="grid grid-cols-[130px_1fr_40px_1.5fr_190px] gap-3 px-4 py-2 bg-white/5 text-white/70 text-xs">
          <div>Start</div>
          <div>Match · Venue</div>
          <div>Q#</div>
          <div>Question</div>
          <div className="text-right pr-1">Pick · Yes % · No %</div>
        </div>

        {loading ? (
          <div className="px-4 py-5 text-white/70 text-sm">Loading…</div>
        ) : view.length === 0 ? (
          <div className="px-4 py-5 text-white/70 text-sm">No questions found.</div>
        ) : (
          view.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[130px_1fr_40px_1.5fr_190px] gap-3 px-4 py-2.5 border-t border-white/10 items-center"
            >
              {/* Start */}
              <div className="text-[11px] leading-4 whitespace-pre text-white/80">
                {formatStart(r.startTime)}
                <div
                  className={`inline-block ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
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
                </div>
              </div>

              {/* Match */}
              <div className="min-w-0">
                <div className="font-semibold text-orange-300 text-sm truncate">
                  {r.match}
                </div>
                <div className="text-[11px] text-white/60 truncate">{r.venue}</div>
              </div>

              {/* Quarter */}
              <div className="text-sm text-white/80">Q{r.quarter}</div>

              {/* Question */}
              <div className="text-sm font-medium text-white line-clamp-2">
                {r.question}
              </div>

              {/* Action */}
              <div className="flex justify-end items-center gap-2">
                <button
                  className="px-2.5 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-xs"
                  onClick={() => onPick(r, "yes")}
                >
                  Yes
                </button>
                <button
                  className="px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-xs"
                  onClick={() => onPick(r, "no")}
                >
                  No
                </button>
                <span className="text-white/70 text-xs ml-2">
                  {r.yesPercent}% · {r.noPercent}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
