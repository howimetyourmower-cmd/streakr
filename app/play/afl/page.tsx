// /app/play/afl/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

type QuestionRow = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
};

type PreviewFocusPayload = {
  sport: "AFL";
  questionId: string;
  intendedPick: "yes" | "no";
  createdAt: number;
};

const PREVIEW_FOCUS_KEY = "streakr_preview_focus_v1";

export default function AflHubPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [showPreloader, setShowPreloader] = useState(true);
  const [isPreloaderFading, setIsPreloaderFading] = useState(false);

  const picksHref = "/picks?sport=AFL";
  const encodedReturnTo = encodeURIComponent(picksHref);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }

    const fadeTimer = window.setTimeout(() => {
      setIsPreloaderFading(true);
    }, 3500);

    const hideTimer = window.setTimeout(() => {
      setShowPreloader(false);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    }, 4200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, []);

  const formatStartDate = (iso: string) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };

    return {
      date: d.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: "Australia/Melbourne",
      }),
      time: d.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Australia/Melbourne",
      }),
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }

        const flat: QuestionRow[] = data.games.flatMap((g) =>
          g.questions
            .filter((q) => q.status === "open")
            .map((q) => ({
              id: q.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
              quarter: q.quarter,
              question: q.question,
            }))
        );

        flat.sort((a, b) => {
          const da = new Date(a.startTime).getTime();
          const db = new Date(b.startTime).getTime();
          if (da !== db) return da - db;
          return a.quarter - b.quarter;
        });

        setQuestions(flat);
      } catch (e) {
        console.error(e);
        setError("Failed to load preview questions.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const previewQuestions = questions.slice(0, 6);

  const goToPicksWithPreviewFocus = (questionId: string, intendedPick: "yes" | "no") => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const payload: PreviewFocusPayload = {
        sport: "AFL",
        questionId,
        intendedPick,
        createdAt: Date.now(),
      };
      window.localStorage.setItem(PREVIEW_FOCUS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }

    router.push(picksHref);
  };

  // ✅ Use this for any Link → Picks so it routes through auth modal
  const onClickGoToPicks = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {/* ========= PRELOADER ========= */}
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
              <p className="mt-1 text-[11px] sm:text-xs text-white/60">
                How Long Can You Last?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========= PAGE BG ========= */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,122,0,0.12),transparent_42%),radial-gradient(circle_at_75%_25%,rgba(56,189,248,0.06),transparent_45%),radial-gradient(circle_at_35%_85%,rgba(255,122,0,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        {/* ========= SUPER CLEAR AFL BANNER ========= */}
        <div className="mb-8 rounded-3xl border border-orange-500/35 bg-gradient-to-r from-orange-500/18 via-[#020617] to-[#020617] px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* AFL Icon */}
              <div className="relative h-14 w-14 rounded-2xl border border-orange-400/40 bg-orange-500/10 shadow-[0_0_44px_rgba(255,122,0,0.25)] flex items-center justify-center">
                <svg
                  viewBox="0 0 120 80"
                  className="h-10 w-10 text-[#FF7A00]"
                  fill="none"
                >
                  <ellipse
                    cx="60"
                    cy="40"
                    rx="46"
                    ry="30"
                    stroke="currentColor"
                    strokeWidth="6"
                  />
                  <path
                    d="M40 27c8 6 32 6 40 0M40 53c8-6 32-6 40 0"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    d="M60 18v44"
                    stroke="currentColor"
                    strokeWidth="4"
                    opacity="0.6"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] text-black px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase shadow-[0_0_24px_rgba(255,122,0,0.75)]">
                    YOU’RE IN AFL
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    AFL SEASON 2026
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    ROUND {roundNumber ?? "—"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/70">
                  Quarter-by-quarter player-stat picks. One wrong call and your
                  streak is cooked.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
              >
                Play AFL now →
              </Link>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 hover:border-orange-400 hover:text-orange-200 px-6 py-3 text-sm text-white/80"
              >
                Switch sport
              </Link>
            </div>
          </div>
        </div>

        {/* ========= MAIN HERO ========= */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-12">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Footy. Banter. Bragging rights.
              </span>
              <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
                AFL STREAKr
              </span>
              <span className="block text-white mt-2">
                How Long Can You Last?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your AFL? Prove it or pipe down. Back your gut,
              ride the hot hand, and roast your mates when you&apos;re on a
              heater. One wrong call and your streak is cooked — back to zip.
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

            <div className="flex flex-col sm:flex-row gap-4 mb-3">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
              >
                Play now – make your next pick
              </Link>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85"
              >
                Check who&apos;s talking big
              </Link>
            </div>

            <p className="text-[11px] text-white/50 mb-5">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No
              gambling. 18+ only. Don&apos;t be a mug — play for fun.
            </p>

            {/* ✅ HOW TO PLAY BOXES (DIRECTLY UNDER HERO CTA) */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-[#020617] to-[#020617] p-4 sm:p-5 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold">How to play</h2>
                  <p className="text-[12px] text-white/70">
                    3 steps. Fast picks. Big sweat.
                  </p>
                </div>
                <Link
                  href={picksHref}
                  onClick={onClickGoToPicks}
                  className="text-[12px] text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
                >
                  Go to Picks →
                </Link>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/40 transition">
                  <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">
                    1) Pick Yes / No
                  </p>
                  <p className="text-sm text-white/80">
                    Live AFL player-stat questions pop up each quarter. Back your read.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/40 transition">
                  <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">
                    2) Clean sweep per match
                  </p>
                  <p className="text-sm text-white/80">
                    Any wrong pick in a match = streak resets to <span className="font-semibold">0</span>.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/40 transition">
                  <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">
                    3) Flex on the ladder
                  </p>
                  <p className="text-sm text-white/80">
                    Beat your mates, climb leaderboards, win prizes, talk big.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image
                src="/mcg-hero.jpg"
                alt="Night footy at the G"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/75 border border-orange-400/50 px-4 py-2 text-xs font-extrabold text-orange-200 shadow-[0_0_28px_rgba(255,122,0,0.45)]">
                  <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
                  AFL MODE
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
                  Live AFL player-stat picks
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/60 mb-1">
                    Group chats. Pub banter. Office comps.
                  </p>
                  <p className="text-sm font-semibold text-white">
                    One streak. Battle your mates. Endless sledging.
                  </p>
                </div>
                <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)]">
                  Make your next pick.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========= NEXT 6 PICKS PREVIEW ========= */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Next 6 available picks</h2>
              <p className="text-sm text-white/70">
                New player? Tap <span className="font-semibold">Yes</span> or <span className="font-semibold">No</span> to see exactly how it works.
              </p>
            </div>

            <Link
              href={picksHref}
              onClick={onClickGoToPicks}
              className="text-sm text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
            >
              Make your next pick →
            </Link>
          </div>

          {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}
          {loading ? <p className="text-sm text-white/70">Loading questions…</p> : null}

          {!loading && previewQuestions.length === 0 && !error ? (
            <p className="text-sm text-white/60">
              No open questions right now. Schedule&apos;s probably between games — check back closer to bounce.
            </p>
          ) : null}

          <div className="space-y-3">
            {previewQuestions.map((q) => {
              const { date, time } = formatStartDate(q.startTime);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-4 py-3 sm:px-5 sm:py-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                        <span className="font-semibold text-orange-200">AFL Q{q.quarter}</span>
                        <span>•</span>
                        <span>
                          {date} • {time} AEDT
                        </span>
                        <span>•</span>
                        <span>{q.match}</span>
                        <span>•</span>
                        <span>{q.venue}</span>
                      </div>
                      <div className="text-sm sm:text-base font-semibold">{q.question}</div>
                    </div>

                    <div className="flex items-center gap-3 md:ml-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                        className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                        className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition"
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
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

      {/* ========= AUTH MODAL ========= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">Log in to play AFL</h2>
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
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
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
