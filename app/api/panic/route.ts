// /app/api/panic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

const SEASON = 2026;

type PanicBody = {
  roundNumber?: number;
  gameId?: string;
  questionId?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (error) {
    console.error("[/api/panic] Failed to verify ID token", error);
    return null;
  }
}

async function getSponsorQuestionIdForSeason(): Promise<string | null> {
  try {
    const snap = await db.collection("config").doc(`season-${SEASON}`).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    const qid = String(data?.sponsorQuestion?.questionId ?? "").trim();
    return qid ? qid : null;
  } catch (e) {
    console.warn("[/api/panic] Failed to read sponsorQuestion config", e);
    return null;
  }
}

/**
 * PANIC BUTTON
 * - Requires the question already answered (a pick exists)
 * - One per round per user
 * - Decision is final
 * - Does NOT apply to sponsor question
 *
 * Writes:
 * panic/{uid}__{roundNumber}   (locks the one-per-round use)
 * panicVoids/{uid}__{roundNumber}__{questionId}  (optional explicit marker)
 *
 * Also deletes:
 * picks/{uid}_{questionId}   (so it won't count)
 */
export async function POST(req: NextRequest) {
  const uid = await getUserIdFromRequest(req);
  if (!uid) return jsonError("Unauthorized", 401);

  let body: PanicBody = {};
  try {
    body = (await req.json()) as PanicBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const roundNumber = Number(body.roundNumber);
  const gameId = String(body.gameId ?? "").trim();
  const questionId = String(body.questionId ?? "").trim();

  if (!Number.isFinite(roundNumber) || roundNumber < 0) return jsonError("roundNumber is required", 400);
  if (!gameId) return jsonError("gameId is required", 400);
  if (!questionId) return jsonError("questionId is required", 400);

  // Block sponsor question
  const sponsorQuestionId = await getSponsorQuestionIdForSeason();
  if (sponsorQuestionId && sponsorQuestionId === questionId) {
    return NextResponse.json({ ok: false, error: "Panic is not allowed on the sponsor question." }, { status: 409 });
  }

  const panicLockId = `${uid}__${roundNumber}`;
  const panicLockRef = db.collection("panic").doc(panicLockId);

  const pickRef = db.collection("picks").doc(`${uid}_${questionId}`);

  const panicVoidRef = db.collection("panicVoids").doc(`${uid}__${roundNumber}__${questionId}`);

  try {
    const result = await db.runTransaction(async (tx) => {
      // 1) One per round
      const lockSnap = await tx.get(panicLockRef);
      if (lockSnap.exists) {
        const data = lockSnap.data() as any;
        return {
          ok: false as const,
          error: "Panic already used for this round.",
          usedQuestionId: String(data?.questionId ?? "") || null,
        };
      }

      // 2) Must already have answered this question
      const pickSnap = await tx.get(pickRef);
      if (!pickSnap.exists) {
        return {
          ok: false as const,
          error: "Panic requires a question already answered.",
          usedQuestionId: null,
        };
      }

      const pickData = pickSnap.data() as any;
      const pickVal = String(pickData?.pick ?? "").toLowerCase();
      if (pickVal !== "yes" && pickVal !== "no") {
        return {
          ok: false as const,
          error: "Panic requires a valid YES/NO pick.",
          usedQuestionId: null,
        };
      }

      // 3) Write lock + marker (final)
      tx.set(panicLockRef, {
        userId: uid,
        season: SEASON,
        roundNumber,
        gameId,
        questionId,
        createdAt: new Date(),
      });

      tx.set(panicVoidRef, {
        userId: uid,
        season: SEASON,
        roundNumber,
        gameId,
        questionId,
        previousPick: pickVal,
        createdAt: new Date(),
      });

      // 4) Remove the pick so it won't count
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
  } catch (e) {
    console.error("[/api/panic] Transaction error", e);
    return jsonError("Server error", 500);
  }
}
