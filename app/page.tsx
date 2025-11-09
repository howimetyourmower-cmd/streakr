"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../config/firebaseClient";

// ---- Types ----
type Question = { quarter: number; question: string };
type Game = {
  match: string;
  // either (date+time+tz) or a freeform startTime (string or Firestore Timestamp)
  date?: string;
  time?: string;
  tz?: string;
  startTime?: any;
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

// ---- Helpers ----
function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

// convert "March 20, 2026 at 7:20:00PM UTC+11" -> Date
function parseFreeformStartTime(v: string): Date | null {
  // Example: March 20, 2026 at 7:20:00PM UTC+11
  const re =
    /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*UTC([+-]\d{1,2})$/;
  const m = v.trim().match(re);
  if (!m) return null;
  const [, monName, dStr, yStr, hStr, minStr, secStr, ampm, tzOffStr] = m;

  const monthMap: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  const month = monthMap[monName.toLowerCase()];
  if (month == null) return null;

  let hour = parseInt(hStr, 10);
  const minute = parseInt(minStr, 10);
  const second = secStr ? parseInt(secStr, 10) : 0;

  // 12h -> 24h
  if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  const day = parseInt(dStr, 10);
  const year = parseInt(yStr, 10);
  const tz = tzOffStr.startsWith("+") ? tzOffStr : `+${tzOffStr}`; // ensure sign

  // Create ISO string with explicit offset
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
  // Case 1: date + time + (optional tz)
  if (game.date && game.time) {
    // Treat date as YYYY-MM-DD (or YYYY/MM/DD) and time as HH:mm
    const tz = game.tz ?? "+11:00"; // safe default for AFL season
    const iso = `${game.date}T${game.time}:00${tz.startsWith("+") || tz.startsWith("-") ? "" : "+"}${tz}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }

  // Case 2: Firestore Timestamp
  if (isFsTimestamp(game.startTime)) {
    return new Date(game.startTime.seconds * 1000);
  }

  // Case 3: Freeform string like "March 20, 2026 at 7:20:00PM UTC+11"
  if (typeof game.startTime === "string") {
    const parsed = parseFreeformStartTime(game.startTime);
    if (parsed) return parsed;
    // If we can’t parse, fall back to naïve Date (may be invalid)
    const d = new Date(game.startTime);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function formatWhenWhere(game: Game): string {
  const tz = game.tz || "Australia/Melbourne";
  const d = toDate(game);

  if (!d) {
    return game.venue ? `TBD • ${game.venue}` : "TBD";
  }

  const day = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: tz,
  }).format(d);

  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(d);

  const tzName =
    new Intl.DateTimeFormat("en-AU", {
      timeZoneName: "short",
      timeZone: tz,
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value || "";

  const venue = game.venue ? ` • ${game.venue}` : "";
  return `${day} • ${time} ${tzName}${venue}`;
}

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore(app);
    const ref = doc(db, "fixtures", `round-${CURRENT_ROUND}`);
    getDoc(ref)
      .then((snap) => {
        const data = snap.data() as RoundDoc | undefined;
        setGames(data?.games ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const samples = useMemo(() => {
    const flat: Array<{ game: Game; q: Question }> = [];
    for (const g of games) for (const q of g.questions) flat.push({ game: g, q });
    return flat.slice(0, 6);
  }, [games]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/streakrlogo.jpg"
              alt="STREAKr AFL"
              width={150}
              height={120}
              priority
              className="h-8 w-auto"
            />
            <span className="text-xl font-extrabold tracking-wide">
              STREAK<span className="text-orange-500">r</span> AFL
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/picks" className="hover:text-orange-400">Picks</Link>
            <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
            <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
            <Link href="/faq" className="hover:text-orange-400">How to Play</Link>
          </nav>
        </div>
      </header>

      {/* Hero with MCG */}
      <section
        className="relative w-full"
        style={{
          backgroundImage: "url('/mcg-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-[#0b0f13]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-28">
          <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
            One pick. <span className="text-orange-500">One streak.</span> Win the round.
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href="/picks" className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600">
              Make your first pick
            </Link>
            <Link href="/leaderboard" className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:border-white/40">
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsor strip */}
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="mb-8 flex h-20 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* Samples grid */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-6 text-xl font-semibold">Round {CURRENT_ROUND} Questions</h2>

        {loading ? (
          <div className="text-white/70">Loading sample questions…</div>
        ) : samples.length === 0 ? (
          <div className="text-white/70">No questions found yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {samples.map(({ game, q }, idx) => (
              <article
                key={`${game.match}-${q.quarter}-${idx}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm"
              >
                <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-orange-400">
                  {game.match}
                </div>
                <div className="mb-3 text-xs text-white/60">{formatWhenWhere(game)}</div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="mr-2 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                      Q{q.quarter}
                    </span>
                    {q.question}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="rounded-md bg-green-600 px-3 py-1 text-sm font-semibold" disabled>
                      Yes
                    </button>
                    <button className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold" disabled>
                      No
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it Works */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <h3 className="mb-4 text-lg font-semibold">How it works</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">1. Pick</div>
            <p className="text-sm text-white/80">Choose <em>Yes</em> or <em>No</em> on a quarter question.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">2. Streak</div>
            <p className="text-sm text-white/80">Each correct pick adds to your streak. A wrong pick ends it.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">3. Win</div>
            <p className="text-sm text-white/80">Longest streak for the round wins the prize.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
