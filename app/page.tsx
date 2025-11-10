"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config/firebaseClient"; // <- your current path

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  startTime?: any; // Firestore Timestamp or ISO/string
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND_ID = "round-1";

/** Try to format a start time; fall back to "TBD" */
function formatStartTime(startTime?: any): string {
  if (!startTime) return "TBD";
  // Firestore Timestamp?
  if (startTime?.seconds && typeof startTime.seconds === "number") {
    const d = new Date(startTime.seconds * 1000);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  }
  // ISO-ish string?
  const d = new Date(startTime);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  }
  return "TBD";
}

/** Pull a flat list of up to 6 questions for the home grid */
function takeSix(items: Game[]): Array<{ game: Game; q: Question }> {
  const out: Array<{ game: Game; q: Question }> = [];
  for (const g of items) {
    for (const q of g.questions) {
      out.push({ game: g, q });
      if (out.length >= 6) return out;
    }
  }
  return out;
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", CURRENT_ROUND_ID);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setGames([]);
        } else {
          const data = snap.data() as RoundDoc;
          setGames(Array.isArray(data?.games) ? data.games : []);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const six = useMemo(() => takeSix(games), [games]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* HERO – full-bleed, responsive */}
      <section className="relative w-full h-[54vh] md:h-[62vh]">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at twilight"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* dark gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-[#0b1220]" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:pb-12">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
              <span className="text-white">Real Streakr&apos;s</span>{" "}
              <span className="text-orange-400">don&apos;t get caught.</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-white/80 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the
              leaderboard, win prizes.
            </p>

            <div className="mt-5 flex gap-3">
              <Link
                href="/auth"
                className="rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 font-semibold transition"
              >
                Sign up / Log in
              </Link>
              <Link
                href="/picks"
                className="rounded-xl border border-white/20 hover:border-white/40 px-4 py-2 font-semibold transition"
              >
                View Picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsor banner BELOW the hero so the whole image stays visible */}
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mt-6 md:mt-8 rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-white/80">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* Open Picks grid */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <h2 className="mt-8 md:mt-10 text-2xl md:text-3xl font-extrabold">
          Round 1 Open Picks
        </h2>

        {loading && (
          <p className="mt-4 text-white/70">Loading selections…</p>
        )}

        {!loading && error && (
          <p className="mt-4 text-red-300">Error: {error}</p>
        )}

        {!loading && !error && six.length === 0 && (
          <p className="mt-4 text-white/70">
            No open selections right now. Check back soon.
          </p>
        )}

        {/* Cards – force consistent size */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {six.map(({ game, q }, idx) => {
            const when = formatStartTime(game.startTime);
            return (
              <div
                key={`${idx}-${q.quarter}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              >
                {/* top: match + meta */}
                <div className="mb-3">
                  <div className="text-orange-400 font-bold tracking-wide">
                    {game.match?.toUpperCase()}
                  </div>
                  <div className="text-xs text-white/70">
                    {when} • {game.venue || "TBD"}
                  </div>
                </div>

                {/* body: question */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 min-h-[140px] flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center text-xs font-bold rounded-md px-2 py-1 bg-white/10 text-white/80">
                      Q{q.quarter}
                    </span>
                    <span className="sr-only">Question</span>
                  </div>
                  <p className="text-[15px] leading-snug">
                    {q.question}
                  </p>

                  {/* actions row */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-orange-500/90 px-3 py-1.5 text-sm font-semibold text-white"
                        title="Login to pick"
                      >
                        Yes
                      </button>
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-purple-600/90 px-3 py-1.5 text-sm font-semibold text-white"
                        title="Login to pick"
                      >
                        No
                      </button>
                    </div>

                    <Link
                      href="/picks"
                      className="text-sm text-white/80 hover:text-white"
                    >
                      See other picks →
                    </Link>
                  </div>

                  {/* tiny stats placeholder */}
                  <div className="mt-3 text-xs text-white/50">
                    Yes 0% • No 0%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Spacer at bottom */}
        <div className="h-12" />
      </section>
    </div>
  );
}
