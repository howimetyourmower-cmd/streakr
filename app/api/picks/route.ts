// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db as adminDb } from "@/lib/admin";
import { CURRENT_SEASON } from "@/lib/rounds";

// Keep this in sync with what you seed into Firestore
type QuestionStatus = "open" | "pending" | "final" | "void";

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
  label: string;
  games: FirestoreGame[];
};

export async function GET() {
  try {
    // 1) Load all rounds for the current season
    const roundsSnap = await adminDb
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .get();

    const rounds: FirestoreRound[] = roundsSnap.docs
      .map((doc) => doc.data() as FirestoreRound)
      .sort((a, b) => a.roundNumber - b.roundNumber);

    if (rounds.length === 0) {
      // No data yet
      return NextResponse.json({ games: [], roundNumber: null });
    }

    // 2) Pick the "current" round
    //    For now: just take the lowest roundNumber (Opening Round = 0)
    const current: FirestoreRound | undefined = rounds[0];

    if (!current) {
      return NextResponse.json({ games: [], roundNumber: null });
    }

    // 3) Return games + roundNumber in the shape your PicksClient expects
    return NextResponse.json({
      games: current.games,
      roundNumber: current.roundNumber,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { games: [], error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
