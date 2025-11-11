"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
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

/* ---------- Types ---------- */
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

/* ---------- Helpers ---------- */
const toDate = (raw: any): Date | null => {
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate();
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === "string") {
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;
    const formats = [
      "ddd, D MMM YYYY, h:mm A",
      "dddd, D MMMM YYYY, h:mm A",
      "ddd, D MMM YYYY, h.mm a",
      "D MMM YYYY, h:mm A",
      "D MMM YYYY, h.mm a",
    ];
    for (const f of formats) {
      const parsed = dayjs(raw, f, true);
      if (parsed.isValid()) return parsed.toDate();
    }
  }
  return null;
};
const formatStart = (v: any) => {
  const d = toDate(v);
  return d ? dayjs(d).format("ddd, D MMM • h:mm A AEDT") : "TBD";
};
const statusColor = (s: CardRow["status"]) =>
  s === "open"
    ? "bg-emerald-900/50 text-emerald-300 ring-emerald-500/30"
    : s === "final"
    ? "bg-sky-900/50 text-sky-300 ring-sky-500/30"
    : s === "pending"
    ? "bg-amber-900/50 text-amber-300 ring-amber-500/30"
    : "bg-rose-900/50 text-rose-300 ring-rose-500/30";

/* ---------- Component ---------- */
export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "final" | "pending" | "void" | "all">(
    "open"
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const list: CardRow[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) =>
            (g.questions || []).forEach((q, qi) =>
              list.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "TBD",
                quarter: q.quarter ?? 1,
                question: q.question ?? "",
                yesPercent: q.yesPercent ?? 0,
                noPercent: q.noPercent ?? 0,
                startTime: g.startTime ?? null,
                status: (g.status as any) ?? "open",
              })
            )
          );
        });
        list.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          return ta - tb;
        });
        setRows(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab]
  );

  const handlePick = (row: CardRow, choice: "yes" | "no") => {
    if (!user) return (window.location.href = "/login");
    console.log("Pick", choice, row.question);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <h1 className="text-4xl font-extrabold text-white mb-6">Make Picks</h1>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["open", "final", "pending", "void", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setTab(s as any)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold ring-1 ring-white/10 ${
              tab === s
                ? "bg-white/10 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 py-8">Loading...</div>
      ) : (
        <div className="rounded-xl bg-[#0C1A2A]/70 ring-1 ring-white/10 overflow-hidden">
          <div className="grid grid-cols-12 text-xs font-semibold uppercase px-4 py-3 border-b border-white/10 text-slate-300">
            <div className="col-span-3">Start</div>
            <div className="col-span-4">Match · Venue</div>
            <div className="col-span-1 text-center">Q#</div>
            <div className="col-span-3">Question</div>
            <div className="col-span-1 text-right">%</div>
          </div>

          {filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-12 items-start gap-y-2 px-4 py-4 border-b border-white/5"
            >
              <div className="col-span-3 flex items-center gap-2">
                <span className="text-slate-200 text-sm">
                  {formatStart(r.startTime)}
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full ring-1 ${statusColor(r.status)}`}>
                  {r.status.toUpperCase()}
                </span>
              </div>

              <div className="col-span-4">
                <div className="font-semibold text-orange-300">{r.match}</div>
                <div className="text-xs text-slate-400">{r.venue}</div>
              </div>

              <div className="col-span-1 text-center">
                <span className="text-slate-100 font-semibold text-xs bg-slate-800 px-2 py-1 rounded-md">
                  Q{r.quarter}
                </span>
              </div>

              <div className="col-span-3 text-slate-100">
                <div className="font-semibold">{r.question}</div>
                {r.status === "open" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handlePick(r, "yes")}
                      className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold"
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
                )}
              </div>

              <div className="col-span-1 text-right font-semibold text-emerald-300">
                {r.yesPercent ?? 0}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
