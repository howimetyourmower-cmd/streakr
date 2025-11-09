"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  startTime?: any;   // Firestore Timestamp or ISO/string
  date?: string;     // optional string date
  time?: string;     // optional string time
  tz?: string;       // e.g. "AEDT"
  venue?: string;    // e.g. "MCG, Melbourne"
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

function isFsTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
}

function formatStart(start?: any) {
  // Accept Firestore Timestamp, ISO string, or undefined
  if (!start) return { date: "TBD", time: "", tz: "", venuePrefix: "" };

  try {
    if (isFsTimestamp(start)) {
      const d = start.toDate();
      return {
        date: d.toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tz: "",
        venuePrefix: "• ",
      };
    }
    // string fallback
    const d = new Date(start);
    if (!isNaN(d.getTime())) {
      return {
        date: d.toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
        tz: "",
        venuePrefix: "• ",
      };
    }
  } catch {
    // fall through to TBD
  }
  return { date: "TBD", time: "", tz: "", venuePrefix: "" };
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const db = useMemo(() => getFirestore(app), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Expecting Firestore structure: rounds (collection) -> round-1 (document) -> games (array)
        const ref = doc(db, "rounds", `round-${CURRENT_ROUND}`);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (!cancelled) {
            setErr(`No round data found at "rounds/round-${CURRENT_ROUND}".`);
            setGames([]);
          }
          return;
        }

        const data = snap.data() as Partial<RoundDoc> | undefined;
        const arr = Array.isArray(data?.games) ? (data!.games as Game[]) : [];

        if (!cancelled) {
          setGames(arr);
        }
      } catch (e: any) {
        console.error("Failed to load picks:", e);
        if (!cancelled) {
          setErr(
            e?.message ||
              "Failed to load picks (client-side exception). Check console."
          );
          setGames([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0f13] to-[#121821] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight">Make Picks</h1>

        {err && (
          <p className="mt-4 text-sm text-red-300">
            {err}{" "}
            <span className="block opacity-80">
              Tip: Ensure Firestore has a{" "}
              <code className="bg-black/30 px-1 py-0.5 rounded">rounds</code>{" "}
              collection with a{" "}
              <code className="bg-black/30 px-1 py-0.5 rounded">
                round-{CURRENT_ROUND}
              </code>{" "}
              document that contains a{" "}
              <code className="bg-black/30 px-1 py-0.5 rounded">games</code>{" "}
              array.
            </span>
          </p>
        )}

        {!games && !err && <p className="mt-8 text-lg opacity-80">Loading…</p>}

        {games && games.length === 0 && (
          <p className="mt-8 text-lg opacity-80">
            No questions found for Round {CURRENT_ROUND}.
          </p>
        )}

        {games && games.length > 0 && (
          <div className="mt-8 space-y-8">
            {games.map((g, gi) => {
              const { date, time, tz, venuePrefix } = formatStart(g.startTime);
              const venue = g.venue ? `${venuePrefix}${g.venue}` : "";
              return (
                <section
                  key={`${g.match}-${gi}`}
                  className="rounded-2xl border border-white/10 bg-white/5 shadow-lg"
                >
                  <div className="p-5 border-b border-white/10">
                    <h2 className="text-xl font-semibold text-orange-400">
                      {g.match ?? "Match"}
                    </h2>
                    <p className="mt-1 text-sm text-white/70">
                      {date}
                      {time ? ` • ${time}` : ""}
                      {tz ? ` ${tz}` : ""}
                      {venue ? ` ${venue}` : ""}
                    </p>
                  </div>

                  <div className="p-5 space-y-4">
                    {(g.questions ?? []).map((q, qi) => (
                      <div
                        key={`${gi}-${qi}`}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-xs font-semibold">
                            Q{q.quarter ?? "?"}
                          </span>

                          {/* These buttons render even if logged out; hook up auth later */}
                          <div className="ml-auto flex gap-2">
                            <button
                              className="rounded-md bg-green-600/90 px-3 py-1.5 text-sm font-semibold hover:bg-green-600"
                              disabled
                              title="Login required to pick"
                            >
                              Yes
                            </button>
                            <button
                              className="rounded-md bg-red-600/90 px-3 py-1.5 text-sm font-semibold hover:bg-red-600"
                              disabled
                              title="Login required to pick"
                            >
                              No
                            </button>
                          </div>
                        </div>

                        <p className="mt-3 text-base leading-relaxed">
                          {q.question ?? "Question"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
