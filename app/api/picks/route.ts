// app/api/picks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

type QuestionStatus = "open" | "final" | "pending" | "void";

type RawQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  sport?: string;
  venue?: string;
  startTime?: string;
};

type RawGame = {
  id: string;
  match: string;
  venue?: string;
  startTime?: string;
  sport?: string;
  questions?: RawQuestion[];
};

type RoundConfig = {
  currentRoundId?: string;
  currentRoundKey?: string;
  currentRoundNumber?: number;
  season?: number;
};

type RoundDoc = {
  games?: RawGame[];
  roundKey?: string;
  roundNumber?: number;
  sponsorQuestionId?: string; // 👈 where admin UI writes the chosen sponsor Q
};

export async function GET() {
  try {
    // 1) Load config/season-2026 to find current round
    const configSnap = await db.collection("config").doc("season-2026").get();

    if (!configSnap.exists) {
      return NextResponse.json(
        {
          games: [],
          roundNumber: 0,
          roundKey: "",
          error: "config/season-2026 not found",
        },
        { status: 200 }
      );
    }

    const config = configSnap.data() as RoundConfig;
    const roundId = config.currentRoundId;
    const roundKeyFromConfig = config.currentRoundKey ?? "";
    const roundNumberFromConfig = config.currentRoundNumber ?? 0;

    if (!roundId) {
      return NextResponse.json(
        {
          games: [],
          roundNumber: roundNumberFromConfig,
          roundKey: roundKeyFromConfig,
          error: "currentRoundId missing in config",
        },
        { status: 200 }
      );
    }

    // 2) Load the round document, e.g. rounds/2026-0
    const roundSnap = await db.collection("rounds").doc(roundId).get();

    if (!roundSnap.exists) {
      return NextResponse.json(
        {
          games: [],
          roundNumber: roundNumberFromConfig,
          roundKey: roundKeyFromConfig,
          error: `rounds/${roundId} not found`,
        },
        { status: 200 }
      );
    }

    const roundData = roundSnap.data() as RoundDoc;

    const rawGames = roundData.games ?? [];
    const roundKey = roundKeyFromConfig || roundData.roundKey || "";
    const roundNumber = roundNumberFromConfig || roundData.roundNumber || 0;

    const sponsorQuestionId = roundData.sponsorQuestionId || "";

    // 3) Map games + questions and tag the sponsor question
    const games = rawGames.map((g) => {
      const baseGameSport = g.sport ?? "AFL";

      const questions = (g.questions ?? []).map((q) => ({
        id: q.id,
        quarter: q.quarter,
        question: q.question,
        status: q.status,
        userPick: q.userPick,
        yesPercent: q.yesPercent,
        noPercent: q.noPercent,
        commentCount: q.commentCount ?? 0,
        sport: q.sport ?? baseGameSport,
        venue: g.venue ?? q.venue ?? "",
        startTime: g.startTime ?? q.startTime ?? "",
        // 👇 THIS is the important bit
        isSponsorQuestion: sponsorQuestionId === q.id,
      }));

      return {
        id: g.id,
        match: g.match,
        venue: g.venue ?? "",
        startTime: g.startTime ?? "",
        sport: baseGameSport,
        questions,
      };
    });
// inside something like questionsSnap.docs.map(...)
const data = qDoc.data() as any;

questions.push({
  id: qDoc.id,
  quarter: data.quarter,
  question: data.question,
  status: data.status,
  // ...other fields...
  isSponsorQuestion: data.isSponsorQuestion === true, // 👈 ADD THIS LINE
});

    return NextResponse.json(
      {
        games,
        roundNumber,
        roundKey,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      {
        games: [],
        roundNumber: 0,
        roundKey: "",
        error: err?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
