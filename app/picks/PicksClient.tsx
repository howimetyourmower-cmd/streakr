// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
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

  // Optional (won’t break if API doesn’t send)
  currentScore?: number;
  leaderScore?: number;
  eligible?: boolean | null;
};

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
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

  if (
    n.includes("greater western sydney") ||
    n === "gws" ||
    n.includes("giants")
  )
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

  const initials =
    teamName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "AFL";

  if (!slug || dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.85)",
        }}
        title={teamName}
      >
        {initials}
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
              setDead(true); // stop trying -> no flashing
              return p;
            });
          }}
        />
      </div>
    </div>
  );
});

type FilterKey = "all" | "upcoming" | "live" | "finished";

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Optional dashboard values (safe if API doesn’t send them)
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [leaderScore, setLeaderScore] = useState<number | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);

  const [filter, setFilter] = useState<FilterKey>("all");

  // countdown tick
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

      setCurrentScore(typeof data.currentScore === "number" ? data.currentScore : null);
      setLeaderScore(typeof data.leaderScore === "number" ? data.leaderScore : null);
      setEligible(typeof data.eligible === "boolean" ? data.eligible : null);
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

  const computedGames = useMemo(() => {
    return sortedGames.map((g) => {
      const startMs = new Date(g.startTime).getTime();
      const lockMs = startMs - nowMs;
      const isLive = lockMs <= 0;
      const isFinished =
        g.questions?.length > 0 &&
        g.questions.every((q) => q.status === "final" || q.status === "void");
      return { g, lockMs, isLive, isFinished };
    });
  }, [sortedGames, nowMs]);

  const filteredGames = useMemo(() => {
    if (filter === "all") return computedGames;
    if (filter === "upcoming") return computedGames.filter((x) => !x.isLive && !x.isFinished);
    if (filter === "live") return computedGames.filter((x) => x.isLive && !x.isFinished);
    if (filter === "finished") return computedGames.filter((x) => x.isFinished);
    return computedGames;
  }, [computedGames, filter]);

  const nextUp = useMemo(() => {
    // Next upcoming game (not finished)
    const upcoming = computedGames.find((x) => !x.isFinished && x.lockMs > 0);
    return upcoming ?? computedGames.find((x) => !x.isFinished) ?? null;
  }, [computedGames]);

  const behindLeader =
    currentScore != null && leaderScore != null ? Math.max(0, leaderScore - currentScore) : null;

  const FilterChip = ({
    k,
    label,
  }: {
    k: FilterKey;
    label: string;
  }) => {
    const active = filter === k;
    return (
      <button
        type="button"
        onClick={() => setFilter(k)}
        className="px-3 py-1 rounded-full border text-[11px] font-black transition"
        style={{
          borderColor: active ? "rgba(255,46,77,0.45)" : "rgba(255,255,255,0.14)",
          background: active ? "rgba(255,46,77,0.12)" : "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {label}
      </button>
    );
  };

  const MatchCard = ({
    g,
    lockMs,
    isLive,
    isFinished,
  }: {
    g: ApiGame;
    lockMs: number;
    isLive: boolean;
    isFinished: boolean;
  }) => {
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";
    const matchSlug = slugify(g.match);

    const urgent = lockMs > 0 && lockMs <= 60 * 60 * 1000; // < 60 mins

    return (
      <Link
        href={`/picks/${matchSlug}`}
        className="group block rounded-2xl overflow-hidden border transition"
        style={{
          borderColor: isLive
            ? "rgba(255,46,77,0.40)"
            : "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: isLive
            ? "0 18px 55px rgba(255,46,77,0.10)"
            : "0 18px 55px rgba(0,0,0,0.75)",
          textDecoration: "none",
          transform: "translateY(0px)",
        }}
        title="Open match"
      >
        {/* TOP */}
        <div
          className="relative p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          {/* subtle silhouette */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
            <Image
              src="/afl1.png"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ objectFit: "cover" }}
              priority={false}
            />
          </div>

          <div className="relative flex items-start justify-between gap-3">
            {/* Logos + team names BELOW (fix your “names showing” issue) */}
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <TeamLogo teamName={homeName} size={46} />
                <div className="text-white/60 font-black text-[12px] mt-1">vs</div>
                <TeamLogo teamName={awayName || "AFL"} size={46} />
              </div>

              <div className="mt-2 leading-tight">
                <div className="text-[13px] font-black text-white/90 truncate">
                  {homeName}
                </div>
                <div className="text-[13px] font-black text-white/90 truncate">
                  {awayName || ""}
                </div>
              </div>
            </div>

            <div className="text-right min-w-[120px]">
              <div className="text-[11px] text-white/70 font-semibold">
                {formatAedt(g.startTime)}
              </div>
              <div className="mt-1 text-[16px] font-black text-white/95 leading-snug">
                {/* allow wrap instead of ugly truncation */}
                <span className="block max-w-[180px] sm:max-w-[220px] text-right">
                  {g.match}
                </span>
              </div>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center gap-2">
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
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border ${
                urgent && !isLive ? "animate-pulse" : ""
              }`}
              style={{
                borderColor: isLive
                  ? "rgba(255,46,77,0.45)"
                  : urgent
                  ? "rgba(255,46,77,0.45)"
                  : "rgba(255,46,77,0.28)",
                background: isLive
                  ? "rgba(255,46,77,0.14)"
                  : urgent
                  ? "rgba(255,46,77,0.14)"
                  : "rgba(255,46,77,0.10)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {isFinished ? "Finished" : isLive ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
            </span>

            <span className="text-[11px] font-semibold text-white/60">
              Locks at bounce (auto)
            </span>
          </div>

          {/* hover lift */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition"
            style={{
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          />
        </div>

        {/* BOTTOM */}
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

            {/* ✅ removed “Focus mode” per your request */}
          </div>
        </div>
      </Link>
    );
  };

  const FeaturedHero = () => {
    if (!nextUp) return null;

    const { g, lockMs, isLive, isFinished } = nextUp;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";

    const matchSlug = slugify(g.match);

    return (
      <Link
        href={`/picks/${matchSlug}`}
        className="block rounded-3xl border overflow-hidden"
        style={{
          borderColor: isLive ? "rgba(255,46,77,0.45)" : "rgba(255,255,255,0.12)",
          background:
            "linear-gradient(135deg, rgba(255,46,77,0.24) 0%, rgba(0,0,0,0.86) 55%, rgba(0,0,0,0.94) 100%)",
          boxShadow: isLive
            ? "0 30px 90px rgba(255,46,77,0.12)"
            : "0 30px 90px rgba(0,0,0,0.75)",
          textDecoration: "none",
        }}
        title="Open next match"
      >
        <div className="relative p-6 sm:p-7">
          {/* silhouette */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
            <Image
              src="/afl1.png"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              style={{ objectFit: "cover" }}
              priority={false}
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-black">
                  Next Up
                </div>
                <div className="mt-1 text-[22px] sm:text-[26px] font-black text-white leading-tight">
                  {g.match}
                </div>
                <div className="mt-1 text-[12px] text-white/70 font-semibold">
                  {formatAedt(g.startTime)} • {g.venue}
                </div>
              </div>

              <div className="text-right">
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {g.questions.length}/12
                </div>
                <div
                  className="mt-2 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-black border"
                  style={{
                    borderColor: isLive ? "rgba(255,46,77,0.45)" : "rgba(255,46,77,0.28)",
                    background: isLive ? "rgba(255,46,77,0.14)" : "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {isFinished ? "Finished" : isLive ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <TeamLogo teamName={homeName} size={64} />
              <div className="text-white/70 font-black text-[14px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={64} />

              <div className="ml-auto hidden sm:flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[13px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.18)",
                    background: `linear-gradient(180deg, ${COLORS.red} 0%, rgba(255,46,77,0.82) 100%)`,
                    color: "rgba(255,255,255,0.98)",
                    boxShadow: "0 16px 44px rgba(255,46,77,0.20)",
                  }}
                >
                  PLAY NOW
                </span>
              </div>
            </div>

            <div className="mt-4 text-[12px] text-white/65 font-semibold">
              Pick any amount — picks auto-lock at bounce. No lock-in button.
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {/* subtle page depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 20% 10%, rgba(255,46,77,0.10) 0%, rgba(0,0,0,0) 60%), radial-gradient(900px 500px at 80% 20%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 60%)",
          opacity: 1,
        }}
      />

      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
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

            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.72)" }}>
              Tap a match → picks auto-lock at bounce. No lock-in button.
            </p>
          </div>

          <button
            type="button"
            className="hidden sm:inline-flex items-center rounded-full px-4 py-2 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.92)",
            }}
            onClick={() => {
              // if you later wire a modal: trigger it here
              alert("How to play:\n\n1) Pick any amount\n2) Locks at bounce\n3) Streak is all-or-nothing");
            }}
          >
            How to play
          </button>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* ✅ Featured Hero */}
        <div className="mt-6">
          <FeaturedHero />
        </div>

        {/* Dashboard (fills that “empty space” with game HUD energy) */}
        <div className="mt-6">
          <div className="text-[12px] uppercase tracking-widest text-white/55">Dashboard</div>

          <div
            className="mt-3 rounded-2xl border p-4 sm:p-5"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">
                  Current Score
                </div>
                <div className="mt-2 text-[28px] font-black text-white/95">
                  {currentScore ?? "—"}
                </div>
                <div className="mt-1 text-[12px] text-white/60 font-semibold">
                  {behindLeader == null
                    ? "Keep the streak alive."
                    : behindLeader === 0
                    ? "You’re leading 🔥"
                    : `${behindLeader} behind leader`}
                </div>
              </div>

              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">
                  Leader Score
                </div>
                <div className="mt-2 text-[28px] font-black text-white/95">
                  {leaderScore ?? "—"}
                </div>
                <div className="mt-1 text-[12px] text-white/60 font-semibold">
                  Chase them down.
                </div>
              </div>

              <div
                className="rounded-2xl border p-4 flex flex-col justify-between"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">
                    Eligible
                  </div>
                  <div className="mt-3">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-black border"
                      style={{
                        borderColor:
                          eligible === true
                            ? "rgba(120,255,170,0.35)"
                            : eligible === false
                            ? "rgba(255,46,77,0.40)"
                            : "rgba(255,255,255,0.14)",
                        background:
                          eligible === true
                            ? "rgba(120,255,170,0.10)"
                            : eligible === false
                            ? "rgba(255,46,77,0.12)"
                            : "rgba(255,255,255,0.05)",
                        color: "rgba(255,255,255,0.92)",
                      }}
                    >
                      {eligible === true ? "YES" : eligible === false ? "NO" : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 text-[12px] text-white/60 font-semibold">
                  Tip: pick any amount. Locks at bounce.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <FilterChip k="all" label="All" />
          <FilterChip k="upcoming" label="Upcoming" />
          <FilterChip k="live" label="Live / Locked" />
          <FilterChip k="finished" label="Finished" />
        </div>

        {/* Matches */}
        <div className="mt-6">
          <div className="text-[12px] uppercase tracking-widest text-white/55">Scheduled Matches</div>
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
                  <div className="h-[170px] bg-white/5" />
                  <div className="h-[120px]" style={{ background: "rgba(255,255,255,0.92)" }} />
                </div>
              ))}
            </div>
          ) : filteredGames.length === 0 ? (
            <div
              className="mt-4 rounded-2xl border p-4 text-sm text-white/70"
              style={{
                borderColor: "rgba(255,46,77,0.35)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              No games found for this filter.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map(({ g, lockMs, isLive, isFinished }) => (
                <MatchCard key={g.id} g={g} lockMs={lockMs} isLive={isLive} isFinished={isFinished} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 pb-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>
          <span className="font-black" style={{ color: COLORS.red }}>
            Torpie
          </span>{" "}
          — Picks auto-lock at bounce.
        </div>
      </div>
    </div>
  );
}
