// /app/HomeClient.tsx
"use client";

import Link from "next/link";

export default function HomeClient() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Top label */}
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
          <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
          STREAKr — Multi-Sport
        </span>
      </div>

      {/* Hero */}
      <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
        How long can you last?
      </h1>

      <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
        Free-to-play, real-time <span className="font-semibold text-[#FF7A00]">Yes</span>{" "}
        / <span className="font-semibold text-[#FF7A00]">No</span> picks. Clean sweep per
        match — get one wrong, back to zero.
      </p>

      {/* Cards */}
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* AFL Card - whole card clickable */}
        <Link
          href="/play/afl"
          className="group block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/60"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Play now
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
              Live
            </span>
          </div>

          <div className="text-xl font-extrabold text-[#FF7A00]">AFL STREAKr</div>
          <div className="mt-2 text-sm text-white/70">
            Quarter-by-quarter player &amp; team stat picks.
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#FF7A00]">
            Enter AFL hub <span className="transition group-hover:translate-x-0.5">→</span>
          </div>
        </Link>

        {/* BBL Card - whole card clickable */}
        <Link
          href="/play/bbl"
          className="group block rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/60"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Play now
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
              Live
            </span>
          </div>

          <div className="text-xl font-extrabold text-[#FF7A00]">BBL STREAKr</div>
          <div className="mt-2 text-sm text-white/70">
            Cricket Yes/No picks. Clean sweep per match.
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#FF7A00]">
            Enter BBL hub <span className="transition group-hover:translate-x-0.5">→</span>
          </div>
        </Link>
      </div>

      {/* Coming soon */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold text-white/80">Other sports coming soon</div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["Tennis", "NBA", "NRL", "Olympics", "Multi-sport"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
