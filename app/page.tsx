"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient"; // ✅ updated import

type Question = { quarter: number; question: string };
type Game = {
  match: string;
  startTime?: any;
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const CURRENT_ROUND_ID = "round-1";

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
      {/* HERO */}
      <section className="relative w-full h-[85vh] md:h-[90vh] overflow-hidden">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at twilight"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#0b1220]/90" />
        <div className="absolute bottom-0 left-0 right-0">
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:pb-10">
            <h1 className="font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="text-white">Real Streakr&apos;s</span>{" "}
              <span className="text-orange-400">don&apos;t get caught.</span>
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/85 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the
              leaderboard, win prizes.
            </p>
            <div className="mt-4 flex gap-3">
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

      {/* SPONSOR BANNER */}
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mt-12 rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-white/80">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* PICKS GRID */}
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
                <header className="mb-3">
                  <div className="text-orange-400 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                    {game.match?.toUpperCase()}
                  </div>
                  <div className="text-xs text-white/70">
                    {when} • {game.venue || "TBD"}
                  </div>
                </header>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 min-h-[200px] flex flex-col justify-between">
                  <div>
                    <span className="inline-flex items-center justify-center text-xs font-bold rounded-md px-2 py-1 bg-white/10 text-white/80 mr-2">
                      Q{q.quarter}
                    </span>
                    <p className="mt-2 text-[15px] leading-snug">
                      {q.question}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-orange-500/90 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Yes
                      </button>
                      <button
                        disabled
                        className="cursor-not-allowed rounded-lg bg-purple-600/90 px-3 py-1.5 text-sm font-semibold text-white"
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
                  <div className="mt-3 text-xs text-white/50">
                    Yes 0% • No 0%
                  </div>
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
