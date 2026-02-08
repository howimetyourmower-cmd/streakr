"use client";

// /app/play/afl/page.tsx
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
  status: any;
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

/** ✅ SCREAMR palette */
const COLORS = {
  bg: "#06070B",
  panel: "#0A0B10",
  panel2: "#07080D",
  red: "#FF2E4D",
  redDeep: "#B10F2A",
  cyan: "#00E5FF",
  white: "#FFFFFF",
  border: "rgba(255,255,255,0.10)",
  soft: "rgba(255,255,255,0.06)",
  soft2: "rgba(255,255,255,0.03)",
};

type TeamSlug =
  | "adelaide"
  | "brisbane"
  | "carlton"
  | "collingwood"
  | "essendon"
  | "fremantle"
  | "geelong"
  | "goldcoast"
  | "gws"
  | "hawthorn"
  | "melbourne"
  | "northmelbourne"
  | "portadelaide"
  | "richmond"
  | "stkilda"
  | "sydney"
  | "westcoast"
  | "westernbulldogs";

function teamNameToSlug(nameRaw: string): TeamSlug | null {
  const n = (nameRaw || "").toLowerCase().trim();

  if (n.includes("greater western sydney") || n === "gws" || n.includes("giants")) return "gws";
  if (n.includes("gold coast") || n.includes("suns")) return "goldcoast";
  if (n.includes("west coast") || n.includes("eagles")) return "westcoast";
  if (n.includes("western bulldogs") || n.includes("bulldogs") || n.includes("footscray")) return "westernbulldogs";
  if (n.includes("north melbourne") || n.includes("kangaroos")) return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (n.includes("st kilda") || n.includes("saints") || n.replace(/\s/g, "") === "stkilda") return "stkilda";

  if (n.includes("adelaide")) return "adelaide";
  if (n.includes("brisbane")) return "brisbane";
  if (n.includes("carlton")) return "carlton";
  if (n.includes("collingwood")) return "collingwood";
  if (n.includes("essendon")) return "essendon";
  if (n.includes("fremantle")) return "fremantle";
  if (n.includes("geelong")) return "geelong";
  if (n.includes("hawthorn")) return "hawthorn";
  if (n.includes("melbourne")) return "melbourne";
  if (n.includes("richmond")) return "richmond";
  if (n.includes("sydney") || n.includes("swans")) return "sydney";

  return null;
}

function splitMatch(match: string): { home: string; away: string } | null {
  const m = String(match || "").trim();
  if (!m) return null;
  const re = /^(.*?)\s+(?:vs|v)\s+(.*?)$/i;
  const hit = m.match(re);
  if (!hit) return null;
  const home = hit[1].trim();
  const away = hit[2].trim();
  if (!home || !away) return null;
  return { home, away };
}

function logoCandidates(teamSlug: TeamSlug): string[] {
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
    `/afllogos/${teamSlug}-logo.jpg`,
    `/afllogos/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = ({
  teamName,
  size = 78,
}: {
  teamName: string;
  size?: number;
}) => {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const fallbackInitials = (teamName || "AFL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  const candidates = slug ? logoCandidates(slug) : [];
  const src = slug ? candidates[Math.min(idx, candidates.length - 1)] : "";

  const tile: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 18,
  };

  if (!slug || dead) {
    return (
      <div className="relative" style={tile} title={teamName}>
        <div className="absolute inset-0 screamr-logoBorder" style={{ borderRadius: 18 }} />
        <div className="absolute inset-[3px] screamr-logoInner" style={{ borderRadius: 16 }}>
          <div className="absolute inset-0 screamr-logoShine" style={{ borderRadius: 16 }} />
          <div className="absolute inset-0 flex items-center justify-center font-black tracking-wide text-white/90">
            {fallbackInitials || "AFL"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" style={tile} title={teamName}>
      <div className="absolute inset-0 screamr-logoBorder" style={{ borderRadius: 18 }} />
      <div className="absolute inset-[3px] screamr-logoInner" style={{ borderRadius: 16 }}>
        <div className="absolute inset-0 screamr-logoShine" style={{ borderRadius: 16 }} />
        <div className="absolute inset-0 p-2.5">
          <Image
            src={src}
            alt={`${teamName} logo`}
            fill
            sizes={`${size}px`}
            style={{ objectFit: "contain" }}
            onError={() => {
              setIdx((p) => {
                if (p + 1 < candidates.length) return p + 1;
                setDead(true);
                return p;
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

type StatChip = { label: string; value: string; sub?: string; tone?: "red" | "cyan" | "white" };

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
    } catch {}

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
    borderColor: COLORS.border,
    background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
    boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
  } as const;

  const glassCardStyle = {
    borderColor: COLORS.border,
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
    borderColor: "rgba(255,255,255,0.25)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))",
    color: "rgba(0,0,0,0.92)",
    boxShadow: "0 0 18px rgba(255,255,255,0.10)",
  } as const;

  const noBtnStyle = {
    borderColor: rgbaFromHex(COLORS.red, 0.65),
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

  const CardSilhouetteBg = ({ opacity = 1 }: { opacity?: number }) => {
    return (
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ opacity }}>
          <Image
            src="/afl1.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            style={{
              objectFit: "cover",
              filter: "grayscale(1) brightness(0.35) contrast(1.35)",
              transform: "scale(1.04)",
            }}
            priority={false}
          />
        </div>

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.58) 55%, rgba(0,0,0,0.90) 100%)",
          }}
        />
      </div>
    );
  };

  const stats: StatChip[] = useMemo(() => {
    const liveCount = games.filter((g) => new Date(g.startTime).getTime() <= nowMs).length;
    const upcomingCount = games.length - liveCount;
    return [
      { label: "Open picks", value: String(openQuestions.length), sub: "right now", tone: "cyan" },
      { label: "Matches", value: String(games.length), sub: `${upcomingCount} upcoming`, tone: "white" },
      { label: "Live", value: String(liveCount), sub: "locked", tone: "red" },
    ];
  }, [games, openQuestions.length, nowMs]);

  return (
    <main className="min-h-screen text-white overflow-x-hidden" style={{ backgroundColor: COLORS.bg }}>
      <style>{`
        @keyframes screamrPing {
          0% { transform: scale(1); opacity: .55; }
          80% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes floaty { 0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)} }

        /* Game-show sparks */
        .screamr-sparks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.16;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(circle at 12% 78%, rgba(0,229,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 22%, rgba(255,46,77,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 55% 62%, rgba(255,255,255,0.20) 0 1px, transparent 2px);
          background-size: 220px 220px;
          animation: sparksMove 6.5s linear infinite;
        }
        @keyframes sparksMove { 0%{transform:translate3d(0,0,0)} 100%{transform:translate3d(-220px,-220px,0)} }

        .screamr-spotlights {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: 0.60;
          background:
            radial-gradient(700px 260px at 20% 0%, rgba(0,229,255,0.14) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(700px 260px at 80% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(900px 340px at 50% 110%, rgba(255,46,77,0.08) 0%, rgba(0,0,0,0) 70%);
        }

        .screamr-cardBorder {
          background: linear-gradient(135deg,
            rgba(255,46,77,0.55) 0%,
            rgba(255,46,77,0.08) 25%,
            rgba(0,229,255,0.10) 55%,
            rgba(255,46,77,0.40) 100%);
        }

        .screamr-pill {
          position: relative;
          border: 1px solid rgba(255,255,255,0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          color: rgba(255,255,255,0.92);
          box-shadow:
            0 10px 26px rgba(0,0,0,0.35),
            0 0 0 1px rgba(0,0,0,0.12) inset;
          overflow: hidden;
        }
        .screamr-pill::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -35%;
          width: 60%;
          height: 200%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.16), rgba(255,255,255,0.00));
          animation: pillShine 3.6s ease-in-out infinite;
        }
        @keyframes pillShine {
          0% { transform: translateX(-40%) rotate(22deg); opacity: 0; }
          18% { opacity: 0.65; }
          40% { transform: translateX(210%) rotate(22deg); opacity: 0; }
          100% { transform: translateX(210%) rotate(22deg); opacity: 0; }
        }

        .screamr-gameLabel {
          position: relative;
          border: 1px solid rgba(255,46,77,0.35);
          background:
            linear-gradient(90deg, rgba(255,46,77,0.22) 0%, rgba(0,229,255,0.10) 50%, rgba(255,46,77,0.18) 100%);
          color: rgba(255,255,255,0.95);
          box-shadow: 0 12px 34px rgba(255,46,77,0.12);
          overflow: hidden;
        }
        .screamr-gameLabel::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(420px 120px at 0% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.00) 60%);
          animation: labelSweep 2.8s ease-in-out infinite;
        }
        @keyframes labelSweep {
          0% { transform: translateX(-55%); opacity: 0.0; }
          25% { opacity: 0.7; }
          55% { transform: translateX(35%); opacity: 0.0; }
          100% { transform: translateX(35%); opacity: 0.0; }
        }

        .screamr-cta {
          border: 1px solid rgba(255,46,77,0.32);
          background: linear-gradient(180deg, rgba(255,46,77,0.98) 0%, rgba(255,46,77,0.70) 100%);
          color: rgba(255,255,255,0.98);
          box-shadow: 0 14px 34px rgba(255,46,77,0.18);
        }
        .screamr-cta:hover { filter: brightness(1.04); }
        .screamr-cta:active { transform: translateY(1px); }

        .screamr-logoBorder {
          background: linear-gradient(135deg,
            rgba(255,46,77,0.75) 0%,
            rgba(255,46,77,0.18) 30%,
            rgba(0,229,255,0.18) 60%,
            rgba(255,46,77,0.55) 100%);
          box-shadow:
            0 14px 34px rgba(255,46,77,0.12),
            0 0 0 1px rgba(0,0,0,0.40) inset;
        }
        .screamr-logoInner {
          background:
            radial-gradient(300px 120px at 50% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0.00) 70%),
            linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.78) 100%);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 0 0 1px rgba(255,46,77,0.10) inset,
            0 18px 48px rgba(0,0,0,0.65);
          overflow: hidden;
        }
        .screamr-logoShine {
          pointer-events: none;
          position: absolute;
          top: -40%;
          left: -45%;
          width: 70%;
          height: 220%;
          transform: rotate(18deg);
          background: linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.16), rgba(255,255,255,0.00));
          animation: logoShine 4.2s ease-in-out infinite;
          opacity: 0.0;
        }
        @keyframes logoShine {
          0% { transform: translateX(-40%) rotate(18deg); opacity: 0.0; }
          20% { opacity: 0.55; }
          45% { transform: translateX(230%) rotate(18deg); opacity: 0.0; }
          100% { transform: translateX(230%) rotate(18deg); opacity: 0.0; }
        }

        /* ✅ Prize ticker marquee */
        .screamr-marquee { overflow: hidden; white-space: nowrap; }
        .screamr-track {
          display: inline-flex;
          align-items: center;
          width: max-content;
          animation: screamrScroll 80s linear infinite;
        }
        @keyframes screamrScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .screamr-track { animation: none; }
          .screamr-sparks, .screamr-pill::after, .screamr-gameLabel::after, .screamr-logoShine { animation: none !important; }
        }
      `}</style>

      {/* ======= HERO ======= */}
      <section className="relative overflow-hidden">
        <div className="relative w-full h-[620px] sm:h-[680px]">
          <Image
            src="/screamr/hero-bg.png"
            alt="SCREAMR AFL hero"
            fill
            priority
            className="object-cover object-center"
          />

          {/* cinematic overlays */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.42)" }} />
          <div className="absolute inset-0 screamr-spotlights" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

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
              {/* marquee */}
              <div
                className="
                  w-screen
                  ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]
                  mb-3
                  rounded-none
                  border-y
                "
                style={{
                  borderColor: COLORS.border,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.42) 100%)",
                  boxShadow: `0 0 26px ${rgbaFromHex(COLORS.red, 0.12)}`,
                }}
              >
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/90 to-transparent" />

                  <div className="screamr-marquee py-2.5">
                    <div className="screamr-track">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span
                          key={`a-${i}`}
                          className="mx-4 text-[12px] sm:text-[11px] font-black tracking-[0.22em]"
                          style={{
                            color: "rgba(255,255,255,0.92)",
                            textShadow: `0 10px 26px ${rgbaFromHex(COLORS.red, 0.22)}`,
                          }}
                        >
                          * SCREAMR BETA 2026 — TESTING GAMEPLAY — SEND FEEDBACK — 2027 WILL BE HUGE *
                        </span>
                      ))}
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span
                          key={`b-${i}`}
                          className="mx-4 text-[12px] sm:text-[11px] font-black tracking-[0.22em]"
                          style={{
                            color: "rgba(255,255,255,0.92)",
                            textShadow: `0 10px 26px ${rgbaFromHex(COLORS.red, 0.22)}`,
                          }}
                        >
                          * SCREAMR BETA 2026 — TESTING GAMEPLAY — SEND FEEDBACK — 2027 WILL BE HUGE *
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* chips */}
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
                      {nextUpLockMs === null ? "" : isNextUpLive ? "LIVE" : `Locks in ${msToCountdown(nextUpLockMs)}`}
                    </span>
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-[44px] sm:text-[66px] font-extrabold leading-[0.98] tracking-tight">
                <span className="block">SCREAMR.</span>
                <span className="block">CALL IT. LOCK IT</span>
                <span className="block">BE PERFECT OR BE</span>
                <span
                  className="block"
                  style={{
                    color: COLORS.red,
                    textShadow: `0 10px 36px ${rgbaFromHex(COLORS.red, 0.22)}`,
                  }}
                >
                  PUNISHED
                </span>
              </h1>

              <p className="mt-4 text-sm sm:text-base text-white/78 max-w-xl leading-relaxed">
                The only AFL game where perfection wins $1000. One wrong pick and you're gone!
              </p>

              {/* hero CTAs */}
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

              {/* stats strip */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {stats.map((s) => {
                  const tone =
                    s.tone === "red"
                      ? COLORS.red
                      : s.tone === "cyan"
                      ? COLORS.cyan
                      : "rgba(255,255,255,0.92)";

                  return (
                    <div key={s.label} className="rounded-2xl border px-4 py-3" style={glassCardStyle}>
                      <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">{s.label}</div>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <div className="text-[20px] font-black" style={{ color: tone }}>
                          {loading ? "—" : s.value}
                        </div>
                        <div className="text-[11px] text-white/60 font-semibold">{s.sub || ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== Right Side: GAME SHOW "NEXT UP" BOARD ===== */}
            <div className="hidden lg:flex flex-1 justify-end">
              <div
                className="rounded-3xl overflow-hidden"
                style={{
                  width: 420,
                  animation: "floaty 4.2s ease-in-out infinite",
                }}
              >
                <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
                  <div
                    className="relative rounded-3xl border overflow-hidden"
                    style={{
                      borderColor: COLORS.border,
                      background: "rgba(0,0,0,0.72)",
                      boxShadow: "0 28px 90px rgba(0,0,0,0.72)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <div className="relative p-5 overflow-hidden" style={{ minHeight: 270 }}>
                      <div className="screamr-sparks" />
                      <CardSilhouetteBg opacity={0.85} />

                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{
                                background: isNextUpLive ? COLORS.red : COLORS.cyan,
                                boxShadow: isNextUpLive
                                  ? "0 0 14px rgba(255,46,77,0.55)"
                                  : "0 0 14px rgba(0,229,255,0.50)",
                              }}
                            />
                            NEXT UP
                          </span>

                          <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                            {nextUpLockMs === null ? "—" : isNextUpLive ? "LIVE / LOCKED" : `LOCKS IN ${msToCountdown(nextUpLockMs)}`}
                          </span>
                        </div>

                        {nextUp ? (
                          <>
                            {(() => {
                              const m = splitMatch(nextUp.match);
                              const home = m?.home ?? nextUp.match;
                              const away = m?.away ?? "AFL";
                              return (
                                <div className="mt-4 flex items-center justify-center gap-4">
                                  <TeamLogo teamName={home} size={92} />
                                  <div className="text-white/85 font-black text-[13px]">vs</div>
                                  <TeamLogo teamName={away} size={92} />
                                </div>
                              );
                            })()}

                            <div className="mt-3 text-center">
                              <div
                                className="text-[22px] font-black leading-tight"
                                style={{ color: "rgba(255,255,255,0.98)", textShadow: "0 2px 12px rgba(0,0,0,0.70)" }}
                              >
                                {nextUp.match}
                              </div>
                              <div className="mt-2 text-[12px] font-semibold text-white/70">
                                {formatStartLine(nextUp.startTime)} • {nextUp.venue}
                              </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                              <Link
                                href={picksHref}
                                onClick={requireAuthForPicks}
                                className="flex-1 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-[12px] font-black border screamr-cta"
                                style={{ textDecoration: "none" }}
                              >
                                GO PICK
                              </Link>
                              <Link
                                href="/leaderboards"
                                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-[12px] font-black border"
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
                          </>
                        ) : (
                          <div className="mt-6 rounded-2xl border p-4 text-sm text-white/70" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
                            Seed rounds to display the Next Up board.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,46,77,0.00), rgba(255,46,77,0.45), rgba(0,229,255,0.18), rgba(255,46,77,0.00))" }} />
                  </div>
                </div>
              </div>
            </div>
            {/* ===== end Right Side ===== */}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#0A0A0F]" />
      </section>

      {/* ======= CONTENT ======= */}
      <section className="overflow-x-hidden" style={{ background: "#0A0A0F" }}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          {/* HOW IT WORKS */}
          <div ref={howRef} className="mb-10">
            <div className="text-[12px] font-black text-white/75 mb-4">HOW IT WORKS</div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  title: "1) PICK YES / NO",
                  body: (
                    <>
                      Tap <span className="font-black text-white/85">YES</span> or{" "}
                      <span className="font-black" style={{ color: COLORS.red }}>
                        NO
                      </span>{" "}
                      on any question. Pick 0, 1, 5 or all 12 — your call.
                    </>
                  ),
                },
                {
                  title: "2) LOCKS AT BOUNCE",
                  body: <>No lock-in button. Picks auto-lock at the game start time. Questions drop live during the match.</>,
                },
                {
                  title: "3) CLEAN SWEEP",
                  body: <>Any wrong pick in a match resets your streak to 0. Voids don’t count.</>,
                },
              ].map((it) => (
                <div key={it.title} className="rounded-2xl border p-5" style={darkCardStyle}>
                  <div className="text-sm font-black mb-2">{it.title}</div>
                  <p className="text-sm text-white/65 leading-relaxed">{it.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* NEXT FEATURED MATCHES — game-show cards */}
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
                    <div className="h-44 bg-white/5 animate-pulse" />
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
                  const lockMs = new Date(g.startTime).getTime() - nowMs;
                  const live = lockMs <= 0;
                  const m = splitMatch(g.match);
                  const home = m?.home ?? g.match;
                  const away = m?.away ?? "AFL";
                  const qCount = Array.isArray(g.questions) ? g.questions.length : 0;

                  return (
                    <Link key={g.id} href={picksHref} onClick={requireAuthForPicks} style={{ textDecoration: "none" }}>
                      <div className="relative p-[1px] rounded-2xl screamr-cardBorder">
                        <div className="relative rounded-2xl border overflow-hidden" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
                          <div className="relative p-4 overflow-hidden" style={{ minHeight: 210 }}>
                            <div className="screamr-sparks" />
                            <div className="absolute inset-0 screamr-spotlights" />
                            <CardSilhouetteBg opacity={0.95} />

                            <div className="relative z-10">
                              <div className="flex items-center justify-between gap-2">
                                <span className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      background: live ? COLORS.red : COLORS.cyan,
                                      boxShadow: live
                                        ? "0 0 14px rgba(255,46,77,0.55)"
                                        : "0 0 14px rgba(0,229,255,0.50)",
                                    }}
                                  />
                                  {live ? "LIVE" : "GAME"}
                                </span>

                                <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                                  {live ? "LOCKED" : `LOCKS ${msToCountdown(lockMs)}`}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center justify-center gap-3">
                                <TeamLogo teamName={home} size={78} />
                                <div className="text-white/85 font-black text-[12px]">vs</div>
                                <TeamLogo teamName={away} size={78} />
                              </div>

                              <div className="mt-3 text-center">
                                <div className="text-[18px] font-black leading-tight text-white">{g.match}</div>
                                <div className="mt-1 text-[12px] font-semibold text-white/70">{g.venue}</div>
                                <div className="mt-1 text-[11px] font-semibold text-white/55">{formatStartLine(g.startTime)}</div>
                              </div>

                              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                                <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                                  {qCount} questions
                                </span>
                                <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                                  Pick any amount
                                </span>
                              </div>

                              <div className="mt-4 flex items-center justify-center">
                                <span className="screamr-cta inline-flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-black">
                                  PLAY NOW
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="h-[1px]"
                            style={{
                              background:
                                "linear-gradient(90deg, rgba(255,46,77,0.00), rgba(255,46,77,0.40), rgba(0,229,255,0.18), rgba(255,46,77,0.00))",
                            }}
                          />
                        </div>
                      </div>
                    </Link>
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

          {/* PICKS AVAILABLE RIGHT NOW */}
          <div className="mb-2">
            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <div className="text-[12px] font-black text-white/75">PICKS AVAILABLE RIGHT NOW</div>
                <div className="text-sm text-white/70">Tap Yes/No to jump into Picks. (We’ll focus that question for you.)</div>
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
                <p className="text-sm text-white/65 mb-4">No open questions right now. Check back closer to bounce.</p>
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
                    <div key={q.id} className="relative p-[1px] rounded-2xl screamr-cardBorder">
                      <div className="rounded-2xl border px-5 py-4" style={darkCardStyle}>
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55 mb-2">
                              <span
                                className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
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
          <footer className="mt-12 border-t pt-6" style={{ borderColor: COLORS.border }}>
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
