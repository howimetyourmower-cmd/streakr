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
        className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm transition hover:border-orange-500/40 hover:bg-slate-900/60"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-300">PLAY NOW</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">
              <span className="text-orange-400">AFL</span> STREAKr
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Quarter-by-quarter player & team stat picks. Survive each match.
            </p>
          </div>

          <span className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
            Live
          </span>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-orange-400">
          Enter AFL hub <span className="transition group-hover:translate-x-0.5">→</span>
        </div>
      </Link>

      <Link
        href="/play/bbl"
        className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm transition hover:border-orange-500/40 hover:bg-slate-900/60"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-300">PLAY NOW</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">
              <span className="text-orange-400">BBL</span> STREAKr
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Cricket Yes/No picks. Clean sweep per match.
            </p>
          </div>

          <span className="shrink-0 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
            Live
          </span>
        </div>

        <div className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-orange-400">
          Enter BBL hub <span className="transition group-hover:translate-x-0.5">→</span>
        </div>
      </Link>
    </div>

    {/* Coming soon */}
    <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="text-sm font-extrabold text-slate-200">
        Other sports coming soon
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {comingSoon.map((s) => (
          <span
            key={s}
            className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-300"
          >
            {s}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Same STREAKr rules. More ways to get caught.
      </p>
    </div>

    {/* Footer */}
    <footer className="mt-10 text-center text-xs text-slate-500">
      © {new Date().getFullYear()} STREAKr — Free-to-play.
    </footer>
  </div>
</main>
