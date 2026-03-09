// /app/api/games/resolve-state/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

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
 * Beta timer-based quarter model.
 * Good enough to prevent Panic abuse before you wire official live quarter state.
 *
 * Timeline from bounce:
 * - Q1: 0m -> 30m
 * - Q1 break: 30m -> 36m   (still treat as Q1 for Panic closure after quarter boundary)
 * - Q2: 36m -> 66m
 * - Halftime: 66m -> 86m   (treat as Q2)
 * - Q3: 86m -> 116m
 * - Q3 break: 116m -> 122m (treat as Q3)
 * - Q4: 122m -> 152m
 * - Final after 152m
 */
function deriveQuarterFromTimer(startMs: number, nowMs: number): number {
  const elapsedMs = nowMs - startMs;
  if (elapsedMs < 0) return 0;

  const minute = 60_000;

  const q1End = 30 * minute;
  const q1BreakEnd = 36 * minute;
  const q2End = 66 * minute;
  const halftimeEnd = 86 * minute;
  const q3End = 116 * minute;
  const q3BreakEnd = 122 * minute;
  const q4End = 152 * minute;

  if (elapsedMs < q1End) return 1;
  if (elapsedMs < q1BreakEnd) return 1;

  if (elapsedMs < q2End) return 2;
  if (elapsedMs < halftimeEnd) return 2;

  if (elapsedMs < q3End) return 3;
  if (elapsedMs < q3BreakEnd) return 3;

  if (elapsedMs < q4End) return 4;

  return 5;
}

function deriveCurrentQuarter(
  matched: SquiggleGame | null,
  localStartMs: number,
  nowMs: number
): { currentQuarter: number; mode: "squiggle" | "timer" } {
  const squiggleQuarter = normalizeQuarter(matched?.quarter);

  if (matched?.status === "scheduled") {
    return { currentQuarter: 0, mode: squiggleQuarter !== null ? "squiggle" : "timer" };
  }

  if (matched?.status === "final") {
    return { currentQuarter: 5, mode: squiggleQuarter !== null ? "squiggle" : "timer" };
  }

  if (squiggleQuarter !== null && squiggleQuarter >= 1 && squiggleQuarter <= 4) {
    return { currentQuarter: squiggleQuarter, mode: "squiggle" };
  }

  return { currentQuarter: deriveQuarterFromTimer(localStartMs, nowMs), mode: "timer" };
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

    const { currentQuarter, mode } = deriveCurrentQuarter(matched, localStartMs, nowMs);

    const resolved: ResolvedGameState = {
      gameId,
      startTimeUtc,
      nowUtc: now.toISOString(),
      countdownMs,
      isLocked,
      status,
      currentQuarter,
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
