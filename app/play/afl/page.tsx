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

const PREVIEW_FOCUS_KEY = "torpy_preview_focus_v1";

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

/** ✅ TORPIE palette: Black / Fire Engine Red / White */
const COLORS = {
  bg: "#05060A",
  darkPanel: "#0B0D14",
  darkPanel2: "#070911",

  // Fire engine red
  red: "#CE2029",
  redDeep: "#8B0F16",

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
  const [roundNumber, setRoundNumber] = useState<number | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);

  const picksHref = "/picks?sport=AFL";
  const encodedReturnTo = encodeURIComponent(picksHref);

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

        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);

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
    const sorted = [...games].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const upcoming = sorted.filter((g) => new Date(g.startTime).getTime() >= now - 1000 * 60 * 60);
    const list = (upcoming.length ? upcoming : sorted).slice(0, 2);
    return list;
  }, [games]);

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

  const darkCardStyle = {
    borderColor: "rgba(255,255,255,0.10)",
    background: `linear-gradient(180deg, ${COLORS.darkPanel} 0%, ${COLORS.darkPanel2} 100%)`,
    boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
  } as const;

  const primaryBtn = {
    borderColor: rgbaFromHex(COLORS.red, 0.65),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.98)}, ${rgbaFromHex(COLORS.redDeep, 0.96)})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 22px ${rgbaFromHex(COLORS.red, 0.18)}`,
  } as const;

  const secondaryBtn = {
    borderColor: "rgba(255,255,255,0.85)",
    background: "rgba(255,255,255,0.96)",
    color: "rgba(0,0,0,0.88)",
    boxShadow: "0 10px 22px rgba(0,0,0,0.16)",
  } as const;

  const yesBtnStyle = {
    borderColor: "rgba(255,255,255,0.40)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))",
    color: "rgba(0,0,0,0.92)",
    boxShadow: "0 0 18px rgba(255,255,255,0.10)",
  } as const;

  const noBtnStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.78),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.96)}, ${rgbaFromHex(COLORS.redDeep, 0.92)})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
  } as const;

  return (
    <main className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {/* IMPORTANT: CSS MUST BE A TEMPLATE STRING (BACKTICKS) */}
      <style>{`
        @keyframes torpiePing {
          0% { transform: scale(1); opacity: .55; }
          80% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* ======= HERO (NO NAVBAR) ======= */}
      <section className="relative">
        <div className="relative w-full h-[420px] sm:h-[500px]">
          <Image src="/afl1.png" alt="AFL action" fill className="object-cover object-top" priority />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        </div>

        <div className="absolute inset-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center">
            <div className="max-w-2xl">
              <div className="mb-4">
                <div className="text-[13px] sm:text-sm font-black tracking-tight text-white">TORPIE</div>
                <div className="text-[11px] sm:text-[12px] font-semibold text-white/70">AFL predictions • free</div>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.02] tracking-tight">
                <span className="block">PREDICT.</span>
                <span className="block">PLAY.</span>
                <span className="block" style={{ color: COLORS.red }}>
                  WIN.
                </span>
              </h1>

              <p className="mt-4 text-sm sm:text-base text-white/75 max-w-xl">
                Live AFL yes/no picks tied to each match. Pick as many as you want. One wrong call in a game and your streak is
                cooked.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={primaryBtn}
                >
                  PLAY NOW
                </Link>

                <button
                  type="button"
                  onClick={scrollToHow}
                  className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-black border transition active:scale-[0.99]"
                  style={secondaryBtn}
                >
                  HOW TO PLAY
                </button>
              </div>

              <div className="mt-4 text-[11px] text-white/50">
                Round {roundNumber ?? "—"} • Free-to-play • Skill • Bragging rights
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======= DARK CONTENT AREA ======= */}
      <section className="bg-[#171A22]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {/* HOW IT WORKS */}
          <div ref={howRef} className="mb-10">
            <div className="text-[12px] font-black text-white/75 mb-4">HOW IT WORKS</div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.4),
                      background: rgbaFromHex(COLORS.red, 0.12),
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" style={{ color: "rgba(255,255,255,0.92)" }}>
                      <path
                        d="M7 12.5l2.3 2.3L17 7.1"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M20 12a8 8 0 1 1-2.2-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-black">1. PICK OUTCOMES</div>
                </div>
                <p className="text-sm text-white/65 leading-relaxed">
                  Tap <span className="font-black text-white/85">YES</span> or{" "}
                  <span className="font-black" style={{ color: COLORS.red }}>
                    NO
                  </span>{" "}
                  on any question. Pick 0, 1, 5 or all 12 — your call.
                </p>
              </div>

              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.4),
                      background: rgbaFromHex(COLORS.red, 0.12),
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" style={{ color: "rgba(255,255,255,0.92)" }}>
                      <path
                        d="M12 6v6l4 2"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M21 12a9 9 0 1 1-3.2-6.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-black">2. PLAY LIVE</div>
                </div>
                <p className="text-sm text-white/65 leading-relaxed">
                  Picks lock at bounce. Live questions drop during the match. Clear a pick any time before lock.
                </p>
              </div>

              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center border"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.4),
                      background: rgbaFromHex(COLORS.red, 0.12),
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" style={{ color: "rgba(255,255,255,0.92)" }}>
                      <path
                        d="M8 21h8M12 17v4"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 4h10l-1 9a4 4 0 0 1-8 0L7 4Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="text-sm font-black">3. WIN PRIZES</div>
                </div>
                <p className="text-sm text-white/65 leading-relaxed">
                  Longest streak wins the round. Beat your mates. Talk big.{" "}
                  <span className="font-black" style={{ color: COLORS.red }}>
                    One wrong
                  </span>{" "}
                  in a game resets you to zero.
                </p>
              </div>
            </div>
          </div>

          {/* FEATURED MATCHES + LIVE LEADERBOARD */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="text-[12px] font-black text-white/75 mb-4">FEATURED MATCHES</div>

              {loading ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-2xl border overflow-hidden" style={darkCardStyle}>
                      <div className="h-24 bg-white/5 animate-pulse" />
                      <div className="p-5">
                        <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse mb-2" />
                        <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                        <div className="mt-4 h-9 w-28 bg-white/10 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : featuredMatches.length ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {featuredMatches.map((g) => {
                    const { date, time } = formatStartDate(g.startTime);
                    return (
                      <div key={g.id} className="rounded-2xl border overflow-hidden" style={darkCardStyle}>
                        <div className="relative h-28">
                          <Image
                            src="/afl1.png"
                            alt="Match hero"
                            fill
                            className="object-cover opacity-70"
                            sizes="(max-width: 640px) 100vw, 50vw"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                          <div className="absolute left-4 bottom-3 right-4">
                            <div className="text-xs text-white/70">
                              {date} • {time} AEDT
                            </div>
                            <div className="text-sm font-black text-white/90">{g.match}</div>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="text-sm text-white/70 mb-1">{g.venue}</div>
                          <div className="text-[11px] text-white/50 mb-4">
                            {Array.isArray(g.questions) ? g.questions.length : 0} questions (pick any amount)
                          </div>

                          <Link
                            href={picksHref}
                            onClick={requireAuthForPicks}
                            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                            style={primaryBtn}
                          >
                            PLAY NOW
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border p-5" style={darkCardStyle}>
                  <div className="text-sm text-white/70 mb-3">No matches loaded yet.</div>
                  <div className="text-[12px] text-white/55">Once rounds are seeded, featured matches show here automatically.</div>
                </div>
              )}
            </div>

            <div>
              <div className="text-[12px] font-black text-white/75 mb-4">LIVE LEADERBOARD</div>

              <div className="rounded-2xl border p-5" style={darkCardStyle}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="text-sm font-black text-white/90">Top Torpies</div>
                  <Link
                    href="/leaderboards"
                    className="text-[11px] font-black hover:underline underline-offset-2"
                    style={{ color: COLORS.red }}
                  >
                    VIEW ALL
                  </Link>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">1. TessieMoonKing</span>
                    <span className="font-black text-white/90">Streak 12</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">2. TorpieMaster</span>
                    <span className="font-black text-white/90">Streak 10</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-white/70">3. BigSledger</span>
                    <span className="font-black text-white/90">Streak 9</span>
                  </div>

                  <div
                    className="mt-4 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.25),
                      background: rgbaFromHex(COLORS.red, 0.08),
                    }}
                  >
                    <div className="text-[12px] font-black text-white/90 mb-1">Locker Rooms</div>
                    <div className="text-[12px] text-white/65">Private comps with your mates. Ladder = current streak only.</div>
                  </div>

                  <Link
                    href="/locker-rooms"
                    className="mt-3 inline-flex items-center justify-center w-full rounded-md px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                    style={{
                      borderColor: "rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    GO TO LOCKER ROOMS
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* NEXT PICKS */}
          <div className="mt-10">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <div className="text-[12px] font-black text-white/75">NEXT PICKS</div>
                <div className="text-sm text-white/70">Tap Yes/No to jump straight into Picks.</div>
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
                  borderColor: rgbaFromHex(COLORS.red, 0.3),
                  background: rgbaFromHex(COLORS.red, 0.1),
                }}
              >
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {error}
                </p>
              </div>
            ) : null}

            {!loading && previewQuestions.length === 0 && !error ? (
              <div className="rounded-2xl border px-6 py-6 text-center" style={darkCardStyle}>
                <p className="text-sm text-white/65 mb-4">No open questions right now. Check back closer to bounce.</p>
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-black border transition active:scale-[0.99]"
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
                : previewQuestions.map((q) => {
                    const { date, time } = formatStartDate(q.startTime);

                    return (
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
                                <span className="relative flex h-2 w-2">
                                  <span
                                    className="absolute inline-flex h-full w-full rounded-full"
                                    style={{
                                      background: rgbaFromHex(COLORS.red, 0.85),
                                      animation: "torpiePing 1.6s cubic-bezier(0,0,0.2,1) infinite",
                                    }}
                                  />
                                  <span
                                    className="relative inline-flex h-2 w-2 rounded-full"
                                    style={{ background: rgbaFromHex(COLORS.red, 0.95) }}
                                  />
                                </span>
                                Q{q.quarter}
                              </span>

                              <span>•</span>
                              <span className="font-semibold text-white/70">
                                {date} • {time} AEDT
                              </span>
                              <span>•</span>
                              <span className="text-white/70">{q.venue}</span>
                            </div>

                            <div className="text-xs sm:text-sm font-black text-white/85 mb-2">{q.match}</div>

                            <div className="text-sm sm:text-base font-semibold text-white/90">
                              <span style={{ color: "rgba(255,255,255,0.92)" }}>{q.question}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 lg:ml-6 shrink-0">
                            <button
                              type="button"
                              onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                              className="rounded-xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] transition"
                              style={yesBtnStyle}
                            >
                              YES
                            </button>

                            <button
                              type="button"
                              onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                              className="rounded-xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] transition"
                              style={noBtnStyle}
                            >
                              NO
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>

            {!loading && openQuestions.length > 0 ? (
              <div className="mt-6 text-center">
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-black border transition active:scale-[0.99]"
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
              <p>TORPIE is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions.</p>
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
          <div className="w-full max-w-sm rounded-2xl border p-6" style={darkCardStyle}>
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
              You need a free TORPIE account to make picks, build your streak and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
                style={primaryBtn}
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
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
