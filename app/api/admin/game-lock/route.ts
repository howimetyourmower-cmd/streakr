// /app/api/admin/game-lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/lib/admin";

type GameLockConfig = {
  isOpenForPicks: boolean;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedBy?: string;
};

type GameLocksDoc = {
  roundNumber: number;
  locks: Record<string, GameLockConfig>;
};

const COLLECTION_NAME = "gameLocks";

// Helper: require an authenticated user for POST
async function requireUserUid(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) {
    throw new Error("Missing ID token");
  }

  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.uid) {
      throw new Error("Invalid token payload – no uid");
    }
    return decoded.uid;
  } catch (err) {
    console.error("[game-lock] Failed to verify ID token", err);
    throw new Error("Unauthorised");
  }
}

// Helper: parse roundNumber from query/body, default to 0 (Opening Round)
function parseRoundNumber(value: unknown): number {
  if (typeof value === "string") {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  if (typeof value === "number" && value >= 0) {
    return value;
  }
  return 0;
}

// Helper: doc id for a round
function getDocId(roundNumber: number): string {
  // You can change this if you want, just be consistent everywhere
  return `season-2026-round-${roundNumber}`;
}

// ─────────────────────────────────────────────
// GET  /api/admin/game-lock?round=0
// Returns lock state for the given round
// Shape:
//
// {
//   roundNumber: 0,
//   locks: {
//     "OR-G1": { isOpenForPicks: true },
//     "OR-G2": { isOpenForPicks: false }
//   }
// }
// ─────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");
    const roundNumber = parseRoundNumber(roundParam ?? undefined);

    const docId = getDocId(roundNumber);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const snap = await docRef.get();

    if (!snap.exists) {
      const empty: GameLocksDoc = {
        roundNumber,
        locks: {},
      };
      return NextResponse.json(empty);
    }

    const data = snap.data() || {};
    const locksRaw = (data.locks || {}) as Record<string, any>;

    // Normalise to { gameId: { isOpenForPicks: boolean } }
    const locks: Record<string, { isOpenForPicks: boolean }> = {};
    for (const [gameId, value] of Object.entries(locksRaw)) {
      if (!value || typeof value !== "object") continue;
      const v: any = value;
      const isOpen =
        typeof v.isOpenForPicks === "boolean"
          ? v.isOpenForPicks
          : typeof v.openForPicks === "boolean"
          ? v.openForPicks
          : typeof v.isOpen === "boolean"
          ? v.isOpen
          : false;

      locks[gameId] = { isOpenForPicks: isOpen };
    }

    const payload: GameLocksDoc = {
      roundNumber: data.roundNumber ?? roundNumber,
      locks,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[game-lock][GET] Unexpected error", error);
    return NextResponse.json(
      { error: "Failed to load game lock config", locks: {}, roundNumber: 0 },
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
// This is what the Settlement/Admin console should call when
// you toggle "Open for picks" for a game.
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
    const gameId = String(body.gameId || "").trim();
    const isOpenForPicks =
      typeof body.isOpenForPicks === "boolean"
        ? body.isOpenForPicks
        : false;

    if (!gameId) {
      return NextResponse.json(
        { error: "Missing gameId" },
        { status: 400 }
      );
    }

    const docId = getDocId(roundNumber);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);

    const updatePath = `locks.${gameId}`;
    const updateValue: GameLockConfig = {
      isOpenForPicks,
      updatedAt: db.firestore.Timestamp.now(),
      updatedBy: uid,
    };

    await docRef.set(
      {
        roundNumber,
        [updatePath]: updateValue,
      },
      { merge: true }
    );

    const snap = await docRef.get();
    const data = snap.data() || {};
    const locksRaw = (data.locks || {}) as Record<string, any>;

    const locks: Record<string, { isOpenForPicks: boolean }> = {};
    for (const [gid, value] of Object.entries(locksRaw)) {
      if (!value || typeof value !== "object") continue;
      const v: any = value;
      const open =
        typeof v.isOpenForPicks === "boolean"
          ? v.isOpenForPicks
          : typeof v.openForPicks === "boolean"
          ? v.openForPicks
          : typeof v.isOpen === "boolean"
          ? v.isOpen
          : false;
      locks[gid] = { isOpenForPicks: open };
    }

    const payload: GameLocksDoc = {
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
