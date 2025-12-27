// /app/play/afl/page.tsx
"use client";

import { useEffect, useState, MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any; // API may send "Open"/"Final" etc
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
  status: QuestionStatus;
};

type PreviewFocusPayload = {
  sport: "AFL";
  questionId: string;
  intendedPick: "yes" | "no";
  createdAt: number;
};

const PREVIEW_FOCUS_KEY = "streakr_preview_focus_v1";

function normaliseStatus(val: any): QuestionStatus {
  const s = String(val ?? "").toLowerCase().trim();
  if (s === "open") return "open";
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  // If the API ever sends something unexpected, safest default:
  return "open";
}

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

  // ✅ FIX 1: Only lock scroll while preloader is visible, always restore safely.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const prevOverflow = document.body.style.overflow;

    if (showPreloader) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }

    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [showPreloader]);

  // Preloader timing (fallback)
  useEffect(() => {
    if (!showPreloader) return;

    const fadeTimer = window.setTimeout(() => {
      setIsPreloaderFading(true);
    }, 2000);

    const hideTimer = window.setTimeout(() => {
      setShowPreloader(false);
    }, 2700);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [showPreloader]);

  const hidePreloaderNow = () => {
    setIsPreloaderFading(true);
    window.setTimeout(() => setShowPreloader(false), 550);
  };

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
        setError("");
        setLoading(true);

        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }

        // ✅ FIX 2: Normalise status so "Open" becomes "open"
        const flat: QuestionRow[] = (data.games || []).flatMap((g) =>
          (g.questions || []).map((q) => {
            const status = normaliseStatus(q.status);
            return {
              id: q.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
              quarter: q.quarter,
              question: q.question,
              status,
            };
          })
        );

        const openOnly = flat.filter((q) => q.status === "open");

        openOnly.sort((a, b) => {
          const da = new Date(a.startTime).getTime();
          const db = new Date(b.startTime).getTime();
          if (da !== db) return da - db;
          return a.quarter - b.quarter;
        });

        setQuestions(openOnly);
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

  const onClickGoToPicks = (e: MouseEvent) => {
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
              onEnded={hidePreloaderNow}
              onError={hidePreloaderNow}
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-4">
              <p className="text-xs sm:text-sm text-white/70 tracking-[0.25em] uppercase mb-1">Welcome to</p>
              <p className="text-3xl sm:text-4xl font-extrabold text-[#FF7A00] drop-shadow-[0_0_24px_rgba(255,122,0,0.9)]">
                STREAKr
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-white/60">How Long Can You Last?</p>
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

        {/* ========= AFL BANNER ========= */}
        <div className="mb-8 rounded-3xl border border-orange-500/35 bg-gradient-to-r from-orange-500/18 via-[#020617] to-[#020617] px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-2xl border border-orange-400/40 bg-orange-500/10 shadow-[0_0_44px_rgba(255,122,0,0.25)] flex items-center justify-center">
                <svg viewBox="0 0 120 80" className="h-10 w-10 text-[#FF7A00]" fill="none">
                  <ellipse cx="60" cy="40" rx="46" ry="30" stroke="currentColor" strokeWidth="6" />
                  <path d="M40 27c8 6 32 6 40 0M40 53c8-6 32-6 40 0" stroke="currentColor" strokeWidth="4" />
                  <path d="M60 18v44" stroke="currentColor" strokeWidth="4" opacity="0.6" />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] text-black px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase shadow-[0_0_24px_rgba(255,122,0,0.75)]">
                    YOU&apos;RE IN AFL
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    AFL SEASON 2026
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    ROUND {roundNumber ?? "—"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/70">
                  Quarter-by-quarter player-stat picks. One wrong call and your streak is cooked.
                </p>
              </div>
            </div>
 </div>
 </div>
        {/* ========= MAIN HERO ========= */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-16">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Footy. Banter. Bragging rights.
              </span>
              <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">AFL STREAKr</span>
              <span className="block text-white mt-2">How Long Can You Last?</span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your AFL? Prove it or pipe down. Back your gut, ride the hot hand, and roast your mates
              when you&apos;re on a heater. One wrong call and your streak is cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.5)]">
                <span className="text-sm font-semibold text-orange-200">Up to $1,000 in prizes every round*</span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)] transition-all"
              >
                Make your first pick
              </Link>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85 transition-all"
              >
                Check leaderboards
              </Link>
            </div>

            <p className="text-[11px] text-white/50">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only. Don&apos;t be a mug —
              play for fun.
            </p>
          </div>

          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image src="/mcg-hero.jpg" alt="Night footy at the G" fill className="object-cover opacity-85" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/75 border border-orange-400/50 px-4 py-2 text-xs font-extrabold text-orange-200 shadow-[0_0_28px_rgba(255,122,0,0.45)]">
                  <span className="h-2 w-2 rounded-full bg-[#FF7A00] animate-pulse" />
                  AFL MODE
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
                  Live AFL player-stat picks
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] text-white/60 mb-1">Group chats. Pub banter. Office comps.</p>
                  <p className="text-sm font-semibold text-white">One streak. Battle your mates. Endless sledging.</p>
                </div>
                <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)] whitespace-nowrap">
                  Start playing now
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========= HOW TO PLAY ========= */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              How to play <span className="text-[#FF7A00]">STREAKr</span>
            </h2>
            <p className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto">
              Three simple steps. Fast picks. Big sweat. One wrong call and you&apos;re cooked.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-6">
            <div className="relative rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-[#020617] to-[#020617] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-orange-400/50 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-black font-extrabold text-lg shadow-[0_0_24px_rgba(255,122,0,0.6)]">
                1
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:text-orange-300 transition-colors">
                  Pick Yes / No
                </h3>
                <p className="text-sm text-white/75 leading-relaxed mb-4">
                  Live AFL player-stat questions drop each quarter. Back your read.
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-green-600/20 border border-green-500/40 px-3 py-1 text-xs font-bold text-green-300">
                    YES
                  </span>
                  <span className="text-white/40">or</span>
                  <span className="inline-flex items-center rounded-full bg-red-600/20 border border-red-500/40 px-3 py-1 text-xs font-bold text-red-300">
                    NO
                  </span>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-[#020617] to-[#020617] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-orange-400/50 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-black font-extrabold text-lg shadow-[0_0_24px_rgba(255,122,0,0.6)]">
                2
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:text-orange-300 transition-colors">
                  Clean sweep per match
                </h3>
                <p className="text-sm text-white/75 leading-relaxed mb-4">
                  To carry your streak forward, you need a{" "}
                  <span className="font-semibold text-orange-300">clean sweep</span> in that match. Any wrong pick resets
                  you to <span className="font-extrabold text-red-400">0</span>.
                </p>
                <div className="rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2">
                  <p className="text-xs font-semibold text-red-300">⚠️ One wrong = back to zero</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-[#020617] to-[#020617] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-orange-400/50 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-black font-extrabold text-lg shadow-[0_0_24px_rgba(255,122,0,0.6)]">
                3
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:text-orange-300 transition-colors">
                  Climb the leaderboard
                </h3>
                <p className="text-sm text-white/75 leading-relaxed mb-4">
                  Longest streak wins the round. Beat your mates, win prizes, talk big.
                </p>
                <span className="inline-flex items-center rounded-full bg-sky-500/20 border border-sky-400/40 px-3 py-1 text-xs font-bold text-sky-300">
                  🏆 Up to $1,000 prizes
                </span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href={picksHref}
              onClick={onClickGoToPicks}
              className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-8 py-4 text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)] transition-all"
            >
              I get it – let me play →
            </Link>
          </div>
        </section>

        {/* ========= NEXT 6 PICKS PREVIEW ========= */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              Next <span className="text-[#FF7A00]">6</span> available picks
            </h2>
            <p className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto">
              Tap <span className="font-semibold text-green-400">Yes</span> or{" "}
              <span className="font-semibold text-red-400">No</span> to jump straight into Picks.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl bg-red-500/10 border border-red-400/30 px-5 py-4 mb-6">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-white/10 px-5 py-4 animate-pulse"
                >
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && previewQuestions.length === 0 && !error ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-8 text-center">
              <p className="text-sm text-white/60 mb-4">
                No open questions right now. Check back closer to bounce.
              </p>
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm shadow-[0_14px_40px_rgba(0,0,0,0.65)] transition-all"
              >
                Go to picks page anyway
              </Link>
            </div>
          ) : null}

          <div className="space-y-4">
            {previewQuestions.map((q, idx) => {
              const { date, time } = formatStartDate(q.startTime);
              return (
                <div
                  key={q.id}
                  className="relative rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-5 py-4 hover:border-orange-400/50 transition-all group"
                >
                  <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-[#FF7A00] border-2 border-black flex items-center justify-center text-black font-extrabold text-sm shadow-[0_0_20px_rgba(255,122,0,0.7)]">
                    {idx + 1}
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-400/40 px-2 py-0.5 font-bold text-orange-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
                          AFL Q{q.quarter}
                        </span>
                        <span>•</span>
                        <span className="font-semibold">
                          {date} • {time} AEDT
                        </span>
                        <span>•</span>
                        <span>{q.venue}</span>
                      </div>

                      <div className="text-xs sm:text-sm font-bold text-white/90 mb-2">{q.match}</div>

                      <div className="text-sm sm:text-base font-semibold text-white group-hover:text-orange-300 transition-colors">
                        {q.question}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 lg:ml-6 shrink-0">
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                        className="px-6 py-2.5 rounded-full text-sm font-extrabold bg-green-600 hover:bg-green-700 text-white transition-all shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_32px_rgba(34,197,94,0.4)] hover:scale-105"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                        className="px-6 py-2.5 rounded-full text-sm font-extrabold bg-red-600 hover:bg-red-700 text-white transition-all shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_32px_rgba(239,68,68,0.4)] hover:scale-105"
                      >
                        No
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {questions.length > 0 ? (
            <div className="mt-8 text-center">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full border-2 border-orange-400/70 bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 hover:text-orange-100 font-bold px-8 py-4 text-base transition-all"
              >
                View all {questions.length} open picks →
              </Link>
            </div>
          ) : null}
        </section>

        {/* ========= SOCIAL PROOF / STATS ========= */}
        <section className="mb-16 rounded-3xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-[#020617] to-[#020617] px-6 py-8 shadow-[0_20px_70px_rgba(0,0,0,0.9)]">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-sky-300 mb-1">Live</div>
              <p className="text-sm text-white/70">Real-time picks during every AFL match</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-orange-400 mb-1">$1,000</div>
              <p className="text-sm text-white/70">In prizes every round*</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-green-400 mb-1">Free</div>
              <p className="text-sm text-white/70">No gambling. Just skill &amp; bragging rights</p>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play
              responsibly.
            </p>
            <Link href="/faq" className="text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline">
              FAQ
            </Link>
          </div>
        </footer>
      </div>

      {/* ========= AUTH MODAL ========= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">Log in to play AFL</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
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
