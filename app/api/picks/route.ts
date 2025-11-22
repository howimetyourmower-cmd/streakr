// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db as adminDb } from "@/lib/admin"; // firebase-admin Firestore
import { CURRENT_SEASON } from "@/lib/rounds";

type FirestoreQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
};

type FirestoreGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: string;
  questions: FirestoreQuestion[];
};

type FirestoreRoundDoc = {
  season: number;
  roundNumber: number;
  label: string;
  published?: boolean;
  games?: FirestoreGame[];
};

export async function GET() {
  try {
    // 1) Read season config to find the current round
    const configRef = adminDb.collection("config").doc(`season-${CURRENT_SEASON}`);
    const configSnap = await configRef.get();

    let currentRoundNumber = 0; // default to Opening Round
    if (configSnap.exists) {
      const data = configSnap.data() as any;
      if (typeof data.currentRoundNumber === "number") {
        currentRoundNumber = data.currentRoundNumber;
      }
    }

    const roundDocId = `${CURRENT_SEASON}-${currentRoundNumber}`;

    // 2) Load that round from Firestore
    const roundRef = adminDb.collection("rounds").doc(roundDocId);
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      return NextResponse.json(
        {
          games: [],
          roundNumber: currentRoundNumber,
          reason: "round-not-found",
        },
        { status: 200 }
      );
    }

    const roundData = roundSnap.data() as FirestoreRoundDoc;

    // 3) Only expose if published === true
    if (!roundData.published) {
      return NextResponse.json(
        {
          games: [],
          roundNumber: roundData.roundNumber ?? currentRoundNumber,
          reason: "round-not-published",
        },
        { status: 200 }
      );
    }

    const games = Array.isArray(roundData.games) ? roundData.games : [];

    return NextResponse.json(
      {
        games,
        roundNumber: roundData.roundNumber,
        label: roundData.label,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { games: [], error: "Internal server error" },
      { status: 500 }
    );
  }
}
