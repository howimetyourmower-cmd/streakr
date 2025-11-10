"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

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

// --- robust startTime parsing (handles Timestamp, ISO, and your seeded human strings)
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

  // Already Date
  if (v instanceof Date && !isNaN(v.getTime())) return v;

  // String paths: try native Date first (for ISO like 2026-03-19T19:20:00+11:00)
  if (typeof v === "string") {
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;

    // Try seeded human formats (both with/without commas, with dot minutes)
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

const formatStart = (v: Row["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  // Match home-page feel: Thu, 19 Mar • 7:20 pm AEDT
  return `${dayjs(d).format("ddd, D MMM")} • ${dayjs(d).format("h:mm A")} AEDT`;
};

export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const out: Row[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            const qs = Array.isArray(g.questions) ? g.questions : [];
            qs.forEach((q, qi) => {
              out.push({
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
              });
            });
          });
        });

        // sort by startTime then quarter
        out.sort((a, b) => {
          const ta = toDate(a.startTime)?.getTime() ?? 0;
          const tb = toDate(b.startTime)?.getTime() ?? 0;
          if (ta !== tb) return ta - tb;
          return a.quarter - b.quarter;
        });

        setRows(out);
      } catch (e) {
        console.error("fetch rounds error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePick = (row: Row, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login"; // or show toast
      return;
    }
    // TODO: write to /picks collection; for now just log:
    console.log("pick", { row, choice, uid: user.uid });
  };

  const tableBody = useMemo(
    () =>
      rows.map((r) => {
        const startTxt = formatStart(r.startTime);
        const statusClass =
          r.status === "open"
            ? "bg-green-800 text-green-300"
            : r.status === "pending"
            ? "bg-yellow-800 text-yellow-300"
            : r.status === "final"
            ? "bg-blue-800 text-blue-300"
            : "bg-gray-700 text-gray-300";

        const buttonsDisabled = r.status !== "open";

        return (
          <tr key={r.id} className="hover:bg-gray-800 transition-colors">
            <td className="px-4 py-3 text-sm">
              <div className="text-gray-300">{startTxt}</div>
              <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}>
                {r.status.toUpperCase()}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="font-semibold text-orange-400">{r.match}</div>
              <div className="text-xs text-gray-400">{r.venue}</div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-300">Q{r.quarter}</td>
            <td className="px-4 py-3 font-bold text-white">{r.question}</td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(r, "yes")}
                  disabled={buttonsDisabled}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ${
                    buttonsDisabled
                      ? "bg-orange-900/40 text-orange-300/60 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => handlePick(r, "no")}
                  disabled={buttonsDisabled}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ${
                    buttonsDisabled
                      ? "bg-purple-900/40 text-purple-300/60 cursor-not-allowed"
                      : "bg-purple-500 hover:bg-purple-600 text-white"
                  }`}
                >
                  No
                </button>
              </div>
            </td>
            <td className="px-4 py-3 text-center text-green-400">{r.yesPercent}%</td>
            <td className="px-4 py-3 text-center text-red-400">{r.noPercent}%</td>
          </tr>
        );
      }),
    [rows, user]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 text-white">Make Picks</h1>

      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-lg">
          <table className="min-w-full text-left text-gray-200">
            <thead className="bg-gray-800 text-sm uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Match · Venue</th>
                <th className="px-4 py-3">Q#</th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3 text-center">Yes %</th>
                <th className="px-4 py-3 text-center">No %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-900">
              {rows.length ? tableBody : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No picks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
