// /app/play/afl/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, MouseEvent } from "react";
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
  panel: "#0B0D14",
  panel2: "#070911",

  red: "#CE2029",
  redDeep: "#8B0F16",

  white: "#FFFFFF",
};

export default function AflHubPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [games, setGames] = useState<ApiGame[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
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

        setGames(data.games || []);

        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }

        const flat: QuestionRow[] = (data.games || []).flatMap((g) =>
          (g.questions || []).map((q) => {
            const status = normaliseStatus(q.status);
            return {
              id: q.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
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

        setQuestions(openOnly);
      } catch (e) {
        console.error(e);
        setError("Failed to load preview questions.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const previewQuestions = useMemo(() => questions.slice(0, 6), [questions]);
  const featuredGames = useMemo(() => (games || []).slice(0, 2), [games]);

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

  const onClickGoToPicks = (e: MouseEvent) => {
    if (!user) {
      e.preventDefault();
      setShowAuthModal(true);
      return;
    }
  };

  // Shared styles (Torpie look)
  const cardStyle = {
    borderColor: "rgba(255,255,255,0.10)",
    background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
    boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
  } as const;

  const cardHoverBorder = rgbaFromHex(COLORS.red, 0.3);

  const redPillStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.35),
    background: rgbaFromHex(COLORS.red, 0.1),
    color: "rgba(255,255,255,0.92)",
  } as const;

  const subtlePillStyle = {
    borderColor: "rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.78)",
  } as const;

  const primaryCtaStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.6),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.42)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.18
    )})`,
    color: "rgba(255,255,255,0.96)",
    boxShadow: `0 0 26px ${rgbaFromHex(COLORS.red, 0.2)}`,
  } as const;

  const secondaryCtaStyle = {
    borderColor: "rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
  } as const;

  const yesBtnStyle = {
    borderColor: "rgba(255,255,255,0.40)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))",
    color: "rgba(0,0,0,0.92)",
    boxShadow: "0 0 18px rgba(255,255,255,0.10)",
  } as const;

  const noBtnStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.78),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.96)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.92
    )})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
  } as const;

  return (
    <main className="min-h-screen relative text-white" style={{ backgroundColor: COLORS.bg }}>
      <style>{`
        @keyframes torpiePing {
          0% { transform: scale(1); opacity: .55; }
          80% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      {/* ========= PAGE BG ========= */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(circle_at_18%_22%, ${rgbaFromHex(COLORS.red, 0.14)}, transparent 42%),` +
              `radial-gradient(circle_at_78%_24%, ${rgbaFromHex(COLORS.red, 0.10)}, transparent 46%),` +
              "radial-gradient(circle_at_45%_86%, rgba(255,255,255,0.06), transparent 48%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,10,1) 0%, rgba(5,6,10,0.92) 55%, rgba(0,0,0,1) 110%)",
          }}
        />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-10">
        {/* ========= HERO ========= */}
        <section className="relative rounded-3xl overflow-hidden border mb-12" style={cardStyle}>
          <div className="relative w-full h-[360px] sm:h-[420px]">
            <Image src="/afl1.png" alt="AFL hero" fill priority className="object-cover opacity-90" />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            <div className="absolute top-4 left-4">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black border"
                style={{
                  borderColor: "rgba(0,0,0,0.15)",
                  background: "rgba(255,255,255,0.92)",
                  color: "rgba(0,0,0,0.86)",
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS.red }} />
                OFFICIAL PARTNER
              </span>
            </div>

            <div className="absolute bottom-6 left-6 right-6 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold" style={subtlePillStyle}>
                  AFL SEASON 2026
                </span>
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold" style={subtlePillStyle}>
                  ROUND {roundNumber ?? "—"}
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold leading-[0.95] tracking-tight">
                PREDICT.
                <br />
                PLAY.
                <br />
                <span style={{ color: COLORS.red }}>WIN.</span>
              </h1>

              <p className="mt-4 text-white/80 text-sm sm:text-base">
                Live AFL yes/no picks tied to each match. Pick as many as you want. One wrong call in a game and your
                streak is cooked.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={picksHref}
                  onClick={onClickGoToPicks}
                  className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-black border"
                  style={primaryCtaStyle}
                >
                  PLAY NOW
                </Link>

                <Link
                  href="#how-to-play"
                  className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.22)",
                    background: "rgba(255,255,255,0.86)",
                    color: "rgba(0,0,0,0.86)",
                  }}
                >
                  HOW TO PLAY
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========= HOW IT WORKS ========= */}
        <section id="how-to-play" className="mb-10">
          <h2 className="text-sm font-black tracking-wide uppercase text-white/60 mb-5">HOW IT WORKS</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border p-6" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/85 font-black">1. PICK OUTCOMES</span>
              </div>
              <p className="text-sm text-white/65">
                Tap <span className="font-black text-white">YES</span> or{" "}
                <span className="font-black" style={{ color: COLORS.red }}>
                  NO
                </span>{" "}
                on any question. Pick 0, 1, 5 or all 12 — your call.
              </p>
            </div>

            <div className="rounded-2xl border p-6" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/85 font-black">2. PLAY LIVE</span>
              </div>
              <p className="text-sm text-white/65">
                Picks lock at bounce. Live questions drop during the match. Clear a pick any time before lock.
              </p>
            </div>

            <div className="rounded-2xl border p-6" style={cardStyle}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/85 font-black">3. WIN PRIZES</span>
              </div>
              <p className="text-sm text-white/65">
                Clean sweep per match to keep your streak alive. Any wrong pick in that game = back to zero.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* =======================================================================
          ✅ FEATURED MATCHES (FORCED WHITE BAND)
          This is OUTSIDE the dark container and forces white background.
      ======================================================================= */}
      <section
        className="w-full"
        style={{
          backgroundColor: "#FFFFFF",
          color: "#0B0D14",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-[12px] font-black tracking-wide uppercase text-black/60">FEATURED MATCHES</div>
              <div className="text-sm text-black/60 mt-1">
                Tap play now — questions are inside Picks.
              </div>
            </div>
            <Link
              href={picksHref}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  setShowAuthModal(true);
                }
              }}
              className="hidden sm:inline-flex rounded-full px-4 py-2 text-xs font-black border"
              style={{
                borderColor: "rgba(0,0,0,0.14)",
                background: "rgba(0,0,0,0.03)",
                color: "rgba(0,0,0,0.78)",
              }}
            >
              View all →
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {(featuredGames.length ? featuredGames : [null, null]).map((g, i) => {
              if (!g) {
                return (
                  <div
                    key={`sk-${i}`}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: "rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.02)" }}
                  >
                    <div className="h-[170px] bg-black/5" />
                    <div className="p-5">
                      <div className="h-4 w-1/2 bg-black/10 rounded mb-2" />
                      <div className="h-5 w-2/3 bg-black/10 rounded mb-3" />
                      <div className="h-4 w-1/3 bg-black/10 rounded mb-6" />
                      <div className="h-9 w-28 bg-black/10 rounded" />
                    </div>
                  </div>
                );
              }

              const { date, time } = formatStartDate(g.startTime);
              const totalQs = (g.questions || []).length || 12;

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(0,0,0,0.10)",
                    background: "#FFFFFF",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.10)",
                  }}
                >
                  <div className="relative h-[170px]">
                    <Image
                      src="/afl1.png"
                      alt={g.match}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <div className="text-[12px] text-white/80 font-semibold">
                        {date} • {time} AEDT
                      </div>
                      <div className="text-lg font-extrabold text-white">{g.match}</div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="text-sm font-semibold text-black/80">{g.venue}</div>
                    <div className="text-xs text-black/55 mt-1">
                      {totalQs} questions (pick any amount)
                    </div>

                    <div className="mt-4">
                      <Link
                        href={picksHref}
                        onClick={(e) => {
                          if (!user) {
                            e.preventDefault();
                            setShowAuthModal(true);
                          }
                        }}
                        className="inline-flex items-center justify-center rounded-md px-5 py-2 text-xs font-black border"
                        style={{
                          borderColor: rgbaFromHex(COLORS.red, 0.35),
                          background: COLORS.red,
                          color: "#fff",
                          boxShadow: `0 10px 22px ${rgbaFromHex(COLORS.red, 0.18)}`,
                        }}
                      >
                        PLAY NOW
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Back to dark container for the rest */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-12">
        {/* ========= NEXT 6 PICKS PREVIEW ========= */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold">
              NEXT <span style={{ color: COLORS.red }}>PICKS</span>
            </h2>
            <p className="text-sm text-white/65">Tap Yes/No to jump straight into Picks.</p>
          </div>

          {error ? (
            <div
              className="rounded-2xl border px-5 py-4 mb-6"
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

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border px-5 py-4 animate-pulse" style={{ ...cardStyle }}>
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && previewQuestions.length === 0 && !error ? (
            <div className="rounded-2xl border px-6 py-8 text-center" style={{ ...cardStyle }}>
              <p className="text-sm text-white/65 mb-4">
                No open questions right now. Check back closer to bounce.
              </p>
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black border active:scale-[0.99] transition"
                style={primaryCtaStyle}
              >
                Go to picks page anyway
              </Link>
            </div>
          ) : null}

          <div className="space-y-4">
            {previewQuestions.map((q, idx) => {
              const { date, time } = formatStartDate(q.startTime);

              return (
                <div
                  key={q.id}
                  className="relative rounded-2xl border px-5 py-4 transition-all group"
                  style={{
                    ...cardStyle,
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = cardHoverBorder;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.10)";
                  }}
                >
                  <div
                    className="absolute -top-3 -left-3 h-8 w-8 rounded-full border-2 border-black flex items-center justify-center text-white font-black text-sm"
                    style={{
                      background: COLORS.red,
                      boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.18)}`,
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45 mb-2">
                        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 border font-black" style={redPillStyle}>
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
                        <span className="font-semibold text-white/65">
                          {date} • {time} AEDT
                        </span>
                        <span>•</span>
                        <span className="text-white/65">{q.venue}</span>
                      </div>

                      <div className="text-xs sm:text-sm font-black text-white/85 mb-2">{q.match}</div>

                      <div className="text-sm sm:text-base font-semibold text-white/90 group-hover:text-white transition-colors">
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

          {questions.length > 0 ? (
            <div className="mt-8 text-center">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-black border active:scale-[0.99] transition"
                style={secondaryCtaStyle}
              >
                View all {questions.length} open picks →
              </Link>
            </div>
          ) : null}
        </section>

        <footer className="border-t pt-6 mt-4 text-sm" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/45">
            <p>TORPIE is a free game of skill. No gambling. 18+ only. Prizes subject to T&Cs.</p>
            <Link href="/faq" className="hover:underline underline-offset-2" style={{ color: COLORS.red }}>
              FAQ
            </Link>
          </div>
        </footer>
      </div>

      {/* ========= AUTH MODAL ========= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border p-6" style={{ ...cardStyle }}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Log in to play</h2>
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
              You need a free Torpie account to make picks and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
                style={primaryCtaStyle}
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-black border active:scale-[0.99] transition flex-1"
                style={secondaryCtaStyle}
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
