// /app/api/games/resolve-state/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

type SquiggleGame = {
  squiggleId: number;
  startTimeUtc: string;
  status: "scheduled" | "live" | "final";
  homeTeam: string;
  awayTeam: string;
};

type QuestionStatusDoc = {
  questionId: string;
  status?: "open" | "pending" | "final" | "void" | "locked";
  overrideMode?: "manual" | "auto";
};

type ResolvedGameState = {
  gameId: string;
  startTimeUtc: string;
  nowUtc: string;
  countdownMs: number;
  isLocked: boolean;
  status: "scheduled" | "live" | "final";
  source: "manual" | "squiggle";
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const gameId = searchParams.get("gameId") || "";
    const seasonParam = searchParams.get("season");
    const roundParam = searchParams.get("roundNumber");

    if (!gameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    // Defaults: infer round from gameId; default season to 2026 (beta)
    const season = seasonParam ? Number(seasonParam) : 2026;
    const roundNumber = roundParam ? Number(roundParam) : roundNumberFromGameId(gameId);

    if (!Number.isFinite(season) || !Number.isFinite(roundNumber)) {
      return NextResponse.json({ error: "Invalid season or roundNumber" }, { status: 400 });
    }

    const now = new Date();

    // 1) Fetch Squiggle games for that round
    const squiggleGames = await fetchSquiggleGames(req, season, roundNumber);

    // Match by team names contained in SCREAMR gameId
    const matched = squiggleGames.find((g) => {
      const id = gameId.toLowerCase();
      return id.includes(g.homeTeam.toLowerCase()) && id.includes(g.awayTeam.toLowerCase());
    });

    if (!matched) {
      return NextResponse.json({ error: "Unable to match Squiggle game" }, { status: 404 });
    }

    const startTime = new Date(matched.startTimeUtc);

    // 2) Read questionStatus docs for this game
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
      if (d.status === "locked") anyLocked = true; // treat as locked too
    });

    const autoLocked = now >= startTime || matched.status !== "scheduled";
    const isLocked = manualOverride ? anyLocked : autoLocked;

    const countdownMs = Math.max(0, startTime.getTime() - now.getTime());

    const resolved: ResolvedGameState = {
      gameId,
      startTimeUtc: startTime.toISOString(),
      nowUtc: now.toISOString(),
      countdownMs,
      isLocked,
      status: matched.status,
      source: manualOverride ? "manual" : "squiggle",
    };

    return NextResponse.json(resolved);
  } catch (e) {
    console.error("[resolve-state] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
