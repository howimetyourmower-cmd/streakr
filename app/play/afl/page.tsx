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

  // Only lock scroll while preloader is visible
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

  const goToPicksWithPreviewFocus = (
    questionId: string,
    intendedPick: "yes" | "no"
  ) => {
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
    <main className="min-h-screen relative bg-bg-primary text-text-primary">
      {/* ========= PRELOADER ========= */}
      {showPreloader && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-bg-void transition-opacity duration-700 ${
            isPreloaderFading ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="relative w-full h-full overflow-hidden bg-bg-void">
            <video
              src="/preloadervideo.mp4"
              autoPlay
              muted
              playsInline
              onEnded={hidePreloaderNow}
              onError={hidePreloaderNow}
              className="absolute inset-0 w-full h-full object-contain bg-bg-void"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-4">
              <p className="text-xs sm:text-sm text-text-secondary tracking-[0.25em] uppercase mb-1">
                Welcome to
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold text-brand drop-shadow-[0_0_24px_rgba(255,61,0,0.9)]">
                STREAKr
              </p>
              <p className="mt-1 text-[11px] sm:text-xs text-text-tertiary">
                How Long Can You Last?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========= PAGE BG ========= */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(0,229,255,0.10),transparent_42%),radial-gradient(circle_at_78%_22%,rgba(245,0,87,0.06),transparent_46%),radial-gradient(circle_at_45%_86%,rgba(255,61,0,0.08),transparent_48%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-primary/90 to-bg-void" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-text-secondary hover:text-white">
            ← Back to sports
          </Link>
        </div>

        {/* ========= AFL BANNER ========= */}
        <div className="mb-8 rounded-3xl border border-border-subtle bg-bg-elevated px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.85)] hover:border-brand-600/60 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-2xl border border-brand-600/50 bg-bg-card shadow-orange flex items-center justify-center">
                <svg viewBox="0 0 120 80" className="h-10 w-10 text-brand" fill="none">
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
                  <span className="inline-flex items-center justify-center rounded-full bg-brand text-black px-3 py-1 text-[11px] font-black tracking-wide uppercase shadow-orange">
                    YOU&apos;RE IN AFL
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-bg-card border border-border-default px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-text-secondary">
                    AFL SEASON 2026
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-bg-card border border-border-default px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-text-secondary">
                    ROUND {roundNumber ?? "—"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-text-secondary">
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
              <span className="block text-sm sm:text-base font-semibold text-text-tertiary mb-2">
                Footy. Banter. Bragging rights.
              </span>
              <span className="text-brand drop-shadow-[0_0_20px_rgba(255,61,0,0.8)]">
                AFL STREAKr
              </span>
              <span className="block text-white mt-2">How Long Can You Last?</span>
            </h1>

            <p className="text-base sm:text-lg text-text-secondary max-w-xl mb-6">
              Think you know your AFL? Prove it or pipe down. Back your gut, ride the hot hand, and roast your mates
              when you&apos;re on a heater. One wrong call and your streak is cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-bg-elevated border border-brand-600/50 shadow-orange">
                <span className="text-sm font-semibold text-text-primary">
                  Up to $1,000 in prizes every round*
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-text-tertiary">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="btn btn-primary h-auto py-3 px-6 rounded-full text-sm sm:text-base shadow-orange hover:shadow-pink"
              >
                Make your first pick
              </Link>

              <Link
                href="/leaderboards"
                className="btn btn-secondary h-auto py-3 px-6 rounded-full text-sm sm:text-base"
              >
                Check leaderboards
              </Link>
            </div>

            <p className="text-[11px] text-text-tertiary">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only. Don&apos;t be a mug —
              play for fun.
            </p>
          </div>

          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-border-subtle bg-bg-elevated shadow-[0_28px_80px_rgba(0,0,0,0.85)] hover:border-brand-600/60 transition-colors">
              <Image
                src="/mcg-hero.jpg"
                alt="Night footy at the G"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/75 border border-brand-600/50 px-4 py-2 text-xs font-black text-text-primary shadow-orange">
                  <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  AFL MODE
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-border-default px-3 py-1 text-[11px] font-semibold text-text-secondary">
                  Live AFL player-stat picks
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] text-text-tertiary mb-1">
                    Group chats. Pub banter. Office comps.
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    One streak. Battle your mates. Endless sledging.
                  </p>
                </div>
                <div className="rounded-full bg-brand text-black text-xs font-bold px-3 py-1 shadow-orange whitespace-nowrap">
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
              How to play <span className="text-brand drop-shadow-[0_0_14px_rgba(255,61,0,0.55)]">STREAKr</span>
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto">
              Three simple steps. Fast picks. Big sweat. One wrong call and you&apos;re cooked.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-6">
            <div className="relative rounded-3xl border border-border-subtle bg-bg-elevated p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-brand-600/60 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-brand flex items-center justify-center text-black font-black text-lg shadow-orange">
                1
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-text-primary group-hover:text-neon-cyan transition-colors">
                  Pick Yes / No
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  Live AFL player-stat questions drop each quarter. Back your read.
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-success/15 border border-success/40 px-3 py-1 text-xs font-black text-success">
                    YES
                  </span>
                  <span className="text-text-tertiary">or</span>
                  <span className="inline-flex items-center rounded-full bg-error/15 border border-error/40 px-3 py-1 text-xs font-black text-error">
                    NO
                  </span>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border border-border-subtle bg-bg-elevated p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-brand-600/60 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-brand flex items-center justify-center text-black font-black text-lg shadow-orange">
                2
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-text-primary group-hover:text-neon-cyan transition-colors">
                  Clean sweep per match
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  To carry your streak forward, you need a{" "}
                  <span className="font-semibold text-brand">clean sweep</span> in that match. Any wrong pick resets
                  you to <span className="font-black text-error">0</span>.
                </p>
                <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2">
                  <p className="text-xs font-semibold text-error">⚠️ One wrong = back to zero</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border border-border-subtle bg-bg-elevated p-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-brand-600/60 transition-all group">
              <div className="absolute top-4 left-4 h-10 w-10 rounded-full bg-brand flex items-center justify-center text-black font-black text-lg shadow-orange">
                3
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-text-primary group-hover:text-neon-cyan transition-colors">
                  Climb the leaderboard
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">
                  Longest streak wins the round. Beat your mates, win prizes, talk big.
                </p>
                <span className="inline-flex items-center rounded-full bg-info/12 border border-info/35 px-3 py-1 text-xs font-black text-info">
                  🏆 Up to $1,000 prizes
                </span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href={picksHref}
              onClick={onClickGoToPicks}
              className="btn btn-primary h-auto py-4 px-8 rounded-full text-base shadow-orange hover:shadow-pink"
            >
              I get it – let me play →
            </Link>
          </div>
        </section>

        {/* ========= NEXT 6 PICKS PREVIEW ========= */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              Next <span className="text-brand">6</span> available picks
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto">
              Tap <span className="font-semibold text-success">Yes</span> or{" "}
              <span className="font-semibold text-error">No</span> to jump straight into Picks.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl bg-error/10 border border-error/30 px-5 py-4 mb-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl bg-bg-elevated border border-border-subtle px-5 py-4 animate-pulse"
                >
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && previewQuestions.length === 0 && !error ? (
            <div className="rounded-2xl bg-bg-elevated border border-border-subtle px-6 py-8 text-center">
              <p className="text-sm text-text-secondary mb-4">
                No open questions right now. Check back closer to bounce.
              </p>
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="btn btn-primary h-auto py-3 px-6 rounded-full text-sm shadow-orange hover:shadow-pink"
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
                  className="relative rounded-2xl bg-bg-elevated border border-border-subtle shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-5 py-4 hover:border-brand-600/60 transition-all group"
                >
                  <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-brand border-2 border-black flex items-center justify-center text-black font-black text-sm shadow-orange">
                    {idx + 1}
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary mb-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand-600/40 px-2 py-0.5 font-black text-brand">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                          AFL Q{q.quarter}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-text-secondary">
                          {date} • {time} AEDT
                        </span>
                        <span>•</span>
                        <span className="text-text-secondary">{q.venue}</span>
                      </div>

                      <div className="text-xs sm:text-sm font-black text-text-primary mb-2">
                        {q.match}
                      </div>

                      <div className="text-sm sm:text-base font-semibold text-text-primary group-hover:text-neon-cyan transition-colors">
                        {q.question}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 lg:ml-6 shrink-0">
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                        className="btn btn-sm bg-success text-black border border-success/40 shadow-green hover:shadow-green hover:scale-[1.03]"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                        className="btn btn-sm bg-error text-black border border-error/40 shadow-red hover:shadow-red hover:scale-[1.03]"
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
                className="btn btn-secondary h-auto py-4 px-8 rounded-full text-base"
              >
                View all {questions.length} open picks →
              </Link>
            </div>
          ) : null}
        </section>

        {/* ========= SOCIAL PROOF / STATS ========= */}
        <section className="mb-16 rounded-3xl border border-border-subtle bg-bg-elevated px-6 py-8 shadow-[0_20px_70px_rgba(0,0,0,0.9)] hover:border-neon-cyan/40 transition-colors">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-neon-cyan mb-1 drop-shadow-[0_0_14px_rgba(0,229,255,0.35)]">
                Live
              </div>
              <p className="text-sm text-text-secondary">
                Real-time picks during every AFL match
              </p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-brand mb-1 drop-shadow-[0_0_14px_rgba(255,61,0,0.35)]">
                $1,000
              </div>
              <p className="text-sm text-text-secondary">In prizes every round*</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-success mb-1 drop-shadow-[0_0_14px_rgba(118,255,3,0.25)]">
                Free
              </div>
              <p className="text-sm text-text-secondary">
                No gambling. Just skill &amp; bragging rights
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-border-subtle pt-6 mt-4 text-sm text-text-secondary">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-text-tertiary">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play
              responsibly.
            </p>
            <Link href="/faq" className="text-brand hover:text-orange-400 underline-offset-2 hover:underline">
              FAQ
            </Link>
          </div>
        </footer>
      </div>

      {/* ========= AUTH MODAL ========= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-bg-elevated border border-border-subtle p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Log in to play AFL
              </h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-text-tertiary hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-text-secondary mb-4">
              You need a free STREAKr account to make picks, build your streak and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="btn btn-primary flex-1 h-auto py-2.5 rounded-full text-sm shadow-orange hover:shadow-pink"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                className="btn btn-secondary flex-1 h-auto py-2.5 rounded-full text-sm"
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
