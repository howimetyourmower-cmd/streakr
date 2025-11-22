import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { CURRENT_SEASON } from "@/lib/rounds";

type FirestoreRound = {
  season: number;
  roundNumber: number;
  roundKey: string;
  label: string;
  published?: boolean;
  games?: any[];
};

type SeasonConfig = {
  currentRoundNumber?: number;
  currentRoundKey?: string;
};

export async function GET() {
  try {
    // 1. Load season config to find which round is currently live
    const configRef = db.collection("config").doc(`season-${CURRENT_SEASON}`);
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      // No config yet – just return empty but with sensible defaults
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "OR",
      });
    }

    const config = configSnap.data() as SeasonConfig;

    const roundNumber = config.currentRoundNumber ?? 0;
    const roundKey = config.currentRoundKey ?? "OR";

    // 2. Load that round from the "rounds" collection
    const roundId = `${CURRENT_SEASON}-${roundNumber}`; // e.g. "2026-0"
    const roundRef = db.collection("rounds").doc(roundId);
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      // Round doc missing – again, return empty but keep round info
      return NextResponse.json({
        games: [],
        roundNumber,
        roundKey,
      });
    }

    const roundData = roundSnap.data() as FirestoreRound;

    // 3. Respect the "published" flag
    if (!roundData.published) {
      return NextResponse.json({
        games: [],
        roundNumber,
        roundKey,
      });
    }

    // 4. Finally, send games back to the Picks page
    const games = Array.isArray(roundData.games) ? roundData.games : [];

    return NextResponse.json({
      games,
      roundNumber,
      roundKey,
    });
  } catch (err) {
    console.error("Error in /api/picks", err);
    return NextResponse.json(
      {
        games: [],
        roundNumber: 0,
        roundKey: "OR",
        error: "internal_error",
      },
      { status: 500 }
    );
  }
}
