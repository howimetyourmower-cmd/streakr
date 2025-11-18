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
    <main className="min-h-screen bg-[#020617] text-white">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-transparent" />

        {/* Text content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-white text-4xl md:text-6xl font-extrabold mb-4 leading-tight drop-shadow-lg">
            Real <span className="text-orange-500">Streakr</span>’s don’t get
            caught.
          </h1>

          <p className="text-white/90 max-w-2xl text-lg md:text-xl mb-8 drop-shadow-md">
            Free-to-play AFL prediction streaks. Build your streak, top the
            leaderboard, win prizes.
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
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-white px-6 py-3 rounded-lg font-semibold text-lg shadow-lg transition border border-white/10"
            >
              View Leaderboard
            </a>
          </div>
        </div>
      </section>

      {/* ---------- STATS STRIP ---------- */}
      <section className="border-t border-slate-800 bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm md:text-base">
          <div>
            <div className="text-slate-400 uppercase tracking-wide text-xs mb-1">
              Season
            </div>
            <div className="text-white font-semibold">2026</div>
          </div>
          <div>
            <div className="text-slate-400 uppercase tracking-wide text-xs mb-1">
              Current Round
            </div>
            <div className="text-white font-semibold">Round 1</div>
          </div>
          <div>
            <div className="text-slate-400 uppercase tracking-wide text-xs mb-1">
              Game Type
            </div>
            <div className="text-white font-semibold">
              Longest Active Streak Wins
            </div>
          </div>
        </div>
      </section>

      {/* ---------- LATEST QUESTIONS PREVIEW (3x2 GRID) ---------- */}
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">
          Latest questions
        </h2>

        <p className="text-slate-300 mb-6">
          Here’s a quick look at the questions currently open. Jump into Picks
          to lock in your streak.
        </p>

        {loading && (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 bg-orange-500/40 animate-pulse h-28"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && previewQuestions.length === 0 && (
          <p className="text-sm text-slate-300">
            No open questions right now. Check back soon or see previous
            rounds in Picks.
          </p>
        )}

        {!loading && !error && previewQuestions.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3">
            {previewQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl p-5 bg-gradient-to-br from-orange-600 via-orange-500 to-orange-500 shadow-lg"
              >
                <h4 className="font-semibold mb-1 text-white truncate">
                  {q.match}
                </h4>
                <p className="text-xs text-white/80 mb-2">
                  Q{q.quarter} • {q.venue}
                </p>
                <p className="text-white/90 text-sm mb-4 line-clamp-3">
                  {q.question}
                </p>
                <a
                  href="/picks"
                  className="text-sm font-semibold underline underline-offset-2 decoration-white/70 hover:decoration-white"
                >
                  Make your pick →
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="max-w-6xl mx-auto px-4 pb-10 md:pb-14">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">
          How Streakr works
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="text-orange-500 font-bold mb-2">1. Make a pick</div>
            <p className="text-slate-300 text-sm">
              Each question is a simple Yes / No prediction on a real AFL
              moment. Pick your side and lock it in before bounce.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="text-orange-500 font-bold mb-2">
              2. Build your streak
            </div>
            <p className="text-slate-300 text-sm">
              Every correct pick adds one to your streak. One wrong pick and
              your streak resets back to zero.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="text-orange-500 font-bold mb-2">
              3. Climb the ladder
            </div>
            <p className="text-slate-300 text-sm">
              Longest active streaks sit on top of the leaderboard. End the
              round with the best streak to share the prize pool.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- CTA STRIP ---------- */}
      <section className="border-t border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-bold mb-1">
              Ready to start your streak?
            </h3>
            <p className="text-slate-300 text-sm md:text-base">
              Lock in your first pick now and watch your streak climb towards
              the top of the ladder.
            </p>
          </div>

          <a
            href="/picks"
            className="bg-orange-500 hover:bg-orange-600 text-black px-6 py-3 rounded-lg font-semibold text-lg shadow-lg transition"
          >
            Go to Picks
          </a>
        </div>
      </section>

      {/* ---------- SOCIAL FOOTER ---------- */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-slate-400">
            Follow <span className="font-semibold text-white">Streakr</span> for
            updates, prizes and highlight reels.
          </p>

          <div className="flex items-center gap-4">
            {/* Facebook */}
            <a
              href="#"
              aria-label="Streakr on Facebook"
              className="group"
            >
              <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <span className="text-white text-xl font-bold">f</span>
              </div>
            </a>

            {/* Instagram */}
            <a
              href="#"
              aria-label="Streakr on Instagram"
              className="group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <span className="text-white text-lg font-bold">IG</span>
              </div>
            </a>

            {/* TikTok */}
            <a
              href="#"
              aria-label="Streakr on TikTok"
              className="group"
            >
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-105 transition-transform">
                <span className="text-white text-lg font-bold">♬</span>
              </div>
            </a>

            {/* YouTube */}
            <a
              href="#"
              aria-label="Streakr on YouTube"
              className="group"
            >
              <div className="w-12 h-8 rounded-lg bg-[#FF0000] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <div className="w-0 h-0 border-t-[7px] border-b-[7px] border-l-[12px] border-t-transparent border-b-transparent border-l-white ml-1" />
              </div>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
