"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./config/firebaseClient";
import { getAuth, onAuthStateChanged } from "firebase/auth";

type Q = {
  quarter: number;
  question: string;
  // optional per-question fallbacks the DB might have
  startTime?: string;
  venue?: string;
};

type Game = {
  match: string; // "Carlton v Brisbane"
  startTime?: string; // preferred: at game level
  venue?: string;     // preferred: at game level
  questions: Q[];
};

type RoundDoc = {
  games: Game[];
};

const ROUNDS_COLLECTION = "rounds"; // <— if your doc lives at root, change fetchRound() below.

export default function HomePage() {
  const db = useMemo(() => getFirestore(app), []);
  const auth = useMemo(() => getAuth(app), []);
  const [games, setGames] = useState<Game[]>([]);
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    async function fetchRound() {
      // rounds/round-1 (preferred)
      const ref = doc(db, ROUNDS_COLLECTION, "round-1");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
        return;
      }
      // Fallback: a single top-level doc called "round-1"
      const fallbackRef = doc(db, "round-1");
      const fbSnap = await getDoc(fallbackRef);
      if (fbSnap.exists()) {
        const data = fbSnap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
      }
    }
    fetchRound();
  }, [db]);

  // Build six samples from Round 1 (first two games, Q1 & Q2) as you asked
  const sixSamples = games
    .flatMap((g) => g.questions.slice(0, 2).map((q) => ({ game: g, q })))
    .slice(0, 6);

  const isAuthed = !!user;

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white antialiased">
      {/* Header / Logo / Nav */}
      <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f13]/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/streaklogo.jpg"
              width={180}
              height={48}
              priority
              alt="STREAKr AFL"
              className="h-10 w-auto"
            />
            <span className="sr-only">STREAKr AFL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/picks" className="hover:text-orange-400">Picks</Link>
            <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
            <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
            <Link href="/faq" className="hover:text-orange-400">FAQ</Link>
          </nav>
        </div>
      </header>

      {/* Hero with MCG image */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG under lights"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f13]/40 to-[#0b0f13]"></div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-16 pb-24">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
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
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-400"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl bg-white/10 px-5 py-3 font-semibold hover:bg-white/20"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Spacer so full hero is visible before the banner */}
        <div className="h-16"></div>

        {/* Sponsor banner placeholder */}
        <div className="mx-auto max-w-6xl px-4 pb-10">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center">
            <span className="text-white/70">Sponsor banner • 970×90</span>
          </div>
        </div>
      </section>

      {/* Round 1 Samples (3×2) */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-6 text-2xl font-bold">Round 1 Questions</h2>

        <div className="grid gap-6 md:grid-cols-3">
          {sixSamples.map((item, idx) => {
            const g = item.game;
            const q = item.q;

            // Prefer game-level time/venue; fall back to question-level if needed
            const startTime = g.startTime || q.startTime || "TBD";
            const venue = g.venue || q.venue || "";
            const sub = [startTime !== "TBD" ? startTime : "TBD", venue].filter(Boolean).join(" • ");

            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-[#12161c] p-4 shadow-lg"
              >
                <div className="mb-2 text-sm font-semibold tracking-wide text-orange-400">
                  {g.match?.toUpperCase() || "MATCH"}
                </div>
                <div className="mb-3 text-xs uppercase tracking-wide text-white/60">{sub}</div>

                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold">
                    Q{q.quarter}
                  </span>
                  <span className="text-base font-semibold">{q.question}</span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {/* Auth gate: if not logged in, send to /auth */}
                  <button
                    className="rounded-xl bg-green-600 px-3 py-2 font-semibold hover:bg-green-500"
                    onClick={() => {
                      if (!isAuthed) {
                        window.location.href = "/auth";
                      } else {
                        window.location.href = "/picks";
                      }
                    }}
                  >
                    Yes
                  </button>
                  <button
                    className="rounded-xl bg-red-600 px-3 py-2 font-semibold hover:bg-red-500"
                    onClick={() => {
                      if (!isAuthed) {
                        window.location.href = "/auth";
                      } else {
                        window.location.href = "/picks";
                      }
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
