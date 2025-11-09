"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;             // "Carlton v Brisbane"
  // Option A (preferred):
  date?: string;             // "2026-03-19"
  time?: string;             // "19:50" (24h)
  tz?: string;               // "Australia/Melbourne"
  // Option B (what you currently have):
  startTime?: any;           // Firestore Timestamp OR a parseable string
  // Common:
  venue?: string;            // "MCG, Melbourne"
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

// --- Helpers ---------------------------------------------------------------

function isFsTimestamp(v: any): v is { seconds: number; nanoseconds?: number } {
  return v && typeof v === "object" && typeof v.seconds === "number";
}

function toDateFromStart(game: Game): Date | null {
  const st = (game as any).startTime;
  if (!st) return null;
  if (isFsTimestamp(st)) return new Date(st.seconds * 1000);
  // String fallback (e.g. "March 19, 2026 at 7:50:00PM UTC+11")
  const d = new Date(st);
  return isNaN(d.getTime()) ? null : d;
}

function toDateFromParts(game: Game): Date | null {
  const { date, time } = game || {};
  if (!date || !time) return null;
  const iso = `${date}T${time}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// "Fri Mar 19 • 7:50 PM AEDT • MCG, Melbourne"   or "TBD • MCG, Melbourne"
function formatWhenWhere(game: Game): string {
  const zone = game.tz || "Australia/Melbourne";
  const d =
    toDateFromParts(game) ||
    toDateFromStart(game);

  if (!d) {
    return game.venue ? `TBD • ${game.venue}` : "TBD";
  }

  try {
    const day = new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: zone,
    }).format(d);

    const t = new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: zone,
    }).format(d);

    const tzShort =
      new Intl.DateTimeFormat("en-AU", {
        timeZoneName: "short",
        timeZone: zone,
      })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value || "";

    const venuePart = game.venue ? ` • ${game.venue}` : "";
    return `${day} • ${t} ${tzShort}${venuePart}`;
  } catch {
    return game.venue ? `TBD • ${game.venue}` : "TBD";
  }
}

// --------------------------------------------------------------------------

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

  // first 6 questions across the round
  const samples = useMemo(() => {
    const flat: Array<{ game: Game; q: Question }> = [];
    for (const g of games) for (const q of g.questions) flat.push({ game: g, q });
    return flat.slice(0, 6);
  }, [games]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      {/* NAV */}
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

      {/* HERO */}
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

      {/* Banner */}
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="mb-8 flex h-20 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* SAMPLE GRID */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-6 text-xl font-semibold">Round {CURRENT_ROUND} Questions</h2>

        {loading ? (
          <div className="text-white/70">Loading sample questions…</div>
        ) : samples.length === 0 ? (
          <div className="text-white/70">No questions found yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {samples.map(({ game, q }, idx) => (
              <div key={`${game.match}-${q.quarter}-${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
                <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-orange-400">
                  {game.match}
                </div>
                <div className="mb-3 text-xs text-white/60">{formatWhenWhere(game)}</div>

                <div className="mb-4 text-sm">
                  <span className="mr-2 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">Q{q.quarter}</span>
                  {q.question}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button className="rounded-md bg-green-600 px-3 py-1 text-sm font-semibold" disabled>Yes</button>
                    <button className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold" disabled>No</button>
                  </div>
                  <Link href="/picks" className="rounded-md bg-orange-500 px-3 py-1 text-sm font-semibold hover:bg-orange-600">
                    Make This Pick
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* HOW IT WORKS */}
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
