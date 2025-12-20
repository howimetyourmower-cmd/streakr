// /app/play/bbl/BblHubClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

type MatchDoc = {
  gameNumber?: number;
  league?: string; // "BBL"
  match?: string; // "Perth Scorchers vs Sydney Sixers"
  matchId?: string; // "BBL-2025-12-14-SCO-VS-SIX"
  startTime?: string; // ISO string in your docs
  venue?: string;
};

export default function BblHubClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);

  // allow url prefill like /play/bbl?docId=BBL-...
  const urlDocId = (params.get("docId") || "").trim();

  // input-controlled docId (matches your screenshot: "Enter a BBL match code to start")
  const [docIdInput, setDocIdInput] = useState(urlDocId);

  // fetched match info (so we can show Match #)
  const [matchDoc, setMatchDoc] = useState<MatchDoc | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [matchError, setMatchError] = useState("");

  const cleanedDocId = docIdInput.trim();

  const picksHref = useMemo(() => {
    if (!cleanedDocId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(cleanedDocId)}`;
  }, [cleanedDocId]);

  // Fetch match document when docId changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setMatchError("");
      setMatchDoc(null);

      if (!cleanedDocId) return;

      setLoadingMatch(true);
      try {
        // IMPORTANT: update this collection name if yours is different
        // From your screenshot, your doc id is like "BBL-2025-12-14-SCO-VS-SIX"
        // This assumes collection is "bblMatches"
        const ref = doc(db, "bblMatches", cleanedDocId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (!cancelled) setMatchError("No match found for that code.");
          return;
        }

        const data = snap.data() as any;

        const parsed: MatchDoc = {
          gameNumber: typeof data.gameNumber === "number" ? data.gameNumber : undefined,
          league: typeof data.league === "string" ? data.league : "BBL",
          match: typeof data.match === "string" ? data.match : "",
          matchId: typeof data.matchId === "string" ? data.matchId : "",
          startTime: typeof data.startTime === "string" ? data.startTime : "",
          venue: typeof data.venue === "string" ? data.venue : "",
        };

        if (!cancelled) setMatchDoc(parsed);
      } catch (e) {
        console.error(e);
        if (!cancelled) setMatchError("Couldn’t load match details.");
      } finally {
        if (!cancelled) setLoadingMatch(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [cleanedDocId]);

  const formatStart = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Australia/Melbourne",
    });
    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    });
    return `${date} • ${time} AEDT`;
  };

  const onContinue = () => {
    if (!cleanedDocId) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    router.push(picksHref);
  };

  return (
    <main className="min-h-screen bg-black text-white relative">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        {/* Header pills like AFL page */}
        <div className="mb-6">
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full flex-nowrap">
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                BBL
              </span>

              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                SELECT A MATCH
              </span>

              <span className="min-w-0 flex-1 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                FREE TO PLAY. AUSSIE AS.
              </span>
            </div>
          </div>
        </div>

        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-start">
          {/* Left */}
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
                Cricket. Banter. Bragging rights.
              </span>
              <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
                How Long Can You Last?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
              Think you know your cricket? Back your gut, ride the hot hand, and roast
              your mates when you&apos;re on a heater. One wrong call and your streak is cooked —
              back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.25)]">
                <span className="text-sm font-semibold text-orange-200">
                  Prizes &amp; venue rewards coming*
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            {/* Match code input */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-[#020617] p-5 max-w-2xl">
              <p className="text-sm font-semibold mb-3">Enter a BBL match code to start</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={docIdInput}
                  onChange={(e) => setDocIdInput(e.target.value)}
                  placeholder="Match code (docId)"
                  className="flex-1 rounded-2xl bg-black/40 border border-white/15 px-4 py-3 text-sm outline-none focus:border-orange-400/70"
                />

                <button
                  type="button"
                  onClick={onContinue}
                  disabled={!cleanedDocId}
                  className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                    cleanedDocId
                      ? "bg-[#FF7A00] text-black hover:bg-orange-500"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  Continue
                </button>
              </div>

              {/* Match preview */}
              <div className="mt-4">
                {loadingMatch ? (
                  <p className="text-xs text-white/60">Loading match details…</p>
                ) : matchError ? (
                  <p className="text-xs text-red-400">{matchError}</p>
                ) : matchDoc ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1">
                      {typeof matchDoc.gameNumber === "number" ? (
                        <span className="font-semibold text-orange-200">
                          Match {matchDoc.gameNumber}
                        </span>
                      ) : null}
                      {typeof matchDoc.gameNumber === "number" ? <span>•</span> : null}
                      <span className="uppercase tracking-wide">
                        {matchDoc.league || "BBL"}
                      </span>
                    </div>

                    <div className="text-sm sm:text-base font-semibold">
                      {matchDoc.match || cleanedDocId}
                    </div>

                    <div className="mt-1 text-xs text-white/60">
                      {formatStart(matchDoc.startTime)}
                      {matchDoc.venue ? ` • ${matchDoc.venue}` : ""}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-white/50">
                    (Temporary) This will be replaced with an auto “Next match” selector.
                  </p>
                )}
              </div>

              <p className="mt-4 text-[11px] text-white/50">
                *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only.
                Don&apos;t be a mug — play for fun.
              </p>
            </div>
          </div>

          {/* Right hero card */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image
                src="/mcg-hero.jpg"
                alt="Night stadium"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
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
                  Make your next pick.
                </div>
              </div>
            </div>
          </div>
        </section>
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
