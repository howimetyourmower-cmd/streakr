"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./config/firebaseClient"; // NOTE: no "src" in the path

// -------- Small, self-contained ad banner component ----------
function AdBanner({ slot }: { slot: "top" | "mid" }) {
  // If you add real creatives later, drop them in /public and swap the src.
  const height = slot === "top" ? 90 : 120;
  const label = slot === "top" ? "SPONSOR BANNER" : "SPONSOR – MID PAGE";
  return (
    <div
      className="w-full rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm
                 flex items-center justify-center text-xs tracking-widest uppercase"
      style={{ height }}
      aria-label={label}
    >
      {label}
    </div>
  );
}

// ----------------- Types -----------------
type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;           // e.g. "Carlton v Brisbane"
  venue?: string;          // e.g. "MCG"
  city?: string;           // e.g. "Melbourne, VIC"
  dateTime?: string;       // ISO or human string, e.g. "Thu Mar 20, 7:25 PM AEDT"
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

export default function HomePage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔁 Change this when rounds advance.
  const CURRENT_ROUND_DOC_ID = "round-1";

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "fixtures", CURRENT_ROUND_DOC_ID));
        if (snap.exists()) setRound(snap.data() as RoundDoc);
      } catch (e) {
        console.error("Failed to load fixtures:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Pull the first 6 questions across the games in round order
  const sixSamples: Array<{ game: Game; q: Question }> = [];
  if (round?.games) {
    for (const game of round.games) {
      for (const q of game.questions) {
        if (sixSamples.length < 6) sixSamples.push({ game, q });
      }
      if (sixSamples.length >= 6) break;
    }
  }

  return (
    <main className="min-h-screen text-white bg-[#0b0f13]">
      {/* HERO with MCG background */}
      <section
        className="w-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/mcg-hero.jpg')",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-28 pb-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold">
            <span>One pick. </span>
            <span className="text-orange-500">One streak. </span>
            <span>Win the round.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the
            leaderboard, win prizes.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-3 font-semibold"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 font-semibold"
            >
              Leaderboard
            </Link>
          </div>

          {/* Top sponsor banner */}
          <div className="mt-10">
            <AdBanner slot="top" />
          </div>
        </div>
      </section>

      {/* “How it works” – short, simple */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-bold mb-4">How it works</h2>
        <ol className="space-y-2 text-white/85">
          <li>1) Pick <span className="font-semibold">Yes</span> or <span className="font-semibold">No</span> on live quarter-questions.</li>
          <li>2) A correct pick extends your streak. A wrong pick resets to 0.</li>
          <li>3) Longest streak for the round wins the prize.</li>
        </ol>
      </section>

      {/* Round samples */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h3 className="text-xl font-semibold mb-4">
          {loading ? "Loading Round…" : "Round 1 Questions"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(sixSamples.length ? sixSamples : Array.from({ length: 6 })).map(
            (item, idx) => {
              const game = item?.game;
              const q = item?.q;

              // Team line in orange
              const teamLine =
                game?.match ?? "Match TBA";

              const whenWhere = (() => {
                if (!game) return "TBD";
                const bits = [
                  game.dateTime || "TBD",
                  game.venue,
                  game.city,
                ].filter(Boolean);
                return bits.join(" • ");
              })();

              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-lg"
                >
                  <div className="mb-2 text-sm text-orange-400 font-semibold uppercase tracking-wide">
                    {teamLine}
                  </div>
                  <div className="mb-4 text-xs text-white/70">{whenWhere}</div>

                  <div className="text-base md:text-[15px] font-semibold min-h-12">
                    {q ? q.question : "Sample Question"}
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <button className="rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-bold">
                      Yes
                    </button>
                    <button className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-bold">
                      No
                    </button>
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* Mid-page sponsor banner */}
        <div className="mt-10">
          <AdBanner slot="mid" />
        </div>
      </section>
    </main>
  );
}
