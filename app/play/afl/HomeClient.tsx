// /app/HomeClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

type PreviewRow = {
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

function formatStartDate(iso: string) {
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
}

function roundLabel(roundNumber: number | null) {
  if (roundNumber === null) return "—";
  if (roundNumber === 0) return "Opening Round";
  return `Round ${roundNumber}`;
}

export default function HomeClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const picksHref = "/picks?sport=AFL";
  const aflHubHref = "/play/afl";
  const encodedReturnTo = encodeURIComponent(picksHref);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingPreview(true);
        setPreviewError("");

        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();
        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);

        const flat: PreviewRow[] = data.games.flatMap((g) =>
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

        setPreview(flat);
      } catch (e) {
        console.error(e);
        setPreviewError("Failed to load preview questions.");
      } finally {
        setLoadingPreview(false);
      }
    };

    load();
  }, []);

  const next6 = useMemo(() => preview.slice(0, 6), [preview]);

  const requireAuthOr = (fn: () => void) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    fn();
  };

  const goToPicks = () => {
    requireAuthOr(() => router.push(picksHref));
  };

  const goToAflHub = () => {
    requireAuthOr(() => router.push(aflHubHref));
  };

  const goToPicksWithPreviewFocus = (questionId: string, intendedPick: "yes" | "no") => {
    requireAuthOr(() => {
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
    });
  };

  // Use for Links that should open auth modal if logged out
  const onClickAuthGate = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {/* ========= PAGE BG ========= */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,122,0,0.12),transparent_42%),radial-gradient(circle_at_75%_25%,rgba(56,189,248,0.06),transparent_45%),radial-gradient(circle_at_35%_85%,rgba(255,122,0,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-10">
        {/* TOP BAR */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-tight">
              STREAK<span className="text-[#FF7A00]">r</span>
            </span>

            <span className="hidden sm:inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[11px] text-white/70">
              AFL • {roundLabel(roundNumber)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/leaderboards"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:border-sky-400/60 hover:text-sky-200 px-4 py-2 text-xs sm:text-sm text-white/80 transition"
            >
              Leaderboards
            </Link>

            <Link
              href={picksHref}
              onClick={onClickAuthGate}
              className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-4 py-2 text-xs sm:text-sm shadow-[0_14px_40px_rgba(0,0,0,0.65)] transition"
            >
              Picks →
            </Link>
          </div>
        </div>

        {/* HERO */}
        <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-10 items-center mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/55 mb-2">AFL STREAKr</p>

            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              <span className="block">How Long Can You</span>
              <span className="block text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">Last?</span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-white/80 max-w-2xl">
              Think you know your AFL? Prove it or pipe down. Back your gut, ride the hot hand,
              and roast your mates when you&apos;re on a heater. One wrong call and your streak is cooked — back to zip.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-orange-200 shadow-[0_0_18px_rgba(255,122,0,0.25)]">
                Up to $1,000 in prizes every round*
              </span>
              <span className="text-[11px] text-white/55">Free to play • 18+ • No gambling • Just bragging rights</span>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={goToPicks}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)] transition"
              >
                Play now – make your next pick
              </button>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 hover:border-sky-400/70 hover:text-sky-200 px-6 py-3 text-sm sm:text-base text-white/80 transition"
              >
                Check who&apos;s talking big
              </Link>
            </div>

            <p className="mt-3 text-[11px] text-white/45">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only. Don&apos;t be a mug — play for fun.
            </p>
          </div>

          <div className="relative">
            <div className="relative w-full h-[280px] sm:h-[340px] rounded-3xl overflow-hidden border border-orange-500/25 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image src="/mcg-hero.jpg" alt="AFL night match" fill className="object-cover opacity-85" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/55 px-4 py-3">
                <p className="text-[11px] text-white/60 mb-1">Round</p>
                <p className="text-sm font-extrabold text-white">{roundLabel(roundNumber)}</p>
                <p className="text-[11px] text-white/55 mt-1">Quarter-by-quarter player-stat picks • Clean Sweep per match</p>
              </div>
            </div>
          </div>
        </section>

        {/* PLAY CARD (like your screenshot) */}
        <section className="mb-10">
          <div className="rounded-3xl border border-sky-500/25 bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.85)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#FF7A00]/10 border border-orange-400/40 flex items-center justify-center font-extrabold text-[#FF7A00]">
                  A
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Play now</p>
                  <p className="text-lg font-extrabold">AFL STREAKr</p>
                  <p className="text-sm text-white/70">Live quarter-by-quarter player-stat picks.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={goToAflHub}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 hover:border-orange-400/70 hover:text-orange-200 px-5 py-2 text-sm font-semibold text-white/80 transition"
                >
                  Enter
                </button>

                <button
                  type="button"
                  onClick={goToPicks}
                  className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-5 py-2 text-sm transition"
                >
                  Play →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS + NEXT 6 PICKS */}
        <section className="grid lg:grid-cols-2 gap-8">
          {/* HOW IT WORKS BOXES */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-[#020617] to-[#020617] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold">How it works</h2>
                <p className="text-[12px] text-white/70">Four steps. Quick. Brutal. Addictive.</p>
              </div>
              <Link
                href={picksHref}
                onClick={onClickAuthGate}
                className="text-[12px] text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
              >
                Go to Picks →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="group rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/50 hover:bg-white/[0.04] transition">
                <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">1) Pick Yes/No</p>
                <p className="text-sm text-white/80">
                  Live questions each quarter. Tap <span className="font-semibold">Yes</span> or{" "}
                  <span className="font-semibold">No</span>.
                </p>
              </div>

              <div className="group rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/50 hover:bg-white/[0.04] transition">
                <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">2) Any wrong = 0</p>
                <p className="text-sm text-white/80">
                  One wrong pick in a match and your streak is <span className="font-semibold">cooked</span>.
                </p>
              </div>

              <div className="group rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/50 hover:bg-white/[0.04] transition">
                <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">3) Clean sweep</p>
                <p className="text-sm text-white/80">
                  Sweep the match and you score for that game. Stack it up.
                </p>
              </div>

              <div className="group rounded-2xl border border-white/10 bg-[#020617] px-4 py-4 hover:border-orange-400/50 hover:bg-white/[0.04] transition">
                <p className="text-[11px] font-extrabold text-orange-300 mb-1 uppercase tracking-wide">4) Flex</p>
                <p className="text-sm text-white/80">Climb the leaderboard and roast your mates in the group chat.</p>
              </div>
            </div>
          </div>

          {/* NEXT 6 PICKS PREVIEW */}
          <div className="rounded-3xl border border-orange-500/20 bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold">Next 6 available picks</h2>
                <p className="text-[12px] text-white/70">Tap Yes/No to jump straight into Picks on that question.</p>
              </div>
              <Link
                href={picksHref}
                onClick={onClickAuthGate}
                className="text-[12px] text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
              >
                View all →
              </Link>
            </div>

            {previewError ? <p className="text-sm text-red-400 mb-3">{previewError}</p> : null}

            {loadingPreview ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 animate-pulse">
                    <div className="h-3 w-3/4 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                    <div className="flex gap-2">
                      <div className="h-8 w-20 bg-white/10 rounded-full" />
                      <div className="h-8 w-20 bg-white/10 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : next6.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
                <p className="text-sm font-semibold text-white">No open questions right now.</p>
                <p className="mt-1 text-sm text-white/60">
                  Likely between games/quarters. Hit Picks anyway — you’ll see what’s coming up.
                </p>
                <button
                  type="button"
                  onClick={goToPicks}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-5 py-2 text-sm transition"
                >
                  Go to Picks →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {next6.map((q) => {
                  const { date, time } = formatStartDate(q.startTime);
                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 hover:border-orange-400/30 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1">
                            <span className="inline-flex items-center rounded-full bg-orange-500/10 border border-orange-400/40 px-2 py-0.5 font-extrabold text-orange-200">
                              Q{q.quarter}
                            </span>
                            <span className="truncate">
                              {date} • {time} AEDT
                            </span>
                          </div>
                          <div className="text-sm font-semibold leading-snug">{q.question}</div>
                          <div className="text-[11px] text-white/55 mt-1 truncate">
                            {q.match} • {q.venue}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                            className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-green-600 hover:bg-green-700 text-white transition"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                            className="px-4 py-1.5 rounded-full text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white transition"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 pt-6 text-[11px] sm:text-xs text-white/50">
          <p>
            STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.
          </p>
        </footer>
      </div>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
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
