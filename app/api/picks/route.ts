// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db as adminDb } from "@/lib/admin";
import { CURRENT_SEASON, type RoundKey } from "@/lib/rounds";

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
  roundNumber: number;
  roundKey: RoundKey;
  label: string;
  published: boolean;
  games: FirestoreGame[];
};

export async function GET() {
  try {
    // 1) Get current round from config/season-2026
    const cfgRef = adminDb.collection("config").doc(`season-${CURRENT_SEASON}`);
    const cfgSnap = await cfgRef.get();

    let currentRoundKey: RoundKey = "OR";
    let currentRoundNumber = 0;

    if (cfgSnap.exists) {
      const data = cfgSnap.data() as any;
      if (data.currentRoundKey) {
        currentRoundKey = data.currentRoundKey as RoundKey;
      }
      if (typeof data.currentRoundNumber === "number") {
        currentRoundNumber = data.currentRoundNumber;
      }
    }

    // 2) Read the round document directly by ID: "2026-0", "2026-1", etc
    const roundDocId = `${CURRENT_SEASON}-${currentRoundNumber}`;
    const roundRef = adminDb.collection("rounds").doc(roundDocId);
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      // No round doc – return empty but with key/number so UI still works
      return NextResponse.json({
        games: [],
        roundNumber: currentRoundNumber,
        roundKey: currentRoundKey,
      });
    }

    const data = roundSnap.data() as FirestoreRound;

    // 3) Respect the published flag – if not published, hide all questions
    if (!data.published) {
      return NextResponse.json({
        games: [],
        roundNumber: data.roundNumber ?? currentRoundNumber,
        roundKey: data.roundKey ?? currentRoundKey,
      });
    }

    const games = (data.games ?? []) as FirestoreGame[];

    return NextResponse.json({
      games,
      roundNumber: data.roundNumber ?? currentRoundNumber,
      roundKey: data.roundKey ?? currentRoundKey,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { error: "Failed to load picks", games: [], roundNumber: 0, roundKey: "OR" },
      { status: 500 }
    );
  }
}
