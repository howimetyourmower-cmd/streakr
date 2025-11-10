"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
import { app } from "./config/firebaseClient";

type Question = { quarter: number; question: string };
type Game = {
  match: string;
  startTime?: any;   // Firestore Timestamp or ISO/human string
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const db = getFirestore(app);
const CURRENT_ROUND_ID = "round-1";

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
    return String(start);
  } catch {
    return "TBD";
  }
}

export default function HomePage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", CURRENT_ROUND_ID);
        const snap = await getDoc(ref);
        setRound(snap.exists() ? (snap.data() as RoundDoc) : { games: [] });
      } catch (e) {
        console.error("Failed to load round:", e);
        setRound({ games: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sixSamples = useMemo(() => {
    if (!round?.games?.length) return [];
    const flat: Array<{ game: Game; q: Question }> = [];
    for (const g of round.games) for (const q of g.questions) flat.push({ game: g, q });
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
          className="w-full h-[58vh] object-cover"
        />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight">
              <span className="text-white">One pick.</span>{" "}
              <span className="text-orange-500">One streak.</span>{" "}
              <span className="text-white">Win the round.</span>
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
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
      </section>

      {/* SPONSOR BANNER (moved down so full hero is visible) */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-10">
        <div className="mx-auto rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center">
          <span className="text-white/70">Sponsor banner • 970×90</span>
        </div>
      </section>

      {/* ROUND SAMPLES */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
        <h2 className="text-2xl font-extrabold mb-6">Round 1 Questions</h2>

        {loading && <div className="text-white/70">Loading…</div>}

        {!loading && sixSamples.length === 0 && (
          <div className="text-white/70">No questions found for Round 1.</div>
        )}

        {!loading && sixSamples.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sixSamples.map((item, idx) => {
              const g = item.game;
              const q = item.q;
              const when = formatStart(g.startTime);
              const where = g.venue ? ` • ${g.venue}` : "";
              const subline = `${when}${where}`;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_2px_20px_rgba(0,0,0,0.25)]"
                >
                  <div className="text-orange-400 font-semibold tracking-wide uppercase">
                    {g.match}
                  </div>
                  <div className="mt-1 text-sm text-white/70">{subline}</div>

                  <div className="mt-4 flex items-start gap-3">
                    <span className="inline-flex select-none items-center justify-center rounded-md bg-white/10 px-2 py-1 text-xs font-bold">
                      Q{q.quarter}
                    </span>
                    <p className="text-base font-medium leading-6">{q.question}</p>
                  </div>

                  {/* Demo buttons (disabled) */}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      aria-disabled
                      className="cursor-not-allowed rounded-md bg-orange-500/80 px-3 py-2 text-sm font-semibold opacity-90"
                      title="Log in on the Picks page to play"
                    >
                      Yes
                    </button>
                    <button
                      aria-disabled
                      className="cursor-not-allowed rounded-md bg-purple-600/80 px-3 py-2 text-sm font-semibold opacity-90"
                      title="Log in on the Picks page to play"
                    >
                      No
                    </button>
                    <Link
                      href="/picks"
                      className="ml-auto rounded-md bg-orange-500/80 px-3 py-2 text-sm font-semibold hover:bg-orange-500 transition"
                    >
                      See Other Picks
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
