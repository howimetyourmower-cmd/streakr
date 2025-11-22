// app/api/picks/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin";              // Firebase Admin (server side)
import { CURRENT_SEASON, RoundKey } from "@/lib/rounds";

type FirestoreQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
  sport?: string;
};

type FirestoreGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string
  sport?: string;
  questions: FirestoreQuestion[];
};

type FirestoreRoundDoc = {
  season: number;
  roundNumber: number;
  label: string;
  games: FirestoreGame[];
  published?: boolean;
};

function roundKeyToNumber(key: RoundKey): number {
  if (key === "OR") return 0;
  if (key === "FINALS") return 99;
  const m = key.match(/^R(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function GET() {
  try {
    // 1) Read current round from config/season-2026 (set on /admin/settings)
    const configRef = db.collection("config").doc(`season-${CURRENT_SEASON}`);
    const configSnap = await configRef.get();

    let currentRoundKey: RoundKey = "OR";

    if (configSnap.exists) {
      const data = configSnap.data() as any;
      if (data?.currentRoundKey) {
        currentRoundKey = data.currentRoundKey as RoundKey;
      }
    }

    const currentRoundNumber = roundKeyToNumber(currentRoundKey);

    // 2) Fetch the round doc for this season + roundNumber that is published
    const roundsRef = db.collection("rounds");
    const q = roundsRef
      .where("season", "==", CURRENT_SEASON)
      .where("roundNumber", "==", currentRoundNumber)
      .where("published", "==", true)
      .limit(1);

    const snap = await q.get();

    if (snap.empty) {
      // No published round found – just return empty, client shows no picks
      return NextResponse.json({
        games: [],
        roundNumber: currentRoundNumber,
        roundKey: currentRoundKey,
      });
    }

    const roundDoc = snap.docs[0].data() as FirestoreRoundDoc;

    // 3) Shape response for PicksClient
    const games = Array.isArray(roundDoc.games) ? roundDoc.games : [];

    return NextResponse.json({
      games,
      roundNumber: roundDoc.roundNumber,
      roundKey: currentRoundKey,
      roundLabel: roundDoc.label,
    });
  } catch (err: any) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { error: "Failed to load picks", games: [] },
      { status: 500 }
    );
  }
}
