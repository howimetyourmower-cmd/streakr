"use client";

import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../src/config/firebaseClient"; // adjust path if different
import Image from "next/image";
import Link from "next/link";

interface Question {
  quarter: number;
  question: string;
}

interface Game {
  match: string;
  questions: Question[];
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const db = getFirestore(app);
      const ref = doc(db, "fixtures", "round-1");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setGames(snap.data().games || []);
      }
    };
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      {/* Hero */}
      <section className="relative">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at night"
          fill
          priority
          className="object-cover opacity-30 -z-10"
        />
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-28">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            <span className="text-white">One pick.</span>{" "}
            <span className="text-orange-500">One streak.</span>{" "}
            <span className="text-white">Win the round.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>

          <div className="mt-8 flex gap-3">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl bg-white/10 px-5 py-3 font-semibold hover:bg-white/15"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Live Round 1 Questions */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-xl font-bold mb-6">Round 1 Questions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.flatMap((game, gi) =>
            game.questions.map((q, qi) => (
              <article
                key={`${gi}-${qi}`}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-lg"
              >
                <header className="mb-3 text-sm font-semibold text-white/70">
                  {game.match} – Q{q.quarter}
                </header>

                <h3 className="text-lg font-bold mb-4">{q.question}</h3>

                <div className="flex gap-2 mb-4">
                  <button className="flex-1 rounded-xl bg-white/10 py-2 font-semibold hover:bg-white/15">
                    Yes
                  </button>
                  <button className="flex-1 rounded-xl bg-white/10 py-2 font-semibold hover:bg-white/15">
                    No
                  </button>
                </div>

                <div className="text-xs text-white/60 mb-4">
                  Stats unlock after you pick
                </div>

                <Link
                  href="/picks"
                  className="block w-full rounded-xl bg-orange-500 py-2 text-center font-semibold text-black hover:bg-orange-400"
                >
                  Make This Pick
                </Link>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
