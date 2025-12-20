// /app/play/bbl/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";

type CurrentBblApi =
  | {
      ok: true;
      docId: string;
      match?: string;
      venue?: string;
      startTime?: string; // ISO
    }
  | {
      ok: true;
      docId: null;
      reason: string;
    }
  | {
      ok: false;
      error: string;
    };

export default function BblHubPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [docId, setDocId] = useState<string>("");
  const [match, setMatch] = useState<string>("");
  const [venue, setVenue] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");

  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setApiError("");

      try {
        const res = await fetch("/api/bbl/current", { cache: "no-store" });
        const data: CurrentBblApi = await res.json();

        if (!res.ok || !data || (data as any).ok === false) {
          const msg =
            (data as any)?.error ||
            "Failed to load current BBL match. Check /api/bbl/current.";
          throw new Error(msg);
        }

        if (data.ok && data.docId) {
          setDocId(data.docId);
          setMatch(data.match || "");
          setVenue(data.venue || "");
          setStartTime(data.startTime || "");
        } else {
          setDocId("");
          setMatch("");
          setVenue("");
          setStartTime("");
        }
      } catch (e: any) {
        console.error(e);
        setApiError(e?.message || "Failed to load BBL match.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const picksHref = useMemo(() => {
    if (!docId) return "";
    return `/picks?sport=BBL&docId=${encodeURIComponent(docId)}`;
  }, [docId]);

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

  const onPlay = () => {
    if (!docId) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    router.push(picksHref);
  };

  const { date, time } = formatStartDate(startTime);

  return (
    <main className="min-h-screen bg-black text-white relative">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/70 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-14">
          <div>
            {/* Pills */}
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
              Think you know your cricket? Back your gut, ride the hot hand, and
              roast your mates when you&apos;re on a heater. One wrong call and
              your streak is cooked — back to zip.
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

            {/* Main CTA block */}
            <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
              {apiError ? (
                <p className="text-sm text-red-400">{apiError}</p>
              ) : loading ? (
                <p className="text-sm text-white/70">Loading BBL match…</p>
              ) : !docId ? (
                <p className="text-sm text-white/70">
                  No BBL match is selected right now.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onPlay}
                  className="w-full text-left group"
                >
                  {/* Make the whole card clickable */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs text-white/60 mb-1">
                          {date && time ? (
                            <>
                              {date} • {time} AEDT
                            </>
                          ) : (
                            "BBL match"
                          )}
                        </p>
                        <p className="text-base sm:text-lg font-extrabold text-white">
                          {match || "BBL Match"}
                        </p>
                        {venue ? (
                          <p className="text-sm text-white/70 mt-1">{venue}</p>
                        ) : null}
                      </div>

                      <div className="inline-flex items-center justify-center rounded-full bg-[#FF7A00] text-black text-sm font-bold px-5 py-2 shadow-[0_0_24px_rgba(255,122,0,0.7)] group-hover:bg-orange-500 transition">
                        Continue
                      </div>
                    </div>

                    <p className="text-[11px] text-white/45 mt-3">
                      Clean sweep per match — get one wrong and you&apos;re back
                      to zero.
                    </p>
                  </div>
                </button>
              )}

              <p className="text-[11px] text-white/50 mt-3">
                *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No
                gambling. 18+ only. Don&apos;t be a mug — play for fun.
              </p>
            </div>
          </div>

          {/* Right hero card */}
          <div className="relative">
            <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
              <Image
                src="/mcg-hero.jpg"
                alt="Stadium lights"
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
              STREAKr is a free game of skill. No gambling. 18+ only. Prizes
              subject to terms and conditions. Play responsibly.
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

      {/* Auth Modal */}
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
