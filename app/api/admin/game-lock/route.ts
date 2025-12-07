// app/api/admin/game-lock/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

type Body = {
  roundNumber: number;
  gameId: string;
  isUnlockedForPicks: boolean;
};

/**
 * POST /api/admin/game-lock
 *
 * Body:
 * {
 *   roundNumber: number;        // e.g. 0 for OR, 1 for R1
 *   gameId: string;             // e.g. "OR-G1"
 *   isUnlockedForPicks: boolean // true = players can pick
 * }
 *
 * Persists a simple config document in the "gameUnlocks" collection:
 *   roundNumber, gameId, isUnlockedForPicks, updatedAt
 *
 * /api/picks reads these docs (by roundNumber) and attaches
 *   game.isUnlockedForPicks for each game.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as Partial<Body>;

    const roundNumber = body.roundNumber;
    const gameId = body.gameId;
    const isUnlockedForPicks = body.isUnlockedForPicks;

    if (
      typeof roundNumber !== "number" ||
      roundNumber < 0 ||
      !Number.isFinite(roundNumber)
    ) {
      return NextResponse.json(
        { error: "roundNumber must be a non-negative number" },
        { status: 400 }
      );
    }

    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json(
        { error: "gameId must be a non-empty string" },
        { status: 400 }
      );
    }

    if (typeof isUnlockedForPicks !== "boolean") {
      return NextResponse.json(
        { error: "isUnlockedForPicks must be a boolean" },
        { status: 400 }
      );
    }

    // Deterministic doc id so updates overwrite the same record
    const docId = `${roundNumber}-${gameId}`;

    const docRef = db.collection("gameUnlocks").doc(docId);

    await docRef.set(
      {
        roundNumber,
        gameId,
        isUnlockedForPicks,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      roundNumber,
      gameId,
      isUnlockedForPicks,
    });
  } catch (error) {
    console.error("[/api/admin/game-lock] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
