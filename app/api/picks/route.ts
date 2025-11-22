import { NextResponse } from "next/server";
import { db } from "@/lib/admin"; // Firestore (admin SDK) instance

export async function GET() {
  try {
    // 1. Load config document from admin Firestore
    // Admin SDK uses db.doc("collection/docId"), not doc(db, ...)
    const configRef = db.doc("config/season-2026");
    const configSnap = await configRef.get();

    if (!configSnap.exists) {
      throw new Error("Config doc missing");
    }

    const config = configSnap.data() as {
      activeRoundId?: string;
      activeRoundKey?: string;
      activeRoundNumber?: number;
    };

    const roundId = config.activeRoundId;

    if (!roundId) {
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "",
        error: "No activeRoundId set",
      });
    }

    // 2. Load the active round by ID from "rounds" collection
    const roundRef = db.doc(`rounds/${roundId}`);
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "",
        error: "Round not found",
      });
    }

    const round = roundSnap.data() as {
      games?: any[];
      roundNumber?: number;
      roundKey?: string;
      published?: boolean;
    };

    // 3. If round is not published yet, return empty games
    if (round.published === false) {
      return NextResponse.json({
        games: [],
        roundNumber: round.roundNumber ?? 0,
        roundKey: round.roundKey ?? "",
      });
    }

    // 4. Return games
    return NextResponse.json({
      games: Array.isArray(round.games) ? round.games : [],
      roundNumber: round.roundNumber ?? 0,
      roundKey: round.roundKey ?? "",
    });
  } catch (error) {
    console.error("Error in /api/picks:", error);
    return NextResponse.json({
      games: [],
      roundNumber: 0,
      roundKey: "",
      error: "Server error",
    });
  }
}
