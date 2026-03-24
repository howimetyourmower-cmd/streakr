"use client";

// /app/play/afl/page.tsx
export const dynamic = "force-dynamic";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: unknown;
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

type StatChip = {
  label: string;
  value: string;
  sub?: string;
  tone?: "red" | "cyan" | "white";
};

const PREVIEW_FOCUS_KEY = "screamr_preview_focus_v1";

const HERO_NOISE_DATA_URL =
  "url(data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E)";

const SCREAMR_GLOBAL_CSS = `
  @keyframes screamrPing {
    0% { transform: scale(1); opacity: .55; }
    80% { transform: scale(1.7); opacity: 0; }
    100% { transform: scale(1.7); opacity: 0; }
  }

  @keyframes floaty {
    0% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
    100% { transform: translateY(0); }
  }

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

  @keyframes sparksMove {
    0% { transform: translate3d(0,0,0); }
    100% { transform: translate3d(-220px,-220px,0); }
  }

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
    background: linear-gradient(
      135deg,
      rgba(255,46,77,0.55) 0%,
      rgba(255,46,77,0.08) 25%,
      rgba(0,229,255,0.10) 55%,
      rgba(255,46,77,0.40) 100%
    );
  }

  .screamr-pill {
    position: relative;
    border: 1px solid rgba(255,255,255,0.14);
    background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
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
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.00),
      rgba(255,255,255,0.16),
      rgba(255,255,255,0.00)
    );
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
    background: linear-gradient(
      90deg,
      rgba(255,46,77,0.22) 0%,
      rgba(0,229,255,0.10) 50%,
      rgba(255,46,77,0.18) 100%
    );
    color: rgba(255,255,255,0.95);
    box-shadow: 0 12px 34px rgba(255,46,77,0.12);
    overflow: hidden;
  }

  .screamr-gameLabel::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
      420px 120px at 0% 50%,
      rgba(255,255,255,0.10) 0%,
      rgba(255,255,255,0.00) 60%
    );
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

  .screamr-cta:hover {
    filter: brightness(1.04);
  }

  .screamr-cta:active {
    transform: translateY(1px);
  }

  .screamr-logoBorder {
    background: linear-gradient(
      135deg,
      rgba(255,46,77,0.75) 0%,
      rgba(255,46,77,0.18) 30%,
      rgba(0,229,255,0.18) 60%,
      rgba(255,46,77,0.55) 100%
    );
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
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.00),
      rgba(255,255,255,0.16),
      rgba(255,255,255,0.00)
    );
    animation: logoShine 4.2s ease-in-out infinite;
    opacity: 0.0;
  }

  @keyframes logoShine {
    0% { transform: translateX(-40%) rotate(18deg); opacity: 0.0; }
    20% { opacity: 0.55; }
    45% { transform: translateX(230%) rotate(18deg); opacity: 0.0; }
    100% { transform: translateX(230%) rotate(18deg); opacity: 0.0; }
  }

  .screamr-marquee {
    overflow: hidden;
    white-space: nowrap;
  }

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
    .screamr-track {
      animation: none;
    }

    .screamr-sparks,
    .screamr-pill::after,
    .screamr-gameLabel::after,
    .screamr-logoShine {
      animation: none !important;
    }
  }
`;

/** Helpers */
function normaliseStatus(val: unknown): QuestionStatus {
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

function formatStartLine(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
    timeZoneName: "short",
  }).formatToParts(d);

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = read("weekday");
  const day = read("day");
  const month = read("month");
  const hour = read("hour");
  const minute = read("minute");
  const dayPeriod = read("dayPeriod").toUpperCase();
  const tzName = read("timeZoneName");

  if (!weekday || !day || !month || !hour || !minute || !dayPeriod) return "";

  return `${weekday}, ${day} ${month} • ${hour}:${minute}${dayPeriod} ${tzName}`.trim();
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

function teamNameToSlug(nameRaw: string): TeamSlug | null {
  const n = (nameRaw || "").toLowerCase().trim();

  if (n.includes("greater western sydney") || n === "gws" || n.includes("giants")) return "gws";
  if (n.includes("gold coast") || n.includes("suns")) return "goldcoast";
  if (n.includes("west coast") || n.includes("eagles")) return "westcoast";
  if (n.includes("western bulldogs") || n.includes("bulldogs") || n.includes("footscray")) {
    return "westernbulldogs";
  }
  if (n.includes("north melbourne") || n.includes("kangaroos")) return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (n.includes("st kilda") || n.includes("saints") || n.replace(/\s/g, "") === "stkilda") {
    return "stkilda";
  }

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

  const home = hit[1]?.trim() ?? "";
  const away = hit[2]?.trim() ?? "";

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

function getTeamNames(match: string): { home: string; away: string } {
  const parsed = splitMatch(match);
  return {
    home: parsed?.home ?? match,
    away: parsed?.away ?? "AFL",
  };
}

function getLockText(
  hydrated: boolean,
  lockMs: number | null,
  liveLabel = "LIVE",
  prefix = "Locks in ",
): string {
  if (!hydrated || lockMs === null) return "—";
  if (lockMs <= 0) return liveLabel;
  return `${prefix}${msToCountdown(lockMs)}`;
}

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
    .map((x) => x[0]?.toUpperCase() ?? "")
    .join("");

  const candidates = slug ? logoCandidates(slug) : [];
  const src = slug ? candidates[Math.min(idx, Math.max(0, candidates.length - 1))] : "";

  const tile: CSSProperties = {
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
              setIdx((prev) => {
                if (prev + 1 < candidates.length) return prev + 1;
                setDead(true);
                return prev;
              });
            }}
          />
        </div>
      </div>
    </div>
  );
};

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

export default function AflHubPage() {
  const user = null;
  const router = useRouter();
  const howRef = useRef<HTMLDivElement | null>(null);

  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const picksHref = "/picks?sport=AFL";
  const encodedReturnTo = encodeURIComponent(picksHref);

  useEffect(() => {
    setHydrated(true);

    const tick = () => {
      setNowMs(Date.now());
    };

    tick();
    const id = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setError("");
        setLoading(true);

        const res = await fetch("/api/picks?sport=AFL", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data: PicksApiResponse = await res.json();
        const nextGames = Array.isArray(data.games) ? data.games : [];
        setGames(nextGames);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("Failed to load matches.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  const openQuestions = useMemo<QuestionRow[]>(() => {
    const flat = games.flatMap((game) =>
      (game.questions || []).map((q) => ({
        id: q.id,
        match: game.match,
        venue: game.venue,
        startTime: game.startTime,
        quarter: q.quarter,
        question: q.question,
        status: normaliseStatus(q.status),
      })),
    );

    return flat
      .filter((q) => q.status === "open")
      .sort((a, b) => {
        const da = new Date(a.startTime).getTime();
        const db = new Date(b.startTime).getTime();
        if (da !== db) return da - db;
        return a.quarter - b.quarter;
      });
  }, [games]);

  const featuredMatches = useMemo(() => {
    const referenceNow = nowMs ?? 0;

    const sorted = [...games].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    const upcoming = sorted.filter(
      (g) => new Date(g.startTime).getTime() >= referenceNow - 1000 * 60 * 60,
    );

    return (upcoming.length ? upcoming : sorted).slice(0, 3);
  }, [games, nowMs]);

  const nextUp = useMemo(() => {
    const sorted = [...games].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    if (nowMs === null) {
      return sorted[0] ?? null;
    }

    const upcoming = sorted.filter((g) => new Date(g.startTime).getTime() > nowMs);
    return upcoming[0] ?? sorted[0] ?? null;
  }, [games, nowMs]);

  const nextUpLockMs = useMemo(() => {
    if (!nextUp || nowMs === null) return null;
    return new Date(nextUp.startTime).getTime() - nowMs;
  }, [nextUp, nowMs]);

  const isNextUpLive = nextUpLockMs !== null ? nextUpLockMs <= 0 : false;
  const previewQuestions = useMemo(() => openQuestions.slice(0, 6), [openQuestions]);

  const stats: StatChip[] = useMemo(() => {
    const referenceNow = nowMs ?? 0;
    const liveCount = games.filter((g) => new Date(g.startTime).getTime() <= referenceNow).length;
    const upcomingCount = Math.max(0, games.length - liveCount);

    return [
      {
        label: "Open picks",
        value: String(openQuestions.length),
        sub: "right now",
        tone: "cyan",
      },
      {
        label: "Matches",
        value: String(games.length),
        sub: `${upcomingCount} upcoming`,
        tone: "white",
      },
      {
        label: "Live",
        value: String(liveCount),
        sub: "locked",
        tone: "red",
      },
    ];
  }, [games, openQuestions.length, nowMs]);

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
      // noop
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

  const darkCardStyle: CSSProperties = {
    borderColor: COLORS.border,
    background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
    boxShadow: "0 18px 55px rgba(0,0,0,0.70)",
  };

  const glassCardStyle: CSSProperties = {
    borderColor: COLORS.border,
    background: "rgba(10,10,14,0.62)",
    boxShadow: "0 22px 80px rgba(0,0,0,0.65)",
    backdropFilter: "blur(10px)",
  };

  const primaryBtn: CSSProperties = {
    borderColor: rgbaFromHex(COLORS.red, 0.55),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.98)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.95,
    )})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 28px ${rgbaFromHex(COLORS.red, 0.18)}`,
  };

  const yesBtnStyle: CSSProperties = {
    borderColor: "rgba(255,255,255,0.25)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))",
    color: "rgba(0,0,0,0.92)",
    boxShadow: "0 0 18px rgba(255,255,255,0.10)",
  };

  const noBtnStyle: CSSProperties = {
    borderColor: rgbaFromHex(COLORS.red, 0.65),
    background: `linear-gradient(180deg, ${rgbaFromHex(COLORS.red, 0.98)}, ${rgbaFromHex(
      COLORS.redDeep,
      0.92,
    )})`,
    color: "rgba(255,255,255,0.98)",
    boxShadow: `0 0 18px ${rgbaFromHex(COLORS.red, 0.14)}`,
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-white" style={{ backgroundColor: COLORS.bg }}>
      <style jsx global>
        {SCREAMR_GLOBAL_CSS}
      </style>

      <section className="relative overflow-hidden">
        <div className="relative h-[620px] w-full sm:h-[680px]">
          <Image
            src="/screamr/hero-bg.png"
            alt="SCREAMR AFL hero"
            fill
            priority
            className="object-cover object-center"
          />

          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.42)" }} />
          <div className="absolute inset-0 screamr-spotlights" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: HERO_NOISE_DATA_URL,
              mixBlendMode: "overlay",
              opacity: 0.16,
            }}
          />
        </div>

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center px-4 sm:px-6">
            <div className="max-w-2xl">
              <div
                className="
                  mb-3
                  ml-[calc(50%-50vw)]
                  mr-[calc(50%-50vw)]
                  w-screen
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
                          className="mx-4 text-[12px] font-black tracking-[0.22em] sm:text-[11px]"
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
                          className="mx-4 text-[12px] font-black tracking-[0.22em] sm:text-[11px]"
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

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black"
                  style={{
                    borderColor: rgbaFromHex(COLORS.red, 0.4),
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
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black"
                    style={{
                      borderColor: "rgba(255,255,255,0.16)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.90)",
                    }}
                    title={nextUp.match}
                  >
                    <span className="text-white/55">NEXT:</span>
                    <span className="max-w-[220px] truncate sm:max-w-[360px]">{nextUp.match}</span>
                    <span className="text-white/35">•</span>
                    <span className="text-white/70">
                      {getLockText(hydrated, nextUpLockMs, "LIVE", "Locks in ")}
                    </span>
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-[44px] font-extrabold leading-[0.98] tracking-tight sm:text-[66px]">
                <span className="block">SCREAMR.</span>
                <span className="block">CALL IT. LOCK IT.</span>
                <span className="block">BE PERFECT OR BE</span>
                <span
                  className="block"
                  style={{
                    color: COLORS.red,
                    textShadow: `0 10px 36px ${rgbaFromHex(COLORS.red, 0.22)}`,
                  }}
                >
                  PUNISHED.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/78 sm:text-base">
                The only AFL game where perfection wins $1000 - One wrong pick and you&apos;re gone!
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-black transition active:scale-[0.99]"
                  style={primaryBtn}
                >
                  PLAY NOW
                </Link>

                <button
                  type="button"
                  onClick={scrollToHow}
                  className="inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-black transition active:scale-[0.99]"
                  style={{
                    borderColor: "rgba(255,255,255,0.20)",
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  HOW IT WORKS
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {stats.map((s) => {
                  const tone =
                    s.tone === "red"
                      ? COLORS.red
                      : s.tone === "cyan"
                        ? COLORS.cyan
                        : "rgba(255,255,255,0.92)";

                  return (
                    <div key={s.label} className="rounded-2xl border px-4 py-3" style={glassCardStyle}>
                      <div className="text-[11px] font-black uppercase tracking-widest text-white/55">
                        {s.label}
                      </div>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <div className="text-[20px] font-black" style={{ color: tone }}>
                          {loading ? "—" : s.value}
                        </div>
                        <div className="text-[11px] font-semibold text-white/60">{s.sub || ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden flex-1 justify-end lg:flex">
              <div
                className="overflow-hidden rounded-3xl"
                style={{
                  width: 420,
                  animation: "floaty 4.2s ease-in-out infinite",
                }}
              >
                <div className="screamr-cardBorder relative rounded-3xl p-[1px]">
                  <div
                    className="relative overflow-hidden rounded-3xl border"
                    style={{
                      borderColor: COLORS.border,
                      background: "rgba(0,0,0,0.72)",
                      boxShadow: "0 28px 90px rgba(0,0,0,0.72)",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <div className="relative overflow-hidden p-5" style={{ minHeight: 270 }}>
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
                            {hydrated
                              ? nextUpLockMs === null
                                ? "—"
                                : isNextUpLive
                                  ? "LIVE / LOCKED"
                                  : `LOCKS IN ${msToCountdown(nextUpLockMs)}`
                              : "—"}
                          </span>
                        </div>

                        {nextUp ? (
                          <>
                            {(() => {
                              const { home, away } = getTeamNames(nextUp.match);

                              return (
                                <div className="mt-4 flex items-center justify-center gap-4">
                                  <TeamLogo teamName={home} size={92} />
                                  <div className="text-[13px] font-black text-white/85">vs</div>
                                  <TeamLogo teamName={away} size={92} />
                                </div>
                              );
                            })()}

                            <div className="mt-3 text-center">
                              <div
                                className="text-[22px] font-black leading-tight"
                                style={{
                                  color: "rgba(255,255,255,0.98)",
                                  textShadow: "0 2px 12px rgba(0,0,0,0.70)",
                                }}
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
                                className="screamr-cta inline-flex flex-1 items-center justify-center rounded-2xl border px-5 py-3 text-[12px] font-black"
                                style={{ textDecoration: "none" }}
                              >
                                GO PICK
                              </Link>
                              <Link
                                href="/leaderboards"
                                className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-[12px] font-black"
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
                          <div
                            className="mt-6 rounded-2xl border p-4 text-sm text-white/70"
                            style={{ borderColor: COLORS.border, background: COLORS.soft2 }}
                          >
                            Seed rounds to display the Next Up board.
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="h-[1px]"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,46,77,0.00), rgba(255,46,77,0.45), rgba(0,229,255,0.18), rgba(255,46,77,0.00))",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#0A0A0F]" />
      </section>

      <section className="overflow-x-hidden" style={{ background: "#0A0A0F" }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div ref={howRef} className="mb-10">
            <div className="mb-4 text-[12px] font-black text-white/75">HOW IT WORKS</div>

            <div className="grid gap-4 sm:grid-cols-3">
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
                  body: (
                    <>
                      No lock-in button. Picks auto-lock at the game start time. Questions drop live
                      during the match.
                    </>
                  ),
                },
                {
                  title: "3) CLEAN SWEEP",
                  body: <>Any wrong pick in a match resets your streak to 0. Voids don&apos;t count.</>,
                },
              ].map((it) => (
                <div key={it.title} className="rounded-2xl border p-5" style={darkCardStyle}>
                  <div className="mb-2 text-sm font-black">{it.title}</div>
                  <p className="text-sm leading-relaxed text-white/65">{it.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="text-[12px] font-black text-white/75">NEXT FEATURED MATCHES</div>
              <Link
                href={picksHref}
                onClick={requireAuthForPicks}
                className="text-[12px] font-black underline-offset-2 hover:underline"
                style={{ color: COLORS.red }}
              >
                GO TO PICKS →
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border" style={darkCardStyle}>
                    <div className="h-44 animate-pulse bg-white/5" />
                    <div className="p-5">
                      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-white/10" />
                      <div className="mb-4 h-3 w-1/2 animate-pulse rounded bg-white/5" />
                      <div className="h-10 w-32 animate-pulse rounded-2xl bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredMatches.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {featuredMatches.map((g) => {
                  const lockMs =
                    nowMs === null ? null : new Date(g.startTime).getTime() - nowMs;
                  const live = lockMs !== null ? lockMs <= 0 : false;
                  const { home, away } = getTeamNames(g.match);
                  const qCount = Array.isArray(g.questions) ? g.questions.length : 0;

                  return (
                    <Link
                      key={g.id}
                      href={picksHref}
                      onClick={requireAuthForPicks}
                      style={{ textDecoration: "none" }}
                    >
                      <div className="screamr-cardBorder relative rounded-2xl p-[1px]">
                        <div
                          className="relative overflow-hidden rounded-2xl border"
                          style={{ borderColor: COLORS.border, background: COLORS.soft2 }}
                        >
                          <div className="relative overflow-hidden p-4" style={{ minHeight: 210 }}>
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
                                  {hydrated && lockMs !== null
                                    ? live
                                      ? "LOCKED"
                                      : `LOCKS ${msToCountdown(lockMs)}`
                                    : "—"}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center justify-center gap-3">
                                <TeamLogo teamName={home} size={78} />
                                <div className="text-[12px] font-black text-white/85">vs</div>
                                <TeamLogo teamName={away} size={78} />
                              </div>

                              <div className="mt-3 text-center">
                                <div className="text-[18px] font-black leading-tight text-white">
                                  {g.match}
                                </div>
                                <div className="mt-1 text-[12px] font-semibold text-white/70">
                                  {g.venue}
                                </div>
                                <div className="mt-1 text-[11px] font-semibold text-white/55">
                                  {formatStartLine(g.startTime)}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
                <div className="mb-3 text-sm text-white/70">No matches loaded yet.</div>
                <div className="text-[12px] text-white/55">
                  Once rounds are seeded, featured matches show here automatically.
                </div>
              </div>
            )}
          </div>

          <div className="mb-2">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] font-black text-white/75">PICKS AVAILABLE RIGHT NOW</div>
                <div className="text-sm text-white/70">
                  Tap Yes/No to jump into Picks. (We&apos;ll focus that question for you.)
                </div>
              </div>

              <Link
                href={picksHref}
                onClick={requireAuthForPicks}
                className="text-[12px] font-black underline-offset-2 hover:underline"
                style={{ color: COLORS.red }}
              >
                VIEW ALL OPEN →
              </Link>
            </div>

            {error ? (
              <div
                className="mb-4 rounded-2xl border px-5 py-4"
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
                <p className="mb-4 text-sm text-white/65">
                  No open questions right now. Check back closer to bounce.
                </p>
                <Link
                  href={picksHref}
                  onClick={requireAuthForPicks}
                  className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-black transition active:scale-[0.99]"
                  style={primaryBtn}
                >
                  GO TO PICKS ANYWAY
                </Link>
              </div>
            ) : null}

            <div className="space-y-3">
              {loading
                ? [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded-2xl border px-5 py-4"
                      style={darkCardStyle}
                    >
                      <div className="mb-2 h-4 w-3/4 rounded bg-white/10" />
                      <div className="h-3 w-1/2 rounded bg-white/5" />
                    </div>
                  ))
                : previewQuestions.map((q) => (
                    <div key={q.id} className="screamr-cardBorder relative rounded-2xl p-[1px]">
                      <div className="rounded-2xl border px-5 py-4" style={darkCardStyle}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                              <span className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                                <TinyBolt live />
                                Q{q.quarter}
                              </span>

                              <span className="text-white/35">•</span>
                              <span className="font-semibold text-white/70">
                                {formatStartLine(q.startTime)}
                              </span>
                              <span className="text-white/35">•</span>
                              <span className="text-white/70">{q.venue}</span>
                            </div>

                            <div className="mb-2 text-xs font-black text-white/85 sm:text-sm">
                              {q.match}
                            </div>
                            <div className="text-sm font-semibold text-white/90 sm:text-base">
                              {q.question}
                            </div>
                          </div>

                          <div className="shrink-0 items-center gap-3 lg:ml-6 flex">
                            <button
                              type="button"
                              onClick={() => goToPicksWithPreviewFocus(q.id, "yes")}
                              className="rounded-2xl border px-5 py-3 text-[13px] font-black transition active:scale-[0.99]"
                              style={yesBtnStyle}
                            >
                              YES
                            </button>

                            <button
                              type="button"
                              onClick={() => goToPicksWithPreviewFocus(q.id, "no")}
                              className="rounded-2xl border px-5 py-3 text-[13px] font-black transition active:scale-[0.99]"
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
                  className="inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-black transition active:scale-[0.99]"
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

          <footer className="mt-12 border-t pt-6" style={{ borderColor: COLORS.border }}>
            <div className="flex flex-col gap-2 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
              <p>
                SCREAMR is a free game of skill. No gambling. 18+ only. Prizes subject to terms and
                conditions.
              </p>
              <div className="flex items-center gap-4">
                <Link href="/terms" className="underline-offset-2 hover:underline">
                  Terms
                </Link>
                <Link href="/privacy" className="underline-offset-2 hover:underline">
                  Privacy
                </Link>
                <Link
                  href="/faq"
                  className="underline-offset-2 hover:underline"
                  style={{ color: COLORS.red }}
                >
                  FAQ
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </section>

      {showAuthModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border p-6" style={darkCardStyle}>
            <div className="mb-4 flex items-start justify-between">
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

            <p className="mb-4 text-sm text-white/65">
              You need a free SCREAMR account to make picks, build your streak and appear on the
              leaderboard.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                className="flex-1 inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-black transition active:scale-[0.99]"
                style={primaryBtn}
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                className="flex-1 inline-flex items-center justify-center rounded-2xl border px-6 py-3 text-sm font-black transition active:scale-[0.99]"
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
      ) : null}
    </main>
  );
}
