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
  status?: "open" | "pending" | "final" | "void";
  overrideMode?: "manual" | "auto";
};

type ResolvedGameState = {
  gameId: string;
  startTimeUtc: string;
  nowUtc: string;
  countdownMs: number;
  isLocked: boolean;
  source: "manual" | "squiggle";
};

function resolveRoundDocId(season: number, roundNumber: number): string {
  if (roundNumber === 0) return `${season}-0`;
  if (roundNumber === 1) return `${season}-1`;
  return `afl-${season}-r${roundNumber}`;
}

async function fetchSquiggleGames(
  season: number,
  roundNumber: number
): Promise<SquiggleGame[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/squiggle/games?year=${season}&round=${roundNumber}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Squiggle fetch failed");

  const json = (await res.json()) as { games?: SquiggleGame[] };
  return Array.isArray(json.games) ? json.games : [];
}

export async function POST(req: NextRequest) {
  try {
    const { season, roundNumber, gameId } = (await req.json()) as {
      season?: number;
      roundNumber?: number;
      gameId?: string;
    };

    if (
      typeof season !== "number" ||
      typeof roundNumber !== "number" ||
      typeof gameId !== "string"
    ) {
      return NextResponse.json(
        { error: "season, roundNumber, gameId required" },
        { status: 400 }
      );
    }

    const now = new Date();

    // 1) Fetch Squiggle games
    const squiggleGames = await fetchSquiggleGames(season, roundNumber);

    // Match by team names contained in SCREAMR gameId
    const matched = squiggleGames.find((g) => {
      const id = gameId.toLowerCase();
      return (
        id.includes(g.homeTeam.toLowerCase()) &&
        id.includes(g.awayTeam.toLowerCase())
      );
    });

    if (!matched) {
      return NextResponse.json(
        { error: "Unable to match Squiggle game" },
        { status: 404 }
      );
    }

    const startTime = new Date(matched.startTimeUtc);

    // 2) Read questionStatus for this game
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
      source: manualOverride ? "manual" : "squiggle",
    };

    return NextResponse.json(resolved);
  } catch (e) {
    console.error("[resolve-state] error", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
