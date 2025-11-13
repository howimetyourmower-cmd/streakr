import { NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/admin"; // ⬅ same style as your working user-picks route
import { Timestamp } from "firebase-admin/firestore";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string
  questions: Question[];
};

type PicksResponse = {
  games: Game[];
};

const CURRENT_SEASON = 2026;
const CURRENT_ROUND = 1; // change to 8 or whatever round you’ve seeded

export async function GET() {
  try {
    // 1) Load the round document from Firestore
    const roundSnap = await adminDb
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .where("round", "==", CURRENT_ROUND)
      .limit(1)
      .get();

    if (roundSnap.empty) {
      console.warn(
        "[/api/picks] No round document found for season",
        CURRENT_SEASON,
        "round",
        CURRENT_ROUND
      );
      const empty: PicksResponse = { games: [] };
      return NextResponse.json(empty);
    }

    const roundDoc = roundSnap.docs[0];
    const data = roundDoc.data() as any;

    const gamesData = (data.games ?? []) as any[];

    const games: Game[] = gamesData.map((g, gameIndex) => {
      const ts = g.startTime as Timestamp | string | undefined;
      let isoStart = new Date().toISOString();

      if (ts instanceof Timestamp) {
        isoStart = ts.toDate().toISOString();
      } else if (typeof ts === "string" && ts) {
        isoStart = new Date(ts).toISOString();
      }

      const questionsData = (g.questions ?? []) as any[];

      const questions: Question[] = questionsData.map(
        (q: any, questionIndex: number) => ({
          id: `${roundDoc.id}-${gameIndex}-${questionIndex}`,
          quarter: Number(q.quarter ?? 1),
          question: String(q.question ?? ""),
          status: "open", // everything is open for now – you’ll hook this up later
          userPick: undefined,
          yesPercent: undefined,
          noPercent: undefined,
        })
      );

      return {
        id: `${roundDoc.id}-${gameIndex}`,
        match: String(g.match ?? ""),
        venue: String(g.venue ?? "MCG, Melbourne"),
        startTime: isoStart,
        questions,
      };
    });

    const payload: PicksResponse = { games };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error in /api/picks:", err);
    const fallback: PicksResponse = { games: [] };
    return NextResponse.json(fallback, { status: 500 });
  }
}
