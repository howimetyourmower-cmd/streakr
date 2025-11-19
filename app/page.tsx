"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type PicksApiResponse = { games: ApiGame[] };

export default function HomePage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load latest open questions from /api/picks
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("Failed to load picks");

        const data: PicksApiResponse = await res.json();

        const flat: QuestionRow[] = data.games.flatMap((g) =>
          g.questions.map((q) => ({
            id: q.id,
            gameId: g.id,
            match: g.match,
            venue: g.venue,
            startTime: g.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
          }))
        );

        // Only open questions, sorted by start time
        const open = flat
          .filter((r) => r.status === "open")
          .sort((a, b) => {
            const da = new Date(a.startTime).getTime();
            const db = new Date(b.startTime).getTime();
            return da - db;
          });

        setQuestions(open);
      } catch (e) {
        console.error(e);
        setError("Failed to load latest questions.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const previewQuestions = questions.slice(0, 6);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* ---------- HERO SECTION ---------- */}
      <section className="relative w-full overflow-hidden">
        {/* Background image */}
        <div className="relative w-full h-[70vh] md:h-[80vh]">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG Stadium"
            fill
            priority
            className="object-cover"
          />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-transparent" />

        {/* Text content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          {/* Prize + meta pills */}
          <div className="mb-4 flex flex-wrap justify-center gap-3">
            <div className="rounded-full bg-black/70 border border-orange-400/70 px-4 py-1 text-sm md:text-base font-semibold text-orange-200 shadow-lg">
              Win a share of $1,000 in prizes every round*
            </div>
            <div className="rounded-full bg-white/10 border border-white/25 px-3 py-1 text-[11px] md:text-xs text-white/80 uppercase tracking-wide">
              Free to play • 18+ • No gambling
            </div>
          </div>

          <h1 className="text-white text-4xl md:text-6xl font-extrabold mb-4 leading-tight drop-shadow-lg">
            Real <span className="text-orange-500">Streakr</span>s don’t get
            caught.
          </h1>

          <p className="text-white/90 max-w-2xl text-lg md:text-xl mb-8 drop-shadow-md">
            Pick one AFL moment at a time, build your longest streak, and climb
            the ladder. Top streaks each round share $1,000 in prizes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="/picks"
              className="bg-orange-500 hover:bg-orange-600 text-black px-6 py-3 rounded-lg font-semibold text-lg shadow-lg transition"
            >
              Start Picking
            </a>

            <a
              href="/leaderboards"
              className="bg-white/90 hover:bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold text-lg shadow-lg transition border border-white/70"
            >
              View Leaderboard
            </a>
          </div>

          <p className="mt-3 text-[11px] md:text-xs text-white/70">
            *Promotional prize pool. Terms & eligibility apply.
          </p>
        </div>
      </section>

      {/* ---------- STATS STRIP ---------- */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm md:text-base">
          <div>
            <div className="text-slate-500 uppercase tracking-wide text-xs mb-1">
              Season
            </div>
            <div className="text-slate-900 font-semibold">2026</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase tracking-wide text-xs mb-1">
              Current Round
            </div>
            <div className="text-slate-900 font-semibold">Round 1</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase tracking-wide text-xs mb-1">
              Game Type
            </div>
            <div className="text-slate-900 font-semibold">
              Longest Active Streak Wins
            </div>
          </div>
        </div>
      </section>

      {/* ---------- LATEST QUESTIONS PREVIEW (3x2 GRID) ---------- */}
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-slate-900">
          Latest questions
        </h2>

        <p className="text-slate-600 mb-6">
          Here’s a quick look at the questions currently open. Jump into Picks
          to lock in your streak.
        </p>

        {loading && (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 bg-orange-100 animate-pulse h-28"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {!loading && !error && previewQuestions.length === 0 && (
          <p className="text-sm text-slate-600">
            No open questions right now. Check back soon or see previous rounds
            in Picks.
          </p>
        )}

        {!loading && !error && previewQuestions.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3">
            {previewQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl p-5 bg-white border border-orange-200 shadow-sm"
              >
                <h4 className="font-semibold mb-1 text-slate-900 truncate">
                  {q.match}
                </h4>
                <p className="text-xs text-slate-500 mb-2">
                  Q{q.quarter} • {q.venue}
                </p>
                <p className="text-slate-800 text-sm mb-4 line-clamp-3">
                  {q.question}
                </p>
                <a
                  href="/picks"
