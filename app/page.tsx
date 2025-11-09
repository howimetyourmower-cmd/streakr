"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
import { app } from "./config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;              // "Carlton v Brisbane"
  startTime?: any;            // Firestore Timestamp or ISO string
  venue?: string;             // "MCG, Melbourne"
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const db = getFirestore(app);
const CURRENT_ROUND_ID = "round-1"; // change this when the current round changes

// ---- helpers ---------------------------------------------------------------
function isFsTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number";
}

function formatStart(start: any): string {
  try {
    if (!start) return "TBD";
    if (isFsTimestamp(start)) {
      const d = start.toDate();
      return d.toLocaleString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // try parse ISO-like strings e.g. "2026-03-19T19:50:00+11:00"
    const d = new Date(start);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // fallback for human strings you might paste; just show as-is
    return String(start);
  } catch {
    return "TBD";
  }
}

export default function HomePage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  // fetch round once
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", CURRENT_ROUND_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRound(snap.data() as RoundDoc);
        } else {
          setRound({ games: [] });
        }
      } catch (e) {
        console.error("Failed to load round:", e);
        setRound({ games: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // pick 6 samples (first 3 questions from first 2 games, or just the first 6 available)
  const sixSamples = useMemo(() => {
    if (!round?.games?.length) return [];
    const flat: Array<{ game: Game; q: Question }> = [];
    for (const g of round.games) {
      for (const q of g.questions) flat.push({ game: g, q });
    }
    return flat.slice(0, 6);
  }, [round]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0f14] to-[#0a0d12] text-white">
      {/* HERO */}
      <section className="relative">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at twilight"
          width={1920}
          height={1080}
          priority
          className="w-full h-[56vh] object-cover"
        />
        {/* Overlay text */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight">
              <span className="text-white">Succeed.</span>{" "}
              <span className="text-orange-500">Survive.</span>{" "}
              <span className="text-white">STREAK.</span>
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the
              leaderboard, win prizes.
            </p>
            <div className="mt-6 flex gap-4">
              <Link
                href="/picks"
                className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 transition"
              >
                Make your first pick
              </Link>
              <Link
                href="/leaderboards"
                className="rounded-xl bg-white/15 px-5 py-3 font-semibold hover:bg-white/25 transition"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>

        {/* Sponsor banner — pushed lower so the hero stays fully visible */}
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mt-10" />
          <div className="mx-auto mt-10 rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center">
            <span className="text-white/70">Sponsor banner • 970×90</span>
          </div>
        </div>
      </section>

      {/* ROUND SAMPLES */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12">
        <h2 className="text-2xl font-extrabold mb-6">
          Round 1 Questions
        </h2>

        {loading && (
          <div className="text-white/70">Loading…</div>
        )}

        {!loading && sixSamples.length === 0 && (
          <div className="text-white/70">
            No questions found for Round 1.
          </div>
        )}

        {!loading && sixSamples.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sixSamples.map((item, idx) => {
              const g = item.game;
              const q = item.q;

              const when = formatStart(g.startTime); // "Thu, 19 Mar, 7:50 PM"
              const where = g.venue ? ` • ${g.venue}` : "";
              const subline = `${when}${where}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_2px_20px_rgba(0,0,0,0.25)]"
                >
                  {/* Teams in orange */}
                  <div className="text-orange-400 font-semibold tracking-wide uppercase">
                    {g.match}
                  </div>
                  <div className="mt-1 text-sm text-white/70">{subline}</div>

                  <div className="mt-4 flex items-start gap-3">
                    <span className="inline-flex select-none items-center justify-center rounded-md bg-white/10 px-2 py-1 text-xs font-bold">
                      Q{q.quarter}
                    </span>
                    <p className="text-base font-medium leading-6">
                      {q.question}
                    </p>
                  </div>

                  {/* Sample buttons are disabled on the home page (teaser only) */}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      aria-disabled
                      className="cursor-not-allowed rounded-md bg-green-600/80 px-3 py-2 text-sm font-semibold opacity-80"
                      title="Log in on the Picks page to play"
                    >
                      Yes
                    </button>
                    <button
                      aria-disabled
                      className="cursor-not-allowed rounded-md bg-red-600/80 px-3 py-2 text-sm font-semibold opacity-80"
                      title="Log in on the Picks page to play"
                    >
                      No
                    </button>
                    <Link
                      href="/picks"
                      className="ml-auto rounded-md bg-orange-500/80 px-3 py-2 text-sm font-semibold hover:bg-orange-500 transition"
                    >
                      Go to Picks
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* “How it works” / FAQ CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/faq"
            className="text-white/80 underline underline-offset-4 hover:text-white"
          >
            How it works & FAQ
          </Link>
        </div>
      </section>
    </main>
  );
}
