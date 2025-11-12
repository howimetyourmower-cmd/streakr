"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

import CommentsSection from "@/app/components/CommentsSection";

// -------- Types --------
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
  id: string; // roundId-gi-qi
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

// -------- Start time helpers (Timestamp | string | Date) -> Date | null --------
const toDate = (v: Row["startTime"]): Date | null => {
  if (!v) return null;

  // Firestore Timestamp
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
  }
  return null;
};

const formatStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  const z = dayjs.tz(d, LOCAL_TZ);
  return `${z.format("ddd DD Mar,")} ${z.format("h:mm A")} AEDT`;
};

// -------- UI helpers --------
const StatusPill = ({ s }: { s: Row["status"] }) => {
  const label = s.toUpperCase();
  const bg =
    s === "open"
      ? "bg-emerald-700/30 text-emerald-300"
      : s === "final"
      ? "bg-sky-700/30 text-sky-300"
      : s === "pending"
      ? "bg-yellow-700/30 text-yellow-200"
      : "bg-zinc-700/40 text-zinc-300";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${bg}`}>
      {label}
    </span>
  );
};

// ===================================================================

export default function PicksClient() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "final" | "pending" | "void" | "all">(
    "open"
  );

  // Track which rows have comments expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: Row[] = [];
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
                venue: g.venue ?? "",
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

        // Sort by time then quarter
        all.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          return a.quarter - b.quarter;
        });

        setRows(all);
      } catch (e) {
        console.error("picks fetch rounds error:", e);
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
    // TODO: Write pick to Firestore
    console.log("pick", { row, choice, uid: user.uid });
  };

  const toggleComments = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16">
      {/* Title + banner row (banner sits in layout above; keep page title here) */}
      <h1 className="text-center text-3xl font-extrabold text-orange-400 mb-2">
        Make Picks
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 justify-center mb-4">
        {(["open", "final", "pending", "void", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-md text-sm font-semibold ${
              tab === t
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-zinc-400">
              <th className="px-4 py-3 text-left w-[190px]">Start</th>
              <th className="px-4 py-3 text-left">Match · Venue</th>
              <th className="px-2 py-3 text-left w-[60px]">Q#</th>
              <th className="px-4 py-3 text-left">Question</th>
              <th className="px-4 py-3 text-right w-[230px]">
                Pick · Yes % · No %
              </th>
              <th className="px-2 py-3 text-right w-[110px]">Discuss</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/5 hover:bg-white/5/40"
                >
                  {/* Start */}
                  <td className="px-4 py-3 align-top">
                    <div className="text-[13px] text-zinc-300">
                      {formatStart(r.startTime)}
                    </div>
                    <div className="mt-1">
                      <StatusPill s={r.status} />
                    </div>
                  </td>

                  {/* Match · Venue */}
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-orange-400">
                      <Link href="#" onClick={(e) => e.preventDefault()}>
                        {r.match}
                      </Link>
                    </div>
                    {r.venue && (
                      <div className="text-xs text-zinc-400">{r.venue}</div>
                    )}
                  </td>

                  {/* Quarter */}
                  <td className="px-2 py-3 align-top">
                    <span className="text-xs text-zinc-400">Q{r.quarter}</span>
                  </td>

                  {/* Question (bold & slightly larger) */}
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-[15px] text-zinc-100">
                      {r.question}
                    </div>
                  </td>

                  {/* Pick / percents */}
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePick(r, "yes")}
                        className="px-3 py-1 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handlePick(r, "no")}
                        className="px-3 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold"
                      >
                        No
                      </button>
                      <div className="ml-3 text-xs text-zinc-300 tabular-nums">
                        {r.yesPercent}% · {r.noPercent}%
                      </div>
                    </div>
                  </td>

                  {/* Discuss toggle */}
                  <td className="px-2 py-3 align-top text-right">
                    <button
                      onClick={() => toggleComments(r.id)}
                      className="text-sm text-orange-400 hover:text-orange-300 underline-offset-2 hover:underline"
                    >
                      {expanded[r.id] ? "Hide" : "Discuss"} →
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Expanded comment rows */}
      {!loading &&
        filtered.map(
          (r) =>
            expanded[r.id] && (
              <div
                key={`${r.id}-comments`}
                className="mt-3 rounded-xl border border-white/5 bg-black/20 p-4"
              >
                <div className="mb-2 text-sm text-zinc-400">
                  Discussion for <span className="text-orange-400">{r.match}</span>{" "}
                  — Q{r.quarter}
                </div>
                <CommentsSection
                  pickId={r.id}
                  userName={user?.displayName || "Guest"}
                />
              </div>
            )
        )}
    </div>
  );
}
