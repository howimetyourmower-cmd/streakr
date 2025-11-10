// app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type Question = { quarter: number; question: string };
type Game = {
  match: string;
  startTime?: Timestamp | string;
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

function isFSTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
}
function toDateAny(v?: Timestamp | string): Date | null {
  if (!v) return null;
  if (isFSTimestamp(v)) return v.toDate();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function fmtWhen(d: Date | null) {
  if (!d) return "TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function HomePage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", "round-1");
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setRound({ games: [] });
          return;
        }
        setRound(snap.data() as RoundDoc);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load data.");
        setRound({ games: [] });
      }
    })();
  }, []);

  // Flatten to individual "open picks", filter to future startTime, limit to 6
  const openPicks = useMemo(() => {
    if (!round?.games?.length) return [];
    const now = new Date();
    const items: Array<{
      gameIdx: number;
      match: string;
      when: Date | null;
      venue?: string;
      q: Question;
    }> = [];
    round.games.forEach((g, gi) => {
      const when = toDateAny(g.startTime);
      g.questions?.forEach((q) => {
        items.push({ gameIdx: gi, match: g.match, when, venue: g.venue, q });
      });
    });
    return items
      .filter((it) => !it.when || it.when > now) // treat missing date as open
      .sort((a, b) => {
        const ad = a.when?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bd = b.when?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return ad - bd;
      })
      .slice(0, 6);
  }, [round]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-white">
      {/* HERO – full-bleed image */}
      <section className="relative w-full">
        <div className="relative w-full h-[38vh] min-h-[260px] md:h-[48vh] lg:h-[56vh]">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG under lights"
            priority
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent" />
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-8">
            <div className="mb-3 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              <span className="text-white">STREAK</span>
              <span className="text-orange-500">r</span>
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-500">
              Real Streakr&apos;s don&apos;t get caught.
            </p>

            <p className="mt-3 text-sm md:text-base text-zinc-300 max-w-xl">
              Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/auth"
                className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold"
              >
                Sign up / Log in
              </Link>
              <Link
                href="/picks"
                className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 hover:bg-zinc-900 px-4 py-2 text-sm text-zinc-200"
              >
                View Picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsor banner – kept below hero so the image is fully visible */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6 text-center text-zinc-300">
          Sponsor banner • 970×90
        </div>
      </section>

      {/* OPEN PICKS GRID */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 mb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-extrabold">Round 1 Open Picks</h2>
          <Link
            href="/picks"
            className="text-sm text-zinc-300 hover:text-white underline underline-offset-4"
          >
            See all
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {round === null ? (
          <div className="text-zinc-400">Loading…</div>
        ) : openPicks.length === 0 ? (
          <div className="text-zinc-400">No open selections right now. Check back soon.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {openPicks.map((it, i) => (
              <div
                key={`${it.gameIdx}-${i}`}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-5"
              >
                <div className="mb-1 text-orange-400 font-semibold tracking-wide uppercase">
                  {it.match}
                </div>
                <div className="mb-3 text-xs text-zinc-400">
                  {fmtWhen(it.when)}{it.venue ? ` • ${it.venue}` : ""}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] rounded-md bg-zinc-800 text-zinc-300">
                        Q{it.q.quarter}
                      </span>
                      <p className="text-zinc-100">{it.q.question}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="px-3 py-1.5 text-sm rounded-md bg-orange-500 hover:bg-orange-600 text-white">
                        Yes
                      </button>
                      <button className="px-3 py-1.5 text-sm rounded-md bg-violet-600 hover:bg-violet-700 text-white">
                        No
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[11px] text-zinc-400">Yes 0% • No 0%</div>
                    <Link
                      href="/picks"
                      className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                    >
                      See other picks →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
