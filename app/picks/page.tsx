"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

// ---------- Types ----------
type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  startTime?: any;     // Firestore Timestamp or string
  venue?: string;
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

// ---------- Helpers ----------
function formatFromDate(d: Date): string {
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

/** Accepts Timestamp | ISO string | human string | undefined. Returns label to render. */
function startLabel(raw: any): string {
  if (!raw) return "TBD";

  // Firestore Timestamp {seconds, nanoseconds}
  if (typeof raw === "object" && typeof raw.seconds === "number") {
    const d = new Date(raw.seconds * 1000);
    return formatFromDate(d);
  }

  // String forms
  if (typeof raw === "string") {
    // Try ISO parse first
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) {
      return formatFromDate(iso);
    }
    // Not ISO → show the original text (manual/human)
    return raw;
  }

  return "TBD";
}

/** Status for display (OPEN if now < start, else PENDING) */
function deriveStatusFromRaw(raw: any): "OPEN" | "PENDING" {
  let d: Date | null = null;
  if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
    d = new Date(raw.seconds * 1000);
  } else if (typeof raw === "string") {
    const t = new Date(raw);
    if (!isNaN(t.getTime())) d = t;
  }
  if (!d) return "OPEN";
  return Date.now() < d.getTime() ? "OPEN" : "PENDING";
}

// ---------- Page ----------
const CURRENT_ROUND_DOC_ID = "round-1"; // update when changing rounds

export default function PicksPage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, "rounds", CURRENT_ROUND_DOC_ID);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          if (!cancelled) {
            setError(`No questions found for ${CURRENT_ROUND_DOC_ID.replace("round-","Round ")}`);
            setLoading(false);
          }
          return;
        }
        const data = snap.data() as RoundDoc;
        if (!cancelled) {
          setRound(data);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load picks.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    if (!round?.games?.length) return [];

    // Flatten games → rows
    const out: Array<{
      startText: string;
      status: "OPEN" | "PENDING";
      match: string;
      venue?: string;
      qnum: number;
      qtext: string;
    }> = [];

    for (const g of round.games) {
      const label = startLabel(g.startTime);
      const status = deriveStatusFromRaw(g.startTime);
      for (const q of g.questions || []) {
        out.push({
          startText: label,
          status,
          match: g.match,
          venue: g.venue,
          qnum: q.quarter,
          qtext: q.question,
        });
      }
    }

    // Optional: sort by start time text (keeps current order if manual strings)
    return out;
  }, [round]);

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">
      <h1 className="text-4xl font-extrabold mt-8 mb-6">Make Picks</h1>

      {loading && (
        <div className="text-sm text-gray-300">Loading…</div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-gray-300">No questions found for this round.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111825]">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300/90 bg-white/5">
            <div className="col-span-2">Start</div>
            <div className="col-span-4">Match • Venue</div>
            <div className="col-span-1">Q#</div>
            <div className="col-span-5">Question</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 px-4 py-4 items-center hover:bg-white/[0.03] transition-colors"
              >
                {/* Start + status */}
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-sm text-gray-200">{r.startText}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      r.status === "OPEN"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-yellow-500/15 text-yellow-200 border-yellow-500/30"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Match • Venue */}
                <div className="col-span-4">
                  <div className="text-sm font-semibold text-orange-300">
                    {r.match.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {r.venue || "–"}
                  </div>
                </div>

                {/* Quarter badge */}
                <div className="col-span-1">
                  <span className="inline-flex items-center justify-center w-9 h-7 rounded-md bg-white/10 text-white/90 text-xs font-semibold">
                    Q{r.qnum}
                  </span>
                </div>

                {/* Question + actions */}
                <div className="col-span-5">
                  <div className="text-sm text-gray-100 mb-2">{r.qtext}</div>

                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-orange-500/90 hover:bg-orange-500 text-white"
                      disabled
                      title="Login required to pick"
                    >
                      Yes
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-500/90 hover:bg-purple-500 text-white"
                      disabled
                      title="Login required to pick"
                    >
                      No
                    </button>

                    <Link
                      href="/login"
                      className="ml-3 text-xs text-gray-300 hover:text-white underline underline-offset-4"
                    >
                      Log in to make picks →
                    </Link>
                  </div>

                  {/* Percentages placeholder */}
                  <div className="mt-1 text-[11px] text-gray-400">
                    Yes 0% • No 0%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
