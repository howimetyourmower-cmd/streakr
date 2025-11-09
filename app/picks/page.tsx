"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  // optional future: status, yes/no %
};
type Game = {
  match: string;
  startTime?: any;
  date?: string;
  time?: string;
  tz?: string;
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

function parseFreeformStartTime(v: string): Date | null {
  const re =
    /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*UTC([+-]\d{1,2})$/i;
  const m = v.trim().replace(/\s+/g, " ").match(re);
  if (!m) return null;
  const [, monName, dStr, yStr, hStr, minStr, secStr, ampmRaw, tzOffStr] = m;
  const monthMap: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const month = monthMap[monName.toLowerCase()];
  if (month == null) return null;
  let hour = parseInt(hStr, 10);
  const minute = parseInt(minStr, 10);
  const second = secStr ? parseInt(secStr, 10) : 0;
  const ampm = ampmRaw.toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const day = parseInt(dStr, 10);
  const year = parseInt(yStr, 10);
  const tz = tzOffStr.startsWith("+") || tzOffStr.startsWith("-") ? tzOffStr : `+${tzOffStr}`;
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
    second
  ).padStart(2, "0")}${tz}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function toDate(game: Game): Date | null {
  if (game.date && game.time) {
    const tz = game.tz ?? "+11:00";
    const d = new Date(`${game.date}T${game.time}:00${tz}`);
    if (!isNaN(d.getTime())) return d;
  }
  const st = game.startTime;
  if (isFsTimestamp(st)) return new Date(st.seconds * 1000);
  if (typeof st === "string") {
    const parsed = parseFreeformStartTime(st);
    if (parsed) return parsed;
    const d = new Date(st);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatWhenWhere(game: Game): string {
  const tz = game.tz || "Australia/Melbourne";
  const d = toDate(game);
  const venue = game.venue;
  if (!d) return venue ? `TBD • ${venue}` : "TBD";
  const day = new Intl.DateTimeFormat("en-AU", {
    weekday: "short", day: "2-digit", month: "short", timeZone: tz,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  }).format(d);
  const tzName = new Intl.DateTimeFormat("en-AU", {
    timeZoneName: "short", timeZone: tz,
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value || "";
  return `${day} • ${time} ${tzName}${venue ? ` • ${venue}` : ""}`;
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, (u) => setAuthed(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const db = getFirestore(app);
    getDoc(doc(db, "fixtures", `round-${CURRENT_ROUND}`))
      .then((snap) => setGames(((snap.data() as RoundDoc | undefined)?.games) ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0f13] px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-4xl font-extrabold">Make Picks</h1>

        {!authed && (
          <div className="mb-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200">
            You must be logged in to make picks.{" "}
            <Link href="/auth" className="text-orange-400 underline">Log in or sign up</Link>.
          </div>
        )}

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : (
          <div className="space-y-6">
            {games.map((game, gi) => (
              <section key={`${game.match}-${gi}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-1 text-lg font-bold uppercase tracking-wide text-orange-400">
                  {game.match}
                </div>
                <div className="mb-4 text-sm text-white/60">{formatWhenWhere(game)}</div>

                {/* One-column compact cards */}
                <div className="space-y-3">
                  {game.questions.map((q, qi) => (
                    <article
                      key={`${gi}-${qi}`}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="mr-2 inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                            Q{q.quarter}
                          </span>
                          <span className="text-white/90">{q.question}</span>
                        </div>

                        <div className="shrink-0">
                          <div className="flex gap-2">
                            <button
                              disabled={!authed}
                              className={`rounded-md px-3 py-1 text-sm font-semibold ${
                                authed
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-green-900/40 opacity-60"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              disabled={!authed}
                              className={`rounded-md px-3 py-1 text-sm font-semibold ${
                                authed
                                  ? "bg-red-600 hover:bg-red-700"
                                  : "bg-red-900/40 opacity-60"
                              }`}
                            >
                              No
                            </button>
                          </div>
                          {!authed && (
                            <div className="mt-1 text-right text-[11px] text-white/50">
                              Log in to pick
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
