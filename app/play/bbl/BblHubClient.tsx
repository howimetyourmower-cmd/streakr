// /app/play/bbl/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type MatchRow = {
  id: string; // firestore docId
  match: string;
  venue?: string;
  startTime?: string;
  gameNumber?: number | null;
};

export default function BblHubPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [isPreloaderFading, setIsPreloaderFading] = useState(false);

  const [upcoming, setUpcoming] = useState<MatchRow[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingError, setUpcomingError] = useState("");

  const [matchCode, setMatchCode] = useState("");

  // If you ever pass ?docId=... to prefill
  const docIdFromUrl = (params.get("docId") || "").trim();

  const effectiveDocId = useMemo(() => {
    return (docIdFromUrl || matchCode || "").trim();
  }, [docIdFromUrl, matchCode]);

  const picksHref = useMemo(() => {
    if (!effectiveDocId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(effectiveDocId)}`;
  }, [effectiveDocId]);

  useEffect(() => {
    // Preloader (same behavior as AFL)
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

  const formatStartDate = (iso?: string) => {
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

  // Load upcoming matches (your API should return docId + match + startTime + venue + gameNumber)
  useEffect(() => {
    const loadUpcoming = async () => {
      try {
        setLoadingUpcoming(true);
        setUpcomingError("");

        // ✅ You likely already have this endpoint working now
        // Expected shape: { matches: Array<{ id, match, venue, startTime, gameNumber }> }
        const res = await fetch("/api/bbl/upcoming", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data = (await res.json()) as { matches?: MatchRow[] };
        const list = Array.isArray(data.matches) ? data.matches : [];

        // Sort by startTime asc
        list.sort((a, b) => {
          const da = a.startTime ? new Date(a.startTime).getTime() : 0;
          const db = b.startTime ? new Date(b.startTime).getTime() : 0;
          return da - db;
        });

        setUpcoming(list);
      } catch (e) {
        console.error(e);
        setUpcomingError("Couldn't load upcoming matches. Use match code for now.");
      } finally {
        setLoadingUpcoming(false);
      }
    };

    loadUpcoming();
  }, []);

  const goPlay = (docId: string) => {
    const target = `/picks?sport=BBL&docId=${encodeURIComponent(docId)}`;
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push(target);
  };

  const onContinue = () => {
    if (!effectiveDocId) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    router.push(picksHref);
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

        {/* ========= SUPER CLEAR BBL BANNER ========= */}
        <div className="mb-8 rounded-3xl border border-orange-500/35 bg-gradient-to-r from-orange-500/18 via-[#020617] to-[#020617] px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* Cricket Icon */}
              <div className="relative h-14 w-14 rounded-2xl border border-orange-400/40 bg-orange-500/10 shadow-[0_0_44px_rgba(255,122,0,0.25)] flex items-center justify-center">
                <svg
                  viewBox="0 0 120 120"
                  className="h-10 w-10 text-[#FF7A00]"
                  fill="none"
                >
                  <path
                    d="M78 26l14 14-54 54H24V80l54-54z"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="92"
                    cy="92"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="6"
                    opacity="0.85"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] text-black px-3 py-1 text-[11px] font-extrabold tracking-wide uppercase shadow-[0_0_24px_rgba(255,122,0,0.75)]">
                    YOU’RE IN BBL
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    CRICKET STREAKr
                  </span>
                  <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                    YES / NO PICKS
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/70">
                  Clean sweep per match — get one wrong and you’re back to zero.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  const first = upcoming[0];
                  if (first?.id) goPlay(first.id);
                }}
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm shadow-[0_14px_40px_rgba(0,0,0,0.65)] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!upcoming[0]?.id}
              >
                Play next match →
              </button>
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
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-10">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Cricket. Banter. Bragging rights.
              </span>
              <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
                BBL STREAKr
              </span>
              <span className="block text-white mt-2">How Long Can You Last?</span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your cricket? Back your gut, ride the hot hand, and roast
              your mates when you&apos;re on a heater. One wrong call and your streak is
              cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.5)]">
                <span className="text-sm font-semibold text-orange-200">
                  Prizes &amp; venue rewards coming*
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <p className="text-[11px] text-white/50">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only.
              Don&apos;t be a mug — play for fun.
            </p>
          </div>

          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              {/* Reuse an existing stadium image or add a cricket one later */}
              <Image
                src="/mcg-hero.jpg"
                alt="Under lights"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              {/* BIG BBL TAG TOP RIGHT */}
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/75 border border-orange-400/50 px-4 py-2 text-xs font-extrabold text-orange-200 shadow-[0_0_28px_rgba(255,122,0,0.45)]">
                  <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
                  BBL MODE
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
                  Live BBL Yes/No picks
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
                  Pick a match.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========= UPCOMING MATCHES + MATCH CODE ========= */}
        <section className="mb-12">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upcoming matches */}
            <div className="rounded-3xl border border-white/10 bg-[#020617] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl font-bold">Upcoming matches</h2>
                <p className="text-xs text-white/50">Tap a match to play</p>
              </div>

              {upcomingError ? (
                <p className="text-sm text-red-300">{upcomingError}</p>
              ) : null}

              {loadingUpcoming ? (
                <p className="text-sm text-white/70">Loading matches…</p>
              ) : null}

              {!loadingUpcoming && !upcomingError && upcoming.length === 0 ? (
                <p className="text-sm text-white/60">
                  No upcoming matches found. Use match code for now.
                </p>
              ) : null}

              <div className="space-y-3 mt-3">
                {upcoming.slice(0, 5).map((m) => {
                  const { date, time } = formatStartDate(m.startTime);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => goPlay(m.id)}
                      className="w-full text-left rounded-2xl border border-orange-500/20 bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] px-4 py-3 hover:border-orange-400/40 transition shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                            <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/50 px-2.5 py-0.5 text-[10px] font-bold text-orange-200">
                              {typeof m.gameNumber === "number"
                                ? `Match ${m.gameNumber}`
                                : "BBL"}
                            </span>
                            {date && time ? (
                              <>
                                <span>•</span>
                                <span>
                                  {date} • {time} AEDT
                                </span>
                              </>
                            ) : null}
                          </div>

                          <div className="text-sm sm:text-base font-extrabold text-white truncate">
                            {m.match}
                          </div>

                          {m.venue ? (
                            <div className="text-xs text-white/60 mt-0.5 truncate">
                              {m.venue}
                            </div>
                          ) : null}
                        </div>

                        <span className="shrink-0 rounded-full bg-[#FF7A00] text-black text-xs font-extrabold px-3 py-1 shadow-[0_0_18px_rgba(255,122,0,0.7)]">
                          Play →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match code entry */}
            <div className="rounded-3xl border border-white/10 bg-[#020617] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
              <h2 className="text-lg sm:text-xl font-bold mb-2">
                Enter a BBL match code to start
              </h2>
              <p className="text-sm text-white/70 mb-4">
                Paste the Firestore docId (match code). We’ll auto-route you into Picks.
              </p>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="block text-xs font-semibold text-white/70 mb-2">
                  Match code (docId)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={matchCode}
                    onChange={(e) => setMatchCode(e.target.value)}
                    placeholder="BBL-2025-12-14-SCO-VS-SIX"
                    className="flex-1 rounded-full bg-black/40 border border-white/15 px-4 py-2.5 text-sm outline-none focus:border-orange-400/70"
                  />
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={!effectiveDocId}
                    className="rounded-full bg-[#FF7A00] px-6 py-2.5 font-extrabold text-black hover:bg-orange-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-white/50">
                  (Temporary) This will be replaced with an auto “Next match” selector.
                </p>

                <p className="mt-3 text-[11px] text-white/50">
                  *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only.
                  Don&apos;t be a mug — play for fun.
                </p>
              </div>
            </div>
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
              <h2 className="text-lg font-semibold">Log in to play BBL</h2>
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
                href={`/auth?mode=login&returnTo=${encodeURIComponent(
                  picksHref || "/picks?sport=BBL"
                )}`}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodeURIComponent(
                  picksHref || "/picks?sport=BBL"
                )}`}
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
