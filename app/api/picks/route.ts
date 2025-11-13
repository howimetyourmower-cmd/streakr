import { NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/admin";
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
  startTime: string;
  questions: Question[];
};

type PicksResponse = {
  games: Game[];
};

const CURRENT_SEASON = 2026;
const CURRENT_ROUND = 1;

export async function GET() {
  try {
    const roundSnap = await adminDb
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .where("round", "==", CURRENT_ROUND)
      .limit(1)
      .get();

    if (roundSnap.empty) {
      const empty: PicksResponse = { games: [] };
      return NextResponse.json(empty);
    }

    const roundDoc = roundSnap.docs[0];
    const data = roundDoc.data() as any;

    const games: Game[] = (data.games ?? []).map((g: any, i: number) => {
      const ts = g.startTime as Timestamp | string;
      let startISO = new Date().toISOString();

      if (ts instanceof Timestamp) {
        startISO = ts.toDate().toISOString();
      } else if (typeof ts === "string") {
        startISO = new Date(ts).toISOString();
      }

      const questions: Question[] = (g.questions ?? []).map(
        (q: any, qIndex: number) => ({
          id: `${roundDoc.id}-${i}-${qIndex}`,
          quarter: Number(q.quarter ?? 1),
          question: q.question ?? "",
          status: "open",
        })
      );

      return {
        id: `${roundDoc.id}-${i}`,
        match: g.match ?? "",
        venue: g.venue ?? "",
        startTime: startISO,
        questions,
      };
    });

    return NextResponse.json({ games });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json({ games: [] }, { status: 500 });
  }
}
