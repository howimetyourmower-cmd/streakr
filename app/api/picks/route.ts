import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

type QuestionStatus = "open" | "final" | "pending" | "void";

type RoundConfig = {
  currentRoundId?: string;
  currentRoundKey?: string;
  currentRoundNumber?: number;
  season?: number;
  // optional sponsor fields – shape is flexible, we read them defensively
  sponsorQuestionId?: string;
  sponsorQuestion?: any;
};

type RoundDoc = {
  games?: any[];
  roundKey?: string;
  roundNumber?: number;
};

export async function GET() {
  try {
    // 1) Read the config doc that your Publish button updates
    const configRef = db.collection("config").doc("season-2026");
    const configSnap = await configRef.get();

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

    const rawConfig = configSnap.data() as RoundConfig & Record<string, any>;
    const config: RoundConfig = rawConfig;

    const roundId = config.currentRoundId;
    const roundKeyFromConfig = config.currentRoundKey ?? "";
    const roundNumberFromConfig = config.currentRoundNumber ?? 0;

    // Try to derive a sponsor question id from a few possible shapes
    const sponsorQuestionId: string | null =
      rawConfig.sponsorQuestionId ??
      rawConfig.sponsorQuestion?.id ??
      rawConfig.sponsorQuestion?.questionId ??
      null;

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

    const games = roundData.games ?? [];
    const roundKey = roundKeyFromConfig || roundData.roundKey || "";
    const roundNumber = roundNumberFromConfig || roundData.roundNumber || 0;

    // 3) If we have a sponsorQuestionId, decorate that question in the games array
    const gamesWithSponsorFlag =
      sponsorQuestionId
        ? games.map((game: any) => {
            const questions = Array.isArray(game.questions)
              ? game.questions.map((q: any) => {
                  // Preserve existing flag if you already store it on the question
                  const alreadySponsor = !!q.isSponsorQuestion;
                  const isSponsor =
                    alreadySponsor || q.id === sponsorQuestionId;

                  return isSponsor
                    ? { ...q, isSponsorQuestion: true }
                    : q;
                })
              : game.questions;

            return {
              ...game,
              questions,
            };
          })
        : games;

    return NextResponse.json(
      {
        games: gamesWithSponsorFlag,
        roundNumber,
        roundKey,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in GET /api/picks:", err);
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
