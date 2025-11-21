// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { CURRENT_SEASON } from "@/lib/rounds";

// ⬇️ Make this line match your seed API (same path + export)
import { Db as adminDb } from "@/lib/admin"; // if your admin file exports "adminDb"

type FirestoreRound = {
  season: number;
  roundNumber: number;
  label: string;
  games: any[];
};

export async function GET() {
  try {
    const roundsRef = adminDb.collection("rounds");

    // get all rounds for the current season, ordered by roundNumber
    const snap = await roundsRef
      .where("season", "==", CURRENT_SEASON)
      .orderBy("roundNumber", "asc")
      .get();

    if (snap.empty) {
      return NextResponse.json({ games: [], roundNumber: null });
    }

    // pick the first round that actually has games
    let current: FirestoreRound | null = null;

    snap.forEach((doc) => {
      const data = doc.data() as FirestoreRound;
      if (!current && Array.isArray(data.games) && data.games.length > 0) {
        current = data;
      }
    });

    if (!current) {
      return NextResponse.json({ games: [], roundNumber: null });
    }

    return NextResponse.json({
      games: current.games,
      roundNumber: current.roundNumber,
    });
  } catch (err) {
    console.error("Error loading picks:", err);
    return NextResponse.json(
      { games: [], roundNumber: null, error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
