"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top nav */}
      <header className="w-full">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-zinc-200">STREAK</span>
            <span className="text-orange-500">r</span>
            <span className="ml-2 text-xs font-semibold text-orange-400">AFL</span>
          </Link>

          <nav className="flex gap-6 text-sm">
            <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
            <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
            <Link href="/faq" className="hover:text-orange-400">How to Play</Link>
            <Link href="/diag-admin" className="hidden hover:text-orange-400">Check Backend</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            <span className="text-zinc-100">One pick.</span>{" "}
            <span className="text-orange-500">One streak.</span>{" "}
            <span className="text-zinc-100">Win the round.</span>
          </h1>
          <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-600 px-5 py-3 font-semibold hover:bg-orange-500 transition"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold hover:border-zinc-500 transition"
            >
              Leaderboards
            </Link>
          </div>
        </div>
      </section>

      {/* Round preview cards (static placeholders for the homepage visual) */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-xs uppercase tracking-wide text-zinc-400">Round {i + 1}</div>
              <h3 className="mt-2 text-lg font-semibold text-zinc-100">Sample Question</h3>

              <div className="mt-4 flex gap-3">
                <button
                  disabled
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
                >
                  Yes
                </button>
                <button
                  disabled
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
                >
                  No
                </button>
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                Stats unlock after you pick
              </div>

              <div className="mt-4">
                <Link
                  href="/picks"
                  className="inline-flex rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 transition"
                >
                  Make This Pick
                </Link>
              </div>

              <div className="mt-3 text-[11px] text-zinc-500">
                Discuss (12) &nbsp; | &nbsp; YES 62% &nbsp; | &nbsp; NO 38%
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-500">
          © {new Date().getFullYear()} STREAKr. Your Streak. Your Game. Your Glory.
        </div>
      </footer>
    </main>
  );
}
