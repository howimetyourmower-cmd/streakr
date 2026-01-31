// /app/picks/PicksClient.tsx
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
 * ✅ SCREAMR PALETTE
 */
const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  cyan: "#00E5FF",
  green: "#2DFF7A",
  white: "#FFFFFF",

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
 * ✅ Match HQ palette — SCREAMR dark
 */
const MATCH_HQ = {
  card: "rgba(10,10,12,0.90)",
  border: "rgba(255,255,255,0.12)",
  pill: "rgba(255,255,255,0.06)",
  pillBorder: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.70)",
  muted2: "rgba(255,255,255,0.55)",
};

const HOW_TO_PLAY_PICKS_KEY = "Screamr_seen_how_to_play_picks_v3";

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

/**
 * ✅ support both "vs" and "v"
 */
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

/**
 * ✅ Picks page TeamLogo — MatchPicks squircle style
 */
const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 78,
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

  const candidates = slug ? logoCandidates(slug) : [];
  const src = slug ? candidates[Math.min(idx, candidates.length - 1)] : "";

  const tile: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 22,
  };

  const innerRadius = 16;

  return (
    <div className="relative" style={tile} title={teamName}>
      <div className="absolute inset-0 screamr-squircleFrame" style={{ borderRadius: 22 }} />
      <div className="absolute inset-[7px] screamr-squircleInner" style={{ borderRadius: innerRadius }}>
        <div className="absolute inset-0 screamr-squircleGloss" style={{ borderRadius: innerRadius }} />
        <div className="absolute inset-0 p-3">
          {slug && !dead ? (
            <Image
              src={src}
              alt={`${teamName} logo`}
              fill
              sizes={`${size}px`}
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.25))",
              }}
              onError={() => {
                setIdx((p) => {
                  if (p + 1 < candidates.length) return p + 1;
                  setDead(true);
                  return p;
                });
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-black tracking-wide text-black/70">
              {fallbackInitials || "AFL"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function CheckIcon({ size = 22, color = COLORS.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ size = 18, color = COLORS.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * ✅ MUCH more “game show” background (non-boring):
 * - dot-wall + moving spotlight sweep
 * - red/cyan corner glows
 * - optional silhouette image for texture
 */
function CardShowBg({ useImage = true }: { useImage?: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* base dot wall */}
      <div className="absolute inset-0 screamr-dotwall" />

      {/* moving sweep */}
      <div className="absolute inset-0 screamr-sweep" />

      {/* corner glows */}
      <div className="absolute inset-0 screamr-cornerGlows" />

      {/* optional grayscale action texture */}
      {useImage ? (
        <div className="absolute inset-0 opacity-[0.22]">
          <Image
            src="/afl1.png"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            style={{
              objectFit: "cover",
              filter: "grayscale(1) brightness(0.55) contrast(1.35)",
              transform: "scale(1.05)",
            }}
            priority={false}
          />
        </div>
      ) : null}

      {/* cinematic vignette */}
      <div className="absolute inset-0 screamr-vignette" />
    </div>
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
          borderColor: COLORS.border,
          background: "rgba(0,0,0,0.92)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.75)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black">How to play</div>
            <div className="text-white/70 text-sm mt-1">Pick any amount. Locks at bounce. One wrong pick kills that match.</div>
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
            <div className="text-white/70 mt-1">One wrong pick resets your streak for that match. Voids don’t count.</div>
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

  // ✅ separate first load vs refresh — never blank the page on refresh.
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

  // ✅ silent refresh (NO visible “REFRESHING…” text)
  useEffect(() => {
    const id = window.setInterval(() => loadPicks("refresh"), 15000);
    return () => window.clearInterval(id);
  }, [loadPicks]);

  // ✅ always use stable data for rendering
  const stable = lastGoodRef.current;
  const stableGames = stable?.games ?? games;
  const stableRoundNumber = stable?.roundNumber ?? roundNumber;
  const stableCurrentStreak = stable?.currentStreak ?? currentStreak;
  const stableLeaderScore = stable?.leaderScore ?? leaderScore;
  const stableLeaderName = stable?.leaderName ?? leaderName;

  const roundLabel =
    stableRoundNumber === null ? "" : stableRoundNumber === 0 ? "Opening Round" : `Round ${stableRoundNumber}`;

  const sortedGames = useMemo(() => {
    return [...(stableGames || [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
    return (stableGames || []).filter((g) => (g.questions || []).some((q) => q.userPick === "yes" || q.userPick === "no"))
      .length;
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
    const lockText = nextUpLockMs === null ? "" : isNextUpLive ? "Locked" : `Locks in ${msToCountdown(nextUpLockMs)}`;

    const chaseText =
      stableLeaderScore === null ? "Leader loading…" : distanceToLeader === 0 ? "Equal lead" : `Need ${distanceToLeader}`;

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
                  <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black">
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
    const leaderText = stableLeaderScore === null ? "Leader loading…" : stableLeaderName ? `${stableLeaderName} leads` : "Leader";

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
      <div className="mt-4 rounded-3xl border px-3 py-3" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">Match HQ</div>
            <span
              className="screamr-pill inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black"
              title="SCREAMR is live and updating"
            >
              <span className="h-2 w-2 rounded-full screamr-liveDot" />
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/leaderboards"
              className="rounded-full px-3 py-1.5 text-[11px] font-black border"
              style={{ borderColor: COLORS.border, background: COLORS.soft, color: COLORS.text, textDecoration: "none" }}
            >
              Leaderboards
            </Link>

            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-[11px] font-black border"
              style={{ borderColor: COLORS.border, background: COLORS.soft, color: COLORS.text }}
              onClick={() => setHowOpen(true)}
            >
              How to play
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-4 gap-2">
          <div className="rounded-2xl border px-3 py-2" style={cardBase}>
            <div className="text-[10px] uppercase tracking-widest font-black" style={{ color: MATCH_HQ.muted2 }}>
              Current streak
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-xl border px-2.5 py-1.5" style={pill}>
                <span className="text-[16px] font-black" style={numStyle}>
                  {stableCurrentStreak}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black">Keep it alive</div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: MATCH_HQ.muted }}>
                  One wrong pick resets to 0.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border px-3 py-2" style={cardBase}>
            <div className="text-[10px] uppercase tracking-widest font-black" style={{ color: MATCH_HQ.muted2 }}>
              Leader
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-xl border px-2.5 py-1.5" style={pill}>
                <span className="text-[16px] font-black" style={numStyle}>
                  {stableLeaderScore === null ? "—" : stableLeaderScore}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black truncate">{leaderText}</div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: MATCH_HQ.muted }}>
                  Current streak right now.
                </div>
              </div>
            </div>

            <div
              className="mt-2 h-[8px] w-full rounded-full border overflow-hidden"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
              }}
              aria-label="progress to leader"
            >
              <div
                className="h-full"
                style={{
                  width: `${leaderProgress}%`,
                  background: `linear-gradient(90deg, ${COLORS.red} 0%, rgba(255,46,77,0.45) 100%)`,
                }}
              />
            </div>

            <div className="mt-2 text-[11px] font-semibold" style={{ color: MATCH_HQ.muted }}>
              {leaderHint}
            </div>
          </div>

          <div className="rounded-2xl border px-3 py-2" style={cardBase}>
            <div className="text-[10px] uppercase tracking-widest font-black" style={{ color: MATCH_HQ.muted2 }}>
              Distance
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-xl border px-2.5 py-1.5" style={pill}>
                <span className="text-[16px] font-black" style={numStyle}>
                  {stableLeaderScore === null || distanceToLeader === null ? "—" : distanceToLeader}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-black">{stableLeaderScore === null ? "Waiting on data" : "Close the gap"}</div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: MATCH_HQ.muted }}>
                  Current streak only.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border px-3 py-2" style={cardBase}>
            <div className="text-[10px] uppercase tracking-widest font-black" style={{ color: MATCH_HQ.muted2 }}>
              Eligible
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-xl border px-2.5 py-1.5 flex items-center justify-center" style={pill}>
                {eligible ? <CheckIcon size={16} color={COLORS.red} /> : <span className="font-black" style={{ color: MATCH_HQ.muted2 }}>—</span>}
              </div>

              <div className="min-w-0">
                <div className="text-[12px] font-black">{eligible ? "Eligible to win" : "Not yet"}</div>
                <div className="text-[11px] font-semibold leading-snug" style={{ color: MATCH_HQ.muted }}>
                  {gamesPicked} games picked
                </div>
              </div>
            </div>

            <div className="mt-2 text-[11px] font-semibold" style={{ color: MATCH_HQ.muted }}>
              Tip: locks at bounce.
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border p-3 sm:p-3.5" style={{ borderColor: COLORS.border, background: "rgba(0,0,0,0.28)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-widest text-white/55 font-black">Game status</div>
            <div className="text-[11px] text-white/55 font-semibold">Picks • Correct • Wrong • Streak after</div>
          </div>

          <div className="hidden md:block mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: COLORS.border }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Game</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Picks</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Correct</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Wrong</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Void</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Unsettled</th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-widest text-white/60 font-black">Streak after</th>
                </tr>
              </thead>
              <tbody>
                {gameStatusRows.map((r, i) => {
                  const anyWrong = r.wrong > 0;
                  const anyUnsettled = r.unsettled > 0;

                  const pillState = anyWrong
                    ? { label: "DEAD ☠️", border: "rgba(255,46,77,0.45)", bg: "rgba(255,46,77,0.14)" }
                    : anyUnsettled && r.picks > 0
                    ? { label: "IN PROGRESS", border: COLORS.border, bg: COLORS.soft }
                    : { label: "ALIVE ✅", border: "rgba(45,255,122,0.35)", bg: "rgba(45,255,122,0.10)" };

                  return (
                    <tr key={r.gameId} style={{ background: i % 2 === 0 ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.10)" }}>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[13px] font-black text-white truncate">{r.match}</div>
                            <div className="text-[11px] text-white/60 font-semibold truncate">
                              {formatAedt(r.startTime)} • {r.venue}
                            </div>
                          </div>
                          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black border" style={{ borderColor: pillState.border, background: pillState.bg, color: COLORS.text }}>
                            {pillState.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-[13px] font-black text-white">{r.picks}</td>

                      <td className="px-3 py-2 text-[13px] font-black" style={{ color: r.correct > 0 ? "rgba(45,255,122,0.95)" : "rgba(255,255,255,0.78)" }}>
                        {r.correct}
                      </td>

                      <td className="px-3 py-2 text-[13px] font-black" style={{ color: r.wrong > 0 ? "rgba(255,46,77,0.95)" : "rgba(255,255,255,0.78)" }}>
                        {r.wrong}
                      </td>

                      <td className="px-3 py-2 text-[13px] font-black text-white/80">{r.voided}</td>
                      <td className="px-3 py-2 text-[13px] font-black text-white/80">{r.unsettled}</td>

                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5" style={{ borderColor: anyWrong ? "rgba(255,46,77,0.35)" : COLORS.border, background: anyWrong ? "rgba(255,46,77,0.10)" : COLORS.soft }}>
                          {anyWrong ? <XIcon size={16} /> : <CheckIcon size={16} color="rgba(45,255,122,0.95)" />}
                          <span className="text-[14px] font-black text-white">{r.streakAfter === null ? "—" : r.streakAfter}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden mt-3 space-y-2">
            {gameStatusRows.map((r) => (
              <div key={r.gameId} className="rounded-2xl border p-3" style={{ borderColor: COLORS.border, background: "rgba(0,0,0,0.18)" }}>
                <div className="text-[13px] font-black text-white">{r.match}</div>
                <div className="text-[11px] text-white/60 font-semibold">
                  {formatAedt(r.startTime)} • {r.venue}
                </div>
                <div className="mt-2 text-[12px] text-white/80 font-semibold">
                  Picks {r.picks} • ✅ {r.correct} • ❌ {r.wrong} • Streak {r.streakAfter === null ? "—" : r.streakAfter}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-white/55 font-semibold">Clean Sweep: any wrong pick in a game resets streak to 0. Voids don’t add.</div>
        </div>
      </div>
    );
  };

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);
    const homeName = m?.home ?? g.match;
    const awayName = m?.away ?? "";

    const picksCount = (g.questions || []).filter((q) => q.userPick === "yes" || q.userPick === "no").length || 0;

    const isLocked = lockMs <= 0;
    const href = `/picks/${g.id}`;

    return (
      <Link
        href={href}
        className="block rounded-2xl overflow-hidden"
        style={{
          textDecoration: "none",
        }}
      >
        <div className="relative p-[1px] rounded-2xl screamr-cardBorder">
          <div
            className="relative rounded-2xl overflow-hidden border"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: COLORS.soft2,
              boxShadow: "0 18px 55px rgba(0,0,0,0.78)",
            }}
          >
            <div className="relative p-4 overflow-hidden" style={{ minHeight: 198 }}>
              <div className="screamr-sparks" />
              <div className="absolute inset-0 screamr-spotlights" />
              <CardShowBg useImage />

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3">
                  <span className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: isLocked ? COLORS.red : COLORS.cyan,
                        boxShadow: isLocked ? "0 0 14px rgba(255,46,77,0.55)" : "0 0 14px rgba(0,229,255,0.50)",
                      }}
                    />
                    {isLocked ? "LIVE" : "GAME"}
                  </span>

                  <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                    {isLocked ? "LOCKED" : `LOCKS IN ${msToCountdown(lockMs)}`}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-center gap-3">
                  <TeamLogo teamName={homeName} size={78} />
                  <div className="text-white/85 font-black text-[12px]">vs</div>
                  <TeamLogo teamName={awayName || "AFL"} size={78} />
                </div>

                <div className="mt-3 text-center">
                  <div
                    className="text-[18px] sm:text-[19px] font-black leading-tight"
                    style={{ color: "rgba(255,255,255,0.98)", textShadow: "0 2px 12px rgba(0,0,0,0.70)" }}
                  >
                    {g.match}
                  </div>
                  <div
                    className="mt-1 text-[12px] font-semibold truncate"
                    style={{ color: "rgba(255,255,255,0.78)", textShadow: "0 2px 10px rgba(0,0,0,0.60)" }}
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

                  <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border" style={{ borderColor: COLORS.border, background: COLORS.soft, color: COLORS.text }}>
                    {isLocked ? "Auto-locked" : "Auto-locks at bounce"}
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
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundColor: COLORS.bg,
        opacity: refreshing ? 0.98 : 1, // ✅ barely noticeable
        transition: "opacity 120ms ease",
      }}
    >
      {/* 🎪 GAME SHOW STYLE (cards + labels + logo tiles) */}
      <style>{`
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
          100% { transform: translate3d(-220px, -220px, 0); }
        }

        .screamr-spotlights {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: 0.55;
          background:
            radial-gradient(700px 260px at 20% 0%, rgba(0,229,255,0.14) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(700px 260px at 80% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(900px 340px at 50% 110%, rgba(255,46,77,0.08) 0%, rgba(0,0,0,0) 70%);
        }

        .screamr-cardBorder {
          background: linear-gradient(135deg,
            rgba(255,46,77,0.50) 0%,
            rgba(255,46,77,0.08) 25%,
            rgba(0,229,255,0.10) 55%,
            rgba(255,46,77,0.38) 100%);
          box-shadow: 0 24px 80px rgba(0,0,0,0.75);
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

        /* ✅ MatchPicks squircle logo style */
        .screamr-squircleFrame {
          background: linear-gradient(180deg, rgba(255, 46, 77, 0.98) 0%, rgba(168, 16, 43, 0.98) 100%);
          box-shadow:
            0 18px 52px rgba(255, 46, 77, 0.22),
            0 0 0 1px rgba(0, 0, 0, 0.45) inset,
            0 0 28px rgba(255, 46, 77, 0.14);
        }
        .screamr-squircleInner {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.55);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.08) inset,
            0 18px 44px rgba(0, 0, 0, 0.30);
          overflow: hidden;
        }
        .screamr-squircleGloss {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background:
            radial-gradient(240px 120px at 50% 0%, rgba(255, 46, 77, 0.14) 0%, rgba(255, 255, 255, 0.0) 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.0) 40%);
          opacity: 0.85;
        }

        /* ✅ Non-boring “main event” background layers */
        .screamr-dotwall {
          opacity: 0.25;
          background-image:
            radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 0 1px, transparent 2px);
          background-size: 14px 14px;
          filter: blur(0px);
        }
        .screamr-sweep {
          opacity: 0.75;
          background:
            radial-gradient(800px 260px at 15% 20%, rgba(0,229,255,0.16) 0%, rgba(0,0,0,0) 68%),
            radial-gradient(900px 320px at 85% 30%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0) 70%),
            linear-gradient(120deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.07) 18%, rgba(255,255,255,0.00) 36%);
          animation: sweepMove 6.8s ease-in-out infinite;
        }
        @keyframes sweepMove {
          0% { transform: translateX(-8%); }
          50% { transform: translateX(8%); }
          100% { transform: translateX(-8%); }
        }
        .screamr-cornerGlows {
          opacity: 0.9;
          background:
            radial-gradient(600px 380px at 0% 0%, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(600px 380px at 100% 0%, rgba(0,229,255,0.18) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(900px 520px at 50% 120%, rgba(255,46,77,0.10) 0%, rgba(0,0,0,0) 75%);
          mix-blend-mode: screen;
        }
        .screamr-vignette {
          background:
            linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.68) 58%, rgba(0,0,0,0.92) 100%),
            radial-gradient(1200px 520px at 50% 10%, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.75) 70%);
        }

        /* subtle live dot pulse (replaces “REFRESHING…”) */
        .screamr-liveDot {
          background: ${COLORS.red};
          box-shadow: 0 0 14px rgba(255,46,77,0.55);
          animation: livePulse 1.5s ease-in-out infinite;
        }
        @keyframes livePulse {
          0% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 0.75; }
        }
      `}</style>

      <HowToPlayModal open={howOpen} onClose={closeHow} />
      <StickyChaseBar />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-14">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-[0.14em]">Picks</h1>

              {roundLabel ? (
                <span className="screamr-pill mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                  {roundLabel}
                </span>
              ) : null}

              {/* ✅ Removed visible “REFRESHING…” completely */}
            </div>

            <div className="mt-1 text-[13px] text-white/65 font-semibold">Pick any amount. Survive the streak.</div>
          </div>

          <button
            type="button"
            onClick={() => loadPicks("refresh")}
            className="rounded-full px-3 py-2 text-[11px] font-black border"
            style={{ borderColor: COLORS.border, background: COLORS.soft, color: COLORS.text }}
            title="Refresh"
          >
            Refresh
          </button>
        </div>

        {err ? (
          <div className="mt-3 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {nextUpStable ? (
          <div className="mt-4 transition-opacity duration-200" style={{ opacity: initialLoading ? 0.75 : 1 }}>
            <Link href={`/picks/${nextUpStable.id}`} className="block rounded-3xl overflow-hidden" style={{ textDecoration: "none" }}>
              <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
                <div
                  className="relative rounded-3xl overflow-hidden border"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: COLORS.soft2,
                    boxShadow: "0 26px 90px rgba(0,0,0,0.72)",
                  }}
                >
                  <div className="relative p-5 sm:p-6 overflow-hidden" style={{ minHeight: 175 }}>
                    <div className="screamr-sparks" />
                    <div className="absolute inset-0 screamr-spotlights" />

                    {/* ✅ upgraded background for main event */}
                    <CardShowBg useImage />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-3">
                        <span className="screamr-gameLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              background: isNextUpLive ? COLORS.red : COLORS.cyan,
                              boxShadow: isNextUpLive ? "0 0 14px rgba(255,46,77,0.55)" : "0 0 14px rgba(0,229,255,0.50)",
                            }}
                          />
                          TONIGHT’S MAIN EVENT
                        </span>

                        <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                          {nextUpLockMs === null ? "" : nextUpLockMs <= 0 ? "LIVE / LOCKED" : `LOCKS IN ${msToCountdown(nextUpLockMs)}`}
                        </span>
                      </div>

                      {(() => {
                        const m = splitMatch(nextUpStable.match);
                        const homeName = m?.home ?? nextUpStable.match;
                        const awayName = m?.away ?? "";
                        return (
                          <div className="mt-4 flex items-center justify-center gap-4">
                            <TeamLogo teamName={homeName} size={84} />
                            <div className="text-white/85 font-black text-[13px]">vs</div>
                            <TeamLogo teamName={awayName || "AFL"} size={84} />
                          </div>
                        );
                      })()}

                      <div className="mt-3 text-center">
                        <div
                          className="text-[22px] sm:text-[28px] font-black leading-tight"
                          style={{ color: "rgba(255,255,255,0.98)", textShadow: "0 2px 12px rgba(0,0,0,0.70)" }}
                        >
                          {nextUpStable.match}
                        </div>
                        <div
                          className="mt-2 text-[12px] font-semibold"
                          style={{ color: "rgba(255,255,255,0.78)", textShadow: "0 2px 10px rgba(0,0,0,0.60)" }}
                        >
                          {formatAedt(nextUpStable.startTime)} • {nextUpStable.venue}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-center">
                        <span className="screamr-cta inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[12px] font-black">
                          GO PICK
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,46,77,0.00), rgba(255,46,77,0.45), rgba(0,229,255,0.18), rgba(255,46,77,0.00))" }} />
                </div>
              </div>
            </Link>
          </div>
        ) : null}

        <DashboardStrip />

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] uppercase tracking-widest text-white/55 font-black">Scheduled matches</div>
            <div className="text-[11px] text-white/45 font-semibold">Pick any amount • locks at bounce</div>
          </div>

          {initialLoading && sortedGames.length === 0 ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: COLORS.border, background: COLORS.soft2 }}>
                  <div className="h-[190px] bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : sortedGames.length === 0 ? (
            <div className="mt-4 rounded-2xl border p-4 text-sm text-white/70" style={{ borderColor: "rgba(255,46,77,0.35)", background: COLORS.soft2 }}>
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

        <div className="mt-8 pb-6 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
          SCREAMR © 2026
        </div>
      </div>
    </div>
  );
}
