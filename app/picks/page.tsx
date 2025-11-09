// app/picks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  // optional future fields
  status?: "OPEN" | "PENDING" | "FINAL";
  yesPct?: number;
  noPct?: number;
  startTime?: any; // string or Firestore Timestamp
  venue?: string;
};

type Game = {
  match: string;
  startTime?: any; // optional if set at game level
  date?: string;
  time?: string;
  tz?: string;
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

function isFsTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number";
}

function formatDateTime(v: any): string | null {
  if (!v) return null;

  // Firestore Timestamp
  if (isFsTimestamp(v)) {
    const d = new Date(v.seconds * 1000);
    // Example: Thu, 19 Mar · 7:50 pm AEDT
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(d);
  }

  // String already formatted (e.g. "March 19, 2026 at 7:50:00PM UTC+11")
  if (typeof v === "string") {
    // Try to prettify if it’s a parseable date, otherwise show as-is
    const maybe = Date.parse(v);
    if (!Number.isNaN(maybe)) {
      const d = new Date(maybe);
      return new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }).format(d);
    }
    return v.replace(" at ", " · ").replace("UTC", "UTC");
  }

  return null;
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);
  const router = useRouter();

  // Auth observer (we only care if there is a user; viewing is allowed regardless)
  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => setUserUid(u ? u.uid : null));
    return unsub;
  }, []);

  // Fetch round doc – try `rounds/round-1`, then fall back to `round-1`
  useEffect(() => {
    const db = getFirestore(app);

    async function fetchRound(): Promise<RoundDoc | null> {
      // Attempt 1: rounds/round-1
      const refA = doc(db, "rounds", `round-${CURRENT_ROUND}`);
      const snapA = await getDoc(refA);
      if (snapA.exists()) return (snapA.data() as DocumentData) as RoundDoc;

      // Attempt 2: root-level document named round-1
      const refB = doc(db, `round-${CURRENT_ROUND}`);
      const snapB = await getDoc(refB);
      if (snapB.exists()) return (snapB.data() as DocumentData) as RoundDoc;

      return null;
    }

    (async () => {
      try {
        const data = await fetchRound();
        setGames(data?.games ?? []);
      } catch (e) {
        console.error("Failed to fetch round:", e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function onPickClick(game: Game, q: Question, value: "YES" | "NO") {
    if (!userUid) {
      router.push("/auth"); // not logged in → take them to auth
      return;
    }
    // TODO: save pick to Firestore when ready
    console.log("Pick saved", { match: game.match, quarter: q.quarter, value });
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-6">
          Make Picks
        </h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!games || games.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-6">
          Make Picks
        </h1>
        <p>No questions found for Round {CURRENT_ROUND}.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-8">Make Picks</h1>

      <div className="space-y-6">
        {games.map((game, gi) => {
          // Prefer game-level startTime/venue, otherwise pull from the first question if present
          const firstQ = game.questions?.[0];
          const when =
            formatDateTime(game.startTime) ?? formatDateTime(firstQ?.startTime);
          const venue = game.venue ?? firstQ?.venue;

          return (
            <section
              key={`${game.match}-${gi}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6"
            >
              {/* Match header */}
              <div className="mb-1 text-xl md:text-2xl font-bold text-orange-400 uppercase tracking-wide">
                {game.match}
              </div>

              {(when || venue) && (
                <div className="mb-4 text-sm text-white/70">
                  {when ?? "TBD"}
                  {venue ? ` · ${venue}` : ""}
                </div>
              )}

              {/* Questions – compact one-column list */}
              <div className="space-y-3">
                {game.questions.map((q, qi) => {
                  const status = q.status ?? "OPEN";
                  const yesPct = q.yesPct ?? 0;
                  const noPct = q.noPct ?? 0;

                  return (
                    <div
                      key={`${gi}-${qi}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      {/* Top row: Q chip, status, and actions */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                            Q{q.quarter}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                              status === "FINAL"
                                ? "bg-purple-500/20 text-purple-300"
                                : status === "PENDING"
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="hidden md:flex items-center gap-2">
                          <button
                            onClick={() => onPickClick(game, q, "YES")}
                            className="rounded-md bg-green-600 hover:bg-green-500 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => onPickClick(game, q, "NO")}
                            className="rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            No
                          </button>
                        </div>
                      </div>

                      {/* Question text */}
                      <div className="mt-2 text-base md:text-lg font-semibold leading-snug">
                        {q.question}
                      </div>

                      {/* Percentages + mobile actions */}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs md:text-sm text-white/70">
                          Yes {yesPct}% · No {noPct}%
                        </div>

                        <div className="md:hidden flex items-center gap-2">
                          <button
                            onClick={() => onPickClick(game, q, "YES")}
                            className="rounded-md bg-green-600 hover:bg-green-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => onPickClick(game, q, "NO")}
                            className="rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Helper link back to home */}
      <div className="mt-10 text-sm text-white/60">
        <Link href="/" className="underline hover:text-white">
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
