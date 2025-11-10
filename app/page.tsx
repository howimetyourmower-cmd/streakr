"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from import { auth, db } from "@/lib/firebaseClient";
;

type Question = { quarter: number; question: string };
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

const CURRENT_ROUND_ID = "round-1";

function isFSTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}
function toDateMaybe(v: any): Date | null {
  try {
    if (!v) return null;
    if (isFSTimestamp(v)) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
function formatStart(g: Game): { line: string; isFuture: boolean } {
  const d = toDateMaybe(g.startTime);
  if (d) {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    };
    const line =
      `${d.toLocaleDateString(undefined, opts)} · ` +
      (g.tz ? `${g.tz} · ` : "") +
      (g.venue ?? "TBD");
    return { line, isFuture: d.getTime() > Date.now() };
  }
  if (g.date || g.time || g.tz || g.venue) {
    const parts = [g.date?.trim(), g.time?.trim(), g.tz?.trim(), g.venue?.trim()].filter(Boolean);
    return { line: parts.join(" · ") || "TBD", isFuture: true };
  }
  return { line: "TBD", isFuture: true };
}

export default function HomePage() {
  const db = useMemo(() => getFirestore(app), []);
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", CURRENT_ROUND_ID);
        const snap = await getDoc(ref);
        if (!snap.exists()) return setGames([]);
        const data = snap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
        setGames([]);
      }
    })();
  }, [db]);

  const openSix = useMemo(() => {
    if (!games) return [];
    const withMeta = games.map((g) => {
      const { isFuture, line } = formatStart(g);
      return { ...g, __startLine: line, __isOpen: isFuture };
    });
    const open = withMeta.filter((g) => (g as any).__isOpen);
    open.sort((a, b) => {
      const ta = toDateMaybe(a.startTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const tb = toDateMaybe(b.startTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    return open.slice(0, 6);
  }, [games]);

  return (
    <main className="min-h-screen w-full text-white">
      {/* HERO FULL WIDTH */}
      <section className="relative w-full h-[70vh] md:h-[80vh]">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG twilight hero"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center text-center px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05]">
            <span className="text-white">Real Streakr’s </span>
            <span className="text-orange-500">don’t get caught.</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-white/80 max-w-2xl">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/picks"
              className="rounded-2xl px-5 py-3 bg-orange-500/90 hover:bg-orange-500 transition font-semibold"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboards"
              className="rounded-2xl px-5 py-3 bg-white/15 hover:bg-white/25 transition font-semibold"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* SPONSOR BANNER */}
      <div className="container mx-auto px-4 mt-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-6 text-center">
          <div className="text-white/70">Sponsor banner • 970×90</div>
        </div>
      </div>

      {/* OPEN PICKS */}
      <section className="container mx-auto px-4 mt-10 mb-16">
        <h2 className="text-2xl md:text-3xl font-bold">Round 1 Open Picks</h2>
        {error && <p className="mt-3 text-red-300 text-sm">{error}</p>}
        {!games && <p className="mt-6 text-white/70">Loading…</p>}
        {games && openSix.length === 0 && (
          <p className="mt-6 text-white/70">No open picks right now. Check back soon.</p>
        )}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {openSix.map((game, gi) => {
            const startLine = (game as any).__startLine as string;
            const firstQ = game.questions?.[0];
            const qLabel = firstQ ? `Q${firstQ.quarter}` : "Q1";
            const qText = firstQ?.question ?? "Selection available";

            return (
              <div
                key={`${game.match}-${gi}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-xs tracking-widest font-semibold text-orange-400">
                  {game.match?.toUpperCase() || "TBD"}
                </div>
                <div className="mt-1 text-white/70 text-sm">{startLine}</div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <span className="rounded-md bg-white/15 px-2 py-1">{qLabel}</span>
                    <span className="rounded-md bg-green-600/25 px-2 py-1">OPEN</span>
                  </div>

                  <p className="mt-3 text-base md:text-lg">{qText}</p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <button className="rounded-lg px-4 py-2 font-semibold bg-orange-500 hover:bg-orange-600 transition">
                        Yes
                      </button>
                      <button className="rounded-lg px-4 py-2 font-semibold bg-purple-600 hover:bg-purple-700 transition">
                        No
                      </button>
                    </div>
                    <Link
                      href="/picks"
                      className="rounded-lg px-4 py-2 font-semibold bg-white/10 hover:bg-white/20 transition"
                    >
                      See other picks
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
