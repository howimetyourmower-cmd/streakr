// app/api/picks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport?: string;
  venue?: string;
  startTime?: string;
  // still here for future use, even if the UI ignores them for now
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  questions: ApiQuestion[];
};

type PicksResponse = {
  games: ApiGame[];
  roundNumber: number;
};

export async function GET() {
  try {
    // 1) Figure out current season + round from meta/currentSeason
    const metaSnap = await db.collection("meta").doc("currentSeason").get();

    const meta = (metaSnap.exists ? metaSnap.data() : {}) as any;
    const season: number = typeof meta.season === "number" ? meta.season : 2026;
    const currentRound: number =
      typeof meta.currentRound === "number" ? meta.currentRound : 0;

    const roundDocId = `${season}-${currentRound}`;

    // 2) Load the round config doc that contains the games/questions
    //    Path: config / season-2026 / rounds / {season}-{roundNumber}
    const roundRef = db
      .collection("config")
      .doc(`season-${season}`)
      .collection("rounds")
      .doc(roundDocId);

    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      // Nothing configured yet – return empty but with roundNumber
      const empty: PicksResponse = {
        games: [],
        roundNumber: currentRound,
      };
      return NextResponse.json(empty);
    }

    const roundData = roundSnap.data() as any;

    const roundNumber: number =
      typeof roundData.roundNumber === "number"
        ? roundData.roundNumber
        : currentRound;

    const gamesRaw: any[] = Array.isArray(roundData.games)
      ? roundData.games
      : [];

    // 3) Work out which question is the sponsor question for this round
    //    The admin screen should save one of these:
    //    - sponsorQuestionId: "<questionId>"
    //    - sponsorQuestion: { questionId: "<questionId>" }  (fallback)
    const sponsorQuestionId: string | null =
      (roundData.sponsorQuestionId as string | undefined) ??
      (roundData.sponsorQuestion?.questionId as string | undefined) ??
      (roundData.sponsorQuestion?.id as string | undefined) ??
      null;

    // 4) Map Firestore shape -> API shape, adding isSponsorQuestion
    const games: ApiGame[] = gamesRaw.map((g: any, gameIndex: number) => {
      const match = g.match ?? "";
      const venue = g.venue ?? "";
      const startTime = g.startTime ?? "";
      const sport = g.sport ?? "AFL";

      const questionsRaw: any[] = Array.isArray(g.questions)
        ? g.questions
        : [];

      const questions: ApiQuestion[] = questionsRaw.map((q: any) => {
        const qId: string = q.id ?? "";
        const isSponsor = !!sponsorQuestionId && qId === sponsorQuestionId;

        return {
          id: qId,
          quarter: Number(q.quarter ?? 1),
          question: q.question ?? "",
          status: (q.status ?? "open") as QuestionStatus,
          sport: q.sport ?? sport,
          venue: q.venue ?? venue,
          startTime: q.startTime ?? startTime,
          // we’re not currently using these in the UI, but keep the fields:
          yesPercent:
            typeof q.yesPercent === "number" ? q.yesPercent : undefined,
          noPercent:
            typeof q.noPercent === "number" ? q.noPercent : undefined,
          commentCount:
            typeof q.commentCount === "number" ? q.commentCount : 0,
          isSponsorQuestion: isSponsor,
        };
      });

      return {
        id: g.id ?? `game-${roundNumber}-${gameIndex}`,
        match,
        venue,
        startTime,
        sport,
        questions,
      };
    });

    const response: PicksResponse = {
      games,
      roundNumber,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { games: [], roundNumber: 0, error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
