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
  currentStreak?: number; // ✅ real streak from API
  leaderScore?: number; // optional (wire later)
};

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  green: "#2DFF7A",
  white: "#FFFFFF",
};

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
  if (n.includes("western bulldogs") || n.includes("bulldogs") || n.includes("footscray"))
    return "westernbulldogs";
  if (n.includes("north melbourne") || n.includes("kangaroos")) return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (n.includes("st kilda") || n.includes("saints") || n.replace(/\s/g, "") === "stkilda")
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

function homeTeamImageCandidates(teamSlug: TeamSlug): string[] {
  return [
    `/afl/grounds/${teamSlug}.jpg`,
    `/afl/grounds/${teamSlug}.jpeg`,
    `/afl/grounds/${teamSlug}.png`,
    `/afl1.png`,
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
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.85)",
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
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.75)",
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
              setDead(true); // stop rendering Image → no flashing
              return p;
            });
          }}
        />
      </div>
    </div>
  );
});

function CheckIcon({ size = 18, color = COLORS.green }: { size?: number; color?: string }) {
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

function HomeTeamBg({
  homeTeamName,
  overlay = true,
}: {
  homeTeamName: string;
  overlay?: boolean;
}) {
  const slug = teamNameToSlug(homeTeamName);
  const [idx, setIdx] = useState(0);
  const candidates = slug ? homeTeamImageCandidates(slug) : ["/afl1.png"];

  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <>
      <div className="absolute inset-0">
        <Image
          src={src}
          alt=""
          fill
          priority={false}
          sizes="(max-width: 1024px) 100vw, 1024px"
          style={{ objectFit: "cover" }}
          className="opacity-30"
          onError={() => setIdx((p) => Math.min(p + 1, candidates.length - 1))}
        />
      </div>

      {overlay ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.80) 70%, rgba(0,0,0,0.92) 100%)",
          }}
        />
      ) : null}
    </>
  );
}

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✅ real values from API (with safe fallbacks)
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [leaderScore, setLeaderScore] = useState<number | null>(null);

  // How to play modal
  const [howOpen, setHowOpen] = useState(false);

  // updates every second for countdown
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
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

      const res = await fetch("/api/picks", {
        headers: authHeader,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;

      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);

      // ✅ real streak
      setCurrentStreak(typeof data.currentStreak === "number" ? data.currentStreak : 0);

      // optional leader score
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

  // ✅ picks-per-game logic (real)
  const gamesPicked = useMemo(() => {
    return games.filter((g) =>
      (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no")
    ).length;
  }, [games]);

  // Eligible meaning: show label + progress ticks; (you can change rule later)
  const eligible = gamesPicked > 0;

  const nextUp = useMemo(() => {
    const upcoming = sortedGames.filter((g) => new Date(g.startTime).getTime() > nowMs);
    return upcoming.length ? upcoming[0] : sortedGames[0] || null;
  }, [sortedGames, nowMs]);

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
        {/* ✅ image for each home team (background) */}
        <div className="relative p-5" style={{ minHeight: 190 }}>
          <HomeTeamBg homeTeamName={homeName} />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-white/70 font-semibold">
                {formatAedt(g.startTime)}
              </div>
              <div className="text-[11px] text-white/55 font-semibold truncate max-w-[55%] text-right">
                {g.venue}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <TeamLogo teamName={homeName} size={48} />
              <div className="text-white/60 font-black text-[12px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={48} />
            </div>

            <div className="mt-3 text-center">
              <div className="text-[18px] font-black text-white leading-tight">{g.match}</div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                12 questions available
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,46,77,0.28)",
                  background: "rgba(255,46,77,0.10)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {lockMs <= 0 ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
              </span>
            </div>
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
            Pick any amount — questions live inside the match page.
          </div>

          <div className="mt-3">
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

  const NextUpHero = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";

    return (
      <Link
        href={`/picks/${slugify(g.match)}`}
        className="block rounded-3xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 26px 80px rgba(0,0,0,0.65)",
          textDecoration: "none",
        }}
      >
        <div className="relative p-6 sm:p-7" style={{ minHeight: 250 }}>
          {/* ✅ home team image in hero */}
          <HomeTeamBg homeTeamName={homeName} />

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

              <div className="text-[11px] text-white/70 font-semibold">
                {lockMs <= 0 ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4">
              <TeamLogo teamName={homeName} size={56} />
              <div className="text-white/70 font-black text-[13px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={56} />
            </div>

            <div className="mt-4 text-center">
              <div className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {g.match}
              </div>
              <div className="mt-2 text-sm text-white/70 font-semibold">
                {formatAedt(g.startTime)} • {g.venue}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                12 questions available
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Header */}
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
            {/* ✅ removed the "Tap a match..." line (as requested) */}
          </div>

          {/* ✅ How to play works (modal) */}
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[12px] font-black border"
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

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Next Up Hero */}
        {!loading && nextUp ? (
          <div className="mt-6">
            <NextUpHero g={nextUp} />
          </div>
        ) : null}

        {/* Dashboard */}
        <div
          className="mt-6 rounded-3xl border p-5 sm:p-6"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-white/60">Dashboard</div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Current Score */}
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <div className="text-[11px] font-black text-white/70 uppercase tracking-widest">
                Current score
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-xl border px-3 py-2"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[18px] font-black text-white">{currentStreak}</span>
                </div>
                <div className="text-white">
                  <div className="text-[14px] font-black text-white">
                    Streak at {currentStreak}
                  </div>
                  <div className="text-[11px] text-white/70 font-semibold">
                    Keep it alive. One wrong pick breaks the streak.
                  </div>
                </div>
              </div>
            </div>

            {/* Leader Score */}
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <div className="text-[11px] font-black text-white/70 uppercase tracking-widest">
                Leader score
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-xl border px-3 py-2"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[18px] font-black text-white">
                    {leaderScore === null ? "—" : leaderScore}
                  </span>
                </div>
                <div className="text-white">
                  <div className="text-[14px] font-black text-white">
                    Leader at {leaderScore === null ? "—" : leaderScore}
                  </div>
                  <div className="text-[11px] text-white/70 font-semibold">
                    Wire this to leaderboard API later.
                  </div>
                </div>
              </div>
            </div>

            {/* Eligible */}
            <div
              className="rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <div className="text-[11px] font-black text-white/70 uppercase tracking-widest">
                Eligible
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center rounded-xl border px-3 py-2"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  {eligible ? <CheckIcon /> : <span className="text-white font-black">—</span>}
                </div>

                <div className="text-white">
                  <div className="text-[14px] font-black text-white">
                    {eligible ? "Eligible" : "Not yet"}
                  </div>

                  {/* ✅ 3 ticks grey → green progressively */}
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressTick on={gamesPicked >= 1} />
                    <ProgressTick on={gamesPicked >= 2} />
                    <ProgressTick on={gamesPicked >= 3} />
                    <span className="text-[11px] font-semibold text-white/80 ml-2">
                      {gamesPicked} games picked
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] font-semibold text-white/70">
                Tip: pick any amount. Locks at bounce.
              </div>
            </div>
          </div>
        </div>

        {/* Matches */}
        <div className="mt-8">
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
                  <div className="h-[190px] bg-white/5" />
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedGames.map((g) => (
                <MatchCard key={g.id} g={g} />
              ))}
            </div>
          )}
        </div>

        {/* ✅ footer */}
        <div className="mt-10 pb-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          TORPIE © 2026
        </div>
      </div>

      {/* ✅ How to play modal (working) */}
      {howOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setHowOpen(false)}
          />

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
                  Quick rules so it’s crystal clear.
                </div>
              </div>

              <button
                className="rounded-full px-3 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                }}
                onClick={() => setHowOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-white/85">
              <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="font-black">1) Pick any amount</div>
                <div className="text-white/70 mt-1">
                  You can pick 0, 1, 5 or all 12 questions — up to you.
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="font-black">2) Locks at bounce</div>
                <div className="text-white/70 mt-1">
                  No lock-in button. Picks lock automatically when the game starts.
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="font-black">3) Streak rules</div>
                <div className="text-white/70 mt-1">
                  Keep your streak alive — one wrong pick breaks it.
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                <div className="font-black">4) Track your progress</div>
                <div className="text-white/70 mt-1">
                  The 3 ticks go green as you make picks in 1, 2, then 3 games.
                </div>
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
                onClick={() => setHowOpen(false)}
              >
                Let’s go
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
