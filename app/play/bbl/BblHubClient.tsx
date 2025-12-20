// /app/play/bbl/BblHubClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type BblRoundDoc = {
  match?: string;
  venue?: string;
  startTime?: string; // ISO string in your docs
  league?: string; // "BBL" | "WBBL"
  gameNumber?: number; // Match 8 etc
};

type MatchCard = {
  docId: string;
  match: string;
  venue: string;
  startTime: string;
  gameNumber?: number;
};

function formatStart(iso: string) {
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

export default function BblHubClient({ initialDocId }: { initialDocId: string }) {
  const router = useRouter();
  const { user } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);

  // Manual input (still useful for admin/testing)
  const [manualDocId, setManualDocId] = useState(initialDocId || "");
  const cleanedManualDocId = manualDocId.trim();

  // Auto selector
  const [upcoming, setUpcoming] = useState<MatchCard[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingError, setUpcomingError] = useState("");

  // If we came in with ?docId=... we treat it as "selected"
  const selectedDocId = useMemo(() => cleanedManualDocId, [cleanedManualDocId]);

  const picksHref = useMemo(() => {
    if (!selectedDocId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(selectedDocId)}`;
  }, [selectedDocId]);

  const goPlay = (docId: string) => {
    const d = (docId || "").trim();
    if (!d) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    router.push(`/picks?sport=BBL&docId=${encodeURIComponent(d)}`);
  };

  // Load upcoming matches from cricketRounds where league == "BBL" and startTime >= now
  useEffect(() => {
    let cancelled = false;

    const loadUpcoming = async () => {
      setLoadingUpcoming(true);
      setUpcomingError("");

      try {
        const nowIso = new Date().toISOString();

        // NOTE: This assumes your docs store startTime as an ISO string.
        // If you later switch to Firestore Timestamp, we can adjust quickly.
        const qRef = query(
          collection(db, "cricketRounds"),
          where("league", "==", "BBL"),
          where("startTime", ">=", nowIso),
          orderBy("startTime", "asc"),
          limit(6)
        );

        const snap = await getDocs(qRef);

        const rows: MatchCard[] = snap.docs.map((d) => {
          const data = d.data() as BblRoundDoc;

          return {
            docId: d.id,
            match: data.match || d.id,
            venue: data.venue || "",
            startTime: data.startTime || "",
            gameNumber: typeof data.gameNumber === "number" ? data.gameNumber : undefined,
          };
        });

        if (!cancelled) {
          setUpcoming(rows);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setUpcomingError("Couldn’t load upcoming matches. Use match code for now.");
        }
      } finally {
        if (!cancelled) setLoadingUpcoming(false);
      }
    };

    loadUpcoming();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-start mb-10">
          <div>
            <div className="mb-4">
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
              your mates when you&apos;re on a heater. One wrong call and your streak is
              cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/40 shadow-[0_0_18px_rgba(255,122,0,0.25)]">
                <span className="text-sm font-semibold text-white/85">
                  Prizes &amp; venue rewards coming*
                </span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/60">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            {/* AUTO UPCOMING MATCHES */}
            <div className="rounded-2xl border border-white/10 bg-[#020617] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm sm:text-base font-bold">Upcoming matches</h2>
                <span className="text-[11px] text-white/50">
                  Tap a match to play
                </span>
              </div>

              {upcomingError ? (
                <p className="text-sm text-red-400 mb-2">{upcomingError}</p>
              ) : null}

              {loadingUpcoming ? (
                <p className="text-sm text-white/70">Loading…</p>
              ) : null}

              {!loadingUpcoming && upcoming.length === 0 && !upcomingError ? (
                <p className="text-sm text-white/60">
                  No upcoming BBL matches found. Use the match code below for now.
                </p>
              ) : null}

              <div className="grid gap-3">
                {upcoming.map((m) => {
                  const { date, time } = formatStart(m.startTime);
                  return (
                    <button
                      key={m.docId}
                      type="button"
                      onClick={() => goPlay(m.docId)}
                      className="group text-left w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-orange-400/40 transition p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1">
                            {typeof m.gameNumber === "number" ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/40 px-2.5 py-0.5 text-orange-200 font-semibold">
                                Match {m.gameNumber}
                              </span>
                            ) : null}
                            <span>{date}</span>
                            <span>•</span>
                            <span>{time} AEDT</span>
                          </div>

                          <div className="text-sm sm:text-base font-semibold text-white group-hover:text-orange-200 transition truncate">
                            {m.match}
                          </div>

                          {m.venue ? (
                            <div className="text-xs text-white/55 mt-1 truncate">
                              {m.venue}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_18px_rgba(255,122,0,0.35)]">
                          Play →
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MANUAL DOC ID (keep for now) */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#020617] p-4 sm:p-5">
              <p className="text-sm font-semibold mb-2">Enter a BBL match code to start</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={manualDocId}
                  onChange={(e) => setManualDocId(e.target.value)}
                  placeholder="Match code (docId)"
                  className="flex-1 rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm outline-none focus:border-orange-400/60"
                />

                <button
                  type="button"
                  onClick={() => goPlay(cleanedManualDocId)}
                  disabled={!cleanedManualDocId}
                  className={`rounded-xl px-5 py-3 text-sm font-bold transition ${
                    cleanedManualDocId
                      ? "bg-[#FF7A00] text-black hover:bg-orange-500"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  Continue
                </button>
              </div>

              <p className="mt-2 text-[11px] text-white/50">
                (Temporary) This will be replaced with an auto “Next match” selector.
              </p>

              <p className="mt-2 text-[11px] text-white/50">
                *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No gambling. 18+ only.
                Don&apos;t be a mug — play for fun.
              </p>
            </div>
          </div>

          {/* RIGHT HERO CARD */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image
                src="/bbl-hero.jpg"
                alt="Big Bash under lights"
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

        <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
            <p>
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions.
              Play responsibly.
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
