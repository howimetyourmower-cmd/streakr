// /app/api/free-kick/route.ts
import { NextResponse } from "next/server";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";

/**
 * GOLDEN FREE KICK (Season-only power-up)
 *
 * ✅ Beta: available to everyone, but STILL only 1 use per season per user.
 *
 * This route ONLY "consumes" the free kick and records the intent.
 * Your settlement logic should read this record and:
 * - restore the user's streak to restoreStreakTo
 * - ensure correct picks in that game do NOT count (per your rule)
 *
 * Firestore:
 *  - seasonPowerUps/{seasonId}_{uid}
 *      freeKickUsed: boolean
 *      freeKickUsedAt: timestamp
 *      freeKickUsedRound: number
 *      freeKickUsedGameId: string
 *      freeKickRestoreTo: number
 *      updatedAt: timestamp
 */

function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    // We don't throw here to avoid crashing cold starts in some environments;
    // we will return a clean error below when used.
    return;
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function authHeaderToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

function bad(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    initAdmin();

    // Validate admin env
    if (!getApps().length) {
      return bad(
        500,
        "Firebase Admin not configured. Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY."
      );
    }

    // Auth
    const token = authHeaderToken(req);
    if (!token) return bad(401, "Missing Authorization Bearer token.");

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    if (!uid) return bad(401, "Invalid token.");

    // Body
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad(400, "Invalid JSON body.");

    const seasonId = String((body as any).seasonId || "").trim();
    const gameId = String((body as any).gameId || "").trim();

    const roundNumberRaw = (body as any).roundNumber;
    const restoreRaw = (body as any).restoreStreakTo;

    const roundNumber = Number(roundNumberRaw);
    const restoreStreakTo = Number(restoreRaw);

    if (!seasonId) return bad(400, "seasonId is required.");
    if (!gameId) return bad(400, "gameId is required.");
    if (!Number.isFinite(roundNumber) || roundNumber < 0) return bad(400, "roundNumber must be a number >= 0.");
    if (!Number.isFinite(restoreStreakTo) || restoreStreakTo < 0)
      return bad(400, "restoreStreakTo must be a number >= 0.");

    // Firestore transaction: enforce once per season
    const db = getFirestore();
    const docId = `${seasonId}_${uid}`;
    const ref = db.collection("seasonPowerUps").doc(docId);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() as any) : null;

      if (data?.freeKickUsed === true) {
        return { ok: false as const, alreadyUsed: true as const, usedAt: data?.freeKickUsedAt || null };
      }

      tx.set(
        ref,
        {
          userId: uid,
          seasonId,

          freeKickUsed: true,
          freeKickUsedAt: FieldValue.serverTimestamp(),
          freeKickUsedRound: roundNumber,
          freeKickUsedGameId: gameId,
          freeKickRestoreTo: restoreStreakTo,

          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true as const };
    });

    if (!result.ok && result.alreadyUsed) {
      return NextResponse.json(
        {
          ok: false,
          error: "FREE_KICK_ALREADY_USED",
          message: "Golden Free Kick already used for this season.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/free-kick] error", e);
    return bad(500, e?.message || "Server error.");
  }
}
