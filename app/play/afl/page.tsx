// /app/play/afl/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState, MouseEvent } from "react";
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

const PREVIEW_FOCUS_KEY = "screamr_preview_focus_v1";

/** Helpers */
function normaliseStatus(val: any): QuestionStatus {
  const s = String(val ?? "").toLowerCase().trim();
  if (s === "open") return "open";
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  return "open";
}

function rgbaFromHex(hex: string, alpha: number): string {
  const h = (hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return `rgba(255,255,255,${alpha})`;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return `rgba(${r},${g},${b},${a})`;
}

function formatStartLine(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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
  return `${date} • ${time} AEDT`;
}

function msToCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** ✅ SCREAMR palette: Black / Red / White */
const COLORS = {
  bg: "#06070B",
  panel: "#0A0B10",
  panel2: "#07080D",
  red: "#FF2E4D",
  redDeep: "#B10F2A",
  white: "#FFFFFF",
};

export default function AflHubPage() {
  const { user } = useAuth();
  const router = useRouter();
  const howRef = useRef<HTMLDivElement | null>(null);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [openQuestions, setOpenQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAuthModal, setShowAuthModal] = useState(false);

  const picksHref = "/picks?sport=AFL";
  const encodedReturnTo = encodeURIComponent(picksHref);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        setLoading(true);

        const res = await fetch("/api/picks?sport=AFL", { cache: "no-store" });
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        const g = Array.isArray(data.games) ? data.games : [];
        setGames(g);

        const flat: QuestionRow[] = g.flatMap((game) =>
          (game.questions || []).map((q) => {
            const status = normaliseStatus(q.status);
            return {
              id: q.id,
              match: game.match,
              venue: game.venue,
              startTime: game.startTime,
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

        setOpenQuestions(openOnly);
      } catch (e) {
        console.error(e);
        setError("Failed to load matches.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const featuredMatches = useMemo(() => {
    const now = Date.now();
    const sorted = [...games].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const upcoming = sorted.filter(
      (g) => new Date(g.startTime).getTime() >= now - 1000 * 60 * 60
    );
    return (upcoming.length ? upcoming : sorted).slice(0, 3);
  }, [games]);

  const nextUp = useMemo(() => {
    const sorted = [...games].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const upcoming = sorted.filter((g) => new Date(g.startTime).getTime() > nowMs);
    return upcoming[0] || sorted[0] || null;
  }, [games, nowMs]);

  const nextUpLockMs = useMemo(() => {
    if (!nextUp) return null;
    return new Date(nextUp.startTime).getTime() - nowMs;
  }, [nextUp, nowMs]);

  const isNextUpLive = nextUpLockMs !== null ? nextUpLockMs <= 0 : false;

  const previewQuestions = useMemo(() => openQuestions.slice(0, 6), [openQuestions]);

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

  const requireAuthForPicks = (e: MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
    }
  };

  const scrollToHow = () => {
    const el = howRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Shared styles
  const darkCardStyle = {
    borderColor: "rgba(255,255,255,0.10)",
    background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
    boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
  } as const;

  const glassCardStyle = {
    borderColor: "rgba(255,255,255,0.10)",
    background: "rgba(10,10,14,0.62)",
    boxShadow: "0 22px 80px rgba(0,0,0,0.65)",
    backdropFilter: "blur(10px)",
  } as const;

  const primaryBtn = {
    borderColor: rgbaFromHex(COLORS.red, 0.55),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.98)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.95
    )})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 28px ${rgbaFromHex(COLORS.red, 0.18)}`,
  } as const;

  const yesBtnStyle = {
    borderColor: "rgba(255,255,255,0.35)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))",
    color: "rgba(0,0,0,0.92)",
    boxShadow: "0 0 18px rgba(255,255,255,0.10)",
  } as const;

  const noBtnStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.75),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.98)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.92
    )})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
  } as const;

  const TinyBolt = ({ live }: { live?: boolean }) => {
    return (
      <span className="relative inline-flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full rounded-full"
          style={{
            background: live ? rgbaFromHex(COLORS.red, 0.55) : "rgba(255,255,255,0.35)",
            animation: live ? "screamrPing 1.55s cubic-bezier(0,0,0.2,1) infinite" : "none",
          }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{
            background: live ? rgbaFromHex(COLORS.red, 0.95) : "rgba(255,255,255,0.55)",
            boxShadow: live ? `0 0 12px ${rgbaFromHex(COLORS.red, 0.35)}` : "none",
          }}
        />
      </span>
    );
  };

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <style>{`
        @keyframes screamrPing {
          0% { transform: scale(1); opacity: .55; }
          80% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes floaty {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      {/* ======= HERO ======= */}
      <section className="relative overflow-hidden">
        <div className="relative w-full h-[560px] sm:h-[640px]">
          {/* ✅ Use your SCREAMR desktop background (save as /public/screamr/hero-bg.jpg) */}
          <Image
            src="/screamr/hero-bg.png"
            alt="SCREAMR AFL hero"
            fill
            priority
            className="object-cover object-center"
          />

          {/* cinematic overlays */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 360px at 20% 12%, rgba(255,46,77,0.26) 0%, rgba(0,0,0,0.00) 65%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

          {/* subtle grain */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E\")",
              mixBlendMode: "overlay",
              opacity: 0.16,
            }}
          />
        </div>

        <div className="absolute inset-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center">
            <div className="max-w-2xl">
              {/* top chip row */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 border text-[11px] font-black"
                  style={{
                    borderColor: rgbaFromHex(COLORS.red, 0.40),
                    background: rgbaFromHex(COLORS.red, 0.12),
                    color: "rgba(255,255,255,0.92)",
                    boxShadow: `0 0 20px ${rgbaFromHex(COLORS.red, 0.14)}`,
                  }}
                >
                  <TinyBolt live />
                  LIVE AFL PICKS
                </span>

                {nextUp ? (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 border text-[11px] font-black"
                    style={{
                      borderColor: "rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.90)",
                    }}
                    title={nextUp.match}
                  >
                    <span className="text-white/55">NEXT:</span>{" "}
                    <span className="truncate max-w-[220px] sm:max-w-[360px]">{nextUp.match}</span>
                    <span className="text-white/35">•</span>
                    <span className="text-white/70">
                      {nextUpLockMs === null
                        ? ""
                        : isNextUpLive
                        ? "LIVE"
                        : `Locks in ${msToCountdown(nextUpLockMs)}`}
                    </span>
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-[44px] sm:text-[66px] font-extrabold leading-[0.98] tracking-tight">
                <span className="block">SCREAMR.</span>
                <span className="block">CALL IT.</span>
                <span className="block">KEEP IT.</span>
                <span className="block" style={{ color: COLORS.red, textShadow: `0 10px 36px ${rgbaFromHex(COLORS.red, 0.22)}` }}>
                  WIN IT.
                </span>
              </h1>

              <p className="mt-4 text-sm sm:text-base text-white/78 max-w-xl leading-relaxed">
                That’s a <span className="font-black text-white">SCREAMR</span>.
                Pick live yes/no AFL matches outcomes. build your streak. One wrong in a game
                and your streak is cooked.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={primaryBtn}
                >
                  PLAY NOW
                </Link>

                <button
                  type="button"
                  onClick={scrollToHow}
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={{
                    borderColor: "rgba(255,255,255,0.20)",
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  HOW IT WORKS
                </button>
              </div>

              {/* hero micro cards */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { k: "Pick any amount", v: "0 to 12 questions" },
                  { k: "Auto-lock", v: "locks at bounce" },
                  { k: "Clean Sweep", v: "any wrong = reset" },
                ].map((it) => (
                  <div
                    key={it.k}
                    className="rounded-2xl border px-4 py-3"
                    style={glassCardStyle}
                  >
                    <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">{it.k}</div>
                    <div className="mt-1 text-[13px] font-black text-white/90">{it.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* right side logo / badge */}
            <div className="hidden lg:flex flex-1 justify-end">
              <div
                className="rounded-3xl border p-5"
                style={{
                  ...glassCardStyle,
                  width: 360,
                  animation: "floaty 4.2s ease-in-out infinite",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">Today’s vibe</div>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 border text-[11px] font-black"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.40),
                      background: rgbaFromHex(COLORS.red, 0.12),
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    <TinyBolt live />
                    SCREAMR MODE
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-14 w-14 rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)" }}>
                    <Image src="/screamr/screamr-logo.png" alt="SCREAMR" fill className="object-contain p-2" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-black text-white">Hit a SCREAMR</div>
                    <div className="text-[12px] text-white/65 font-semibold truncate">
                      Make calls live • Climb the leaderboard
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.22)" }}>
                  <div className="text-[12px] font-black text-white/90">Pro tip</div>
                  <div className="mt-1 text-[12px] text-white/70 leading-relaxed">
                    Go small early, then scale up when you’re confident. Your streak only cares about being perfect.
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={picksHref}
                    onClick={requireAuthForPicks}
                    className="flex-1 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[12px] font-black border"
                    style={primaryBtn}
                  >
                    GO PICK
                  </Link>
                  <Link
                    href="/leaderboards"
                    className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[12px] font-black border"
                    style={{
                      borderColor: "rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.92)",
                      textDecoration: "none",
                    }}
                  >
                    LEADERS
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#0A0A0F]" />
      </section>

      {/* ======= CONTENT ======= */}
      <section style={{ background: "#0A0A0F" }}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {/* HOW IT WORKS */}
          <div ref={howRef} className="mb-10">
            <div className="text-[12px] font-black text-white/75 mb-4">HOW IT WORKS</div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="text-sm font-black mb-2">1) PICK YES / NO</div>
                <p className="text-sm text-white/65 leading-relaxed">
                  Tap <span className="font-black text-white/85">YES</span> or{" "}
                  <span className="font-black" style={{ color: COLORS.red }}>
                    NO
                  </span>{" "}
                  on any question. Pick 0, 1, 5 or all 12 — your call.
                </p>
              </div>

              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="text-sm font-black mb-2">2) LOCKS AT BOUNCE</div>
                <p className="text-sm text-white/65 leading-relaxed">
                  No lock-in button. Picks auto-lock at the game start time. Questions drop live during the match.
                </p>
              </div>

              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="text-sm font-black mb-2">3) CLEAN SWEEP</div>
                <p className="text-sm text-white/65 leading-relaxed">
                  Your streak is per game. Any wrong pick in that match = reset to 0. Voids don’t count.
                </p>
              </div>
            </div>
          </div>

          {/* NEXT FEATURED MATCHES */}
          <div className="mb-10">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div className="text-[12px] font-black text-white/75">NEXT FEATURED MATCHES</div>
              <Link
                href={picksHref}
                onClick={requireAuthForPicks}
                className="text-[12px] font-black hover:underline underline-offset-2"
                style={{ color: COLORS.red }}
              >
                GO TO PICKS →
              </Link>
            </div>

            {loading ? (
              <div className="grid md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl border overflow-hidden" style={darkCardStyle}>
                    <div className="h-32 bg-white/5 animate-pulse" />
                    <div className="p-5">
                      <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
                      <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse mb-4" />
                      <div className="h-10 w-32 bg-white/10 rounded-2xl animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredMatches.length ? (
              <div className="grid md:grid-cols-3 gap-4">
                {featuredMatches.map((g) => {
                  const line = formatStartLine(g.startTime);
                  const qCount = Array.isArray(g.questions) ? g.questions.length : 0;
                  const lockMs = new Date(g.startTime).getTime() - nowMs;
                  const live = lockMs <= 0;

                  return (
                    <div
                      key={g.id}
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        borderColor: "rgba(255,255,255,0.10)",
                        boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
                        background: "rgba(0,0,0,0.18)",
                      }}
                    >
                      <div className="relative h-36">
                        <Image
                          src="/screamr/hero-bg.png"
                          alt="Match hero"
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-black/62" />
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              "radial-gradient(700px 220px at 20% 0%, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.00) 60%)",
                          }}
                        />
                        <div className="absolute left-4 right-4 bottom-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-white/75 font-semibold">{line}</div>
                            <span
                              className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border text-[10px] font-black"
                              style={{
                                borderColor: live ? rgbaFromHex(COLORS.red, 0.55) : "rgba(255,255,255,0.16)",
                                background: live ? rgbaFromHex(COLORS.red, 0.14) : "rgba(255,255,255,0.06)",
                                color: "rgba(255,255,255,0.92)",
                              }}
                            >
                              <TinyBolt live={live} />
                              {live ? "LIVE" : `LOCKS ${msToCountdown(lockMs)}`}
                            </span>
                          </div>
                          <div className="text-sm font-black text-white/95 mt-1">{g.match}</div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="text-sm font-extrabold text-white/90">{g.venue}</div>
                        <div className="text-[12px] text-white/55 mt-1">{qCount} questions • pick any amount</div>

                        <div className="mt-4">
                          <Link
                            href={picksHref}
                            onClick={requireAuthForPicks}
                            className="inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-[12px] font-black border"
                            style={primaryBtn}
                          >
                            PLAY THIS MATCH
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="text-sm text-white/70 mb-3">No matches loaded yet.</div>
                <div className="text-[12px] text-white/55">
                  Once rounds are seeded, featured matches show here automatically.
                </div>
              </div>
            )}
          </div>

          {/* PICKS AVAILABLE RIGHT NOW */}
          <div className="mb-2">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <div className="text-[12px] font-black text-white/75">PICKS AVAILABLE RIGHT NOW</div>
                <div className="text-sm text-white/70">
                  Tap Yes/No to jump into Picks. (We’ll focus that question for you.)
                </div>
              </div>

              <Link
                href={picksHref}
                onClick={requireAuthForPicks}
                className="text-[12px] font-black hover:underline underline-offset-2"
                style={{ color: COLORS.red }}
              >
                VIEW ALL OPEN →
              </Link>
            </div>

            {error ? (
              <div
                className="rounded-2xl border px-5 py-4 mb-4"
                style={{
                  borderColor: rgbaFromHex(COLORS.red, 0.30),
                  background: rgbaFromHex(COLORS.red, 0.10),
                }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {error}
                </p>
              </div>
            ) : null}

            {!loading && previewQuestions.length === 0 && !error ? (
              <div className="rounded-2xl border px-6 py-6 text-center" style={darkCardStyle}>
                <p className="text-sm text-white/65 mb-4">
                  No open questions right now. Check back closer to bounce.
                </p>
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={primaryBtn}
                >
                  GO TO PICKS ANYWAY
                </Link>
              </div>
            ) : null}

            <div className="space-y-3">
              {loading
                ? [1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl border px-5 py-4 animate-pulse" style={darkCardStyle}>
                      <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  ))
                : previewQuestions.map((q) => (
                    <div key={q.id} className="rounded-2xl border px-5 py-4" style={darkCardStyle}>
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55 mb-2">
                            <span
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1 border font-black"
                              style={{
                                borderColor: rgbaFromHex(COLORS.red, 0.35),
                                background: rgbaFromHex(COLORS.red, 0.08),
                                color: "rgba(255,255,255,0.92)",
                              }}
                            >
                              <TinyBolt live />
                              Q{q.quarter}
                            </span>

                            <span className="text-white/35">•</span>
                            <span className="font-semibold text-white/70">{formatStartLine(q.startTime)}</span>
                            <span className="text-white/35">•</span>
                            <span className="text-white/70">{q.venue}</span>
                          </div>

                          <div className="text-xs sm:text-sm font-black text-white/85 mb-2">{q.match}</div>
                          <div className="text-sm sm:text-base font-semibold text-white/90">{q.question}</div>
                        </div>

                        <div className="flex items-center gap-3 lg:ml-6 shrink-0">
                          <button
                            type="button"
                            onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                            className="rounded-2xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] transition"
                            style={yesBtnStyle}
                          >
                            YES
                          </button>

                          <button
                            type="button"
                            onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                            className="rounded-2xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] transition"
                            style={noBtnStyle}
                          >
                            NO
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>

            {!loading && openQuestions.length > 0 ? (
              <div className="mt-6 text-center">
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={{
                    borderColor: "rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  VIEW ALL {openQuestions.length} OPEN PICKS →
                </Link>
              </div>
            ) : null}
          </div>

          {/* FOOTER */}
          <footer className="mt-12 border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/45">
              <p>SCREAMR is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions.</p>
              <div className="flex items-center gap-4">
                <Link href="/terms" className="hover:underline underline-offset-2">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:underline underline-offset-2">
                  Privacy
                </Link>
                <Link href="/faq" className="hover:underline underline-offset-2" style={{ color: COLORS.red }}>
                  FAQ
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </section>

      {/* ========= AUTH MODAL ========= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl border p-6" style={darkCardStyle}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Log in to play AFL</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm transition-colors hover:text-white"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-white/65 mb-4">
              You need a free SCREAMR account to make picks, build your streak and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
                style={primaryBtn}
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
                style={{
                  borderColor: "rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
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
