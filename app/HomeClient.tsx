// /app/HomeClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  match: string;
  venue: string;
  startTime: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

export default function HomeClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [loadingRound, setLoadingRound] = useState(true);

  const [showAuthModal, setShowAuthModal] = useState(false);

  const [showPreloader, setShowPreloader] = useState(true);
  const [isPreloaderFading, setIsPreloaderFading] = useState(false);

  // Preloader (same vibe as AFL hub)
  useEffect(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";

    const fadeTimer = window.setTimeout(() => setIsPreloaderFading(true), 2600);
    const hideTimer = window.setTimeout(() => {
      setShowPreloader(false);
      if (typeof document !== "undefined") document.body.style.overflow = "";
    }, 3200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, []);

  // Load AFL round number for the badge row
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");
        const data: PicksApiResponse = await res.json();
        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);
      } catch (e) {
        // keep silent on homepage
        console.error(e);
      } finally {
        setLoadingRound(false);
      }
    };
    load();
  }, []);

  const onEnterAfl = () => {
    // AFL hub (your existing AFL page)
    router.push("/play/afl");
  };

  const onPlayNow = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push("/picks?sport=AFL");
  };

  const returnTo = useMemo(() => encodeURIComponent("/picks?sport=AFL"), []);

  return (
    <main className="min-h-screen bg-black text-white relative">
      {showPreloader && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-700 ${
            isPreloaderFading ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="relative w-full h-full overflow-hidden bg-black">
            <video
              src="/preloadervideo.mp4"
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-4">
              <p className="text-xs sm:text-sm text-white/70 tracking-[0.25em] uppercase mb-1">
                Welcome to
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold text-[#FF7A00] drop-shadow-[0_0_24px_rgba(255,122,0,0.9)]">
                STREAKr
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-white/60">How Long Can You Last?</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        {/* Hero */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-12">
          <div>
            {/* Badge row – AFL only */}
            <div className="mb-5">
              <div className="w-full overflow-hidden">
                <div className="flex items-center gap-2 w-full flex-nowrap">
                  <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                    YOU’RE IN AFL
                  </span>

                  <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                    AFL SEASON 2026
                  </span>

                  <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                    ROUND {loadingRound ? "—" : roundNumber ?? "—"}
                  </span>

                  <span className="min-w-0 flex-1 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                    FREE TO PLAY. AUSSIE AS.
                  </span>
                </div>
              </div>

              <p className="mt-2 text-[12px] text-white/65">
                Quarter-by-quarter player-stat picks. One wrong call and your streak is cooked.
              </p>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Footy. Banter. Bragging rights.
              </span>

              <span className="block text-[#FF7A00] text-3xl sm:text-4xl lg:text-5xl tracking-wide drop-shadow-[0_0_18px_rgba(255,122,0,0.75)] mb-1">
                AFL STREAKr
              </span>

              <span className="text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.7)]">
                How Long Can You Last?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your AFL? Prove it or pipe down. Back your gut, ride the hot hand,
              and roast your mates when you&apos;re on a heater. One wrong call and your streak is
              cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.5)]">
                <span className="text-sm font-semibold text-orange-200">
                  Up to $1,000 in prizes every round*
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <button
                type="button"
                onClick={onPlayNow}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-semibold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
              >
                Play now – make your next pick
              </button>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85"
              >
                Check who&apos;s talking big
              </Link>
            </div>

            <p className="text-[11px] text-white/50">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only.
              Don&apos;t be a mug — play for fun.
            </p>

            {/* AFL-only “entry card” row (desktop) */}
            <div className="mt-8 hidden md:block">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] shadow-[0_20px_80px_rgba(0,0,0,0.9)] p-5">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-400/40 flex items-center justify-center">
                      <span className="text-[#FF7A00] text-2xl font-extrabold">A</span>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/60 uppercase tracking-[0.2em]">
                        Play now
                      </p>
                      <p className="text-xl font-extrabold text-white">
                        AFL STREAKr
                      </p>
                      <p className="text-sm text-white/70">
                        Live quarter-by-quarter player-stat picks.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={onEnterAfl}
                      className="rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-300 px-5 py-2 text-sm font-semibold text-white/90 transition"
                    >
                      Enter
                    </button>
                    <button
                      type="button"
                      onClick={onPlayNow}
                      className="rounded-full bg-[#FF7A00] hover:bg-orange-500 px-5 py-2 text-sm font-bold text-black transition shadow-[0_0_26px_rgba(255,122,0,0.55)]"
                    >
                      Play →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile picker (AFL only) */}
            <div className="mt-8 md:hidden">
              <div className="rounded-3xl border border-white/10 bg-[#020617] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.85)]">
                <p className="text-xs text-white/60 uppercase tracking-[0.25em] mb-3">
                  Choose your game
                </p>

                <button
                  type="button"
                  onClick={onEnterAfl}
                  className="w-full rounded-2xl border border-orange-400/40 bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] p-4 text-left shadow-[0_14px_50px_rgba(0,0,0,0.9)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-400/40 flex items-center justify-center">
                      <span className="text-[#FF7A00] text-2xl font-extrabold">A</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-white leading-tight">
                        AFL STREAKr
                      </p>
                      <p className="text-sm text-white/70">
                        Quarter-by-quarter player stat picks
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className="inline-flex items-center rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1">
                        Enter
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={onPlayNow}
                  className="mt-3 w-full rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-semibold py-3 transition"
                >
                  Play now – make your next pick
                </button>

                <p className="mt-3 text-[11px] text-white/50">
                  Free to play • 18+ • No gambling • Just bragging rights
                </p>
              </div>
            </div>
          </div>

          {/* Right hero image */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[380px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image
                src="/mcg-hero.jpg"
                alt="AFL under lights"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
                  Live AFL player-stat picks
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] text-white/60 mb-1">
                    Group chats. Pub banter. Office comps.
                  </p>
                  <p className="text-sm font-semibold text-white">
                    One streak. Battle your mates. Endless sledging.
                  </p>
                </div>
                <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)] whitespace-nowrap">
                  Make your next pick.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-6 mt-10 text-sm text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.
            </p>
            <Link
              href="/faq"
              className="text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
            >
              FAQ
            </Link>
          </div>
        </footer>
      </div>

      {/* Auth modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">Log in to play</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-white/70 mb-4">
              You need a free STREAKr account to make picks, build your streak and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${returnTo}`}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${returnTo}`}
                className="flex-1 inline-flex items-center justify-center rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-400 text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
