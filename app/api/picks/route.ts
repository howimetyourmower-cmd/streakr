// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db as adminDb } from "@/lib/admin"; // uses firebase-admin Firestore

const CURRENT_SEASON = 2026;

type SettingsDoc = {
  currentRoundKey?: string;
};

export async function GET() {
  try {
    // 1. Get current round from config/season-2026
    const settingsRef = adminDb.collection("config").doc(`season-${CURRENT_SEASON}`);
    const settingsSnap = await settingsRef.get();

    if (!settingsSnap.exists) {
      console.warn("No settings doc found for season", CURRENT_SEASON);
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: "OR",
        debug: "no-settings-doc",
      });
    }

    const settings = settingsSnap.data() as SettingsDoc;
    const activeRoundKey = settings.currentRoundKey || "OR";

    // 2. Find the matching round that is published
    const roundsRef = adminDb.collection("rounds");
    const q = roundsRef
      .where("season", "==", CURRENT_SEASON)
      .where("roundKey", "==", activeRoundKey)
      .where("published", "==", true)
      .limit(1);

    const snapshot = await q.get();

    if (snapshot.empty) {
      console.warn("No published round found for", {
        season: CURRENT_SEASON,
        roundKey: activeRoundKey,
      });
      return NextResponse.json({
        games: [],
        roundNumber: 0,
        roundKey: activeRoundKey,
        debug: "no-round-doc",
      });
    }

    const roundDoc = snapshot.docs[0];
    const data = roundDoc.data() as any;

    const games = Array.isArray(data.games) ? data.games : [];

    return NextResponse.json({
      games,
      roundNumber: data.roundNumber ?? 0,
      roundKey: data.roundKey ?? activeRoundKey,
    });
  } catch (error) {
    console.error("Error in /api/picks", error);
    return NextResponse.json(
      {
        games: [],
        roundNumber: 0,
        roundKey: "OR",
        error: "server-error",
      },
      { status: 500 },
    );
  }
}
