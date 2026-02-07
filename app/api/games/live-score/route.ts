// /app/api/games/live-score/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type SquiggleGame = {
  squiggleId: number;
  startTimeUtc: string;
  status: "scheduled" | "live" | "final";
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

type LiveScoreResponse = {
  gameId: string;
  status: "scheduled" | "live" | "final";
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  updatedAtUtc: string;
};

async function fetchSquiggleGames(
  season: number,
  roundNumber: number
): Promise<SquiggleGame[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/squiggle/games?year=${season}&round=${roundNumber}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch Squiggle games");
  }

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

    const games = await fetchSquiggleGames(season, roundNumber);

    // Match by team names in SCREAMR gameId
    const matched = games.find((g) => {
      const id = gameId.toLowerCase();
      return (
        id.includes(g.homeTeam.toLowerCase()) &&
        id.includes(g.awayTeam.toLowerCase())
      );
    });

    if (!matched) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    const response: LiveScoreResponse = {
      gameId,
      status: matched.status,
      homeTeam: matched.homeTeam,
      awayTeam: matched.awayTeam,
      homeScore:
        matched.status === "scheduled" ? null : matched.homeScore,
      awayScore:
        matched.status === "scheduled" ? null : matched.awayScore,
      updatedAtUtc: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[live-score] error", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
