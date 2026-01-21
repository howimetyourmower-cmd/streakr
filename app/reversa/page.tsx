// /app/reversa/page.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReversaHomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl border border-white/15 bg-white/5" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">REVERSA</div>
              <div className="text-xs text-white/60">AFL anti-tipping</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/reversa/picks"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Picks
            </Link>
            <Link
              href="/reversa/ladder"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Ladder
            </Link>
            <Link
              href="/reversa/profile"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Profile
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-64 left-10 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-64 right-10 h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-8 pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            <span>Picking wrong is the point.</span>
          </div>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
            <span className="block">REVERSA.</span>
            <span className="mt-2 block text-white/80">
              THE GAME THAT REWARDS{" "}
              <span className="text-white underline decoration-white/20 underline-offset-8">
                BEING WRONG
              </span>
              .
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            Tip every AFL match all season. The fewer correct tips you get, the higher you climb.
            Perfect tipping loses. Think opposite.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/reversa/picks"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              START TIPPING
            </Link>
            <Link
              href="/reversa/ladder"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              VIEW LADDER
            </Link>
          </div>

          {/* Quick rules strip */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Objective</div>
              <div className="mt-1 text-sm font-semibold">Finish with the LOWEST correct tips</div>
              <div className="mt-2 text-xs text-white/60">
                Correct = bad. Incorrect = good.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Lock rule</div>
              <div className="mt-1 text-sm font-semibold">Locks at first bounce</div>
              <div className="mt-2 text-xs text-white/60">
                No changes after lock.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Anti-AFK</div>
              <div className="mt-1 text-sm font-semibold">No pick = counted incorrect</div>
              <div className="mt-2 text-xs text-white/60">
                Skipping matches doesn’t help.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">How it works</h2>
          <div className="text-xs text-white/60">“The crowd is usually wrong.”</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black text-sm font-bold">
              1
            </div>
            <div className="mt-3 text-sm font-semibold">Tip every match</div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Choose Team A or Team B for each AFL match. One pick per match.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black text-sm font-bold">
              2
            </div>
            <div className="mt-3 text-sm font-semibold">Get it wrong (on purpose)</div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Incorrect tips keep your “correct” count low — that’s how you win.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black text-sm font-bold">
              3
            </div>
            <div className="mt-3 text-sm font-semibold">Climb the ladder</div>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Ladder ranks by fewest correct tips. Ties break by lowest winning margin across
              correct tips, then earliest signup.
            </p>
          </div>
        </div>
      </section>

      {/* Prize */}
      <section className="mx-auto max-w-5xl px-4 pb-2">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-black p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Season Prize</div>
              <h3 className="mt-2 text-xl font-bold sm:text-2xl">
                AFL Grand Final trip package (sponsor-backed)
              </h3>
              <ul className="mt-3 space-y-1 text-sm text-white/70">
                <li>• AFL Grand Final tickets (x2)</li>
                <li>• Flights to Melbourne (x2)</li>
                <li>• 3 nights accommodation</li>
                <li>• Airport transfers</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <div className="text-xs text-white/60">Test mode (2026)</div>
              <div className="mt-1 text-sm font-semibold">Soft launch for 50–100 players</div>
              <div className="mt-2 text-xs leading-relaxed text-white/60">
                Validate behaviour, confusion points, and engagement before major prizes.
              </div>
              <Link
                href="/reversa/picks"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
              >
                START TIPPING
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Premium */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Free vs Premium</h2>
          <div className="text-xs text-white/60">Advantage through information, not rule changes.</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">FREE</div>
              <div className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs text-white/60">
                Essentials
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/50" />
                Must tip every match
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/50" />
                See teams + start time
              </li>
              <li className="flex gap-2 text-white/50">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/20" />
                No public pick %
              </li>
              <li className="flex gap-2 text-white/50">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/20" />
                No head-to-head / ladder / trap indicators
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-black p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">PREMIUM</div>
              <div className="rounded-full border border-white/15 bg-black px-3 py-1 text-xs text-white/70">
                Info edge
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400/80" />
                Live public pick %
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400/80" />
                Last 5 head-to-head results
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400/80" />
                Ladder positions
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400/80" />
                “Trap Alert” when a favourite is heavily tipped
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/80" />
                Season insurance: 1 missed tip becomes random team instead of incorrect
              </li>
            </ul>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black p-4">
              <div className="text-xs text-white/60">Language</div>
              <div className="mt-1 text-sm font-semibold">“Perfect tipping loses.”</div>
              <div className="mt-1 text-xs text-white/60">“Think opposite.”</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/50">© {new Date().getFullYear()} REVERSA</div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Dark mode default
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Picking wrong is the point
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
