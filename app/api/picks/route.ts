// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db as adminDb } from "@/lib/admin";
import { CURRENT_SEASON, type RoundKey } from "@/lib/rounds";

type FirestoreGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // "2026-03-05T19:30:00+11:00"
  sport: string;
  questions: {
    id: string;
    quarter: number;
    question: string;
    status: "open" | "final" | "pending" | "void";
  }[];
};

type FirestoreRound = {
  season: number;
  roundNumber: number;
  roundKey: RoundKey;
  label: string;
  published: boolean;
  games: FirestoreGame[];
};

export async function GET() {
  try {
    // 1) Read current round from config: config/season-2026
    const cfgRef = adminDb
      .collection("config")
      .doc(`season-${CURRENT_SEASON}`);

    const cfgSnap = await cfgRef.get();

    let currentRoundKey: RoundKey = "OR";
    let currentRoundNumber = 0;

    if (cfgSnap.exists) {
      const data = cfgSnap.data() as any;
      if (data.currentRoundKey) {
        currentRoundKey = data.currentRoundKey as RoundKey;
      }
      if (typeof data.currentRoundNumber === "number") {
        currentRoundNumber = data.currentRoundNumber as number;
      }
    }

    // 2) Find the round doc that is published and matches this season + roundKey
    const roundsRef = adminDb.collection("rounds");

    const roundsSnap = await roundsRef
      .where("season", "==", CURRENT_SEASON)
      .where("roundKey", "==", currentRoundKey)
      .where("published", "==", true)
      .limit(1)
      .get();

    let roundKey: RoundKey = currentRoundKey;
    let roundNumber = currentRoundNumber;
    let games: FirestoreGame[] = [];

    if (!roundsSnap.empty) {
      const docSnap = roundsSnap.docs[0];
      const data = docSnap.data() as FirestoreRound;

      roundKey = data.roundKey ?? currentRoundKey;
      roundNumber = data.roundNumber ?? currentRoundNumber;
      games = (data.games ?? []) as FirestoreGame[];
    }

    return NextResponse.json({
      games,
      roundNumber,
      roundKey,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { error: "Failed to load picks", games: [], roundNumber: 0, roundKey: "OR" },
      { status: 500 }
    );
  }
}
