
// /app/api/admin/game-lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/admin";

type GameLockDoc = {
  gameId: string;
  roundNumber: number;
  isUnlockedForPicks: boolean;
  updatedAt?: FirebaseFirestore.Timestamp;
  updatedBy?: string;
};

type ApiLocksPayload = {
  roundNumber: number;
  locks: Record<string, { isOpenForPicks: boolean }>;
};

const COLLECTION_NAME = "gameLocks";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseRoundNumber(value: unknown): number {
  if (typeof value === "number" && value >= 0) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  // default to Opening Round
  return 0;
}

async function requireUserUid(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) throw new Error("Missing ID token");

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.uid) throw new Error("Invalid token payload – no uid");
    return decoded.uid;
  } catch (err) {
    console.error("[game-lock] Failed to verify ID token", err);
    throw new Error("Unauthorised");
  }
}

// ─────────────────────────────────────────────
// GET /api/admin/game-lock?round=0
// Reads all gameLocks docs for that roundNumber and
// returns them in the shape the Picks page expects.
// ─────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");
    const roundNumber = parseRoundNumber(roundParam ?? undefined);

    const snap = await db
      .collection(COLLECTION_NAME)
      .where("roundNumber", "==", roundNumber)
      .get();

    const locks: Record<string, { isOpenForPicks: boolean }> = {};

    snap.forEach((docSnap) => {
      const data = docSnap.data() as GameLockDoc;
      const gameId = data.gameId || docSnap.id;
      if (!gameId) return;

      // your Firestore field is isUnlockedForPicks
      const isOpen =
        typeof data.isUnlockedForPicks === "boolean"
          ? data.isUnlockedForPicks
          : false;

      locks[gameId] = { isOpenForPicks: isOpen };
    });

    const payload: ApiLocksPayload = {
      roundNumber,
      locks,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[game-lock][GET] Unexpected error", error);
    return NextResponse.json(
      { error: "Failed to load game lock config", roundNumber: 0, locks: {} },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/game-lock
//
// Body:
// {
//   "roundNumber": 0,
//   "gameId": "OR-G1",
//   "isOpenForPicks": true
// }
//
// This creates/updates: gameLocks/OR-G1
//  - roundNumber: 0
//  - gameId: "OR-G1"
//  - isUnlockedForPicks: true
// ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await requireUserUid(req);
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const roundNumber = parseRoundNumber(body.roundNumber);
    const rawGameId = body.gameId;
    const gameId = typeof rawGameId === "string" ? rawGameId.trim() : "";

    if (!gameId) {
      return NextResponse.json(
        { error: "Missing gameId" },
        { status: 400 }
      );
    }

    const isOpenForPicks =
      typeof body.isOpenForPicks === "boolean"
        ? body.isOpenForPicks
        : false;

    const docRef = db.collection(COLLECTION_NAME).doc(gameId);

    const update: GameLockDoc = {
      gameId,
      roundNumber,
      isUnlockedForPicks: isOpenForPicks,
      updatedAt: db.firestore.Timestamp.now(),
      updatedBy: uid,
    };

    await docRef.set(update, { merge: true });

    // Re-read all locks for this round so the admin UI can refresh cleanly
    const snap = await db
      .collection(COLLECTION_NAME)
      .where("roundNumber", "==", roundNumber)
      .get();

    const locks: Record<string, { isOpenForPicks: boolean }> = {};

    snap.forEach((docSnap) => {
      const data = docSnap.data() as GameLockDoc;
      const gid = data.gameId || docSnap.id;
      if (!gid) return;

      const open =
        typeof data.isUnlockedForPicks === "boolean"
          ? data.isUnlockedForPicks
          : false;

      locks[gid] = { isOpenForPicks: open };
    });

    const payload: ApiLocksPayload = {
      roundNumber,
      locks,
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[game-lock][POST] Unexpected error", error);
    const msg =
      typeof error?.message === "string"
        ? error.message
        : "Failed to update game lock config";
    const status =
      msg === "Unauthorised" || msg.startsWith("Missing or invalid")
        ? 401
        : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
