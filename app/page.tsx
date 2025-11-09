import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="text-center py-14 md:py-20 border-b border-zinc-800 bg-[url('/mcg-hero.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="backdrop-brightness-75 py-10">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            One pick. <span className="text-orange-500">One streak.</span> Win the round.
          </h1>
          <p className="mt-3 text-zinc-300">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold hover:bg-orange-500 transition"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold hover:bg-zinc-900 transition"
            >
              Leaderboards
            </Link>
          </div>
        </div>
      </section>

      {/* keep your sample round cards or remove if not needed */}
      <section className="mx-auto max-w-6xl px-4 py-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* placeholder tiles kept from your current home – safe to delete later */}
        {[1,2,3].map((i)=>(
          <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-400">ROUND {i}</div>
            <h3 className="mt-2 text-lg font-semibold text-zinc-100">Sample Question</h3>
            <div className="mt-4 flex gap-3">
              <button className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300">Yes</button>
              <button className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300">No</button>
            </div>
            <div className="mt-4 text-xs text-zinc-500">Stats unlock after you pick</div>
          </div>
        ))}
      </section>
    </main>
  );
}
