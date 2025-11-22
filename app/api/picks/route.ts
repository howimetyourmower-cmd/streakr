import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

type QuestionStatus = "open" | "final" | "pending" | "void";

type RoundConfig = {
  currentRoundId?: string;
  currentRoundKey?: string;
  currentRoundNumber?: number;
  season?: number;
};

type RoundDoc = {
  games?: any[];
  roundKey?: string;
  roundNumber?: number;
};

export async function GET() {
  try {
    // 1) Read the config doc that your Publish button updates
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

    const games = roundData.games ?? [];
    const roundKey = roundKeyFromConfig || roundData.roundKey || "";
    const roundNumber = roundNumberFromConfig || roundData.roundNumber || 0;

    return NextResponse.json(
      {
        games,
        roundNumber,
        roundKey,
      },
      { status: 200 }
    );
  } catch (err: any) {
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
