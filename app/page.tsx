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

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // PRELOADER STATE
  const [showPreloader, setShowPreloader] = useState(true);
  const [isPreloaderFading, setIsPreloaderFading] = useState(false);

  // -------- Preloader: play video then fade into homepage --------
  useEffect(() => {
    // lock scroll while preloader is showing
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }

    // adjust timings to match your video length (ms)
    const fadeTimer = setTimeout(() => {
      setIsPreloaderFading(true);
    }, 3500); // start fade

    const hideTimer = setTimeout(() => {
      setShowPreloader(false);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    }, 4200); // fully gone

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, []);

  // -------- Date formatting ----------
  const formatStartDate = (iso: string) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: "", time: "" };

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

  // -------- Load a preview of open questions --------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
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

        // sort by start time then quarter
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

  // -------- Handle YES / NO clicks on homepage preview --------
  const handlePreviewPick = (questionId: string, outcome: "yes" | "no") => {
    if (!user) {
      // Not logged in → show auth modal encouraging signup/login
      setShowAuthModal(true);
      return;
    }

    // Logged in → send them to Picks page (they'll make the official pick there)
    router.push("/picks");
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {/* PRELOADER OVERLAY */}
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
              className="
                absolute inset-0 w-full h-full
                object-contain
                bg-black
              "
            />

            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Brand Text */}
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

      {/* Page wrapper */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        {/* HERO SECTION */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-14">
          {/* Left text block */}
          <div>
            {/* Season / round meta */}
            <div className="mb-4">
              <span className="inline-flex items-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-orange-200">
                AFL Season 2026
                {roundNumber !== null && (
                  <>
                    <span className="mx-1">•</span>
                    <span>Round {roundNumber}</span>
                  </>
                )}
                <span className="mx-1">•</span>
                <span>Free to play. Aussie as.</span>
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Footy. Banter. Bragging rights.
              </span>
              <span className="text-[#FF7A00] drop-shadow-[0_0_18px_rgba(255,122,0,0.8)]">
                How Long Can You Last?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Quarter-by-quarter AFL stat picks. Back your gut, ride the hot
              hand, and roast your mates when you&apos;re on a heater. One
              wrong call and your streak is cooked — back to zip.
            </p>

            {/* Prize pill */}
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

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-semibold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)]"
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

            <p className="text-[11px] text-white/50">
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No
              gambling. 18+ only. Don&apos;t be a mug — play for fun.
            </p>
          </div>

          {/* Right hero image card */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              {/* You can swap this out for a more cinematic Aussie hero image, e.g.
                  /images/streakr-hero-night-footy.png */}
              <Image
                src="/mcg-hero.jpg"
                alt="Night footy at the G"
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
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/60 mb-1">
                    Group chats. Pub TVs. Office comps.
                  </p>
                  <p className="text-sm font-semibold text-white">
                    One streak. Endless sledging.
                  </p>
                </div>
                <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)]">
                  Make your next pick
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mb-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            How STREAKr works
          </h2>
          <p className="text-sm text-white/70 mb-4 max-w-2xl">
            It&apos;s like tipping&apos;s louder cousin. Quick picks, live
            sweat, and bragging rights that last all week.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">
                1 · Pick a player question
              </p>
              <p className="text-sm text-white/80">
                Every quarter has hand-picked AFL player-stat questions.{" "}
                <span className="font-semibold">Yes</span> or{" "}
                <span className="font-semibold">No</span> — back your gut and
                lock in your pick.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">
                2 · Build a filthy streak
              </p>
              <p className="text-sm text-white/80">
                Every correct answer adds{" "}
                <span className="font-semibold">+1</span> to your streak. One
                wrong pick and you&apos;re{" "}
                <span className="font-semibold">back to zero</span>. No safety
                nets. No cash outs. Just nerve.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">
                3 · Flex on your mates
              </p>
              <p className="text-sm text-white/80">
                Climb the round ladder, earn{" "}
                <span className="font-semibold">badges</span>, win{" "}
                <span className="font-semibold">prizes</span>, and send those
                screenshots straight into the group chat. Long streak = loudest
                voice.
              </p>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm text-white/75">
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">
                Built for
              </p>
              <p>Group chats, office comps, pub TVs and venue leagues.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">
                No deposit, no drama
              </p>
              <p>Free to play. No odds, no multis, no gambling nonsense.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">
                Just the footy chat
              </p>
              <p>
                Back your eye for the game, not your bank account. Be the one
                everyone hates losing to.
              </p>
            </div>
          </div>
        </section>

        {/* NEXT QUESTIONS PREVIEW – KEEPING PICKS DOWN THE BOTTOM */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Tonight&apos;s live picks preview
              </h2>
              <p className="text-sm text-white/70">
                A taste of the open questions right now. Jump into Picks to
                actually lock yours in.
              </p>
            </div>
            <Link
              href="/picks"
              className="text-sm text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
            >
              Make your next pick →
            </Link>
          </div>

          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          {loading && (
            <p className="text-sm text-white/70">Loading questions…</p>
          )}

          {!loading && previewQuestions.length === 0 && !error && (
            <p className="text-sm text-white/60">
              No open questions right now. Schedule&apos;s probably between
              games — check back closer to bounce.
            </p>
          )}

          <div className="space-y-3">
            {previewQuestions.map((q) => {
              const { date, time } = formatStartDate(q.startTime);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-4 py-3 sm:px-5 sm:py-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    {/* Left: meta + question */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                        <span className="font-semibold text-orange-200">
                          Q{q.quarter}
                        </span>
                        <span>•</span>
                        <span>
                          {date} • {time} AEDT
                        </span>
                        <span>•</span>
                        <span>{q.match}</span>
                        <span>•</span>
                        <span>{q.venue}</span>
                      </div>
                      <div className="text-sm sm:text-base font-semibold">
                        {q.question}
                      </div>
                    </div>

                    {/* Right: YES / NO buttons */}
                    <div className="flex items-center gap-3 md:ml-4 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewPick(q.id, "yes")}
                        className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreviewPick(q.id, "no")}
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

        {/* SOCIAL + FOOTER */}
        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
          {/* Social bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <p className="text-xs sm:text-sm text-white/60 uppercase tracking-wide">
              Follow STREAKr – clips, challenges &amp; bad beats
            </p>
            <div className="flex flex-wrap gap-3">
              {/* Instagram */}
              <a
                href="https://instagram.com/streakr"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-[0_0_18px_rgba(221,42,123,0.7)] hover:brightness-110 transition"
              >
                Instagram
              </a>

              {/* TikTok */}
              <a
                href="https://www.tiktok.com/@streakr"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold bg-[#010101] text-white border border-white/20 shadow-[0_0_18px_rgba(45,212,191,0.7)] hover:border-cyan-300 transition"
              >
                TikTok
              </a>

              {/* Facebook */}
              <a
                href="https://facebook.com/streakr"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold bg-[#1877F2] text-white shadow-[0_0_18px_rgba(24,119,242,0.7)] hover:brightness-110 transition"
              >
                Facebook
              </a>

              {/* YouTube */}
              <a
                href="https://www.youtube.com/@streakr"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold bg-[#FF0000] text-white shadow-[0_0_18px_rgba(239,68,68,0.8)] hover:brightness-110 transition"
              >
                YouTube
              </a>
            </div>
          </div>

          {/* Legal line / FAQ link */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes
              subject to terms and conditions. Play responsibly and don&apos;t
              be a hero chasing losses — it&apos;s just for fun and bragging
              rights.
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

      {/* AUTH REQUIRED MODAL (same style as PicksClient) */}
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
              You need a free STREAKr account to make picks, build your streak
              and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth?mode=login&returnTo=/picks"
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href="/auth?mode=signup&returnTo=/picks"
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
