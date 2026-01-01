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
  currentStreak?: number;
  leaderScore?: number;
};

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  green: "#2DFF7A",
  white: "#FFFFFF",
};

const HOW_TO_PLAY_PICKS_KEY = "torpie_seen_how_to_play_picks_v1";

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
  const m = Math.floor((total % 3600) / 60);
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

  if (n.includes("greater western sydney") || n === "gws" || n.includes("giants"))
    return "gws";
  if (n.includes("gold coast") || n.includes("suns")) return "goldcoast";
  if (n.includes("west coast") || n.includes("eagles")) return "westcoast";
  if (
    n.includes("western bulldogs") ||
    n.includes("bulldogs") ||
    n.includes("footscray")
  )
    return "westernbulldogs";
  if (n.includes("north melbourne") || n.includes("kangaroos"))
    return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (
    n.includes("st kilda") ||
    n.includes("saints") ||
    n.replace(/\s/g, "") === "stkilda"
  )
    return "stkilda";

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

  if (!slug) {
    const initials = teamName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("");
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.90)",
        }}
        title={teamName}
      >
        {initials || "AFL"}
      </div>
    );
  }

  if (dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.90)",
        }}
        title={teamName}
      >
        {teamName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((x) => x[0]?.toUpperCase())
          .join("") || "AFL"}
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
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.35)",
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

function CheckIcon({
  size = 18,
  color = COLORS.green,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressTick({ on }: { on: boolean }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full border"
      style={{
        width: 22,
        height: 22,
        borderColor: on ? "rgba(45,255,122,0.55)" : "rgba(255,255,255,0.22)",
        background: on ? "rgba(45,255,122,0.12)" : "rgba(255,255,255,0.06)",
      }}
      aria-label={on ? "picked" : "not picked"}
    >
      {on ? <CheckIcon size={16} /> : null}
    </div>
  );
}

/**
 * ✅ Fix: silhouette MUST be clipped to each card.
 * - Parent cards must have overflow-hidden
 * - This component is absolute inside the card and cannot escape
 * - Opacity tuned so it’s visible but never competes with text/logos
 */
function CardSilhouetteBg({
  opacity = 1,
}: {
  opacity?: number;
}) {
  return (
    <>
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

        {/* Tight readability layer so logos + match name POP */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.70) 60%, rgba(0,0,0,0.86) 100%)",
          }}
        />
      </div>
    </>
  );
}

function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-3xl border p-5 sm:p-6"
        style={{
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(10,10,10,0.96)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.75)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black">How to play</div>
            <div className="text-white/70 text-sm mt-1">
              Pick any amount. Locks at bounce. One wrong pick breaks the match streak.
            </div>
          </div>

          <button
            className="rounded-full px-3 py-2 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-white/85">
          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            <div className="font-black">1) Pick any amount</div>
            <div className="text-white/70 mt-1">Pick 0, 1, 5 or all 12 questions.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            <div className="font-black">2) Auto-lock</div>
            <div className="text-white/70 mt-1">No lock-in button. Picks lock at the game start time.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            <div className="font-black">3) Clean Sweep</div>
            <div className="text-white/70 mt-1">One wrong pick resets your streak for that match. Voids don’t count.</div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="rounded-2xl px-5 py-3 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,46,77,0.35)",
              background: "rgba(255,46,77,0.14)",
              color: "rgba(255,255,255,0.95)",
            }}
            onClick={onClose}
          >
            Let’s go
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

  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [leaderScore, setLeaderScore] = useState<number | null>(null);

  const [howOpen, setHowOpen] = useState(false);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(HOW_TO_PLAY_PICKS_KEY);
      if (!seen) setHowOpen(true);
    } catch {}
  }, []);

  const closeHow = useCallback(() => {
    try {
      localStorage.setItem(HOW_TO_PLAY_PICKS_KEY, "1");
    } catch {}
    setHowOpen(false);
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

      setCurrentStreak(typeof data.currentStreak === "number" ? data.currentStreak : 0);
      setLeaderScore(typeof data.leaderScore === "number" ? data.leaderScore : null);
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
    return [...games].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [games]);

  const gamesPicked = useMemo(() => {
    return games.filter((g) =>
      (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no")
    ).length;
  }, [games]);

  const eligible = gamesPicked > 0;

  const nextUp = useMemo(() => {
    const upcoming = sortedGames.filter((g) => new Date(g.startTime).getTime() > nowMs);
    return upcoming.length ? upcoming[0] : sortedGames[0] || null;
  }, [sortedGames, nowMs]);

  const distanceToLeader = useMemo(() => {
    if (leaderScore === null) return null;
    return Math.max(0, leaderScore - currentStreak);
  }, [leaderScore, currentStreak]);

  const DashboardStrip = () => {
    return (
      <div
        className="mt-4 rounded-2xl border px-3 py-3"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">
            Dashboard
          </div>

          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-[11px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
            onClick={() => setHowOpen(true)}
          >
            How to play
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <div
            className="shrink-0 rounded-2xl border px-4 py-3"
            style={{
              minWidth: 220,
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-black">
              Current streak
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="rounded-xl border px-3 py-2"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-[18px] font-black text-white">{currentStreak}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black text-white">Keep it alive</div>
                <div className="text-[11px] text-white/65 font-semibold leading-snug">
                  One wrong pick in a match resets to 0.
                </div>
              </div>
            </div>
          </div>

          <div
            className="shrink-0 rounded-2xl border px-4 py-3"
            style={{
              minWidth: 220,
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-black">
              Distance to leader
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="rounded-xl border px-3 py-2"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <span className="text-[18px] font-black text-white">
                  {leaderScore === null || distanceToLeader === null ? "—" : distanceToLeader}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black text-white">
                  {leaderScore === null ? "Leader not loaded" : `Leader at ${leaderScore}`}
                </div>
                <div className="text-[11px] text-white/65 font-semibold leading-snug">
                  Close the gap. Current streak only.
                </div>
              </div>
            </div>
          </div>

          <div
            className="shrink-0 rounded-2xl border px-4 py-3"
            style={{
              minWidth: 240,
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <div className="text-[10px] uppercase tracking-widest text-white/60 font-black">
              Eligible to win
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div
                className="rounded-xl border px-3 py-2 flex items-center justify-center"
                style={{
                  width: 46,
                  height: 42,
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                {eligible ? <CheckIcon /> : <span className="text-white font-black">—</span>}
              </div>

              <div className="min-w-0">
                <div className="text-[12px] font-black text-white">
                  {eligible ? "Eligible" : "Not yet"}
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <ProgressTick on={gamesPicked >= 1} />
                  <ProgressTick on={gamesPicked >= 2} />
                  <ProgressTick on={gamesPicked >= 3} />
                  <span className="text-[11px] font-semibold text-white/80 ml-1">
                    {gamesPicked} games picked
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-white/65 font-semibold">
              Tip: picks lock at bounce.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";
    const matchSlug = slugify(g.match);

    const picksCount =
      (g.questions || []).filter((q) => q.userPick === "yes" || q.userPick === "no").length || 0;

    const isLocked = lockMs <= 0;

    const badgeStyle = isLocked
      ? { borderColor: "rgba(255,46,77,0.55)", background: "rgba(255,46,77,0.18)" }
      : { borderColor: "rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.40)" };

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
      >
        {/* ✅ CRITICAL: overflow-hidden here ensures the silhouette cannot escape the card */}
        <div className="relative p-5 overflow-hidden" style={{ minHeight: 205 }}>
          <CardSilhouetteBg opacity={1} />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-white/85 font-semibold">
                {formatAedt(g.startTime)}
              </div>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  ...badgeStyle,
                  color: "rgba(255,255,255,0.96)",
                }}
              >
                {isLocked ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <TeamLogo teamName={homeName} size={50} />
              <div className="text-white/80 font-black text-[12px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={50} />
            </div>

            <div className="mt-3 text-center">
              <div
                className="text-[18px] sm:text-[19px] font-black leading-tight"
                style={{
                  color: "rgba(255,255,255,0.98)",
                  textShadow: "0 2px 12px rgba(0,0,0,0.70)",
                }}
              >
                {g.match}
              </div>
              <div
                className="mt-1 text-[12px] font-semibold truncate"
                style={{
                  color: "rgba(255,255,255,0.78)",
                  textShadow: "0 2px 10px rgba(0,0,0,0.60)",
                }}
              >
                {g.venue}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor:
                    picksCount > 0 ? "rgba(45,255,122,0.45)" : "rgba(255,255,255,0.14)",
                  background:
                    picksCount > 0 ? "rgba(45,255,122,0.10)" : "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                {picksCount}/12 picked
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {isLocked ? "Auto-locked" : "Auto-locks at bounce"}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-center">
              <span
                className="inline-flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,46,77,0.32)",
                  background:
                    "linear-gradient(180deg, rgba(255,46,77,0.95) 0%, rgba(255,46,77,0.72) 100%)",
                  color: "rgba(255,255,255,0.98)",
                  boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
                }}
              >
                PLAY NOW
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <HowToPlayModal open={howOpen} onClose={closeHow} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
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
            <div className="mt-1 text-[13px] text-white/65 font-semibold">
              Pick any amount. Survive the streak.
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        <DashboardStrip />

        {!loading && nextUp ? (
          <div className="mt-6">
            <Link
              href={`/picks/${slugify(nextUp.match)}`}
              className="block rounded-2xl overflow-hidden border"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                boxShadow: "0 22px 70px rgba(0,0,0,0.65)",
                textDecoration: "none",
              }}
            >
              {/* ✅ also clip the hero */}
              <div className="relative p-5 sm:p-6 overflow-hidden" style={{ minHeight: 180 }}>
                <CardSilhouetteBg opacity={1} />

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black border"
                      style={{
                        borderColor: "rgba(255,46,77,0.35)",
                        background: "rgba(255,46,77,0.12)",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      NEXT UP
                    </div>

                    <div className="text-[11px] text-white/80 font-semibold">
                      {new Date(nextUp.startTime).getTime() - nowMs <= 0
                        ? "LIVE / Locked"
                        : `Locks in ${msToCountdown(new Date(nextUp.startTime).getTime() - nowMs)}`}
                    </div>
                  </div>

                  {(() => {
                    const m = splitMatch(nextUp.match);
                    const homeName = m?.home ?? nextUp.match;
                    const awayName = m?.away ?? "";
                    return (
                      <div className="mt-4 flex items-center justify-center gap-4">
                        <TeamLogo teamName={homeName} size={54} />
                        <div className="text-white/80 font-black text-[13px]">vs</div>
                        <TeamLogo teamName={awayName || "AFL"} size={54} />
                      </div>
                    );
                  })()}

                  <div className="mt-3 text-center">
                    <div
                      className="text-[22px] sm:text-[28px] font-black leading-tight"
                      style={{
                        color: "rgba(255,255,255,0.98)",
                        textShadow: "0 2px 12px rgba(0,0,0,0.70)",
                      }}
                    >
                      {nextUp.match}
                    </div>
                    <div
                      className="mt-2 text-[12px] font-semibold"
                      style={{
                        color: "rgba(255,255,255,0.78)",
                        textShadow: "0 2px 10px rgba(0,0,0,0.60)",
                      }}
                    >
                      {formatAedt(nextUp.startTime)} • {nextUp.venue}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ) : null}

        <div className="mt-8">
          <div className="text-[12px] uppercase tracking-widest text-white/55 font-black">
            Scheduled matches
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
                  <div className="h-[205px] bg-white/5" />
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedGames.map((g) => (
                <MatchCard key={g.id} g={g} />
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-10 pb-8 text-center text-[11px]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          TORPIE © 2026
        </div>
      </div>
    </div>
  );
}
