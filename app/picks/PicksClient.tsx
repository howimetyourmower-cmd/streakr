"use client";

import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import dayjs from "dayjs";

// ---------- Types ----------
type Question = {
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
  commentsCount?: number;
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
  commentsCount?: number;
};

// ---------- Helper Functions ----------
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
  return `${dayjs(d).format("ddd, D MMM")}, ${dayjs(d).format("h:mm A")} AEDT`;
};

// ---------- Component ----------
export default function PicksClient() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
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
        const acc: Row[] = [];

        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];

          games.forEach((g, gi) => {
            const qs = Array.isArray(g.questions) ? g.questions : [];

            qs.forEach((q, qi) => {
              acc.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "TBD",
                quarter: Number(q.quarter ?? 1),
                question: q.question ?? "",
                yesPercent: Number(q.yesPercent ?? 0),
                noPercent: Number(q.noPercent ?? 0),
                startTime: g.startTime ?? null,
                status: (g.status as Row["status"]) ?? "open",
                commentsCount: q.commentsCount ?? 0,
              });
            });
          });
        });

        acc.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          if (a.match !== b.match) return a.match.localeCompare(b.match);
          return a.quarter - b.quarter;
        });

        setRows(acc);
      } catch (e) {
        console.error("picks load error", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const handlePick = (row: Row, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    console.log("pick logged:", {
      rowId: row.id,
      choice,
      uid: user.uid,
    });

    // TODO: Write to Firestore + trigger percentage update
  };

  // ---------- Render ----------
  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { k: "open", label: "Open" },
          { k: "final", label: "Final" },
          { k: "pending", label: "Pending" },
          { k: "void", label: "Void" },
          { k: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.k
                ? "bg-[#ff6a1a] text-black"
                : "bg-[#1a2230] text-gray-200 hover:bg-[#223044]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="hidden md:grid grid-cols-[200px_1fr_54px_1.8fr_220px] text-xs uppercase tracking-wide text-gray-300/80 px-3 py-2 bg-[#0f141c] rounded-t-lg border border-[#253244]">
        <div>Start</div>
        <div className="pl-2">Match • Venue</div>
        <div className="text-center">Q#</div>
        <div className="pl-2">Question</div>
        <div className="text-right pr-1">Pick · Yes % · No %</div>
      </div>

      {/* Rows */}
      <div className="rounded-b-lg overflow-hidden border-x border-b border-[#253244]">
        {loading && (
          <div className="px-3 py-4 text-sm text-gray-300">Loading…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-300">
            No selections for this filter yet.
          </div>
        )}

        {filtered.map((r, idx) => (
          <div
            key={r.id}
            className={`grid md:grid-cols-[200px_1fr_54px_1.8fr_220px] items-center px-3 ${
              idx % 2 ? "bg-[#0d1219]" : "bg-[#0b1016]"
            }`}
            style={{
              paddingTop: "8px",
              paddingBottom: "8px",
              rowGap: "4px",
            }}
          >
            {/* ----------- START (2-LINE DATE/TIME FIX) ----------- */}
            <div className="text-[13px] leading-tight text-gray-200">
              <div>{dayjs(toDate(r.startTime)).format("ddd, D MMM")}</div>
              <div className="text-gray-400">
                {dayjs(toDate(r.startTime)).format("h:mm A")} AEDT
              </div>
            </div>

            {/* Match & Venue */}
            <div className="pl-2 leading-tight">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                    r.status === "open"
                      ? "bg-emerald-900/40 text-emerald-300"
                      : r.status === "final"
                      ? "bg-sky-900/40 text-sky-300"
                      : r.status === "pending"
                      ? "bg-amber-900/40 text-amber-300"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {r.status.toUpperCase()}
                </span>
                <span className="font-semibold text-[15px] text-[#ff9c4d]">
                  {r.match}
                </span>
              </div>
              <div className="text-[12px] text-gray-400">{r.venue}</div>
            </div>

            {/* Quarter */}
            <div className="text-center">
              <span className="inline-block rounded-md bg-[#1a2230] px-2 py-[2px] text-[11px] text-gray-200">
                Q{r.quarter}
              </span>
            </div>

            {/* Question */}
            <div className="pl-2">
              <div className="font-semibold text-[15px] leading-snug text-gray-100">
                {r.question}
              </div>

              <a
                href="#"
                className="mt-1 inline-flex items-center rounded-full border border-[#2a384b] px-2 py-[2px] text-[11px] text-gray-300 hover:border-[#415471]"
              >
                Comments ({r.commentsCount ?? 0})
              </a>
            </div>

            {/* Pick + % */}
            <div className="flex items-center justify-end gap-2 pr-1">
              <button
                onClick={() => handlePick(r, "yes")}
                className="rounded-md bg-[#ff6a1a] text-black text-[13px] font-semibold px-3 py-1"
              >
                Yes
              </button>

              <button
                onClick={() => handlePick(r, "no")}
                className="rounded-md bg-[#2a384b] text-gray-100 text-[13px] font-semibold px-3 py-1"
              >
                No
              </button>

              <div className="ml-2 text-[12px] tabular-nums text-gray-300">
                <span className="mr-1">{Math.round(r.yesPercent)}%</span>
                <span className="mx-1 text-gray-500">·</span>
                <span>{Math.round(r.noPercent)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 mt-3">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#253244] bg-[#0b1016] p-3">
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <div>{formatStart(r.startTime)}</div>

              <span
                className={`ml-2 rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                  r.status === "open"
                    ? "bg-emerald-900/40 text-emerald-300"
                    : r.status === "final"
                    ? "bg-sky-900/40 text-sky-300"
                    : r.status === "pending"
                    ? "bg-amber-900/40 text-amber-300"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {r.status.toUpperCase()}
              </span>
            </div>

            <div className="text-[#ff9c4d] font-semibold">{r.match}</div>
            <div className="text-xs text-gray-400">{r.venue}</div>

            <div className="mt-2 text-[13.5px] font-semibold text-gray-100">
              Q{r.quarter} · {r.question}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePick(r, "yes")}
                  className="rounded-md bg-[#ff6a1a] text-black text-[13px] font-semibold px-3 py-1"
                >
                  Yes
                </button>

                <button
                  onClick={() => handlePick(r, "no")}
                  className="rounded-md bg-[#2a384b] text-gray-100 text-[13px] font-semibold px-3 py-1"
                >
                  No
                </button>
              </div>

              <a
                href="#"
                className="rounded-full border border-[#2a384b] px-2 py-[2px] text-[11px] text-gray-300"
              >
                Comments ({r.commentsCount ?? 0})
              </a>
            </div>

            <div className="mt-1 text-xs tabular-nums text-gray-300 text-right">
              Yes {Math.round(r.yesPercent)}% · No {Math.round(r.noPercent)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
