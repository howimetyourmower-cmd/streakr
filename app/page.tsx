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
  match: string;            // "Carlton v Brisbane"
  date?: string;            // "2026-03-20"   (YYYY-MM-DD)  optional but recommended
  time?: string;            // "19:20"        (24h local time as string) optional
  tz?: string;              // "Australia/Melbourne"        optional
  venue?: string;           // "MCG"                         optional
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

const CURRENT_ROUND = 1;

// Simple formatter for "Fri Mar 20 • 7:20 PM AEDT • MCG"
function formatWhenWhere(game: Game): string {
  const { date, time, tz, venue } = game || {};
  if (!date || !time) return venue ? `TBD • ${venue}` : "TBD";

  try {
    const iso = `${date}T${time}:00`;
    const dt = new Date(iso);
    const zone = tz || "Australia/Melbourne";
    const day = new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: zone,
    }).format(dt);
    const t = new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: zone,
    }).format(dt);
    const tzShort = new Intl.DateTimeFormat("en-AU", {
      timeZoneName: "short",
      timeZone: zone,
    })
      .formatToParts(dt)
      .find(p => p.type === "timeZoneName")?.value || "";
    const venuePart = venue ? ` • ${venue}` : "";
    return `${day} • ${t} ${tzShort}${venuePart}`;
  } catch {
    return venue ? `TBD • ${venue}` : "TBD";
  }
}

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Firestore pull for the current round
  useEffect(() => {
    const db = getFirestore(app);
    const ref = doc(db, "fixtures", `round-${CURRENT_ROUND}`);
    getDoc(ref)
      .then(snap => {
        const data = snap.data() as RoundDoc | undefined;
        setGames(data?.games ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build a flat list of sample cards from the first N questions in the round
  const samples = useMemo(() => {
    const flat: Array<{ game: Game; q: Question }> = [];
    for (const g of games) {
      for (const q of g.questions) {
        flat.push({ game: g, q });
      }
    }
    // Take first 6 for the home page sample grid
    return flat.slice(0, 6);
  }, [games]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      {/* Sticky top nav with logo */}
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
            <Link href="/picks" className="hover:text-orange-400">
              Picks
            </Link>
            <Link href="/leaderboard" className="hover:text-orange-400">
              Leaderboards
            </Link>
            <Link href="/rewards" className="hover:text-orange-400">
              Rewards
            </Link>
            <Link href="/faq" className="hover:text-orange-400">
              How to Play
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO with background image and CTA */}
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
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:border-white/40"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Ad banner (placeholder) */}
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="mb-8 flex h-20 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* Sample picks grid from current round */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-6 text-xl font-semibold">Round {CURRENT_ROUND} Questions</h2>

        {loading ? (
          <div className="text-white/70">Loading sample questions…</div>
        ) : samples.length === 0 ? (
          <div className="text-white/70">No questions found yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {samples.map((item, idx) => {
              const game = item.game;
              const q = item.q;
              return (
                <div
                  key={`${game.match}-${q.quarter}-${idx}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm"
                >
                  <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-orange-400">
                    {game.match}
                  </div>
                  <div className="mb-3 text-xs text-white/60">
                    {formatWhenWhere(game)}
                  </div>

                  <div className="mb-4 text-sm">
                    <span className="mr-2 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/70">
                      Q{q.quarter}
                    </span>
                    {q.question}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        className="rounded-md bg-green-600 px-3 py-1 text-sm font-semibold hover:bg-green-700"
                        disabled
                      >
                        Yes
                      </button>
                      <button
                        className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold hover:bg-red-700"
                        disabled
                      >
                        No
                      </button>
                    </div>
                    <Link
                      href="/picks"
                      className="rounded-md bg-orange-500 px-3 py-1 text-sm font-semibold hover:bg-orange-600"
                    >
                      Make This Pick
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <h3 className="mb-4 text-lg font-semibold">How it works</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">1. Pick</div>
            <p className="text-sm text-white/80">
              Choose <em>Yes</em> or <em>No</em> on a quarter-by-quarter question.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">2. Streak</div>
            <p className="text-sm text-white/80">
              Each correct pick adds to your streak. Wrong ends it.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-orange-400 font-semibold">3. Win</div>
            <p className="text-sm text-white/80">
              Longest streak of the round tops the leaderboard and wins the prize.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
