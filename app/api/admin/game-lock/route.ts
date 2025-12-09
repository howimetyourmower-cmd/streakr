// /app/api/admin/game-lock/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type GameLockDoc = {
  gameId: string;
  roundNumber: number;
  isUnlockedForPicks: boolean;
  updatedAt?: Timestamp;
  updatedBy?: string;
};

type ApiLocksPayload = {
  roundNumber: number;
  locks: Record<string, { isOpenForPicks: boolean }>;
};

const COLLECTION_NAME = "gameLocks";

//────────────────────────────────────────
// Helpers
//────────────────────────────────────────

function parseRoundNumber(value: unknown): number {
  const n = Number(value);
  return Number.isNaN(n) || n < 0 ? 0 : n; // Default → Opening Round
}

async function requireUserUid(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorised");

  const token = authHeader.replace("Bearer ", "").trim();
  const decoded = await auth.verifyIdToken(token);
  if (!decoded.uid) throw new Error("Unauthorised");

  return decoded.uid;
}


//────────────────────────────────────────
// GET — read locks for a round
//────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundNumber = parseRoundNumber(url.searchParams.get("round"));

    const snap = await db.collection(COLLECTION_NAME)
      .where("roundNumber", "==", roundNumber)
      .get();

    const locks: Record<string, { isOpenForPicks: boolean }> = {};

    snap.forEach(d => {
      const data = d.data() as GameLockDoc;
      const gameId = data.gameId || d.id;

      locks[gameId] = {
        isOpenForPicks: data.isUnlockedForPicks === true
      };
    });

    return NextResponse.json({ roundNumber, locks });

  } catch (err) {
    console.error("GET /game-lock", err);
    return NextResponse.json({ roundNumber: 0, locks: {} }, { status: 500 });
  }
}


//────────────────────────────────────────
// POST — update game lock
//────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await requireUserUid(req);
    const body = await req.json();

    const gameId: string = body?.gameId;
    const roundNumber = parseRoundNumber(body?.roundNumber);
    const isOpen = body?.isOpenForPicks === true;

    if (!gameId) return NextResponse.json({ error: "Missing gameId" }, { status: 400 });

    await db.collection(COLLECTION_NAME)
      .doc(gameId)
      .set({
        gameId,
        roundNumber,
        isUnlockedForPicks: isOpen,
        updatedAt: Timestamp.now(),
        updatedBy: uid,
      },
      { merge: true }
      );


    // Re-read updated locks for UI refresh
    const snap = await db.collection(COLLECTION_NAME)
      .where("roundNumber", "==", roundNumber)
      .get();

    const locks: Record<string, { isOpenForPicks: boolean }> = {};
    snap.forEach(d => {
      const data = d.data() as GameLockDoc;
      locks[d.id] = { isOpenForPicks: data.isUnlockedForPicks === true };
    });

    return NextResponse.json({ roundNumber, locks });

  } catch (err) {
    console.error("POST /game-lock", err);
    return NextResponse.json({ error: "Failed to update lock" }, { status: 500 });
  }
}
