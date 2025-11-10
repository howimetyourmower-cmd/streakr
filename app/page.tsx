"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./config/firebaseClient";

// ---------- Types ----------
type Question = {
  quarter: number;
  question: string;
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

// ---------- Settings ----------
const CURRENT_ROUND = 1; // change to "OR" if you move to Opening Round later

function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

function formatWhen(game: Game) {
  // If a Firestore Timestamp was seeded
  if (isFsTimestamp(game.startTime)) {
    const dt = new Date(game.startTime.seconds * 1000);
    const date = dt.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const time = dt.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const tz = "AEDT";
    return `${date} · ${time} ${tz} · ${game.venue ?? "TBD"}`;
  }

  // If you stored pre-split strings {date,time,tz,venue}
  if (game.date && game.time) {
    return `${game.date} · ${game.time}${game.tz ? ` ${game.tz}` : ""} · ${game.venue ?? "TBD"}`;
  }

  // If you stored a single startTime string
  if (typeof game.startTime === "string") {
    return `${game.startTime}${game.venue ? ` · ${game.venue}` : ""}`;
  }

  return `TBD${game.venue ? ` · ${game.venue}` : ""}`;
}

export default function HomePage() {
  const db = useMemo(() => getFirestore(app), []);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const id = CURRENT_ROUND === 1 ? "round-1" : `round-${CURRENT_ROUND}`;
        const ref = doc(db, "rounds", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRound(snap.data() as RoundDoc);
        } else {
          setRound({ games: [] });
        }
      } catch (e) {
        console.error("Home fetch error:", e);
        setRound({ games: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  // pick first 6 questions from the round (spread across games)
  const samples = useMemo(() => {
    if (!round?.games?.length) return [];
    const out: { game: Game; q: Question }[] = [];
    for (const g of round.games) {
      for (const q of g.questions) {
        out.push({ game: g, q });
        if (out.length >= 6) return out;
      }
    }
    return out;
  }, [round]);

  return (
    <main className="min-h-screen w-full">
      {/* HERO */}
      <section className="relative w-full h-[620px] overflow-hidden">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG under lights"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
        <div className="relative z-10 max-w-6xl mx-auto h-full flex flex-col justify-center px-4">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight">
            Real <span className="text-orange-500">Streakr’s</span> Don’t Get Caught!
          </h1>
          <p className="mt-4 text-lg text-white/90 max-w-2xl">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/picks"
              className="rounded-xl px-5 py-3 bg-orange-500 text-black font-semibold hover:opacity-90 transition"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboards"
              className="rounded-xl px-5 py-3 bg-white/15 text-white font-semibold hover:bg-white/20 transition"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsor banner — pushed well below hero */}
      <div className="max-w-6xl mx-auto px-4 mt-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 text-center text-white/80">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* Round samples */}
      <section className="max-w-6xl mx-auto px-4 mt-10 mb-20">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-6">
          Round {CURRENT_ROUND} Questions
        </h2>

        {loading && (
          <div className="text-white/80">Loading…</div>
        )}

        {!loading && (!samples || samples.length === 0) && (
          <div className="text-white/80">
            No questions found for Round {CURRENT_ROUND}.
          </div>
        )}

        {!loading && samples.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {samples.map(({ game, q }, i) => (
              <article
                key={`${game.match}-${q.quarter}-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-sm tracking-wide font-bold text-orange-400 uppercase">
                  {game.match}
                </h3>
                <p className="text-white/70 mt-1 text-sm">{formatWhen(game)}</p>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-white/10 text-white/90">
                      Q{q.quarter}
                    </span>
                  </div>

                  <p className="text-white font-semibold">{q.question}</p>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      {/* YES (Orange) */}
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg font-semibold text-black bg-[#ff7a00] hover:opacity-90 transition"
                        aria-label="Yes"
                        disabled
                        title="Login to make picks"
                      >
                        Yes
                      </button>
                      {/* NO (Purple) */}
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg font-semibold text-white bg-[#6f3aff] hover:opacity-90 transition"
                        aria-label="No"
                        disabled
                        title="Login to make picks"
                      >
                        No
                      </button>
                    </div>

                    <Link
                      href="/picks"
                      className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 transition"
                    >
                      See Other Picks
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
