  // /app/page.tsx

import Link from "next/link";

const comingSoon = ["Tennis", "NBA", "NRL", "Olympics", "Multi-sport"];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-10">
        {/* Top badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          STREAKr — Multi-Sport
        </div>

        {/* Hero */}
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
          How long can you last?
        </h1>

        <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          Free-to-play, real-time{" "}
          <span className="font-extrabold text-orange-400">Yes / No</span> picks.
          Clean sweep per match — get one wrong, back to zero.
        </p>

        {/* Sport cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/play/afl"
            className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-orange-500/40 hover:bg-slate-900/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-300">PLAY NOW</div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight">
                  <span className="text-orange-400">AFL</span> STREAKr
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Quarter-by-quarter player & team stat picks.
                </p>
              </div>

              <span className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
                Live
              </span>
            </div>

            <div className="mt-6 text-sm font-extrabold text-orange-400">
              Enter AFL hub →
            </div>
          </Link>

          <Link
            href="/play/bbl"
            className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-orange-500/40 hover:bg-slate-900/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-300">PLAY NOW</div>
                <div className="mt-2 text-2xl font-extrabold tracking-tight">
                  <span className="text-orange-400">BBL</span> STREAKr
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Cricket Yes/No picks. Clean sweep per match.
                </p>
              </div>

              <span className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
                Live
              </span>
            </div>

            <div className="mt-6 text-sm font-extrabold text-orange-400">
              Enter BBL hub →
            </div>
          </Link>
        </div>

        {/* Coming soon */}
        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="text-sm font-extrabold text-slate-200">
            Other sports coming soon
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {comingSoon.map((sport) => (
              <span
                key={sport}
                className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-300"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} STREAKr
        </footer>
      </div>
    </main>
  );
}
