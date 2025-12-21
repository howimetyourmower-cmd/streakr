// /app/play/bbl/BblHubClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  gameNumber?: number | null;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
};

type QuestionRow = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
};

type UpcomingMatch = {
  id: string; // Firestore docId
  match: string;
  venue?: string;
  startTime?: string;
  gameNumber?: number | null;
};

export default function BblHubClient({ initialDocId }: { initialDocId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showAuthModal, setShowAuthModal] = useState(false);

  // ✅ Source of truth for selected match
  const initialFromProps = (initialDocId || "").trim();
  const initialFromQuery = (searchParams?.get("docId") || "").trim();
  const initialResolved = initialFromQuery || initialFromProps;

  const [selectedDocId, setSelectedDocId] = useState<string>(initialResolved);
  const [matchCode, setMatchCode] = useState<string>(initialResolved);

  // Mobile picker modal
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  // Upcoming matches
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingError, setUpcomingError] = useState("");

  // Preview questions
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Optional preloader (safe if video missing)
  const [showPreloader, setShowPreloader] = useState(true);
  const [isPreloaderFading, setIsPreloaderFading] = useState(false);

  const seasonChip = "BBL SEASON 2025/26";

  // Prevent auto-select from overriding an explicit selection
  const didAutoSelectRef = useRef(false);

  // ---- Helpers ----
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

  const selectedMeta = useMemo(() => {
    const found = upcoming.find((m) => m.id === selectedDocId);
    return found || null;
  }, [upcoming, selectedDocId]);

  const selectedMatchLabel = useMemo(() => {
    const found = upcoming.find((m) => m.id === selectedDocId);
    if (!found) return "SELECT A MATCH";
    if (typeof found.gameNumber === "number") return `MATCH ${found.gameNumber}`;
    return "MATCH SELECTED";
  }, [upcoming, selectedDocId]);

  const selectedMatchDisplay = useMemo(() => {
    const found = upcoming.find((m) => m.id === selectedDocId);
    return found?.match || "";
  }, [upcoming, selectedDocId]);

  const picksHref = useMemo(() => {
    if (!selectedDocId) return "/picks?sport=BBL";
    return `/picks?sport=BBL&docId=${encodeURIComponent(selectedDocId)}`;
  }, [selectedDocId]);

  // ---- Preloader ----
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
    const fadeTimer = window.setTimeout(() => setIsPreloaderFading(true), 2500);
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

  // ---- Keep state in sync if query docId changes (e.g. user navigates with a link) ----
  useEffect(() => {
    const q = (searchParams?.get("docId") || "").trim();
    if (!q) return;
    if (q === selectedDocId) return;
    setSelectedDocId(q);
    setMatchCode(q);
  }, [searchParams, selectedDocId]);

  // ---- Load upcoming matches ----
  useEffect(() => {
    const loadUpcoming = async () => {
      try {
        setLoadingUpcoming(true);
        setUpcomingError("");

        // Expected: { matches: [{ id, match, venue, startTime, gameNumber }] }
        const res = await fetch("/api/bbl/upcoming", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data = (await res.json()) as { matches?: UpcomingMatch[] };
        const list = Array.isArray(data.matches) ? data.matches : [];

        list.sort((a, b) => {
          const da = a.startTime ? new Date(a.startTime).getTime() : 0;
          const db = b.startTime ? new Date(b.startTime).getTime() : 0;
          return da - db;
        });

        setUpcoming(list);

        // ✅ AUTO-SELECT (this is what you asked for)
        // If user has not selected anything (no prop, no query, no state), choose first upcoming.
        // And only do this once.
        if (!didAutoSelectRef.current) {
          const hasExplicit = !!selectedDocId;
          const firstId = list[0]?.id;

          if (!hasExplicit && firstId) {
            didAutoSelectRef.current = true;
            setSelectedDocId(firstId);
            setMatchCode(firstId);
          } else {
            didAutoSelectRef.current = true;
          }
        }
      } catch (e) {
        console.error(e);
        setUpcomingError("Couldn't load upcoming matches. Use match code for now.");
      } finally {
        setLoadingUpcoming(false);
      }
    };

    loadUpcoming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load preview questions for selected match (AUTO LOAD) ----
  useEffect(() => {
    const loadPreview = async () => {
      if (!selectedDocId) {
        setQuestions([]);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Assumes /api/picks supports sport=BBL & docId
        const res = await fetch(
          `/api/picks?sport=BBL&docId=${encodeURIComponent(selectedDocId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        const flat: QuestionRow[] = (data.games || []).flatMap((g) =>
          (g.questions || [])
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
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [selectedDocId]);

  // ✅ Make the preview feel alive even when there are lots of open questions
  const previewQuestions = useMemo(() => questions.slice(0, 6), [questions]);

  // ---- Actions ----
  const requireMatchThenAuth = (after?: () => void) => {
    if (!selectedDocId) {
      setShowMatchPicker(true);
      return;
    }
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    after?.();
  };

  const handlePlayNow = () => requireMatchThenAuth(() => router.push(picksHref));
  const handlePreviewPick = () => requireMatchThenAuth(() => router.push(picksHref));

  const openMatchPicker = () => setShowMatchPicker(true);

  const applyDocId = (docId: string) => {
    const clean = (docId || "").trim();
    if (!clean) return;
    setSelectedDocId(clean);
    setMatchCode(clean);
    setShowMatchPicker(false);
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      {/* PRELOADER */}
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
              <p className="mt-1 text-[11px] sm:text-xs text-white/60">BBL STREAKr</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        {/* TOP CHIPS */}
        <div className="mb-6">
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full flex-nowrap">
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                YOU&apos;RE IN BBL
              </span>

              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                {seasonChip}
              </span>

              <button
                type="button"
                onClick={openMatchPicker}
                className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap hover:bg-orange-500/15 transition"
                title="Select a match"
              >
                {loadingUpcoming ? "LOADING…" : selectedMatchLabel}
              </button>

              <span className="min-w-0 flex-1 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                FREE TO PLAY. AUSSIE AS.
              </span>
            </div>
          </div>

          {selectedMeta ? (
            <p className="mt-2 text-xs text-white/60">
              Selected:{" "}
              <span className="text-white/80 font-semibold">{selectedMeta.match}</span>
              {selectedMeta.venue ? <span className="text-white/50"> • {selectedMeta.venue}</span> : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/50">
              {loadingUpcoming ? "Loading matches…" : "Select a match to preview questions and play."}
            </p>
          )}

          {upcomingError ? <p className="mt-2 text-xs text-red-300">{upcomingError}</p> : null}
        </div>

        {/* HERO */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-14">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Cricket. Banter. Bragging rights.
              </span>

              <span className="block text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
                BBL STREAKr
              </span>

              <span className="block text-white">How Long Can You Last?</span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your cricket? Prove it or pipe down. Back your gut, ride the hot hand, and roast
              your mates when you&apos;re on a heater. One wrong call and your streak is cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.5)]">
                <span className="text-sm font-semibold text-orange-200">Prizes &amp; venue rewards coming*</span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <button
                type="button"
                onClick={handlePlayNow}
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
              *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only. Don&apos;t be a mug —
              play for fun.
            </p>
          </div>

          {/* Right card */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image src="/cricket.png" alt="Cricket under lights" fill className="object-cover opacity-85" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
                  Live BBL Yes/No picks
                </span>
              </div>
              <div className="absolute top-4 right-4">
                <span className="rounded-full bg-[#FF7A00] text-black text-xs font-extrabold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)]">
                  BBL MODE
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-white/60 mb-1">Group chats. Pub banter. Office comps.</p>
                  <p className="text-sm font-semibold text-white">One streak. Battle your mates. Endless sledging.</p>
                </div>

                <button
                  type="button"
                  onClick={openMatchPicker}
                  className="rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold px-3 py-1 hover:border-orange-400/70 hover:text-orange-200 transition"
                >
                  Select match
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mb-10">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">How BBL STREAKr works</h2>
          <p className="text-sm text-white/70 mb-4 max-w-2xl">
            It&apos;s like tipping&apos;s louder cousin. Quick picks, live sweat, and bragging rights that last all week.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">1 · Pick a cricket question</p>
              <p className="text-sm text-white/80">
                Each match has hand-picked BBL questions. <span className="font-semibold">Yes</span> or{" "}
                <span className="font-semibold">No</span> — back your gut and lock it in.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">2 · Build a filthy streak</p>
              <p className="text-sm text-white/80">
                Every correct answer adds <span className="font-semibold">+1</span> to your streak. One wrong pick and
                you&apos;re <span className="font-semibold">back to zero</span>. No safety nets. Just nerve.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              <p className="text-xs font-semibold text-orange-300 mb-1">3 · Flex on your mates</p>
              <p className="text-sm text-white/80">
                Climb the ladder, earn <span className="font-semibold">badges</span>, win{" "}
                <span className="font-semibold">prizes</span>, and send screenshots into the group chat.
              </p>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm text-white/75">
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">Built for</p>
              <p>Group chats, office comps, pub and venue leagues.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">No deposit, no drama</p>
              <p>Free to play. No odds, no multis, no gambling nonsense.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold text-white/70 mb-1 uppercase tracking-wide">Pure cricket chat</p>
              <p>Back your eye for the game, not your bank account.</p>
            </div>
          </div>
        </section>

        {/* PREVIEW */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Tonight&apos;s live BBL picks preview</h2>
              <p className="text-sm text-white/70">
                A taste of the open questions for the selected match. Jump into Picks to actually lock yours in.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePlayNow}
              className="text-sm text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
            >
              Make your next pick →
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-[#020617] px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-white/80">
                <span className="font-semibold text-orange-200">Selected match:</span>{" "}
                {selectedMeta ? (
                  <>
                    <span className="font-semibold">{selectedMeta.match}</span>
                    {selectedMeta.venue ? <span className="text-white/60"> • {selectedMeta.venue}</span> : null}
                    {selectedMeta.startTime ? (
                      <>
                        <span className="text-white/60"> • </span>
                        <span className="text-white/70">
                          {(() => {
                            const { date, time } = formatStartDate(selectedMeta.startTime);
                            return date && time ? `${date} • ${time} AEDT` : "";
                          })()}
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <span className="text-white/60">
                    {loadingUpcoming ? "Loading…" : "None selected"}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openMatchPicker}
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold hover:border-orange-400/70 hover:text-orange-200 transition"
                >
                  Select match
                </button>

                <button
                  type="button"
                  onClick={handlePlayNow}
                  className="rounded-full bg-[#FF7A00] px-4 py-2 text-xs font-extrabold text-black hover:bg-orange-500 transition"
                >
                  Play →
                </button>
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}
          {loading ? <p className="text-sm text-white/70">Loading questions…</p> : null}

          {!loading && !error && selectedDocId && previewQuestions.length === 0 ? (
            <p className="text-sm text-white/60">
              No open questions right now for this match. Could be between toss/innings — check back soon.
            </p>
          ) : null}

          {!loading && !error && !selectedDocId ? (
            <p className="text-sm text-white/60">
              No match selected. Pick a match and the preview will load automatically.
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
                        <span className="font-semibold text-orange-200">Q{q.quarter}</span>
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
                        onClick={handlePreviewPick}
                        className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-green-600 hover:bg-green-700 text-white transition"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={handlePreviewPick}
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

          <div className="mt-5 text-[11px] text-white/50">
            STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.
            </p>
            <Link href="/faq" className="text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline">
              FAQ
            </Link>
          </div>
        </footer>
      </div>

      {/* MATCH PICKER MODAL */}
      {showMatchPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[#050816] border border-white/10 p-5 shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-extrabold text-white">Select a BBL match</h2>
                <p className="text-sm text-white/60">Pick from upcoming matches, or paste a match code (docId).</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMatchPicker(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Upcoming */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">Upcoming matches</p>
                  <span className="text-[11px] text-white/50">Tap to select</span>
                </div>

                {upcomingError ? <p className="text-sm text-red-300">{upcomingError}</p> : null}
                {loadingUpcoming ? <p className="text-sm text-white/70">Loading…</p> : null}

                <div className="space-y-2 mt-2 max-h-[320px] overflow-auto pr-1">
                  {upcoming.slice(0, 12).map((m) => {
                    const { date, time } = formatStartDate(m.startTime);
                    const active = m.id === selectedDocId;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyDocId(m.id)}
                        className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                          active
                            ? "border-orange-400/70 bg-orange-500/10"
                            : "border-white/10 bg-black/20 hover:border-orange-400/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1">
                              <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/50 px-2 py-0.5 text-[10px] font-bold text-orange-200">
                                {typeof m.gameNumber === "number" ? `Match ${m.gameNumber}` : "BBL"}
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
                            <div className="font-extrabold text-sm text-white truncate">{m.match}</div>
                            {m.venue ? <div className="text-xs text-white/60 truncate">{m.venue}</div> : null}
                          </div>

                          <span className="shrink-0 text-xs font-extrabold text-black rounded-full bg-[#FF7A00] px-3 py-1">
                            Select
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Match code */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-bold mb-2">Enter match code (docId)</p>

                <label className="block text-xs font-semibold text-white/70 mb-2">Match code</label>
                <input
                  value={matchCode}
                  onChange={(e) => setMatchCode(e.target.value)}
                  placeholder="BBL-2025-12-21-Ren-vs-Hur"
                  className="w-full rounded-full bg-black/40 border border-white/15 px-4 py-2.5 text-sm outline-none focus:border-orange-400/70"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => applyDocId(matchCode)}
                    className="flex-1 rounded-full bg-[#FF7A00] px-4 py-2.5 font-extrabold text-black hover:bg-orange-500 transition"
                  >
                    Use this match
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMatchCode("");
                      setSelectedDocId("");
                    }}
                    className="rounded-full border border-white/20 px-4 py-2.5 text-sm text-white/80 hover:border-orange-400/60 hover:text-orange-200 transition"
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[11px] text-white/60">
                    Tip: the match code is the Firestore document ID under{" "}
                    <span className="text-orange-200 font-semibold">cricketRounds</span>.
                  </p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowMatchPicker(false)}
                    className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 hover:border-orange-400/60 hover:text-orange-200 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMatchPicker(false);
                  handlePlayNow();
                }}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-[#FF7A00] hover:bg-orange-500 text-black font-extrabold px-6 py-3 text-sm"
              >
                Play selected match →
              </button>
              <button
                type="button"
                onClick={() => setShowMatchPicker(false)}
                className="flex-1 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 hover:border-orange-400/70 hover:text-orange-200 px-6 py-3 text-sm text-white/80"
              >
                Keep browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
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
                href={`/auth?mode=login&returnTo=${encodeURIComponent(picksHref)}`}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodeURIComponent(picksHref)}`}
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
