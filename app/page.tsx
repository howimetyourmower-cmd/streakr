// app/page.tsx
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative">
      {/* Hero background */}
      <div className="relative h-[70vh] w-full overflow-hidden">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at night"
          fill
          priority
          className="object-cover"
        />
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-[#0b0f13]" />

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-4 text-center">
          <h1 className="text-4xl font-extrabold sm:text-6xl">
            <span className="text-white">One pick. </span>
            <span className="text-orange-400">One streak. </span>
            <span className="text-white">Win the round.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/picks"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold transition hover:bg-orange-400"
            >
              Make your first pick
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold backdrop-blur transition hover:bg-white/20"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Optional: space below hero for future content */}
      <section className="mx-auto max-w-6xl px-4 py-10" />
    </main>
  );
}
