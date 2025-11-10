"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

type Question = { quarter: number; question: string };
type Game = {
  match: string;
  startTime?: any;
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const CURRENT_ROUND_ID = "round-1";

/** Format Firestore Timestamp or ISO string; else "TBD" */
function fmtStart(startTime?: any): string {
  if (!startTime) return "TBD";
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

/** Flatten to first six questions for the home grid */
function firstSix(games: Game[]): Array<{ game: Game; q: Question }> {
  const out: Array<{ game: Game; q: Question }> = [];
  for (const g of games) {
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
        if (snap.exists()) {
          const data = snap.data() as RoundDoc;
          setGames(Array.isArray(data?.games) ? data.games : []);
        } else {
          setGames([]);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const six = useMemo(() => firstSix(games), [games]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* HERO: full-width, show entire image (no cropping) */}
      <section className="relative w-full">
        <div className="relative w-full">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG at twilight"
            width={2400}
            height={900}
            priority
            // Show full image, keep aspect, span width. Height adjusts by image ratio.
            className="w-full h-auto"
          />
          {/* readable overlay content, pinned near bottom */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#0b1220]/90" />
          <div className="absolute left-0 right-0 bottom-0">
            <div className="mx-auto w-full max-w-6xl px-4 pb-6 md:pb-8">
              <h1
                className="pointer-events-auto font-extrabold text-4xl md:text-6xl lg:text-7xl whitespace-nowrap overflow-hidden text-ellipsis"
                title="Real Streakr’s don’t get caught."
              >
                <span className="text-white">Real Streakr&apos;s</span>{" "}
                <span className="text-orange-400">don&apos;t get caught.</span>
              </h1>
              <p className="pointer-events-auto mt-2 text-sm md:text-base text-white/85 max-w-2xl">
                Free-to-play AFL prediction streaks. Build your streak, top the
                leaderboard, win prizes.
              </p>

              <div className="pointer-events-auto mt-4 flex gap-3">
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
        </div>
      </section>

      {/* Lower sponsor banner so full hero stays in view */}
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mt-10 md:mt-14 rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-white/80">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* GRID: 6 equal-height cards */}
      <section className="mx-auto w-full max-w-6xl px-4">
        <h2 className="mt-8 md:mt-10 text-2xl md:text-3xl font-extrabold">
          Round 1 Open Picks
        </h2>

        {loading && <p className="mt-4 text-white/70">Loading selections…</p>}
        {!loading && error && (
          <p className="mt-4 text-red-300">Error: {error}</p>
        )}
        {!loading && !error && six.length === 0 && (
          <p className="mt-4 text-white/70">
            No open selections right now. Check back soon.
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {six.map(({ game, q }, i) => {
            const when = fmtStart(game.startTime);
            return (
              <article
                key={`${i}-${q.quarter}`}
                className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              >
                {/* Top: meta */}
                <header className="mb-3">
                  <div className="text-orange-400 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                    {game.match?.toUpperCase()}
                  </div>
                  <div className="text-xs text-white/70">
                    {when} • {game.venue || "TBD"}
                  </div>
                </header>

                {/* Body: fixed-height content box so all cards match */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 min-h-[220px] flex flex-col justify-between">
                  {/* Q label + question */}
                  <div>
                    <span className="inline-flex items-center justify-center text-xs font-bold rounded-md px-2 py-1 bg-white/10 text-white/80 mr-2">
                      Q{q.quarter}
                    </span>
                    <p className="mt-2 text-[15px] leading-snug">
                      {q.question}
                    </p>
                  </div>

                  {/* Actions + link */}
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

                  {/* tiny stats row */}
                  <div className="mt-3 text-xs text-white/50">Yes 0% • No 0%</div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="h-12" />
      </section>
    </div>
  );
}
