// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin"; // ← or "@/lib/firebaseAdmin" if that's your filename

const CURRENT_SEASON = 2026;

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
  sport: string;
  startTime: string;
  questions: FirestoreQuestion[];
};

type PicksResponse = {
  games: FirestoreGame[];
  roundNumber: number;
  roundKey: string;
};

export async function GET() {
  try {
    // 1) Load season config
    const configRef = db.collection("config").doc("season-2026");
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      console.error("Config doc season-2026 is missing");
      return NextResponse.json<PicksResponse>({
        games: [],
        roundNumber: 0,
        roundKey: "OR",
      });
    }

    const config = configSnap.data() as {
      currentRoundNumber: number;
      currentRoundKey: string;
    };

    const roundNumber = config.currentRoundNumber ?? 0;
    const roundKey = config.currentRoundKey ?? "OR";

    // 2) Load current round document, e.g. "2026-0"
    const roundDocId = `${CURRENT_SEASON}-${roundNumber}`;
    const roundRef = db.collection("rounds").doc(roundDocId);
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      console.error("Round doc missing:", roundDocId);
      return NextResponse.json<PicksResponse>({
        games: [],
        roundNumber,
        roundKey,
      });
    }

    const roundData = roundSnap.data() as {
      games?: FirestoreGame[];
      published?: boolean;
    };

    // 3) If not published or games not an array, hide everything
    if (!roundData.published || !Array.isArray(roundData.games)) {
      console.log("Round exists but unpublished or no games:", roundDocId);
      return NextResponse.json<PicksResponse>({
        games: [],
        roundNumber,
        roundKey,
      });
    }

    // 4) Success – return games
    return NextResponse.json<PicksResponse>({
      games: roundData.games,
      roundNumber,
      roundKey,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json<PicksResponse>(
      {
        games: [],
        roundNumber: 0,
        roundKey: "OR",
      },
      { status: 500 }
    );
  }
}
