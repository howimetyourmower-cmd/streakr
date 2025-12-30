// /app/play/afl/page.tsx
"use client";

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

/** ✅ TORPY palette: Black / Fire Engine Red / White */
const COLORS = {
  bg: "#05060A",
  panel: "#0B0D14",
  panel2: "#070911",

  // Fire engine red
  red: "#CE2029",
  redDeep: "#8B0F16",

  white: "#FFFFFF",
};

export default function AflHubPage() {
  const { user } = useAuth();
  const router = useRouter();

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

  // Shared styles (TORPY look)
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

  const redBadgeStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.55),
    background: rgbaFromHex(COLORS.red, 0.14),
    color: "rgba(255,255,255,0.96)",
    boxShadow: `0 0 26px ${rgbaFromHex(COLORS.red, 0.16)}`,
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

  // Black / Red / White buttons
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
        @keyframes torpyPing {
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

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-white/65 hover:text-white">
            ← Back to sports
          </Link>
        </div>

        {/* ========= AFL BANNER ========= */}
        <div
          className="mb-8 rounded-3xl border px-5 py-4 transition-colors"
          style={{
            ...cardStyle,
            borderColor: "rgba(255,255,255,0.10)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div
                className="relative h-14 w-14 rounded-2xl border flex items-center justify-center"
                style={{
                  borderColor: rgbaFromHex(COLORS.red, 0.4),
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: `0 0 26px ${rgbaFromHex(COLORS.red, 0.16)}`,
                }}
              >
                <svg viewBox="0 0 120 80" className="h-10 w-10" fill="none" style={{ color: COLORS.white }}>
                  <ellipse cx="60" cy="40" rx="46" ry="30" stroke="currentColor" strokeWidth="6" />
                  <path
                    d="M40 27c8 6 32 6 40 0M40 53c8-6 32-6 40 0"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path d="M60 18v44" stroke="currentColor" strokeWidth="4" opacity="0.6" />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-black tracking-wide uppercase border"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.65),
                      background: rgbaFromHex(COLORS.red, 0.16),
                      color: "rgba(255,255,255,0.95)",
                      boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
                    }}
                  >
                    YOU&apos;RE IN AFL
                  </span>

                  <span
                    className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase border"
                    style={subtlePillStyle}
                  >
                    AFL SEASON 2026
                  </span>

                  <span
                    className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase border"
                    style={subtlePillStyle}
                  >
                    ROUND {roundNumber ?? "—"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/65">
                  Know your stats. Make your pick. One wrong call and your streak is cooked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========= MAIN HERO ========= */}
        <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-16">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
              <span className="block text-sm sm:text-base font-semibold text-white/45 mb-2">
                Footy. Banter. Bragging rights.
              </span>

              <span
                style={{
                  color: COLORS.white,
                  textShadow: "0 0 18px rgba(255,255,255,0.20)",
                }}
              >
                AFL TORPY
              </span>

              <span className="block mt-2" style={{ color: COLORS.red }}>
                How far can you kick it?
              </span>
            </h1>

            <p className="text-base sm:text-lg text-white/65 max-w-xl mb-6">
              Think you know your AFL? Prove it or pipe down. Back your gut, ride the hot hand, and roast
              your mates when you&apos;re on a run. One wrong call and your streak is cooked — back to zip.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3 mb-6">
              <div className="rounded-full px-4 py-1.5 border" style={redBadgeStyle}>
                <span className="text-sm font-semibold">Up to $1,000 in prizes every round*</span>
              </div>
              <span className="hidden sm:inline text-[11px] text-white/45">
                Free to play • 18+ • No gambling • Just bragging rights
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href={picksHref}
                onClick={onClickGoToPicks}
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm sm:text-base font-black border active:scale-[0.99] transition"
                style={primaryCtaStyle}
              >
                Make your first pick
              </Link>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm sm:text-base font-black border active:scale-[0.99] transition"
                style={secondaryCtaStyle}
              >
                Check leaderboards
              </Link>
            </div>

            <p className="text-[11px] text-white/45">
              *Prizes subject to T&amp;Cs. TORPY is a free game of skill. No gambling. 18+ only. Don&apos;t be
              a mug — play for fun.
            </p>
          </div>

          <div className="relative">
            <div
              className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border transition-colors"
              style={{
                ...cardStyle,
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <Image
                src="/mcg-hero.jpg"
                alt="Night footy at the G"
                fill
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

              <div className="absolute top-4 right-4">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black border"
                  style={{
                    borderColor: rgbaFromHex(COLORS.red, 0.6),
                    background: "rgba(0,0,0,0.62)",
                    color: "rgba(255,255,255,0.94)",
                    boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS.red }} />
                  AFL MODE
                </span>
              </div>

              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-[11px] font-semibold" style={subtlePillStyle}>
                  Live AFL player-stat picks
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] text-white/45 mb-1">Group chats. Pub banter. Office comps.</p>
                  <p className="text-sm font-semibold text-white/90">
                    One streak. Battle your mates. Endless sledging.
                  </p>
                </div>
                <div className="rounded-full text-xs font-black px-3 py-1 whitespace-nowrap border" style={primaryCtaStyle}>
                  Start playing now
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========= HOW TO PLAY ========= */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              How to play{" "}
              <span
                style={{
                  color: COLORS.red,
                  textShadow: `0 0 14px ${rgbaFromHex(COLORS.red, 0.25)}`,
                }}
              >
                TORPY
              </span>
            </h2>
            <p className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
              Three simple steps. Fast picks. Big sweat. One wrong call and you&apos;re cooked.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 mb-6">
            <div className="relative rounded-3xl border p-6 transition-all group" style={{ ...cardStyle, borderColor: "rgba(255,255,255,0.10)" }}>
              <div
                className="absolute top-4 left-4 h-10 w-10 rounded-full flex items-center justify-center text-white font-black text-lg border"
                style={{
                  borderColor: rgbaFromHex(COLORS.red, 0.65),
                  background: rgbaFromHex(COLORS.red, 0.95),
                  boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.18)}`,
                }}
              >
                1
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:opacity-95 transition-colors">
                  Pick Yes / No
                </h3>
                <p className="text-sm text-white/65 leading-relaxed mb-4">
                  Live AFL player-stat questions drop each quarter. Back your read.
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border"
                    style={{
                      borderColor: "rgba(255,255,255,0.35)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.95)",
                    }}
                  >
                    YES
                  </span>
                  <span className="text-white/45">or</span>
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border"
                    style={{
                      borderColor: rgbaFromHex(COLORS.red, 0.55),
                      background: rgbaFromHex(COLORS.red, 0.12),
                      color: "rgba(255,255,255,0.95)",
                    }}
                  >
                    NO
                  </span>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border p-6 transition-all group" style={{ ...cardStyle, borderColor: "rgba(255,255,255,0.10)" }}>
              <div
                className="absolute top-4 left-4 h-10 w-10 rounded-full flex items-center justify-center text-white font-black text-lg border"
                style={{
                  borderColor: rgbaFromHex(COLORS.red, 0.65),
                  background: rgbaFromHex(COLORS.red, 0.95),
                  boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.18)}`,
                }}
              >
                2
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:opacity-95 transition-colors">
                  Clean sweep per match
                </h3>
                <p className="text-sm text-white/65 leading-relaxed mb-4">
                  To carry your streak forward, you need a{" "}
                  <span style={{ color: COLORS.red }} className="font-semibold">
                    clean sweep
                  </span>{" "}
                  in that match. Any wrong pick resets you to{" "}
                  <span className="font-black" style={{ color: COLORS.red }}>
                    0
                  </span>
                  .
                </p>
                <div
                  className="rounded-lg px-3 py-2 border"
                  style={{
                    borderColor: rgbaFromHex(COLORS.red, 0.3),
                    background: rgbaFromHex(COLORS.red, 0.1),
                  }}
                >
                  <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>
                    ⚠️ One wrong = back to zero
                  </p>
                </div>
              </div>
            </div>

            <div className="relative rounded-3xl border p-6 transition-all group" style={{ ...cardStyle, borderColor: "rgba(255,255,255,0.10)" }}>
              <div
                className="absolute top-4 left-4 h-10 w-10 rounded-full flex items-center justify-center text-white font-black text-lg border"
                style={{
                  borderColor: rgbaFromHex(COLORS.red, 0.65),
                  background: rgbaFromHex(COLORS.red, 0.95),
                  boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.18)}`,
                }}
              >
                3
              </div>
              <div className="mt-16">
                <h3 className="text-lg font-extrabold mb-3 text-white group-hover:opacity-95 transition-colors">
                  Climb the leaderboard
                </h3>
                <p className="text-sm text-white/65 leading-relaxed mb-4">
                  Longest streak wins the round. Beat your mates, win prizes, talk big.
                </p>
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border"
                  style={{
                    borderColor: rgbaFromHex(COLORS.red, 0.35),
                    background: rgbaFromHex(COLORS.red, 0.1),
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  🏆 Up to $1,000 prizes
                </span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link
              href={picksHref}
              onClick={onClickGoToPicks}
              className="inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-black border active:scale-[0.99] transition"
              style={primaryCtaStyle}
            >
              I get it – let me play →
            </Link>
          </div>
        </section>

        {/* ========= NEXT 6 PICKS PREVIEW ========= */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              Next <span style={{ color: COLORS.red }}>6</span> available picks
            </h2>
            <p className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
              Tap{" "}
              <span className="font-semibold" style={{ color: COLORS.white }}>
                Yes
              </span>{" "}
              or{" "}
              <span className="font-semibold" style={{ color: COLORS.red }}>
                No
              </span>{" "}
              to jump straight into Picks.
            </p>
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
                                animation: "torpyPing 1.6s cubic-bezier(0,0,0.2,1) infinite",
                              }}
                            />
                            <span
                              className="relative inline-flex h-2 w-2 rounded-full"
                              style={{ background: rgbaFromHex(COLORS.red, 0.95) }}
                            />
                          </span>
                          AFL Q{q.quarter}
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

        {/* ========= SOCIAL PROOF / STATS ========= */}
        <section className="mb-16 rounded-3xl border px-6 py-8 transition-colors" style={{ ...cardStyle }}>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <div
                className="text-3xl sm:text-4xl font-extrabold mb-1"
                style={{
                  color: COLORS.white,
                  textShadow: "0 0 14px rgba(255,255,255,0.14)",
                }}
              >
                Live
              </div>
              <p className="text-sm text-white/65">Real-time picks during every AFL match</p>
            </div>

            <div>
              <div
                className="text-3xl sm:text-4xl font-extrabold mb-1"
                style={{
                  color: COLORS.red,
                  textShadow: `0 0 14px ${rgbaFromHex(COLORS.red, 0.22)}`,
                }}
              >
                $1,000
              </div>
              <p className="text-sm text-white/65">In prizes every round*</p>
            </div>

            <div>
              <div
                className="text-3xl sm:text-4xl font-extrabold mb-1"
                style={{
                  color: COLORS.white,
                  textShadow: "0 0 14px rgba(255,255,255,0.12)",
                }}
              >
                Free
              </div>
              <p className="text-sm text-white/65">No gambling. Just skill &amp; bragging rights</p>
            </div>
          </div>
        </section>

        <footer className="border-t pt-6 mt-4 text-sm" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/45">
            <p>
              TORPY is a free game of skill. No gambling. 18+ only. Prizes subject to terms and conditions.
              Play responsibly.
            </p>
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
              You need a free TORPY account to make picks, build your streak and appear on the leaderboard.
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
