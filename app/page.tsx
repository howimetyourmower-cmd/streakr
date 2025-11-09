"use client";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* HERO IMAGE */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG Stadium at night"
          fill
          priority
          className="object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      </div>

      {/* HERO CONTENT */}
      <section className="flex flex-col items-center justify-center text-center py-36 px-4">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4">
          <span className="text-orange-500">One pick.</span>{" "}
          <span className="text-zinc-100">One streak.</span>{" "}
          <span className="text-orange-400">Win the round.</span>
        </h1>
        <p className="text-lg text-zinc-300 mb-8 max-w-xl">
          Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/picks"
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-semibold shadow-md transition"
          >
            Make your first pick
          </Link>
          <Link
            href="/leaderboard"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-8 py-3 rounded-xl font-semibold border border-zinc-700 transition"
          >
            Leaderboard
          </Link>
        </div>
      </section>

      {/* STREAK CARDS PLACEHOLDER */}
      <section className="max-w-6xl mx-auto py-20 px-4 grid md:grid-cols-3 gap-8">
        {[1, 2, 3].map((round) => (
          <div
            key={round}
            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center shadow-lg"
          >
            <h3 className="text-orange-400 font-bold mb-2">ROUND {round}</h3>
            <p className="text-zinc-300 mb-4">Sample Question</p>
            <div className="flex justify-center gap-4">
              <button className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-medium">
                Yes
              </button>
              <button className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm font-medium">
                No
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
