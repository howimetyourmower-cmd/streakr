// /app/play/bbl/BblHubClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ Resolve initial docId from query > props
  const initialFromProps = (initialDocId || "").trim();
  const initialFromQuery = (searchParams?.get("docId") || "").trim();
  const initialResolved = initialFromQuery || initialFromProps;

  // ✅ Selected match (AFL-style: one match only)
  const [selectedDocId, setSelectedDocId] = useState<string>(initialResolved);

  // Upcoming matches (used only to auto-pick the one “upcoming/live” match)
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

  // Prevent repeated auto-pick loops
  const didAutoPickRef = useRef(false);

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

  // Keep URL in sync so refresh keeps the match (same as AFL behaviour)
  const syncUrlWithDocId = (docId: string) => {
    const clean = (docId || "").trim();
    if (!clean) return;

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (params.get("docId") === clean) return;

    params.set("docId", clean);
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Choose the “best” match for players: prefer live/soonest upcoming.
  const pickBestAutoMatch = (list: UpcomingMatch[]) => {
    if (!Array.isArray(list) || list.length === 0) return "";

    const now = Date.now();
    const parsed = list
      .map((m) => ({
        ...m,
        ts: m.startTime ? new Date(m.startTime).getTime() : 0,
      }))
      .filter((m) => m.ts > 0);

    if (parsed.length === 0) return list[0]?.id || "";

    // Prefer matches that are “now-ish” or upcoming (5 min grace)
    const future = parsed
      .filter((m) => m.ts >= now - 5 * 60 * 1000)
      .sort((a, b) => a.ts - b.ts);

    if (future[0]?.id) return future[0].id;

    // Else earliest match we can find
    parsed.sort((a, b) => a.ts - b.ts);
    return parsed[0]?.id || list[0]?.id || "";
  };

  const selectedMeta = useMemo(() => {
    return upcoming.find((m) => m.id === selectedDocId) || null;
  }, [upcoming, selectedDocId]);

  const picksHref = useMemo(() => {
    if (!selectedDocId) return "/picks?sport=BBL";
    return `/picks?sport=BBL&docId=${encodeURIComponent(selectedDocId)}`;
  }, [selectedDocId]);

  // ---- Preloader ----
  useEffect(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
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

  // ---- Sync if URL docId changes (e.g. share link) ----
  useEffect(() => {
    const q = (searchParams?.get("docId") || "").trim();
    if (!q) return;
    if (q === selectedDocId) return;
    setSelectedDocId(q);
  }, [searchParams, selectedDocId]);

  // ---- Load upcoming matches and AUTO-SELECT ONE MATCH (AFL behaviour) ----
  useEffect(() => {
    const loadUpcoming = async () => {
      try {
        setLoadingUpcoming(true);
        setUpcomingError("");

        const res = await fetch("/api/bbl/upcoming", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data = (await res.json()) as { matches?: UpcomingMatch[] };
        const list = Array.isArray(data.matches) ? data.matches : [];

        // sort by start time
        list.sort((a, b) => {
          const da = a.startTime ? new Date(a.startTime).getTime() : 0;
          const db = b.startTime ? new Date(b.startTime).getTime() : 0;
          return da - db;
        });

        setUpcoming(list);

        // ✅ AFL-style: if no match selected, pick the best one automatically
        if (!didAutoPickRef.current) {
          didAutoPickRef.current = true;

          const hasExplicit = !!(searchParams?.get("docId") || "").trim() || !!initialFromProps || !!selectedDocId;

          if (!hasExplicit) {
            const best = pickBestAutoMatch(list);
            if (best) {
              setSelectedDocId(best);
              syncUrlWithDocId(best);
            }
          } else {
            // Ensure URL has docId if selectedDocId exists (helps refresh / sharing)
            if (!((searchParams?.get("docId") || "").trim()) && selectedDocId) {
              syncUrlWithDocId(selectedDocId);
            }
          }
        }
      } catch (e) {
        console.error(e);
        setUpcomingError("Couldn't load upcoming matches right now.");
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

        const res = await fetch(`/api/picks?sport=BBL&docId=${encodeURIComponent(selectedDocId)}`, {
          cache: "no-store",
        });
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
        setError("Failed to load picks preview.");
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [selectedDocId]);

  // AFL-style count (6–8)
  const previewQuestions = useMemo(() => questions.slice(0, 8), [questions]);

  // ---- Navigation actions (AFL behaviour: preview click -> picks page) ----
  const requireAuthThenGo = () => {
    // AFL hub usually lets you browse without login but requires login to actually pick.
    // Your picks page likely handles login too, but keep this consistent:
    if (!user) {
      router.push(`/auth?mode=login&returnTo=${encodeURIComponent(picksHref)}`);
      return;
    }
    router.push(picksHref);
  };

  const goToPicks = () => {
    if (!selectedDocId) return;
    requireAuthThenGo();
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
              <p className="text-xs sm:text-sm text-white/70 tracking-[0.25em] uppercase mb-1">Welcome to</p>
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

              <span className="min-w-0 flex-1 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                FREE TO PLAY. AUSSIE AS.
              </span>
            </div>
          </div>

          {selectedMeta ? (
            <p className="mt-2 text-xs text-white/60">
              Tonight: <span className="text-white/80 font-semibold">{selectedMeta.match}</span>
              {selectedMeta.venue ? <span className="text-white/50"> • {selectedMeta.venue}</span> : null}
              {selectedMeta.startTime ? (
                <span className="text-white/50">
                  {" "}
                  •{" "}
                  {(() => {
                    const { date, time } = formatStartDate(selectedMeta.startTime);
                    return date && time ? `${date} • ${time} AEDT` : "";
                  })()}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2 text-xs text-white/50">{loadingUpcoming ? "Loading tonight’s match…" : "No match found."}</p>
          )}

          {upcomingError ? <p className="mt-2 text-xs text-red-300">{upcomingError}</p> : null}
        </div>

        {/* HERO */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-10">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Cricket. Banter. Bragging rights.
              </span>
              <span className="block text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">BBL STREAKr</span>
              <span className="block text-white">How Long Can You Last?</span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Quick yes/no picks during the match. One wrong call and your streak is cooked — back to zero.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <button
                type="button"
                onClick={goToPicks}
                disabled={!selectedDocId}
                className={`inline-flex items-center justify-center rounded-full font-semibold px-6 py-3 text-sm sm:text-base shadow-[0_14px_40px_rgba(0,0,0,0.65)] ${
                  selectedDocId
                    ? "bg-[#FF7A00] hover:bg-orange-500 text-black"
                    : "bg-white/10 text-white/50 cursor-not-allowed"
                }`}
              >
                Go to Picks
              </button>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85"
              >
                Leaderboard
              </Link>
            </div>

            <p className="text-[11px] text-white/50">
              STREAKr is a free game of skill. No gambling. 18+ only. Play responsibly.
            </p>
          </div>

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
            </div>
          </div>
        </section>

        {/* ✅ AFL-STYLE: ONE MATCH + 6–8 PICKS (CLICK -> PICKS PAGE) */}
        <section className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-bold">Tonight&apos;s live BBL picks</h2>
            <p className="text-sm text-white/70">
              A taste of the open questions for tonight’s match. Tap any pick to jump into Picks.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-[#020617] px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-white/80">
                <span className="font-semibold text-orange-200">Match:</span>{" "}
                {selectedMeta ? (
                  <>
                    <span className="font-semibold">{selectedMeta.match}</span>
                    {selectedMeta.venue ? <span className="text-white/60"> • {selectedMeta.venue}</span> : null}
                  </>
                ) : (
                  <span className="text-white/60">{loadingUpcoming ? "Loading…" : "Not available"}</span>
                )}
              </div>

              <button
                type="button"
                onClick={goToPicks}
                disabled={!selectedDocId}
                className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                  selectedDocId ? "bg-[#FF7A00] text-black hover:bg-orange-500" : "bg-white/10 text-white/50 cursor-not-allowed"
                }`}
              >
                Go to Picks →
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}
          {loading ? <p className="text-sm text-white/70">Loading picks…</p> : null}

          {!loading && !error && selectedDocId && previewQuestions.length === 0 ? (
            <p className="text-sm text-white/60">
              No open questions right now for this match. Could be between toss/innings — check back soon.
            </p>
          ) : null}

          {!loading && !error && !selectedDocId ? (
            <p className="text-sm text-white/60">No match selected / found yet.</p>
          ) : null}

          <div className="space-y-3">
            {previewQuestions.map((q) => {
              const { date, time } = formatStartDate(q.startTime);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={goToPicks}
                  className="w-full text-left rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 hover:border-orange-400/60 transition shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-4 py-3 sm:px-5 sm:py-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                        <span className="font-semibold text-orange-200">Q{q.quarter}</span>
                        <span>•</span>
                        <span>
                          {date} • {time} AEDT
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-semibold">{q.question}</div>
                    </div>

                    <div className="flex items-center gap-3 md:ml-4 shrink-0">
                      <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-green-600 text-white">
                        Yes
                      </span>
                      <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-red-600 text-white">
                        No
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 text-[11px] text-white/50">
            STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions. Play responsibly.</p>
            <Link href="/faq" className="text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline">
              FAQ
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
