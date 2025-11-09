"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { app } from "../src/config/firebaseClient";
import {
  getFirestore,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

type Q = {
  question: string;
  quarter: number;
  match: string; // we'll inject this when we flatten
};

type Game = {
  match: string;
  questions: Q[];
  startTime?: Timestamp; // if you add this later we can sort by it
};

type FixtureDoc = {
  round: number;
  season?: number;
  games: Game[];
};

type Card = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
};

export default function HomePage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const db = getFirestore(app);
        // Round 1 – if you change rounds later, just change this id:
        const ref = doc(db, "fixtures", "round-1");
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setCards([]);
          setLoading(false);
          return;
        }

        const data = snap.data() as FixtureDoc;

        // Flatten all questions, decorate with match & quarter,
        // then take only the first 6 for the home grid.
        const all: Card[] =
          data.games
            .flatMap((g) =>
              (g.questions || []).map((q, idx) => ({
                id: `${g.match.replaceAll(" ", "_")}-Q${q.quarter}-${idx}`,
                title: q.question,
                subtitle: `${g.match} – Q${q.quarter}`,
                cta: "Make This Pick",
              }))
            )
            // You can sort here if you later add times:
            // .sort((a,b) => ...)
            .slice(0, 6); // ← LIMIT TO 6

        setCards(all);
      } catch (e) {
        console.error(e);
        setCards([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <main className="text-white">
      {/* HERO with MCG background */}
      <section
        className="relative w-full"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url('/mcg-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-32 sm:py-40">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold">
            <span className="text-white">One pick.</span>{" "}
            <span className="text-orange-500">One streak.</span>{" "}
            <span className="text-white">Win the round.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the
            leaderboard, win prizes.
          </p>

          <div className="mt-8 flex gap-3">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 transition"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl bg-white/10 px-5 py-3 font-semibold hover:bg-white/20 transition"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* ROUND 1 SAMPLE GRID (3×2) */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-6 text-xl font-semibold">Round 1 Questions</h2>

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="text-white/70">
            No questions found for Round 1 yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl bg-white/5 p-5 shadow-md ring-1 ring-white/10"
              >
                <div className="text-xs uppercase tracking-wide text-white/60 mb-1">
                  {c.subtitle}
                </div>
                <h3 className="text-lg font-semibold leading-snug">
                  {c.title}
                </h3>

                {/* Dummy Yes/No buttons – on home they don’t submit, just navigate */}
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-medium hover:bg-white/20 transition"
                    onClick={() => (window.location.href = "/picks")}
                  >
                    Yes
                  </button>
                  <button
                    className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-medium hover:bg-white/20 transition"
                    onClick={() => (window.location.href = "/picks")}
                  >
                    No
                  </button>
                </div>

                <button
                  className="mt-4 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold hover:bg-orange-600 transition"
                  onClick={() => (window.location.href = "/picks")}
                >
                  {c.cta}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
