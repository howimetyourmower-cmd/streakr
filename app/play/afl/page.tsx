// /app/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any;
};

type ApiGame = {
  id: string;
  match: string; // e.g. "Sydney vs Carlton"
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

const FIRE_RED = "#CE2029";

function splitMatch(match: string) {
  const raw = (match || "").trim();
  const parts = raw.split(/\s+vs\s+/i);
  if (parts.length >= 2) return { home: parts[0].trim(), away: parts.slice(1).join(" vs ").trim() };
  const dash = raw.split(/\s*-\s*/);
  if (dash.length >= 2) return { home: dash[0].trim(), away: dash.slice(1).join(" - ").trim() };
  return { home: raw || "Home", away: "Away" };
}

function formatStart(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { line: "" };
  const date = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Melbourne",
  });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
  });
  return { line: `${date} • ${time} AEDT` };
}

export default function HomePage() {
  const { user } = useAuth();

  const [games, setGames] = useState<ApiGame[]>([]);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const playHref = "/play/afl";
  const picksHref = "/picks?sport=AFL";
  const encodedReturnTo = encodeURIComponent(playHref);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");
        const data: PicksApiResponse = await res.json();
        setGames(data.games || []);
        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);
      } catch (e) {
        console.error(e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const featured = useMemo(() => (games || []).slice(0, 3), [games]);

  return (
    <main className="min-h-screen bg-[#F3F4F7] text-black">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* White page + dark contained hub card (like your reference) */}
        <div className="rounded-2xl overflow-hidden border border-black/10 bg-[#0B0D14] text-white shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
          {/* TOP MINI BAR (white) */}
          <div className="bg-white border-b border-black/10">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="relative h-10 w-[160px] sm:h-12 sm:w-[190px]">
                  <Image
                    src="/Torpielogo.png"
                    alt="Torpie"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </Link>

              <div className="hidden sm:flex items-center gap-6 text-xs font-extrabold text-black/70">
                <Link href="#how-it-works" className="hover:text-black">
                  HOW IT WORKS
                </Link>
                <Link href="/faq" className="hover:text-black">
                  FAQ
                </Link>
                <Link href="/leaderboards" className="hover:text-black">
                  LEADERBOARD
                </Link>
                {!user ? (
                  <Link
                    href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                    className="rounded-md px-3 py-2 border border-black/15 text-black hover:border-black/30"
                  >
                    LOGIN
                  </Link>
                ) : (
                  <Link
                    href="/profile"
                    className="rounded-md px-3 py-2 border border-black/15 text-black hover:border-black/30"
                  >
                    PROFILE
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* HERO BANNER */}
          <section className="relative">
            <div className="relative h-[220px] sm:h-[260px] w-full">
              <Image
                src="/afl1.png"
                alt="Torpie AFL hero"
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />

              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <div className="text-[11px] font-extrabold tracking-wide text-white/70 mb-2">
                  TORPIE • {roundNumber ? `ROUND ${roundNumber}` : "AFL"}
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold leading-[1] tracking-tight">
                  PREDICT.
                  <br />
                  PLAY. <span style={{ color: FIRE_RED }}>WIN.</span>
                </div>

                <div className="mt-3 text-sm text-white/70 max-w-[520px]">
                  Live AFL yes/no picks tied to each match. Pick as many as you want.
                  One wrong call in a game and your streak is cooked.
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Link
                    href={playHref}
                    onClick={(e) => {
                      if (!user) e.preventDefault();
                    }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-extrabold"
                    style={{ background: FIRE_RED }}
                  >
                    PLAY NOW
                  </Link>

                  <Link
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-extrabold bg-white/10 hover:bg-white/15 border border-white/15"
                  >
                    HOW TO PLAY
                  </Link>

                  {!user ? (
                    <Link
                      href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                      className="text-xs text-white/70 hover:text-white underline underline-offset-2"
                    >
                      Login required to play
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how-it-works" className="px-6 pt-6">
            <div className="text-xs font-extrabold tracking-wide text-white/60 mb-3">
              HOW IT WORKS
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-extrabold">1. PICK OUTCOMES</div>
                <div className="text-xs text-white/70 mt-1">
                  Tap <span className="font-extrabold">YES</span> or{" "}
                  <span className="font-extrabold" style={{ color: FIRE_RED }}>
                    NO
                  </span>{" "}
                  on any question. Pick 0, 1, 5 or all 12.
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-extrabold">2. PLAY LIVE</div>
                <div className="text-xs text-white/70 mt-1">
                  Picks lock at bounce. Live questions drop during the match.
                  Clear a pick any time before lock.
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-extrabold">3. WIN PRIZES</div>
                <div className="text-xs text-white/70 mt-1">
                  Clean sweep per match to keep your streak alive. Any wrong = cooked.
                </div>
              </div>
            </div>
          </section>

          {/* FEATURED MATCHES + LIVE LEADERBOARD */}
          <section className="px-6 py-6">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* FEATURED MATCHES */}
              <div className="lg:col-span-2">
                <div className="text-xs font-extrabold tracking-wide text-white/60 mb-3">
                  FEATURED MATCHES
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {(loading ? [null, null] : featured.length ? featured.slice(0, 2) : [null, null]).map(
                    (g, idx) => {
                      if (!g) {
                        return (
                          <div
                            key={`sk-${idx}`}
                            className="rounded-md border border-white/10 bg-white/5 overflow-hidden"
                          >
                            <div className="h-[110px] bg-white/5" />
                            <div className="p-4">
                              <div className="h-3 w-2/3 bg-white/10 rounded mb-2" />
                              <div className="h-3 w-1/2 bg-white/10 rounded mb-4" />
                              <div className="h-8 w-24 bg-white/10 rounded" />
                            </div>
                          </div>
                        );
                      }

                      const teams = splitMatch(g.match);
                      const { line } = formatStart(g.startTime);
                      const qCount = (g.questions || []).length || 12;

                      return (
                        <div
                          key={g.id}
                          className="rounded-md border border-white/10 bg-white/5 overflow-hidden"
                        >
                          <div className="relative h-[120px]">
                            <Image
                              src="/afl1.png"
                              alt={g.match}
                              fill
                              className="object-cover opacity-90"
                            />
                            <div className="absolute inset-0 bg-black/55" />
                            <div className="absolute left-4 bottom-3 right-4">
                              <div className="text-[11px] text-white/75 font-semibold">
                                {line}
                              </div>
                              <div className="text-sm font-extrabold">
                                {teams.home} <span className="text-white/50">vs</span>{" "}
                                {teams.away}
                              </div>
                            </div>
                          </div>

                          {/* ✅ “bottom section white” (the part under image) */}
                          <div className="p-4 bg-white text-black">
                            <div className="text-xs font-extrabold text-black/80">
                              {g.venue}
                            </div>
                            <div className="text-xs text-black/60 mt-1">
                              {qCount} questions (pick any amount)
                            </div>

                            <div className="mt-3">
                              <Link
                                href={playHref}
                                onClick={(e) => {
                                  if (!user) e.preventDefault();
                                }}
                                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-extrabold text-white"
                                style={{ background: FIRE_RED }}
                              >
                                PLAY NOW
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* LIVE LEADERBOARD (placeholder for now) */}
              <div>
                <div className="text-xs font-extrabold tracking-wide text-white/60 mb-3">
                  LIVE LEADERBOARD
                </div>

                <div className="rounded-md border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-extrabold mb-2">Top streaks</div>
                  <div className="text-xs text-white/70">
                    (Placeholder panel — we’ll wire to your leaderboard data next.)
                  </div>

                  <div className="mt-4 space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-3 py-2"
                      >
                        <div className="text-xs font-extrabold text-white/85">
                          Player {i}
                        </div>
                        <div className="text-xs text-white/60">
                          Streak: {Math.max(1, 8 - i)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Link
                      href="/leaderboards"
                      className="text-xs font-extrabold underline underline-offset-2 text-white/80 hover:text-white"
                    >
                      View full leaderboard →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FOOTER STRIP */}
          <div className="border-t border-white/10 px-6 py-4 text-[11px] text-white/55">
            Torpie is free-to-play. Skill-based. No gambling.
          </div>
        </div>
      </div>
    </main>
  );
}
