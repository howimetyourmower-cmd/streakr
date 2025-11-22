import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { doc, getDoc } from "firebase-admin/firestore";

export async function GET() {
  try {
    // 1. Load config
    const configRef = doc(db, "config", "season-2026");
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      throw new Error("Config doc missing");
    }

    const config = configSnap.data();
    const roundId = config.activeRoundId; // MUST be 2026-0, 2026-1 etc.

    if (!roundId) {
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "",
        error: "No active round ID",
      });
    }

    // 2. Load round by ID (correct)
    const roundRef = doc(db, "rounds", roundId);
    const roundSnap = await getDoc(roundRef);

    if (!roundSnap.exists()) {
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "",
        error: "Round not found",
      });
    }

    const data = roundSnap.data();

    // 3. If unpublished → hide games
    if (data.published === false) {
      return NextResponse.json({
        games: [],
        roundNumber: data.roundNumber,
        roundKey: data.roundKey,
      });
    }

    // 4. Build games array
    const games = Array.isArray(data.games) ? data.games : [];

    return NextResponse.json({
      games,
      roundNumber: data.roundNumber,
      roundKey: data.roundKey,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ games: [], error: "internal" });
  }
}
