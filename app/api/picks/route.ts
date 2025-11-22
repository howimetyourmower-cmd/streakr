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

export async function GET() {
  try {
    // 1) Read current round from config/season-2026
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

    // 2) Get the round doc for that roundKey & season that is published
    const roundsSnap = await db
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .where("roundKey", "==", currentRoundKey)
      .where("published", "==", true)
      .limit(1)
      .get();

    if (roundsSnap.empty) {
      console.warn(
        "No published round found for",
        CURRENT_SEASON,
        currentRoundKey
      );
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: currentRoundKey,
      });
    }

    const roundDoc = roundsSnap.docs[0];
    const roundData = roundDoc.data() as FirestoreRound;

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
