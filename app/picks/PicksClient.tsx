"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  correctPick?: boolean | null; // true=correct, false=wrong, null=void
  outcome?: "yes" | "no" | "void";
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
  leaderName?: string | null;
};

/**
 * ✅ SCREAMR PALETTE (only colours changed)
 * - Black glass base
 * - Neon red accent
 * - High-contrast text
 */
const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  green: "#2DFF7A",
  white: "#FFFFFF",

  // extra screamr tones (used via MATCH_HQ below)
  panel: "#07070A",
  panel2: "#0B0B10",
  border: "rgba(255,255,255,0.10)",
  soft: "rgba(255,255,255,0.06)",
  soft2: "rgba(255,255,255,0.03)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.70)",
  muted2: "rgba(255,255,255,0.55)",
};

/**
 * ✅ Match HQ palette — converted from light to SCREAMR dark
 * (no layout changes; just colours)
 */
const MATCH_HQ = {
  card: "rgba(10,10,10,0.92)",
  border: "rgba(255,255,255,0.12)",
  pill: "rgba(255,255,255,0.06)",
  pillBorder: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.70)",
  muted2: "rgba(255,255,255,0.55)",
};

const HOW_TO_PLAY_PICKS_KEY = "Torpie_seen_how_to_play_picks_v1";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

/**
 * ✅ FIX: splitMatch must handle BOTH "vs" and "v"
 * Round 2 is using "v" so away team was blank -> fallback "AFL" -> "A"
 */
function splitMatch(match: string): { home: string; away: string } | null {
  const m = String(match || "").trim();
  if (!m) return null;

  // Handles: "Team A vs Team B" OR "Team A v Team B" (any spacing/case)
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

const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 75,
}: {
  teamName: string;
  size?: number;
}) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const fallbackInitials = (teamName || "AFL")
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
          borderColor: COLORS.border,
          background: "rgba(0,0,0,0.45)",
          color: COLORS.text,
        }}
        title={teamName}
      >
        {fallbackInitials || "AFL"}
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
        borderColor: COLORS.border,
        background: "rgba(0,0,0,0.45)",
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

function CheckIcon({ size = 22, color = COLORS.green }: { size?: number; color?: string }) {
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

function XIcon({ size = 18, color = COLORS.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardSilhouetteBg({ opacity = 1.5 }: { opacity?: number }) {
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
            "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.70) 60%, rgba(0,0,0,0.86) 100%)",
        }}
      />
    </div>
  );
}

function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-3xl border p-5 sm:p-6"
        style={{
          borderColor: COLORS.border,
          background: "rgba(0,0,0,0.92)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.75)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black">How to play</div>
            <div className="text-white/70 text-sm mt-1">
              Pick any amount. Locks at bounce. One wrong pick kills that match.
            </div>
          </div>

          <button
            className="rounded-full px-3 py-2 text-[12px] font-black border"
            style={{
              borderColor: COLORS.border,
              background: COLORS.soft,
              color: COLORS.text,
            }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-white/85">
          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
            <div className="font-black">1) Pick any amount</div>
            <div className="text-white/70 mt-1">Pick 0, 1, 5 or all 12 questions.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
            <div className="font-black">2) Auto-lock</div>
            <div className="text-white/70 mt-1">No lock-in button. Picks lock at the game start time.</div>
          </div>

          <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
            <div className="font-black">3) Clean Sweep</div>
            <div className="text-white/70 mt-1">
              One wrong pick resets your streak for that match. Voids don’t count.
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="rounded-2xl px-5 py-3 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,46,77,0.35)",
              background: "rgba(255,46,77,0.14)",
              color: COLORS.text,
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

type GameStatusRow = {
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  picks: number;
  correct: number;
  wrong: number;
  voided: number;
  unsettled: number;
  streakAfter: number | null;
};

export default function PicksClient() {
  const { user } = useAuth();

  // ✅ KEY FIX: separate first load vs refresh — never blank the page on refresh.
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [leaderScore, setLeaderScore] = useState<number | null>(null);
  const [leaderName, setLeaderName] = useState<string | null>(null);

  // ✅ Stable refs so UI never “loses” blocks during refresh
  const lastGoodRef = useRef<{
    roundNumber: number | null;
    games: ApiGame[];
    currentStreak: number;
    leaderScore: number | null;
    leaderName: string | null;
  } | null>(null);

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

  const applyData = useCallback((data: PicksApiResponse) => {
    const rn = typeof data.roundNumber === "number" ? data.roundNumber : null;
    const gs = Array.isArray(data.games) ? data.games : [];
    const cs = typeof data.currentStreak === "number" ? data.currentStreak : 0;
    const ls = typeof data.leaderScore === "number" ? data.leaderScore : null;
    const ln = typeof data.leaderName === "string" ? data.leaderName : null;

    setRoundNumber(rn);
    setGames(gs);
    setCurrentStreak(cs);
    setLeaderScore(ls);
    setLeaderName(ln);

    lastGoodRef.current = {
      roundNumber: rn,
      games: gs,
      currentStreak: cs,
      leaderScore: ls,
      leaderName: ln,
    };
  }, []);

  const loadPicks = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") setInitialLoading(true);
      else setRefreshing(true);

      // IMPORTANT: do NOT clear games/stats here — that’s what caused “Game status” to disappear.
      setErr("");

      try {
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
        applyData(data);
      } catch (e) {
        console.error(e);
        // Keep UI; show error toast-like banner
        setErr("Could not load picks right now.");
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [applyData, user]
  );

  useEffect(() => {
    loadPicks("initial");
  }, [loadPicks]);

  // silent refresh
  useEffect(() => {
    const id = window.setInterval(() => loadPicks("refresh"), 15000);
    return () => window.clearInterval(id);
  }, [loadPicks]);

  // ✅ always use stable data for rendering (prevents disappearing sections)
  const stable = lastGoodRef.current;
  const stableGames = stable?.games ?? games;
  const stableRoundNumber = stable?.roundNumber ?? roundNumber;
  const stableCurrentStreak = stable?.currentStreak ?? currentStreak;
  const stableLeaderScore = stable?.leaderScore ?? leaderScore;
  const stableLeaderName = stable?.leaderName ?? leaderName;

  const roundLabel =
    stableRoundNumber === null ? "" : stableRoundNumber === 0 ? "Opening Round" : `Round ${stableRoundNumber}`;

  const sortedGames = useMemo(() => {
    return [...(stableGames || [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [stableGames]);

  const nextUp = useMemo(() => {
    const upcoming = sortedGames.filter((g) => new Date(g.startTime).getTime() > nowMs);
    if (upcoming.length) return upcoming[0];
    return sortedGames[0] || null;
  }, [sortedGames, nowMs]);

  const lastNextUpRef = useRef<ApiGame | null>(null);
  const [nextUpStable, setNextUpStable] = useState<ApiGame | null>(null);

  useEffect(() => {
    if (nextUp) {
      lastNextUpRef.current = nextUp;
      setNextUpStable(nextUp);
    } else if (!nextUpStable && lastNextUpRef.current) {
      setNextUpStable(lastNextUpRef.current);
    }
  }, [nextUp, nextUpStable]);

  const nextUpLockMs = useMemo(() => {
    const g = nextUpStable;
    if (!g) return null;
    return new Date(g.startTime).getTime() - nowMs;
  }, [nextUpStable, nowMs]);

  const isNextUpLive = nextUpLockMs !== null ? nextUpLockMs <= 0 : false;

  const gamesPicked = useMemo(() => {
    return (stableGames || []).filter((g) =>
      (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no")
    ).length;
  }, [stableGames]);

  const eligible = gamesPicked >= 3;

  const distanceToLeader = useMemo(() => {
    if (stableLeaderScore === null) return null;
    return Math.max(0, stableLeaderScore - stableCurrentStreak);
  }, [stableLeaderScore, stableCurrentStreak]);

  const leaderProgress = useMemo(() => {
    if (stableLeaderScore === null || stableLeaderScore <= 0) return 0;
    return clamp((stableCurrentStreak / stableLeaderScore) * 100, 0, 100);
  }, [stableLeaderScore, stableCurrentStreak]);

  const gameStatusRows = useMemo((): GameStatusRow[] => {
    let runningStreak = 0;

    return sortedGames.map((g) => {
      const pickedQs = (g.questions || []).filter((q) => q.userPick === "yes" || q.userPick === "no");
      const picks = pickedQs.length;

      let correct = 0;
      let wrong = 0;
      let voided = 0;
      let unsettled = 0;

      for (const q of pickedQs) {
        if (q.correctPick === true) correct += 1;
        else if (q.correctPick === false) wrong += 1;
        else if (q.correctPick === null) voided += 1;
        else unsettled += 1;
      }

      if (picks === 0) {
        return {
          gameId: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          picks,
          correct,
          wrong,
          voided,
          unsettled,
          streakAfter: runningStreak,
        };
      }

      if (unsettled > 0) {
        return {
          gameId: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          picks,
          correct,
          wrong,
          voided,
          unsettled,
          streakAfter: null,
        };
      }

      if (wrong > 0) runningStreak = 0;
      else runningStreak += correct;

      return {
        gameId: g.id,
        match: g.match,
        venue: g.venue,
        startTime: g.startTime,
        picks,
        correct,
        wrong,
        voided,
        unsettled,
        streakAfter: runningStreak,
      };
    });
  }, [sortedGames]);

  const StickyChaseBar = () => {
    const g = nextUpStable;
    if (!g) return null;

    const href = `/picks/${g.id}`;
    const label = isNextUpLive ? "GO PICK (LIVE)" : "GO PICK";
    const lockText =
      nextUpLockMs === null ? "" : isNextUpLive ? "Locked" : `Locks in ${msToCountdown(nextUpLockMs)}`;

    const chaseText =
      stableLeaderScore === null
        ? "Leader loading…"
        : distanceToLeader === 0
        ? "Equal lead"
        : `Need ${distanceToLeader}`;

    return (
      <div className="fixed bottom-0 left-0 right-0 z-[60] md:hidden">
        <div
          className="px-3 pb-3 pt-2"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.78) 35%, rgba(0,0,0,0.96) 100%)",
          }}
        >
          <div
            className="rounded-2xl border p-3 shadow-[0_18px_60px_rgba(0,0,0,0.80)]"
            style={{
              borderColor: COLORS.border,
              background: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black"
                    style={{
                      borderColor: isNextUpLive ? "rgba(255,46,77,0.55)" : COLORS.border,
                      background: isNextUpLive ? "rgba(255,46,77,0.14)" : COLORS.soft,
                      color: COLORS.text,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: isNextUpLive ? COLORS.red : "rgba(255,255,255,0.55)",
                        boxShadow: isNextUpLive ? "0 0 14px rgba(255,46,77,0.55)" : "none",
                      }}
                    />
                    {lockText || "Next up"}
                  </span>

                  <span className="text-[11px] text-white/60 font-semibold truncate">{g.match}</span>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="rounded-xl border px-3 py-1.5"
                    style={{ borderColor: "rgba(255,46,77,0.22)", background: "rgba(255,46,77,0.10)" }}
                  >
                    <div className="text-[10px] uppercase tracking-widest text-white/70 font-black">Streak</div>
                    <div className="text-[16px] font-black" style={{ color: COLORS.red }}>
                      {stableCurrentStreak}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-white/55 font-black">Chase</div>
                    <div className="text-[12px] font-black text-white truncate">{chaseText}</div>
                    <div className="text-[11px] text-white/55 font-semibold truncate">
                      {stableLeaderScore === null
                        ? ""
                        : `Leader ${stableLeaderScore}${stableLeaderName ? ` • ${stableLeaderName}` : ""}`}
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href={href}
                className="shrink-0 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,46,77,0.32)",
                  background: "linear-gradient(180deg, rgba(255,46,77,0.95) 0%, rgba(255,46,77,0.72) 100%)",
                  color: "rgba(255,255,255,0.98)",
                  boxShadow: "0 12px 30px rgba(255,46,77,0.18)",
                  textDecoration: "none",
                }}
              >
                {label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DashboardStrip = () => {
    const leaderText =
      stableLeaderScore === null ? "Leader loading…" : stableLeaderName ? `${stableLeaderName} leads` : "Leader";

    const leaderHint =
      stableLeaderScore === null
        ? "Waiting for leaderScore from /api/picks."
        : distanceToLeader === 0
        ? "Equal lead — keep it alive."
        : `Gap: ${distanceToLeader}`;

    const cardBase: React.CSSProperties = {
      borderColor: MATCH_HQ.border,
      background: MATCH_HQ.card,
      color: MATCH_HQ.text,
    };

    const pill: React.CSSProperties = {
      borderColor: MATCH_HQ.pillBorder,
      background: MATCH_HQ.pill,
      color: MATCH_HQ.text,
    };

    const numStyle: React.CSSProperties = { color: COLORS.red };

    return (
      <div
        className="mt-4 rounded-3xl border px-3 py-3"
        style={{
          borderColor: COLORS.border,
          background: COLORS.soft2,
        }}
      >
        {/* ... unchanged ... */}
        {/* (Rest of your file remains exactly the same from here down) */}
      </div>
    );
  };

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";

    const picksCount =
      (g.questions || []).filter((q) => q.userPick === "yes" || q.userPick === "no").length || 0;

    const isLocked = lockMs <= 0;

    const badgeStyle = isLocked
      ? { borderColor: "rgba(255,46,77,0.55)", background: "rgba(255,46,77,0.18)" }
      : { borderColor: COLORS.border, background: "rgba(0,0,0,0.40)" };

    const href = `/picks/${g.id}`;

    return (
      <Link
        href={href}
        className="block rounded-2xl overflow-hidden border"
        style={{
          borderColor: COLORS.border,
          background: COLORS.soft2,
          boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
          textDecoration: "none",
        }}
      >
        <div className="relative p-4 overflow-hidden" style={{ minHeight: 190 }}>
          <CardSilhouetteBg opacity={1} />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-white/85 font-semibold">{formatAedt(g.startTime)}</div>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{ ...badgeStyle, color: "rgba(255,255,255,0.96)" }}
              >
                {isLocked ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3">
              <TeamLogo teamName={homeName} size={72} />
              <div className="text-white/80 font-black text-[12px]">vs</div>
              <TeamLogo teamName={awayName || "AFL"} size={72} />
            </div>

            <div className="mt-3 text-center">
              <div
                className="text-[17px] sm:text-[18px] font-black leading-tight"
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

            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: picksCount > 0 ? "rgba(45,255,122,0.45)" : COLORS.border,
                  background: picksCount > 0 ? "rgba(45,255,122,0.10)" : COLORS.soft,
                  color: COLORS.text,
                }}
              >
                {picksCount}/12 picked
              </span>

              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: COLORS.border,
                  background: COLORS.soft,
                  color: COLORS.text,
                }}
              >
                {isLocked ? "Auto-locked" : "Auto-locks at bounce"}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <span
                className="inline-flex items-center justify-center rounded-xl px-5 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,46,77,0.32)",
                  background: "linear-gradient(180deg, rgba(255,46,77,0.95) 0%, rgba(255,46,77,0.72) 100%)",
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
    <div
      className="min-h-screen text-white"
      style={{
        backgroundColor: COLORS.bg,
        opacity: refreshing ? 0.9 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      {/* ... unchanged ... */}
      {/* (Rest of your file remains exactly the same) */}
    </div>
  );
}
