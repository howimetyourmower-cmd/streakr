// /app/api/admin/game-lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { roundNumber, gameId, isUnlockedForPicks } = body ?? {};

    if (typeof gameId !== "string" || !gameId.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid gameId" },
        { status: 400 }
      );
    }

    const round =
      typeof roundNumber === "number" && roundNumber >= 0 ? roundNumber : null;

    // Use gameId as the document id for convenience
    const docRef = db.collection("gameLocks").doc(gameId);

    await docRef.set(
      {
        gameId, // 👈 CRUCIAL: /api/picks queries on this field
        roundNumber: round,
        isUnlockedForPicks: !!isUnlockedForPicks,
        updatedAt: new Date(), // Date is fine; Firestore stores as Timestamp
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      gameId,
      roundNumber: round,
      isUnlockedForPicks: !!isUnlockedForPicks,
    });
  } catch (error) {
    console.error("[/api/admin/game-lock] error", error);
    return NextResponse.json(
      { error: "Failed to update game lock" },
      { status: 500 }
    );
  }
}
