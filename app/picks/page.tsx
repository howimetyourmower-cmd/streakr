"use client";

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_TZ = "Australia/Melbourne";

// ----- types that match your Firestore shape -----
type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  startTime?: any; // can be string or Firestore timestamp
  venue?: string;
  questions?: Question[];
};

type RoundDoc = {
  games?: Game[];
};

// this is what we actually render in the table
type PickRow = {
  id: string;
  match: string;
  venue: string;
  startLabel: string;
  quarter: number;
  question: string;
  status: "open" | "pending" | "final" | "void";
  yesPct: number;
  noPct: number;
};

function formatStartTime(raw: any): string {
  if (!raw) return "TBD";

  // Firestore timestamp { seconds: number }
  if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
    const d = dayjs.unix(raw.seconds).tz(LOCAL_TZ);
    return d.isValid() ? d.format("ddd, D MMM • h:mm A") : "TBD";
  }

  // ISO/string
  if (typeof raw === "string") {
    // try a couple formats, but mainly just let dayjs parse it
    const d = dayjs.tz(raw, LOCAL_TZ);
    return d.isValid() ? d.format("ddd, D MMM • h:mm A") : "TBD";
  }

  return "TBD";
}

export default function PicksPage() {
  const [rows, setRows] = useState<PickRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPicks = async () => {
      try {
        // 1. get all round docs
        const roundsRef = collection(db, "rounds");
        const snapshot = await getDocs(roundsRef);

        const allRows: PickRow[] = [];

        snapshot.forEach((docSnap) => {
          const roundData = docSnap.data() as RoundDoc;
          const games = roundData.games || [];

          games.forEach((game, gameIndex) => {
            const startLabel = formatStartTime(game.startTime);
            const venue = game.venue || "";

            (game.questions || []).forEach((q, questionIndex) => {
              allRows.push({
                id: `${docSnap.id}-${gameIndex}-${questionIndex}`,
                match: game.match,
                venue,
                startLabel,
                quarter: q.quarter,
                question: q.question,
                // you said for now just show them all as open
                status: "open",
                yesPct: 0,
                noPct: 0,
              });
            });
          });
        });

        // optional: sort by start time string (TBD goes last)
        allRows.sort((a, b) => {
          if (a.startLabel === "TBD" && b.startLabel !== "TBD") return 1;
          if (b.startLabel === "TBD" && a.startLabel !== "TBD") return -1;
          return a.startLabel.localeCompare(b.startLabel);
        });

        setRows(allRows);
      } catch (err) {
        console.error("Error fetching picks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Make Picks</h1>

        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
          {/* header row */}
          <div className="grid grid-cols-[140px,1.2fr,80px,1.6fr,90px,90px] gap-3 px-6 py-3 bg-slate-950/60 text-sm font-semibold text-slate-200">
            <div>Start</div>
            <div>Match · Venue</div>
            <div>Q#</div>
            <div>Question</div>
            <div className="text-right">Yes %</div>
            <div className="text-right">No %</div>
          </div>

          {loading ? (
            <div className="px-6 py-6 text-slate-300 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-6 text-slate-300 text-sm">
              No questions found.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[140px,1.2fr,80px,1.6fr,90px,90px] gap-3 px-6 py-4 border-t border-slate-800 items-center"
              >
                {/* start + status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-100">
                    {row.startLabel}
                  </span>
                  <span
                    className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-wide ${
                      row.status === "open"
                        ? "bg-emerald-900/50 text-emerald-200 border border-emerald-700/60"
                        : row.status === "pending"
                        ? "bg-amber-900/40 text-amber-100 border border-amber-600/60"
                        : row.status === "final"
                        ? "bg-slate-700 text-slate-100 border border-slate-500/80"
                        : "bg-red-900/40 text-red-100 border border-red-700/60"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>

                {/* match / venue */}
                <div>
                  <div className="text-orange-200 font-semibold">
                    {row.match}
                  </div>
                  <div className="text-xs text-slate-300">{row.venue}</div>
                </div>

                {/* quarter */}
                <div>
                  <span className="inline-block bg-slate-800/70 rounded-lg px-3 py-1 text-xs font-semibold">
                    Q{row.quarter}
                  </span>
                </div>

                {/* question */}
                <div className="font-semibold text-sm">
                  {row.question}
                  <div className="mt-2 flex gap-2">
                    <button className="bg-orange-500 hover:bg-orange-400 transition text-sm px-4 py-1 rounded-lg text-slate-950 font-semibold">
                      Yes
                    </button>
                    <button className="bg-purple-500 hover:bg-purple-400 transition text-sm px-4 py-1 rounded-lg text-slate-950 font-semibold">
                      No
                    </button>
                    <button className="text-xs text-slate-300 hover:text-white ml-auto">
                      See other picks →
                    </button>
                  </div>
                </div>

                {/* yes/no % */}
                <div className="text-right text-emerald-200 font-semibold">
                  {row.yesPct}%
                </div>
                <div className="text-right text-red-200 font-semibold">
                  {row.noPct}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
