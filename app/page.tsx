import Image from "next/image";

export default function HomePage() {
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
              href="/leaderboard"
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

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
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
    </main>
  );
}
