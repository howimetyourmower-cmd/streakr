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
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 44,
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
          color: "rgba(255,255,255,0.70)",
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
        style={{ background: "rgba(0,0,0,0.70)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-3xl border p-6"
        style={{
          borderColor: "rgba(255,255,255,0.14)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 65%, rgba(0,0,0,0.96) 100%)",
          boxShadow: "0 22px 70px rgba(0,0,0,0.80)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/55">How to play</div>
            <h2 className="mt-1 text-2xl font-black text-white">Torpie Picks</h2>
          </div>
          <button
            className="rounded-xl border px-3 py-2 text-[12px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-3 text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>
          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
            <div className="font-black text-white">1) Pick any amount</div>
            <div className="mt-1 text-white/75">Choose 0–12 questions. Use X to clear a pick.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
            <div className="font-black text-white">2) Locks at bounce</div>
            <div className="mt-1 text-white/75">At match start, picks auto-lock. No “Lock In” button needed.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
            <div className="font-black text-white">3) Streak is all-or-nothing</div>
            <div className="mt-1 text-white/75">One wrong pick ends the streak. Voids don’t count.</div>
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-2xl px-5 py-3 text-[14px] font-black border"
          style={{
            borderColor: "rgba(255,46,77,0.35)",
            background: `linear-gradient(180deg, ${COLORS.red} 0%, rgba(255,46,77,0.82) 100%)`,
            color: "rgba(255,255,255,0.98)",
            boxShadow: "0 14px 36px rgba(255,46,77,0.18)",
          }}
          onClick={onClose}
        >
          GOT IT
        </button>
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

  // countdown ticker (logos won't flash because TeamLogo locks candidates and stops after dead)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // show once per device
    try {
      const key = "torpie_seen_how_to_play_picks_v1";
      const seen = window.localStorage.getItem(key);
      if (!seen) {
        setHowToOpen(true);
        window.localStorage.setItem(key, "1");
      }
    } catch {}
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

  // Lightweight dashboard (placeholders unless you wire a stats endpoint later)
  const dashboard = useMemo(() => {
    // You can replace these later with real values from an API (current streak, leader streak, eligibility).
    // For now we still fill the space nicely.
    const current = user ? "—" : "—";
    const leader = "—";
    const eligible = user ? "—" : "Sign in";
    return { current, leader, eligible };
  }, [user]);

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
          {/* Row 1: logos + time */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamLogo teamName={homeName} size={44} />
              <div className="text-white/60 font-black text-[12px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={44} />
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] text-white/70 font-semibold">{formatAedt(g.startTime)}</div>
            </div>
          </div>

          {/* Row 2: match name UNDER logos (fixes the overlap/truncation issue) */}
          <div className="mt-3">
            <div className="text-[18px] font-black text-white leading-snug break-words">
              {homeName}
              {awayName ? (
                <span className="text-white/70"> {" "}vs{" "} </span>
              ) : null}
              {awayName}
            </div>
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
              {lockMs <= 0 ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
            </span>

            <span className="text-[12px] font-semibold text-white/60">Locks at bounce (auto)</span>
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

            {/* Removed "Focus mode" per your instruction */}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <HowToPlayModal open={howToOpen} onClose={() => setHowToOpen(false)} />

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

            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
              Tap a match → picks auto-lock at bounce. No lock-in button.
            </p>
          </div>
        </div>

        {/* Dashboard row (fills the empty space with the stats + a tip) */}
        <div
          className="mt-6 rounded-2xl border overflow-hidden"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div className="p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] uppercase tracking-widest text-white/55">Dashboard</div>

              <button
                className="rounded-xl border px-4 py-2 text-[12px] font-black"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.85)",
                }}
                onClick={() => setHowToOpen(true)}
              >
                How to play
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-2xl border p-3"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}
              >
                <div className="text-[11px] uppercase tracking-widest text-white/55">Current score</div>
                <div className="mt-1 text-[20px] font-black text-white">{dashboard.current}</div>
              </div>

              <div
                className="rounded-2xl border p-3"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}
              >
                <div className="text-[11px] uppercase tracking-widest text-white/55">Leader score</div>
                <div className="mt-1 text-[20px] font-black text-white">{dashboard.leader}</div>
              </div>

              <div
                className="rounded-2xl border p-3"
                style={{ borderColor: "rgba(255,46,77,0.22)", background: "rgba(255,46,77,0.10)" }}
              >
                <div className="text-[11px] uppercase tracking-widest text-white/70">Eligible</div>
                <div className="mt-1 text-[20px] font-black text-white">{dashboard.eligible}</div>
              </div>
            </div>

            <div className="text-[12px] text-white/65">
              Tip: pick any amount. At bounce, picks lock automatically.
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Matches */}
        <div className="mt-8">
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedGames.map((g) => (
                <MatchCard key={g.id} g={g} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 pb-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.50)" }}>
          <span className="font-black" style={{ color: COLORS.red }}>
            Torpie
          </span>{" "}
          — Dashboard → Match page → Auto-lock.
        </div>
      </div>
    </div>
  );
}
