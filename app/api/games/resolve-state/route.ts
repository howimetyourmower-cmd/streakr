// /app/api/games/resolve-state/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

const PANIC_CUTOFF_MINUTE = 28;

type SquiggleGame = {
  squiggleId?: number;
  id?: number;
  startTimeUtc: string;
  status: "scheduled" | "live" | "final";
  homeTeam: string;
  awayTeam: string;
  quarter?: number | string | null;
};

type QuestionStatusDoc = {
  questionId: string;
  status?: "open" | "pending" | "final" | "void" | "locked";
  overrideMode?: "manual" | "auto";
};

type LocalGame = {
  id: string;
  match: string;
  venue?: string;
  startTime: string;
};

type PicksApiResponse = {
  games?: LocalGame[];
};

type ResolvedGameState = {
  gameId: string;
  startTimeUtc: string;
  nowUtc: string;
  countdownMs: number;
  isLocked: boolean;
  status: "scheduled" | "live" | "final";
  currentQuarter: number; // 0 pregame, 1-4 live quarters, 5 final
  currentQuarterElapsedMs: number;
  currentQuarterPanicOpen: boolean;
  panicCutoffMinute: number;
  source: "manual" | "squiggle" | "local";
  debug?: {
    roundNumber: number;
    season: number;
    matchedBy: "teams+time" | "teamsOnly" | "none";
    localMatch?: string;
    localStartTime?: string;
    squiggleStartTime?: string;
    squiggleHome?: string;
    squiggleAway?: string;
    squiggleQuarter?: number | null;
    derivedQuarterMode?: "squiggle" | "timer";
  };
};

type QuarterState = {
  currentQuarter: number;
  currentQuarterElapsedMs: number;
  currentQuarterPanicOpen: boolean;
};

function roundNumberFromGameId(gameId: string): number {
  const s = String(gameId || "").toUpperCase().trim();
  if (s.startsWith("OR-")) return 0;
  if (s.startsWith("R")) {
    const dash = s.indexOf("-");
    const prefix = dash === -1 ? s : s.slice(0, dash);
    const n = Number(prefix.replace("R", ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function getBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function fetchSquiggleGames(req: NextRequest, season: number, roundNumber: number): Promise<SquiggleGame[]> {
  const base = getBaseUrl(req);
  const url = `${base}/api/squiggle/games?year=${season}&round=${roundNumber}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Squiggle fetch failed");

  const json = (await res.json()) as { games?: SquiggleGame[] };
  return Array.isArray(json.games) ? json.games : [];
}

async function fetchLocalRoundGames(req: NextRequest, roundNumber: number): Promise<LocalGame[]> {
  const base = getBaseUrl(req);
  const url = `${base}/api/picks?round=${roundNumber}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Local picks fetch failed");

  const json = (await res.json()) as PicksApiResponse;
  return Array.isArray(json.games) ? json.games : [];
}

function normalizeTeamName(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z ]/g, "")
    .trim();
}

function parseTeamsFromMatch(match: string): { a: string; b: string } {
  const m = String(match || "").trim();
  const hit = m.match(/^(.*?)\s+(?:vs|v)\s+(.*?)$/i);
  if (!hit) return { a: normalizeTeamName(m), b: "" };
  return { a: normalizeTeamName(hit[1]), b: normalizeTeamName(hit[2]) };
}

function sameTeamsOrderInsensitive(localMatch: string, sqHome: string, sqAway: string): boolean {
  const { a, b } = parseTeamsFromMatch(localMatch);
  const x = normalizeTeamName(sqHome);
  const y = normalizeTeamName(sqAway);

  const left = [a, b].sort().join("|");
  const right = [x, y].sort().join("|");
  return left === right;
}

function safeDateMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : null;
}

function normalizeQuarter(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const q = Math.floor(n);
  if (q < 0) return 0;
  if (q > 5) return 5;
  return q;
}

/**
 * Timer-based beta quarter model used for Panic cutoffs.
 * This keeps currentQuarter on the quarter that just ended during breaks,
 * but closes Panic once the cutoff has passed.
 */
function deriveQuarterStateFromTimer(startMs: number, nowMs: number): QuarterState {
  const elapsedMs = nowMs - startMs;
  if (elapsedMs < 0) {
    return {
      currentQuarter: 0,
      currentQuarterElapsedMs: 0,
      currentQuarterPanicOpen: false,
    };
  }

  const minute = 60_000;
  const panicCutoffMs = PANIC_CUTOFF_MINUTE * minute;

  const q1Length = 30 * minute;
  const q1Break = 6 * minute;
  const q2Length = 30 * minute;
  const halftime = 20 * minute;
  const q3Length = 30 * minute;
  const q3Break = 6 * minute;
  const q4Length = 30 * minute;

  const q1Start = 0;
  const q1End = q1Start + q1Length;
  const q1BreakEnd = q1End + q1Break;

  const q2Start = q1BreakEnd;
  const q2End = q2Start + q2Length;
  const halftimeEnd = q2End + halftime;

  const q3Start = halftimeEnd;
  const q3End = q3Start + q3Length;
  const q3BreakEnd = q3End + q3Break;

  const q4Start = q3BreakEnd;
  const q4End = q4Start + q4Length;

  if (elapsedMs < q1End) {
    return {
      currentQuarter: 1,
      currentQuarterElapsedMs: elapsedMs - q1Start,
      currentQuarterPanicOpen: elapsedMs - q1Start < panicCutoffMs,
    };
  }

  if (elapsedMs < q1BreakEnd) {
    return {
      currentQuarter: 1,
      currentQuarterElapsedMs: elapsedMs - q1Start,
      currentQuarterPanicOpen: false,
    };
  }

  if (elapsedMs < q2End) {
    return {
      currentQuarter: 2,
      currentQuarterElapsedMs: elapsedMs - q2Start,
      currentQuarterPanicOpen: elapsedMs - q2Start < panicCutoffMs,
    };
  }

  if (elapsedMs < halftimeEnd) {
    return {
      currentQuarter: 2,
      currentQuarterElapsedMs: elapsedMs - q2Start,
      currentQuarterPanicOpen: false,
    };
  }

  if (elapsedMs < q3End) {
    return {
      currentQuarter: 3,
      currentQuarterElapsedMs: elapsedMs - q3Start,
      currentQuarterPanicOpen: elapsedMs - q3Start < panicCutoffMs,
    };
  }

  if (elapsedMs < q3BreakEnd) {
    return {
      currentQuarter: 3,
      currentQuarterElapsedMs: elapsedMs - q3Start,
      currentQuarterPanicOpen: false,
    };
  }

  if (elapsedMs < q4End) {
    return {
      currentQuarter: 4,
      currentQuarterElapsedMs: elapsedMs - q4Start,
      currentQuarterPanicOpen: elapsedMs - q4Start < panicCutoffMs,
    };
  }

  return {
    currentQuarter: 5,
    currentQuarterElapsedMs: 0,
    currentQuarterPanicOpen: false,
  };
}

function deriveCurrentQuarterState(
  matched: SquiggleGame | null,
  localStartMs: number,
  nowMs: number
): { state: QuarterState; mode: "squiggle" | "timer" } {
  const squiggleQuarter = normalizeQuarter(matched?.quarter);
  const timerState = deriveQuarterStateFromTimer(localStartMs, nowMs);

  if (matched?.status === "scheduled") {
    return {
      state: {
        currentQuarter: 0,
        currentQuarterElapsedMs: 0,
        currentQuarterPanicOpen: false,
      },
      mode: squiggleQuarter !== null ? "squiggle" : "timer",
    };
  }

  if (matched?.status === "final") {
    return {
      state: {
        currentQuarter: 5,
        currentQuarterElapsedMs: 0,
        currentQuarterPanicOpen: false,
      },
      mode: squiggleQuarter !== null ? "squiggle" : "timer",
    };
  }

  if (squiggleQuarter !== null && squiggleQuarter >= 1 && squiggleQuarter <= 4) {
    return {
      state: {
        currentQuarter: squiggleQuarter,
        currentQuarterElapsedMs:
          timerState.currentQuarter === squiggleQuarter ? timerState.currentQuarterElapsedMs : 0,
        currentQuarterPanicOpen:
          timerState.currentQuarter === squiggleQuarter ? timerState.currentQuarterPanicOpen : true,
      },
      mode: "squiggle",
    };
  }

  return { state: timerState, mode: "timer" };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const gameId = searchParams.get("gameId") || "";
    const seasonParam = searchParams.get("season");
    const roundParam = searchParams.get("roundNumber");

    if (!gameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const season = seasonParam ? Number(seasonParam) : 2026;
    const roundNumber = roundParam ? Number(roundParam) : roundNumberFromGameId(gameId);

    if (!Number.isFinite(season) || !Number.isFinite(roundNumber)) {
      return NextResponse.json({ error: "Invalid season or roundNumber" }, { status: 400 });
    }

    const now = new Date();

    const localRoundGames = await fetchLocalRoundGames(req, roundNumber);
    const localGame = localRoundGames.find((g) => String(g.id) === String(gameId));

    if (!localGame) {
      return NextResponse.json({ error: "Local game not found for gameId" }, { status: 404 });
    }

    const localStartMs = safeDateMs(localGame.startTime);
    if (!localStartMs) {
      return NextResponse.json({ error: "Local game missing/invalid startTime" }, { status: 500 });
    }

    let matched: SquiggleGame | null = null;
    let matchedBy: "teams+time" | "teamsOnly" | "none" = "none";

    let squiggleGames: SquiggleGame[] = [];
    try {
      squiggleGames = await fetchSquiggleGames(req, season, roundNumber);
    } catch {
      squiggleGames = [];
    }

    const teamMatches = squiggleGames.filter((g) => sameTeamsOrderInsensitive(localGame.match, g.homeTeam, g.awayTeam));

    if (teamMatches.length > 0) {
      const best = teamMatches
        .map((g) => {
          const ms = safeDateMs(g.startTimeUtc);
          const diff = ms === null ? Number.POSITIVE_INFINITY : Math.abs(ms - localStartMs);
          return { g, diff };
        })
        .sort((a, b) => a.diff - b.diff)[0];

      if (best && Number.isFinite(best.diff) && best.diff <= 12 * 60 * 1000) {
        matched = best.g;
        matchedBy = "teams+time";
      } else {
        matched = teamMatches[0];
        matchedBy = "teamsOnly";
      }
    }

    const startTimeUtc = new Date(localStartMs).toISOString();

    const statusSnap = await db
      .collection("questionStatus")
      .where("questionId", ">=", `${gameId}-`)
      .where("questionId", "<", `${gameId}-\uf8ff`)
      .get();

    let manualOverride = false;
    let anyLocked = false;

    statusSnap.forEach((doc) => {
      const d = doc.data() as QuestionStatusDoc;
      if (d.overrideMode === "manual") manualOverride = true;
      if (d.status && d.status !== "open") anyLocked = true;
      if (d.status === "locked") anyLocked = true;
    });

    const nowMs = now.getTime();
    const countdownMs = Math.max(0, localStartMs - nowMs);

    const squiggleStatus: "scheduled" | "live" | "final" | null = matched?.status ?? null;

    const autoLocked = nowMs >= localStartMs || (squiggleStatus ? squiggleStatus !== "scheduled" : false);
    const isLocked = manualOverride ? anyLocked : autoLocked;

    const status: "scheduled" | "live" | "final" =
      squiggleStatus ?? (nowMs >= localStartMs ? "live" : "scheduled");

    const { state, mode } = deriveCurrentQuarterState(matched, localStartMs, nowMs);

    const resolved: ResolvedGameState = {
      gameId,
      startTimeUtc,
      nowUtc: now.toISOString(),
      countdownMs,
      isLocked,
      status,
      currentQuarter: state.currentQuarter,
      currentQuarterElapsedMs: state.currentQuarterElapsedMs,
      currentQuarterPanicOpen: state.currentQuarterPanicOpen,
      panicCutoffMinute: PANIC_CUTOFF_MINUTE,
      source: manualOverride ? "manual" : matched ? "squiggle" : "local",
      debug: {
        roundNumber,
        season,
        matchedBy,
        localMatch: localGame.match,
        localStartTime: localGame.startTime,
        squiggleStartTime: matched?.startTimeUtc,
        squiggleHome: matched?.homeTeam,
        squiggleAway: matched?.awayTeam,
        squiggleQuarter: normalizeQuarter(matched?.quarter),
        derivedQuarterMode: mode,
      },
    };

    return NextResponse.json(resolved);
  } catch (e) {
    console.error("[resolve-state] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
