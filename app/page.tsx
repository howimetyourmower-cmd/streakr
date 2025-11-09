"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "../config/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

type FixtureQuestion = { quarter: number; question: string };
type FixtureGame = {
  match: string; // e.g., "Carlton v Brisbane"
  venue?: string; // optional, if you later add it
  time?: string;  // optional, e.g., "Fri, Mar 15 — 7:20 PM AEDT"
  questions: FixtureQuestion[];
};

export default function HomePage() {
  const [sample, setSample] = useState<
    { match: string; quarter: number; question: string }[]
  >([]);

  useEffect(() => {
    (async () => {
      try {
        // Pull the current round’s sample questions (round-1 for now)
        const ref = doc(db, "fixtures", "round-1");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as { games: FixtureGame[] };
        const picks: { match: string; quarter: number; question: string }[] = [];

        for (const g of data.games || []) {
          for (const q of g.questions || []) {
            if (picks.length < 6) {
              picks.push({ match: g.match, quarter: q.quarter, question: q.question });
            }
          }
          if (picks.length >= 6) break;
        }

        setSample(picks);
      } catch {
        // leave empty — just don’t crash the homepage
      }
    })();
  }, []);

  return (
    <main className="bg-[#0b0f13] text-white min-h-screen">
      {/* HERO */}
      <section className="relative w-full">
        <div className="mx-auto max-w-6xl px-4 pt-8">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              {/* If you want the header logo here, keep as-is */}
              <Image
                src="/streakrlogo.jpg"
                alt="STREAKr AFL"
                width={140}
                height={40}
                className="h-10 w-auto"
                priority
              />
              <span className="sr-only">STREAKr AFL</span>
            </Link>

            <nav className="flex items-center gap-8 text-sm md:text-base">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="#how-it-works" className="hover:text-orange-400">How to Play</Link>
            </nav>
          </header>
        </div>

        <div className="mx-auto max-w-6xl px-4 mt-8">
          <div className="relative overflow-hidden rounded-2xl shadow-lg">
            <Image
              src="/mcg-hero.jpg"
              alt="MCG stadium hero image"
              width={1600}
              height={600}
              className="w-full h-[420px] md:h-[500px] object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f13] via-transparent to-transparent"></div>

            <div className="absolute left-0 right-0 bottom-0 p-6 md:p-10">
              <h1 className="text-4xl md:text-6xl font-extrabold">
                <span className="text-white">One pick. </span>
                <span className="text-orange-500">One streak.</span>{" "}
                <span className="text-white">Win the round.</span>
              </h1>
              <p className="mt-3 max-w-3xl text-gray-200">
                Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
              </p>

              <div className="mt-6 flex gap-4">
                <Link
                  href="/picks"
                  className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400 transition"
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
          </div>
        </div>
      </section>

      {/* SAMPLE PICKS GRID (Round 1) */}
      <section className="mx-auto max-w-6xl px-4 mt-14 md:mt-20">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Round 1 Questions</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sample.slice(0, 6).map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white/5 p-5 shadow-lg ring-1 ring-white/10"
            >
              <h3 className="text-sm font-semibold tracking-wide text-orange-500 mb-2">
                {item.match}
              </h3>
              <div className="text-xs text-gray-400 mb-3">Q{item.quarter}</div>
              <p className="text-base md:text-lg font-medium mb-5">{item.question}</p>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Stats unlock after you pick</div>
                <Link
                  href="/picks"
                  className="rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 transition"
                >
                  Make This Pick
                </Link>
              </div>
            </div>
          ))}

          {/* Fallback placeholders if no data yet */}
          {sample.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="rounded-2xl bg-white/5 p-5 shadow-lg ring-1 ring-white/10 animate-pulse"
              >
                <div className="h-4 w-40 bg-white/10 rounded mb-3" />
                <div className="h-3 w-16 bg-white/10 rounded mb-4" />
                <div className="h-5 w-full bg-white/10 rounded mb-6" />
                <div className="flex items-center justify-between">
                  <div className="h-3 w-32 bg-white/10 rounded" />
                  <div className="h-9 w-32 bg-white/10 rounded" />
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 mt-20 pb-24">
        <h2 className="text-3xl font-bold text-center mb-6">How It Works</h2>
        <div className="max-w-3xl mx-auto text-lg space-y-4 text-center text-gray-200">
          <p>1️⃣ Pick a player question before each AFL quarter starts.</p>
          <p>2️⃣ Get it right to keep your streak alive — get it wrong and your streak resets.</p>
          <p>3️⃣ Climb the leaderboard. Longest streak each round wins prizes!</p>
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/picks"
            className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-black hover:bg-orange-400 transition"
          >
            Start Picking
          </Link>
        </div>
      </section>
    </main>
  );
}
