// /app/api/admin/game-lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

export async function POST(req: NextRequest) {
  try {
    const { roundNumber, gameId, isUnlockedForPicks } = await req.json();

    if (typeof gameId !== "string") {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    // Store lock state per game. Collection name is up to you.
    // Using "games2026" with doc.id = gameId (e.g. "OR-G1", "R1-G3").
    await db
      .collection("games2026")
      .doc(gameId)
      .set(
        {
          roundNumber,
          isUnlockedForPicks: !!isUnlockedForPicks,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/admin/game-lock] error", error);
    return NextResponse.json(
      { error: "Failed to update game lock state" },
      { status: 500 }
    );
  }
}
