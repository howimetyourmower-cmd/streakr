// app/picks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  // startTime may be a Firestore Timestamp or a string (we support both)
  startTime?: Timestamp | string;
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

function isFSTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
}

function formatStart(start?: Timestamp | string) {
  if (!start) return "TBD";
  try {
    const d = isFSTimestamp(start)
      ? start.toDate()
      : new Date(String(start)); // handles ISO strings or “Thu, 19 Mar 2026, 7:20 PM AEDT”
    if (isNaN(d.getTime())) return "TBD";
    // Show like: Thu, 19 Mar • 7:20 pm
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "TBD";
  }
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // IMPORTANT: rounds / round-1
        const ref = doc(db, "rounds", "round-1");
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setGames([]);
          return;
        }
        const data = snap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load picks.");
        setGames([]);
      }
    })();
  }, []);

  const content = useMemo(() => {
    if (!games) {
      return (
        <div className="text-sm text-zinc-400">Loading…</div>
      );
    }
    if (games.length === 0) {
      return (
        <div className="text-sm text-zinc-400">
          No questions found for Round 1.
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {games.map((g, gi) => (
          <div key={gi} className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
            <div className="mb-1 text-orange-400 font-semibold tracking-wide uppercase">
              {g.match}
            </div>
            <div className="mb-4 text-xs text-zinc-400">
              {formatStart(g.startTime)} {g.venue ? `• ${g.venue}` : ""}
            </div>

            <div className="space-y-4">
              {g.questions?.map((q, qi) => (
                <div
                  key={qi}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-800 text-zinc-300">
                        Q{q.quarter}
                      </span>
                      <p className="text-zinc-100">{q.question}</p>
                    </div>

                    {/* Yes / No – colored per your palette */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="px-3 py-1.5 text-sm rounded-md bg-orange-500 hover:bg-orange-600 text-white"
                        // onClick={...} – wire to auth-gated pick later
                      >
                        Yes
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm rounded-md bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Optional: small footer row for % and comments (placeholder for now) */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <div>Yes 0% • No 0%</div>
                    <div className="flex items-center gap-1">
                      <span>💬</span>
                      <span>0</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }, [games]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white">Make Picks</h1>
        <Link
          href="/"
          className="text-sm text-zinc-300 hover:text-white underline underline-offset-4"
        >
          ← Back to Home
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {content}
    </main>
  );
}
