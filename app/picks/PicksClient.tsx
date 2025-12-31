// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
  userPick?: "yes" | "no";
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

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
};

const HOW_TO_PLAY_KEY = "torpie_seen_how_to_play_picks_v1";

function formatAedt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return dateIso;
  }
}

function msToCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 36000) / 60); // keeps formatting stable for long timers
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  const m = (match || "").split(/\s+vs\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}

function logoCandidates(teamSlug: TeamSlug): string[] {
  // lock candidates; once all fail we stop rendering Image to prevent flashing
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 46,
}: {
  teamName: string;
  size?: number;
}) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const initials = (teamName || "AFL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (!slug || dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.75)",
        }}
        title={teamName}
      >
        {initials || "AFL"}
      </div>
    );
  }

  const candidates = logoCandidates(slug);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        width: size,
        height: size,
        borderColor: "rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}
      title={teamName}
    >
      <div className="absolute inset-0 p-2">
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
  );
});

function HowToPlayModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.72)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(15,15,15,0.98)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.85)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-white/60">How to play</div>
              <div className="mt-1 text-[22px] font-black text-white">Survive the streak.</div>
              <div className="mt-1 text-[13px] text-white/70 leading-snug">
                No odds. No money. Skill + nerve only.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-3 py-1.5 text-[12px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div className="text-[12px] uppercase tracking-widest text-white/55">1</div>
              <div className="mt-1 text-[14px] font-black text-white">Pick any amount</div>
              <div className="mt-1 text-[12px] text-white/70">
                Choose 0–12 questions per match. You’re in control.
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div className="text-[12px] uppercase tracking-widest text-white/55">2</div>
              <div className="mt-1 text-[14px] font-black text-white">Locks at bounce</div>
              <div className="mt-1 text-[12px] text-white/70">
                Picks auto-lock at match start. No lock-in button.
              </div>
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div className="text-[12px] uppercase tracking-widest text-white/55">3</div>
              <div className="mt-1 text-[14px] font-black text-white">Clean Sweep</div>
              <div className="mt-1 text-[12px] text-white/70">
                One wrong pick in a match wipes that match streak. Voids don’t hurt you.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl border px-5 py-4 text-[13px] font-black"
            style={{
              borderColor: "rgba(255,46,77,0.55)",
              background: "rgba(255,46,77,0.18)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "0 10px 30px rgba(255,46,77,0.18)",
            }}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [howToOpen, setHowToOpen] = useState(false);

  // updates every second for countdown; logos are stable (no flashing)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // show how-to-play once per device
  useEffect(() => {
    try {
      const seen = localStorage.getItem(HOW_TO_PLAY_KEY);
      if (!seen) setHowToOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const closeHowTo = useCallback(() => {
    try {
      localStorage.setItem(HOW_TO_PLAY_KEY, "1");
    } catch {
      // ignore
    }
    setHowToOpen(false);
  }, []);

  const loadPicks = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const res = await fetch("/api/picks", { headers: authHeader, cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;
      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      console.error(e);
      setErr("Could not load picks right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [games]);

  const stats = useMemo(() => {
    const totalMatches = sortedGames.length;

    const matchesPicked = sortedGames.reduce((acc, g) => {
      const anyPick = (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no");
      return acc + (anyPick ? 1 : 0);
    }, 0);

    const totalPicks = sortedGames.reduce((acc, g) => {
      const picksInGame = (g.questions || []).reduce((a, q) => a + (q.userPick ? 1 : 0), 0);
      return acc + picksInGame;
    }, 0);

    // live = started within last 6 hours (we don't have endTime)
    const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

    let liveGame: ApiGame | null = null;
    for (const g of sortedGames) {
      const startMs = new Date(g.startTime).getTime();
      const diff = nowMs - startMs;
      if (diff >= 0 && diff <= LIVE_WINDOW_MS) {
        liveGame = g;
        break;
      }
    }

    let nextGame: ApiGame | null = null;
    for (const g of sortedGames) {
      const startMs = new Date(g.startTime).getTime();
      if (startMs > nowMs) {
        nextGame = g;
        break;
      }
    }

    return {
      totalMatches,
      matchesPicked,
      totalPicks,
      liveGame,
      nextGame,
    };
  }, [sortedGames, nowMs]);

  // Mini dashboard values (these depend on your leaderboard/streak backend)
  // We keep them non-invented: show placeholders until your leaderboard summary is wired.
  const currentStreakText = "—";
  const leaderStreakText = "—";
  const eligibleText = "—";

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;

    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";

    const matchSlug = slugify(g.match);

    return (
      <Link
        href={`/picks/${matchSlug}`}
        className="block rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
          textDecoration: "none",
        }}
        title="Open match"
      >
        <div
          className="p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          {/* Top line: logos left, date right */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamLogo teamName={homeName} size={46} />
              <div className="text-white/60 font-black text-[12px] w-[22px] text-center">VS</div>
              <TeamLogo teamName={awayName || "AFL"} size={46} />
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-white/70 font-semibold whitespace-nowrap">
                {formatAedt(g.startTime)}
              </div>
            </div>
          </div>

          {/* Match name gets its own full-width line (fixes truncation) */}
          <div className="mt-3 text-[16px] sm:text-[18px] font-black text-white leading-tight">
            {g.match}
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {g.questions.length}/12 questions
            </span>

            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
              style={{
                borderColor: "rgba(255,46,77,0.28)",
                background: "rgba(255,46,77,0.10)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {lockMs <= 0 ? "LOCKED" : `Locks in ${msToCountdown(lockMs)}`}
            </span>

            <span className="text-[11px] font-semibold text-white/55">Locks at bounce (auto)</span>
          </div>
        </div>

        <div
          className="px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "rgba(0,0,0,0.92)",
          }}
        >
          <div className="text-[12px] font-semibold" style={{ color: "rgba(0,0,0,0.70)" }}>
            {g.venue}
          </div>

          <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
            12 questions (pick any amount)
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(0,0,0,0.10)",
                background: `linear-gradient(180deg, ${COLORS.red} 0%, rgba(255,46,77,0.82) 100%)`,
                color: "rgba(255,255,255,0.98)",
                boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
              }}
            >
              PLAY NOW
            </span>
          </div>
        </div>
      </Link>
    );
  };

  const urgency = useMemo(() => {
    if (stats.liveGame) {
      const slug = slugify(stats.liveGame.match);
      return {
        mode: "live" as const,
        title: "LIVE NOW",
        match: stats.liveGame.match,
        sub: "Questions are locked. Results land live.",
        href: `/picks/${slug}`,
      };
    }
    if (stats.nextGame) {
      const ms = new Date(stats.nextGame.startTime).getTime() - nowMs;
      const slug = slugify(stats.nextGame.match);
      return {
        mode: "next" as const,
        title: "NEXT LOCK",
        match: stats.nextGame.match,
        sub: `Locks in ${msToCountdown(ms)}`,
        href: `/picks/${slug}`,
      };
    }
    return null;
  }, [stats.liveGame, stats.nextGame, nowMs]);

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <HowToPlayModal open={howToOpen} onClose={closeHowTo} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Title block (no AFL icon) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-black">Picks</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,46,77,0.35)",
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
              Tap a match → picks page → locks at bounce. No distractions.
            </p>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Mini dashboard + button */}
        <div
          className="mt-5 rounded-2xl border p-4"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-6 flex-1">
              <div>
                <div className="text-[12px] uppercase tracking-widest text-white/55">Current</div>
                <div className="mt-1 text-[18px] font-black text-white">{currentStreakText}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-widest text-white/55">Leader</div>
                <div className="mt-1 text-[18px] font-black text-white">{leaderStreakText}</div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-widest text-white/55">Eligible</div>
                <div className="mt-1 text-[18px] font-black text-white">{eligibleText}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHowToOpen(true)}
              className="rounded-full border px-5 py-2 text-[12px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              How to play
            </button>
          </div>

          {/* Fill the empty space: Round snapshot / urgency */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div
              className="rounded-2xl border p-4 lg:col-span-2"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              {urgency ? (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{
                          borderColor: urgency.mode === "live" ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.16)",
                          background: urgency.mode === "live" ? "rgba(255,46,77,0.14)" : "rgba(255,255,255,0.05)",
                          color: "rgba(255,255,255,0.95)",
                        }}
                      >
                        {urgency.title}
                      </span>
                      <span className="text-[12px] text-white/70 font-semibold">{urgency.sub}</span>
                    </div>

                    <div className="mt-2 text-[16px] sm:text-[18px] font-black text-white truncate">
                      {urgency.match}
                    </div>

                    <div className="mt-1 text-[12px] text-white/60">{urgency.mode === "live" ? urgency.sub : "Picks auto-lock at bounce."}</div>
                  </div>

                  <Link
                    href={urgency.href}
                    className="shrink-0 rounded-xl border px-4 py-2 text-[12px] font-black"
                    style={{
                      borderColor: "rgba(255,46,77,0.45)",
                      background: "rgba(255,46,77,0.12)",
                      color: "rgba(255,255,255,0.95)",
                      textDecoration: "none",
                    }}
                  >
                    Open
                  </Link>
                </div>
              ) : (
                <div className="text-[13px] text-white/70">No scheduled matches yet.</div>
              )}
            </div>

            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              <div className="text-[12px] uppercase tracking-widest text-white/55">Round snapshot</div>
              <div className="mt-2 text-[18px] font-black text-white">
                {stats.matchesPicked}/{stats.totalMatches} <span className="text-white/60 text-[14px] font-black">matches picked</span>
              </div>
              <div className="mt-1 text-[12px] text-white/60">
                {stats.totalPicks} total picks selected
              </div>
              <div className="mt-3 text-[12px] text-white/60">
                Pick any amount. One wrong pick wipes that match streak.
              </div>
            </div>
          </div>
        </div>

        {/* Matches */}
        <div className="mt-7">
          <div className="text-[12px] uppercase tracking-widest text-white/55">Scheduled matches</div>
          <div className="mt-1 text-[14px] text-white/75">
            Pick any amount — questions live inside the match page.
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="h-[160px] bg-white/5" />
                  <div className="h-[120px]" style={{ background: "rgba(255,255,255,0.92)" }} />
                </div>
              ))}
            </div>
          ) : sortedGames.length === 0 ? (
            <div
              className="mt-4 rounded-2xl border p-4 text-sm text-white/70"
              style={{
                borderColor: "rgba(255,46,77,0.35)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              No games found.
            </div>
          ) : (
            <div className="mt-4 relative">
              {/* Subtle AFL silhouette behind cards */}
              <div className="pointer-events-none absolute inset-0 -top-8 opacity-[0.06]">
                <Image
                  src="/afl1.png"
                  alt=""
                  fill
                  sizes="100vw"
                  style={{ objectFit: "contain" }}
                  priority={false}
                />
              </div>

              <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedGames.map((g) => (
                  <MatchCard key={g.id} g={g} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 pb-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>
          <span className="font-black" style={{ color: COLORS.red }}>
            Torpie
          </span>{" "}
          — Pick any amount. Locks at bounce.
        </div>
      </div>
    </div>
  );
}
