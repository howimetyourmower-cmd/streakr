// /app/api/panic/route.ts
import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

type Body = {
  roundNumber?: number;
  gameId?: string;
  questionId?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getBearerUid(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(m[1]);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

/**
 * PANIC BUTTON — one per round (per user)
 *
 * POST /api/panic
 * Body: { roundNumber, gameId, questionId }
 *
 * Rules:
 * - must be authenticated
 * - only 1 per round per user
 * - question must belong to that round (light check here; heavy check can be added)
 * - create/lock panic record atomically
 *
 * Result:
 * - marks this question "panic void" for this user+round
 * - (optionally) deletes the pick doc for that question for this user
 */
export async function POST(req: Request) {
  const uid = await getBearerUid(req);
  if (!uid) return jsonError("Unauthorized", 401);

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const roundNumber = Number(body.roundNumber);
  const gameId = String(body.gameId || "").trim();
  const questionId = String(body.questionId || "").trim();

  if (!Number.isFinite(roundNumber) || roundNumber < 0) return jsonError("roundNumber is required", 400);
  if (!gameId) return jsonError("gameId is required", 400);
  if (!questionId) return jsonError("questionId is required", 400);

  // One-per-round doc (unique key)
  const panicDocId = `${uid}__${roundNumber}`;
  const panicRef = adminDb.collection("panic").doc(panicDocId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(panicRef);

      // If already used, reject
      if (snap.exists) {
        const prev = snap.data() as any;
        const prevQ = String(prev?.questionId || "");
        return {
          ok: false as const,
          error: "Panic already used for this round.",
          usedQuestionId: prevQ || null,
        };
      }

      // OPTIONAL: sanity check that question exists
      // If you don't have a questions collection, remove this block.
      const qRef = adminDb.collection("questions").doc(questionId);
      const qSnap = await tx.get(qRef);
      if (!qSnap.exists) {
        return { ok: false as const, error: "Question not found.", usedQuestionId: null };
      }

      const qData = qSnap.data() as any;

      // OPTIONAL: verify the question belongs to the round passed in (best-effort)
      const qRound = Number(qData?.roundNumber);
      if (Number.isFinite(qRound) && qRound !== roundNumber) {
        return { ok: false as const, error: "Question does not belong to this round.", usedQuestionId: null };
      }

      // OPTIONAL: prevent panic on sponsor question (best-effort)
      const isSponsor = !!qData?.isSponsorQuestion;
      if (isSponsor) {
        return { ok: false as const, error: "Sponsor question cannot be panic-voided.", usedQuestionId: null };
      }

      // Create panic record
      tx.set(panicRef, {
        userId: uid,
        roundNumber,
        gameId,
        questionId,
        createdAt: new Date(),
      });

      // OPTIONAL: remove pick for this question so it can't score.
      // Your pick id format in client: `${uid}_${questionId}`
      const pickRef = adminDb.collection("picks").doc(`${uid}_${questionId}`);
      tx.delete(pickRef);

      return { ok: true as const, questionId };
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, usedQuestionId: (result as any).usedQuestionId ?? null },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, questionId: result.questionId });
  } catch (e: any) {
    console.error("[/api/panic] error", e);
    return jsonError("Server error", 500);
  }
}
