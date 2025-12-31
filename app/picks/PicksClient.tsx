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

function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke={COLORS.green}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  // Dashboard metrics (safe + derived from picks)
  const gamesPicked = useMemo(() => {
    return games.filter((g) =>
      (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no")
    ).length;
  }, [games]);

  // Until you wire real streak/leader APIs, set sensible display defaults:
  const currentStreak = 5; // requested
  const leaderScore = 0; // placeholder (wire later)
  const eligible = gamesPicked > 0;

  // "3 games picked" display requested — show computed if available, else show 3 as a nice demo
  const gamesPickedDisplay = gamesPicked > 0 ? gamesPicked : 3;

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
        <div
          className="p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-white/70 font-semibold">
              {formatAedt(g.startTime)}
            </div>
            <div className="text-[11px] text-white/55 font-semibold truncate max-w-[55%] text-right">
              {g.venue}
            </div>
          </div>

          {/* Logos row */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <TeamLogo teamName={homeName} size={48} />
            <div className="text-white/60 font-black text-[12px]">vs</div>
            <TeamLogo teamName={awayName || "AFL"} size={48} />
          </div>

          {/* Match name on its own line (fixes truncation/ugly alignment) */}
          <div className="mt-3 text-center">
            <div className="text-[18px] font-black text-white leading-tight">
              {g.match}
            </div>
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
        <div
          className="p-6 sm:p-7"
          style={{
            background:
              "radial-gradient(1200px 500px at 20% 0%, rgba(255,46,77,0.22), transparent 55%), radial-gradient(900px 450px at 100% 30%, rgba(255,46,77,0.12), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.55))",
          }}
        >
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
            {/* removed the "Tap a match..." line as requested */}
          </div>

          <button
            type="button"
            className="rounded-full px-4 py-2 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
            onClick={() => {
              // you can wire your existing how-to-play modal handler here later
              // for now, keep the button present for UX
              window.dispatchEvent(new CustomEvent("torpie:howtoplay"));
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

        {/* Next Up Hero */}
        {!loading && nextUp ? (
          <div className="mt-6">
            <NextUpHero g={nextUp} />
          </div>
        ) : null}

        {/* Dashboard */}
        <div className="mt-6 rounded-3xl border p-5 sm:p-6"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[12px] uppercase tracking-widest text-white/60">
              Dashboard
            </div>
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
                    color: COLORS.white, // all white as requested
                  }}
                >
                  <span className="text-[18px] font-black text-white">
                    {currentStreak}
                  </span>
                </div>
                <div className="text-white">
                  <div className="text-[14px] font-black text-white">Streak at {currentStreak}</div>
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
                    color: COLORS.white, // all white as requested
                  }}
                >
                  <span className="text-[18px] font-black text-white">
                    {leaderScore || "—"}
                  </span>
                </div>
                <div className="text-white">
                  <div className="text-[14px] font-black text-white">
                    Leader at {leaderScore || "—"}
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
                    color: COLORS.white, // all white as requested
                  }}
                >
                  {eligible ? <CheckIcon /> : <span className="text-white font-black">—</span>}
                </div>

                <div className="text-white">
                  <div className="text-[14px] font-black text-white">
                    {eligible ? "Eligible" : "Not yet"}
                  </div>
                  <div className="text-[11px] text-white/70 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <CheckIcon size={16} />
                      <span className="text-white">
                        {gamesPickedDisplay} games picked
                      </span>
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
          <div className="text-[12px] uppercase tracking-widest text-white/55">
            Scheduled matches
          </div>
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
          — no lock-in button. Picks lock automatically.
        </div>
      </div>
    </div>
  );
}
