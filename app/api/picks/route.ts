import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

const SEASON = 2026;
const CONFIG_DOC_ID = `season-${SEASON}`;

// Response shape used by the Picks page
type PicksApiResponse = {
  games: any[];
  roundNumber: number;
  roundKey: string;
};

export async function GET() {
  try {
    // 1) Load config to find the current round key
    const configRef = doc(db, "config", CONFIG_DOC_ID);
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      console.error("[/api/picks] Config doc missing");
      const empty: PicksApiResponse = { games: [], roundNumber: 0, roundKey: "" };
      return NextResponse.json(empty);
    }

    const configData = configSnap.data() as {
      currentRoundKey?: string;
    };

    const currentRoundKey = configData.currentRoundKey || "OR";

    // 2) Find the published round for this season + roundKey
    const roundsRef = collection(db, "rounds");
    const roundsQuery = query(
      roundsRef,
      where("season", "==", SEASON),
      where("roundKey", "==", currentRoundKey),
      where("published", "==", true),
      limit(1)
    );

    const roundsSnap = await getDocs(roundsQuery);

    if (roundsSnap.empty) {
      console.warn("[/api/picks] No published round found for", {
        season: SEASON,
        currentRoundKey,
      });

      const empty: PicksApiResponse = {
        games: [],
        roundNumber: 0,
        roundKey: currentRoundKey,
      };
      return NextResponse.json(empty);
    }

    const roundDoc = roundsSnap.docs[0];
    const roundData = roundDoc.data() as {
      games?: any[];
      roundNumber?: number;
      roundKey?: string;
    };

    const games = Array.isArray(roundData.games) ? roundData.games : [];

    const response: PicksApiResponse = {
      games,
      roundNumber: roundData.roundNumber ?? 0,
      roundKey: roundData.roundKey ?? currentRoundKey,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/picks] Error loading picks:", error);
    const empty: PicksApiResponse = { games: [], roundNumber: 0, roundKey: "" };
    return NextResponse.json(empty, { status: 500 });
  }
}
