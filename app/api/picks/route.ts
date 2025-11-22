// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { CURRENT_SEASON, RoundKey } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";

type FirestoreQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type FirestoreGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: string;
  questions: FirestoreQuestion[];
};

type FirestoreRound = {
  season: number;
  roundKey: RoundKey;
  roundNumber: number;
  label: string;
  published: boolean;
  games: FirestoreGame[];
};

// Turn a round key (OR, R1, R2, …) into the rounds doc ID
function roundKeyToDocId(key: RoundKey): string {
  if (key === "OR") return `${CURRENT_SEASON}-0`;
  if (key === "FINALS") return `${CURRENT_SEASON}-24`; // placeholder for later

  const match = key.match(/^R(\d{1,2})$/);
  if (match) {
    const n = parseInt(match[1], 10); // e.g. R1 -> 1, R2 -> 2
    return `${CURRENT_SEASON}-${n}`;
  }

  // Fallback – should never really hit this
  return `${CURRENT_SEASON}-0`;
}

export async function GET() {
  try {
    // 1) Read current round key from config/season-2026
    const configSnap = await db
      .collection("config")
      .doc(`season-${CURRENT_SEASON}`)
      .get();

    if (!configSnap.exists) {
      console.warn("No config doc for season", CURRENT_SEASON);
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "OR" as RoundKey,
      });
    }

    const configData = configSnap.data() as {
      currentRound?: RoundKey;
    };

    const currentRoundKey = configData.currentRound ?? ("OR" as RoundKey);

    // 2) Use that key to build the doc ID, e.g. "2026-0" for OR, "2026-1" for R1, etc.
    const docId = roundKeyToDocId(currentRoundKey);

    const roundSnap = await db.collection("rounds").doc(docId).get();

    if (!roundSnap.exists) {
      console.warn("Round doc not found for ID", docId);
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: currentRoundKey,
      });
    }

    const roundData = roundSnap.data() as FirestoreRound;

    // Extra safety: if not published, hide it
    if (!roundData.published) {
      return NextResponse.json({
        games: [],
        roundNumber: roundData.roundNumber ?? 0,
        roundKey: roundData.roundKey ?? currentRoundKey,
      });
    }

    return NextResponse.json({
      games: roundData.games ?? [],
      roundNumber: roundData.roundNumber ?? 0,
      roundKey: roundData.roundKey ?? currentRoundKey,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { games: [], roundNumber: 0, roundKey: "OR" as RoundKey },
      { status: 500 }
    );
  }
}
