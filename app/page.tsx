"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  // optional future fields
  status?: "OPEN" | "PENDING" | "FINAL";
  yesPct?: number; // for future stats
  noPct?: number;
};

type Game = {
  match: string;         // e.g. "Carlton v Brisbane"
  date?: string;         // e.g. "Thu Mar 20 2026"
  time?: string;         // e.g. "7:20 PM AEDT"
  venue?: string;        // e.g. "MCG"
  location?: string;     // alt field name if you use it
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

export default function HomePage() {
  const db = useMemo(() => getFirestore(app), []);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<
    { match: string; meta: string; question: string }[]
  >([]);

  // TODO: when you add a "currentRound" doc/field, read that instead of hardcoding.
  const currentRoundId = "round-1";

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "fixtures", currentRoundId);
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as RoundDoc) : undefined;
        const games = data?.games ?? [];

        // Flatten all questions with their parent match/meta, then take 6.
        const flattened: { match: string; meta: string; question: string }[] =
          games.flatMap((g) => {
            const metaParts = [
              g.date?.trim(),
              g.time?.trim(),
              (g.venue || g.location)?.trim(),
            ].filter(Boolean);
            const meta =
              metaParts.length > 0 ? metaParts.join(" • ") : "TBD";

            return (g.questions ?? []).map((q) => ({
              match: g.match ?? "Unknown Match",
              meta,
              question: q.question ?? "Question unavailable",
            }));
          });

        setSamples(flattened.slice(0, 6));
      } catch (e) {
        console.error("Failed to load samples:", e);
        setSamples([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG hero background"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/80" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
            <span className="text-white">One pick. </span>
            <span className="text-orange-400">One streak. </span>
            <span className="text-white">Win the round.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-zinc-200">
            Free-to-play AFL prediction streaks. Build your streak, top the
            leaderboard, win prizes.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-black hover:bg-orange-400 transition"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl bg-zinc-800 px-4 py-2 font-semibold text-white ring-1 ring-white/10 hover:bg-zinc-700 transition"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* TOP AD BANNER */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-8">
        <div className="w-full h-20 sm:h-24 rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 flex items-center justify-center">
          <span className="text-zinc-400 text-sm">Ad Banner (970×90 / 728×90)</span>
        </div>
      </section>

      {/* SAMPLES GRID (from current round) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mt-10 mb-16">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Round 1 Questions</h2>

        {loading ? (
          <div className="text-zinc-400">Loading samples…</div>
        ) : samples.length === 0 ? (
          <div className="text-zinc-400">No questions available yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {samples.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl bg-gradient-to-b from-zinc-900/60 to-zinc-900/30 ring-1 ring-white/10 p-4"
              >
                <p className="text-sm text-orange-400 font-semibold">
                  {s.match}
                </p>
                <p className="text-xs text-zinc-400">{s.meta}</p>
                <p className="mt-3 font-semibold">{s.question}</p>

                <div className="mt-4 flex gap-3">
                  <Link
                    href="/picks"
                    className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-black hover:bg-orange-400 transition"
                  >
                    Make This Pick
                  </Link>
                  <Link
                    href="/picks"
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-zinc-700 transition"
                  >
                    See More
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* BOTTOM AD BANNER */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-16">
        <div className="w-full h-32 sm:h-36 rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 flex items-center justify-center">
          <span className="text-zinc-400 text-sm">
            Ad Banner (Responsive rectangle)
          </span>
        </div>
      </section>

      {/* HOW IT WORKS (simple, optional) */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-24">
        <h3 className="text-xl sm:text-2xl font-bold mb-3">How it works</h3>
        <ol className="list-decimal pl-5 space-y-2 text-zinc-200">
          <li>Pick <span className="font-semibold">Yes</span> or <span className="font-semibold">No</span> on one question at a time.</li>
          <li>Each correct pick extends your streak. A wrong pick ends it.</li>
          <li>Top streak for the round wins the prize pool (ties split evenly).</li>
          <li>Your streak resets when the next round starts.</li>
        </ol>
        <Link
          href="/faq"
          className="inline-block mt-4 rounded-xl bg-zinc-800 px-4 py-2 font-semibold text-white ring-1 ring-white/10 hover:bg-zinc-700 transition"
        >
          Read the full FAQ
        </Link>
      </section>
    </main>
  );
}
