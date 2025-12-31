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
  isSponsorQuestion?: boolean;
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

// NOTE: we purposely keep this flexible so we don't invent a new structure.
// If your /api/picks already returns these, great. If not, this stays null-safe.
type DashboardApi = {
  currentStreak?: number;
  bestStreak?: number;
  leaderStreak?: number;
  distanceToLeader?: number;
  eligibleToWin?: boolean;
  leaderName?: string | null;
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

  if (!slug || dead) {
    const initials = (teamName || "AFL")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("");
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black shrink-0"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.78)",
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
      className="relative rounded-2xl border overflow-hidden shrink-0"
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
              setDead(true); // stop retry loop => no flashing
              return p;
            });
          }}
        />
      </div>
    </div>
  );
});

function DashboardStrip({
  dash,
  loading,
  onHowToPlay,
}: {
  dash: DashboardApi | null;
  loading: boolean;
  onHowToPlay: () => void;
}) {
  const current = typeof dash?.currentStreak === "number" ? dash!.currentStreak : null;
  const dist =
    typeof dash?.distanceToLeader === "number"
      ? dash!.distanceToLeader
      : typeof dash?.leaderStreak === "number" && typeof dash?.currentStreak === "number"
        ? Math.max(0, dash!.leaderStreak - dash!.currentStreak)
        : null;

  const eligible = typeof dash?.eligibleToWin === "boolean" ? dash!.eligibleToWin : null;

  return (
    <div
      className="mt-4 rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/55">Current</div>
          <div className="mt-0.5 text-[16px] font-black text-white">
            {loading ? "—" : current === null ? "—" : current}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/55">Behind leader</div>
          <div className="mt-0.5 text-[16px] font-black text-white">
            {loading ? "—" : dist === null ? "—" : dist}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-white/55">Eligible</div>
          <div
            className="mt-0.5 text-[16px] font-black"
            style={{ color: eligible === null ? "rgba(255,255,255,0.92)" : eligible ? "rgba(25,195,125,0.95)" : COLORS.red }}
          >
            {loading ? "—" : eligible === null ? "—" : eligible ? "YES" : "NO"}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onHowToPlay}
        className="shrink-0 rounded-full border px-3 py-2 text-[11px] font-black active:scale-[0.99]"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.90)",
        }}
      >
        How to play
      </button>
    </div>
  );
}

function HowToPlayModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.70)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl border overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(10,10,10,0.98)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.85)",
        }}
      >
        <div className="p-5">
          <div className="text-[16px] font-black text-white">How to play</div>
          <div className="mt-3 space-y-2 text-[13px]" style={{ color: "rgba(255,255,255,0.78)" }}>
            <div className="flex gap-2">
              <span className="font-black" style={{ color: COLORS.red }}>1.</span>
              <span>Pick any amount (0–12) per match.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-black" style={{ color: COLORS.red }}>2.</span>
              <span>Picks lock automatically at bounce.</span>
            </div>
            <div className="flex gap-2">
              <span className="font-black" style={{ color: COLORS.red }}>3.</span>
              <span>Clean Sweep: one wrong pick resets your streak. Voids don’t break it.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl border px-4 py-3 text-[13px] font-black active:scale-[0.99]"
            style={{
              borderColor: "rgba(255,46,77,0.50)",
              background: "rgba(255,46,77,0.16)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "0 10px 30px rgba(255,46,77,0.16)",
            }}
          >
            GOT IT
          </button>

          <div className="mt-3 text-[11px] text-white/50">
            No gambling. No odds. Just survive.
          </div>
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

  // dashboard (null-safe; doesn't invent structures)
  const [dash, setDash] = useState<DashboardApi | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // countdown ticker (once/sec). logos won't flash because TeamLogo stops retry loops.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const HOW_TO_KEY = "torpie_seen_how_to_play_picks_v1";
  const [howToOpen, setHowToOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(HOW_TO_KEY);
      if (!seen) setHowToOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const closeHowTo = useCallback(() => {
    setHowToOpen(false);
    try {
      localStorage.setItem(HOW_TO_KEY, "1");
    } catch {
      // ignore
    }
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

      const data = (await res.json()) as any;

      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);

      // If your API already includes dashboard fields, we pick them up without inventing.
      const d: DashboardApi = {
        currentStreak: typeof data?.currentStreak === "number" ? data.currentStreak : undefined,
        bestStreak: typeof data?.bestStreak === "number" ? data.bestStreak : undefined,
        leaderStreak: typeof data?.leaderStreak === "number" ? data.leaderStreak : undefined,
        distanceToLeader: typeof data?.distanceToLeader === "number" ? data.distanceToLeader : undefined,
        eligibleToWin: typeof data?.eligibleToWin === "boolean" ? data.eligibleToWin : undefined,
        leaderName: typeof data?.leaderName === "string" ? data.leaderName : undefined,
      };
      setDash(Object.values(d).some((v) => v !== undefined && v !== null) ? d : dash);
    } catch (e) {
      console.error(e);
      setErr("Could not load picks right now.");
    } finally {
      setLoading(false);
    }
  }, [user, dash]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  // Optional: poll dashboard less frequently (no flashing UI). Only if API already supports it.
  useEffect(() => {
    let alive = true;
    async function tick() {
      if (!user) return;
      setDashLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/picks", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as any;

        const d: DashboardApi = {
          currentStreak: typeof data?.currentStreak === "number" ? data.currentStreak : undefined,
          bestStreak: typeof data?.bestStreak === "number" ? data.bestStreak : undefined,
          leaderStreak: typeof data?.leaderStreak === "number" ? data.leaderStreak : undefined,
          distanceToLeader: typeof data?.distanceToLeader === "number" ? data.distanceToLeader : undefined,
          eligibleToWin: typeof data?.eligibleToWin === "boolean" ? data.eligibleToWin : undefined,
          leaderName: typeof data?.leaderName === "string" ? data.leaderName : undefined,
        };

        if (!alive) return;
        setDash(Object.values(d).some((v) => v !== undefined && v !== null) ? d : null);
      } catch {
        // ignore
      } finally {
        if (alive) setDashLoading(false);
      }
    }

    // every 20s is enough for “live enough” without re-render spam
    const id = window.setInterval(() => tick(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user]);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  // Show ALL games (no slice)
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [games]);

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";
    const matchSlug = slugify(g.match);

    return (
      <Link
        href={`/picks/${matchSlug}`}
        className="relative block rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
          textDecoration: "none",
        }}
        title="Open match"
      >
        {/* Subtle AFL silhouette behind the whole card */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]">
          <Image src="/afl1.png" alt="" fill sizes="400px" style={{ objectFit: "cover" }} />
        </div>

        <div
          className="relative p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* home always left */}
              <TeamLogo teamName={homeName} size={44} />
              <div className="text-white/60 font-black text-[12px] w-[22px] text-center">VS</div>
              <TeamLogo teamName={awayName || "AFL"} size={44} />
            </div>

            <div className="text-right min-w-0">
              <div className="text-[11px] text-white/70 font-semibold truncate">{formatAedt(g.startTime)}</div>
              <div className="mt-1 text-[16px] sm:text-[18px] font-black text-white truncate">{g.match}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
              {lockMs <= 0 ? "LIVE / LOCKED" : `Locks in ${msToCountdown(lockMs)}`}
            </span>

            <span className="text-[11px] font-semibold text-white/55">
              Locks at bounce (auto)
            </span>
          </div>
        </div>

        <div
          className="relative px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "rgba(0,0,0,0.92)",
          }}
        >
          <div className="text-[12px] font-semibold" style={{ color: "rgba(0,0,0,0.70)" }}>
            {g.venue}
          </div>

          <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
            Pick any amount — questions live inside match page.
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

            <span className="text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
              Focus mode
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <HowToPlayModal open={howToOpen} onClose={closeHowTo} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              {/* No AFL icon next to Picks */}
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
              Tap a match → focus mode → locks at bounce. No distractions.
            </p>

            <DashboardStrip dash={dash} loading={dashLoading} onHowToPlay={() => setHowToOpen(true)} />
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        <div className="mt-6">
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
          — Survive the bounce.
        </div>
      </div>
    </div>
  );
}
