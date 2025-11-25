// app/api/picks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no"; // (not used yet, but kept for type-compat)
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;
  sport?: string;
  venue?: string;
  startTime?: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

// Helper to normalise Firestore Timestamp/Date/string to ISO string
function toIso(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

// GET /api/picks
export async function GET() {
  try {
    // 1) Find current season + round from meta/currentSeason
    const metaSnap = await db.collection("meta").doc("currentSeason").get();

    if (!metaSnap.exists) {
      return NextResponse.json(
        { error: "currentSeason meta document not found" },
        { status: 500 }
      );
    }

    const meta = metaSnap.data() as any;
    const seasonId: string = meta.seasonId || "season-2026";
    const currentRound: number =
      typeof meta.currentRound === "number" ? meta.currentRound : 0;

    // 2) Load games for that season + round
    const seasonRef = db.collection("config").doc(seasonId);
    const roundRef = seasonRef.collection("rounds").doc(String(currentRound));

    const roundSnap = await roundRef.get();
    if (!roundSnap.exists) {
      return NextResponse.json(
        { error: "Round config not found for current round" },
        { status: 500 }
      );
    }

    const gamesSnap = await roundRef.collection("games").get();

    const games: ApiGame[] = [];

    for (const gameDoc of gamesSnap.docs) {
      const gData = gameDoc.data() as any;

      const match: string =
        gData.match ||
        `${gData.homeTeam ?? "Home"} vs ${gData.awayTeam ?? "Away"}`;

      const venue: string = gData.venue ?? "";
      const sport: string = gData.sport ?? "AFL";
      const startTimeIso: string =
        toIso(gData.startTime) ?? new Date().toISOString();

      // 3) Load questions for each game
      const questionsSnap = await gameDoc.ref.collection("questions").get();
      const questions: ApiQuestion[] = [];

      questionsSnap.forEach((qDoc) => {
        const data = qDoc.data() as any;

        const status: QuestionStatus =
          (data.status as QuestionStatus) ?? "open";

        questions.push({
          id: qDoc.id,
          quarter: typeof data.quarter === "number" ? data.quarter : 1,
          question: data.question ?? "",
          status,
          yesPercent:
            typeof data.yesPercent === "number" ? data.yesPercent : 0,
          noPercent:
            typeof data.noPercent === "number" ? data.noPercent : 0,
          commentCount:
            typeof data.commentCount === "number" ? data.commentCount : 0,
          isSponsorQuestion: !!data.isSponsorQuestion,
          sport: data.sport ?? sport,
          venue: data.venue ?? venue,
          startTime: toIso(data.startTime) ?? startTimeIso,
        });
      });

      games.push({
        id: gameDoc.id,
        match,
        venue,
        startTime: startTimeIso,
        sport,
        questions,
      });
    }

    const response: PicksApiResponse = {
      games,
      roundNumber: currentRound,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
