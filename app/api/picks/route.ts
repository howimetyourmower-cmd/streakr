// app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";

type JsonRow = {
  Round: string;      // "OR", "R1", ...
  Game: number;       // 1, 2, 3...
  Match: string;
  Venue: string;
  StartTime: string;  // ISO string
  Question: string;
  Quarter: number;
  Status: string;     // "Open", "Final", "Pending", "Void"
};

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

const rows: JsonRow[] = rounds2026 as JsonRow[];

function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

function normalizeStatus(raw: string | undefined): QuestionStatus {
  const s = (raw || "open").toLowerCase();
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  return "open";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    let roundNumber: number = 0;
    if (roundParam !== null) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        roundNumber = parsed;
      }
    }

    const roundCode = getRoundCode(roundNumber);

    const roundRows = rows.filter((row) => row.Round === roundCode);

    if (!roundRows.length) {
      const empty: PicksApiResponse = { games: [], roundNumber };
      return NextResponse.json(empty);
    }

    const gamesByKey: Record<string, ApiGame> = {};
    const questionIndexByGame: Record<string, number> = {};

    for (const row of roundRows) {
      const gameKey = `${roundCode}-G${row.Game}`;

      if (!gamesByKey[gameKey]) {
        gamesByKey[gameKey] = {
          id: gameKey,
          match: row.Match,
          sport: "AFL",
          venue: row.Venue,
          startTime: row.StartTime,
          questions: [],
        };
        questionIndexByGame[gameKey] = 0;
      }

      const qIndex = questionIndexByGame[gameKey]++;
      const questionId = `${gameKey}-Q${qIndex + 1}`;

      const apiQuestion: ApiQuestion = {
        id: questionId,
        quarter: row.Quarter,
        question: row.Question,
        status: normalizeStatus(row.Status),
        sport: "AFL",
        isSponsorQuestion: false,
        userPick: undefined,
        yesPercent: 0,
        noPercent: 0,
        commentCount: 0,
      };

      gamesByKey[gameKey].questions.push(apiQuestion);
    }

    const games = Object.values(gamesByKey);

    const response: PicksApiResponse = {
      games,
      roundNumber,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/picks] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error", games: [], roundNumber: 0 },
      { status: 500 }
    );
  }
}
