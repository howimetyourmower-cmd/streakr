"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PicksPage() {
  const [questions, setQuestions] = useState<
    { id: number; match: string; question: string; yesPercent: number; noPercent: number }[]
  >([]);

  // Temporary sample data (we’ll swap to Firestore later)
  useEffect(() => {
    setQuestions([
      { id: 1, match: "Carlton vs Brisbane", question: "Will Charlie Curnow kick a goal in Q1?", yesPercent: 62, noPercent: 38 },
      { id: 2, match: "Essendon vs Collingwood", question: "Will Zach Merrett get 8+ disposals in Q2?", yesPercent: 71, noPercent: 29 },
      { id: 3, match: "Richmond vs Geelong", question: "Will Dustin Martin have 25+ disposals?", yesPercent: 54, noPercent: 46 },
    ]);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-zinc-200">STREAK</span>
            <span className="text-orange-500">r</span>
            <span className="ml-2 text-xs font-semibold text-orange-400">AFL</span>
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/picks" className="hover:text-orange-400">Picks</Link>
            <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
            <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
            <Link href="/faq" className="hover:text-orange-400">How to Play</Link>
          </nav>
        </div>
      </header>

      {/* Title */}
      <section className="text-center py-10 border-b border-zinc-800">
        <h1 className="text-4xl md:text-5xl font-extrabold">
          Today’s <span className="text-orange-500">Quarter Questions</span>
        </h1>
        <p className="mt-3 text-zinc-400">Make one pick at a time. Build your streak.</p>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-4 py-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-400">{q.match}</div>
            <h3 className="mt-2 text-lg font-semibold text-zinc-100">{q.question}</h3>

            <div className="mt-4 flex gap-3">
              <button className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 transition">Yes</button>
              <button className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition">No</button>
            </div>

            <div className="mt-4 text-xs text-zinc-500">Stats unlock after you pick</div>

            <div className="mt-4 flex justify-between text-[11px] text-zinc-500">
              <span>YES {q.yesPercent}%</span>
              <span>NO {q.noPercent}%</span>
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-800 text-center py-8 text-sm text-zinc-500">
        © {new Date().getFullYear()} STREAKr. Your Streak. Your Game. Your Glory.
      </footer>
    </main>
  );
}
