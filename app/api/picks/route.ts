export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

// JSON seed for all 2026 rounds
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

// Shape of each row in data/rounds-2026.json
type JsonRow = {
  Round: string;        // e.g. "OR", "R1"
  Game: number;         // 1..9
  Match: string;        // "Sydney vs Carlton"
  Venue: string;        // "SCG, Sydney"
  StartTime: string;    // ISO-ish string
  Question: string;
  Quarter: number;
  Status: string;       // "Open" | "Final" | ...
  Sport?: string;       // optional, default "AFL"
};

function normaliseStatus(raw: string | undefined): QuestionStatus {
  const s = (raw || "").toLowerCase();
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  return "open";
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    // 1) Get current round meta from Firestore
    const seasonDocRef = db.collection("config").doc("season-2026");
    const seasonSnap = await seasonDocRef.get();

    let currentRoundKey = "OR";
    let currentRoundNumber = 0;
    let currentRoundId = "2026-0";

    if (seasonSnap.exists) {
      const data = seasonSnap.data() as any;
      if (typeof data.currentRoundKey === "string") {
        currentRoundKey = data.currentRoundKey;
      }
      if (typeof data.currentRoundNumber === "number") {
        currentRoundNumber = data.currentRoundNumber;
      }
      if (typeof data.currentRoundId === "string") {
        currentRoundId = data.currentRoundId;
      }
    }

    // 2) Load sponsor question(s) for this round from Firestore
    //    We look through rounds/{currentRoundId}.games[].questions[].isSponsorQuestion
    const sponsorQuestionTexts = new Set<string>();

    const roundDocRef = db.collection("rounds").doc(currentRoundId);
    const roundSnap = await roundDocRef.get();
    if (roundSnap.exists) {
      const roundData = roundSnap.data() as any;
      const games = Array.isArray(roundData?.games) ? roundData.games : [];

      for (const g of games) {
        const qs = Array.isArray(g?.questions) ? g.questions : [];
        for (const q of qs) {
          if (q && q.isSponsorQuestion && typeof q.question === "string") {
            sponsorQuestionTexts.add(q.question);
          }
        }
      }
    }

    // 3) Filter JSON rows for the current round key
    const allRows = rounds2026 as JsonRow[];
    const rowsForRound = allRows.filter(
      (r) => (r.Round || "").toUpperCase() === currentRoundKey.toUpperCase()
    );

    if (!rowsForRound.length) {
      // No data for this round in JSON – return empty but with round number
      return NextResponse.json(
        { games: [], roundNumber: currentRoundNumber } as PicksApiResponse
      );
    }

    // 4) Group JSON rows by game (Round + Game number is unique within season)
    const gamesMap = new Map<string, ApiGame>();

    for (const row of rowsForRound) {
      const sport = row.Sport || "AFL";
      const gameKey = `${row.Round}-${row.Game}`;
      let game = gamesMap.get(gameKey);

      if (!game) {
        const gameId = `${row.Round}-${row.Game}-${slugify(row.Match)}`;
        game = {
          id: gameId,
          match: row.Match,
          venue: row.Venue,
          startTime: row.StartTime,
          sport,
          questions: [],
        };
        gamesMap.set(gameKey, game);
      }

      const isSponsor = sponsorQuestionTexts.has(row.Question);

      const questionId = `${game.id}-q${row.Quarter}-${game.questions.length + 1}`;

      const q: ApiQuestion = {
        id: questionId,
        quarter: row.Quarter,
        question: row.Question,
        status: normaliseStatus(row.Status),
        yesPercent: 0,
        noPercent: 0,
        commentCount: 0,
        isSponsorQuestion: isSponsor,
      };

      game.questions.push(q);
    }

    const games = Array.from(gamesMap.values());

    const response: PicksApiResponse = {
      games,
      roundNumber: currentRoundNumber,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { games: [], roundNumber: 0, error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
