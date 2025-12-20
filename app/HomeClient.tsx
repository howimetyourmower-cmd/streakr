"use client";

import Link from "next/link";

export default function HomeClient() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8">
      {/* Badge */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
          STREAKr
        </span>
      </div>

      {/* Hero */}
      <section className="mb-10">
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          How long can you last?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          Free-to-play, real-time <span className="text-[#FF7A00]">Yes / No</span>{" "}
          picks. Clean sweep per match — get one wrong, back to zero.
        </p>
      </section>

      {/* Main cards */}
      <section className="grid gap-5 md:grid-cols-2">
        {/* AFL */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold tracking-widest text-white/50">
              PLAY NOW
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
              Live
            </span>
          </div>

          <div className="text-2xl font-extrabold text-[#FF7A00]">AFL STREAKr</div>
          <p className="mt-2 text-sm text-white/70">
            Quarter-by-quarter player &amp; team stat picks.
          </p>

          <Link
            href="/afl"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#FF7A00] hover:opacity-90"
          >
            Enter AFL hub →
          </Link>
        </div>

        {/* BBL */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold tracking-widest text-white/50">
              PLAY NOW
            </div>
          </div>

          <div className="text-2xl font-extrabold text-[#FF7A00]">BBL STREAKr</div>
          <p className="mt-2 text-sm text-white/70">
            Cricket Yes/No picks. Clean sweep per match.
          </p>

          <Link
            href="/bbl"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#FF7A00] hover:opacity-90"
          >
            Enter BBL hub →
          </Link>
        </div>
      </section>

      {/* Coming soon */}
      <section className="mt-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/70">
            Other sports coming soon
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Tennis", "NBA", "NRL", "Olympics", "Multi-sport"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
