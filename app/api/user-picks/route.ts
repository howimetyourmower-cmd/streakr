// /streakr/app/api/user-picks/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (error) {
    console.error("[/api/user-picks] Failed to verify ID token", error);
    return null;
  }
}

async function getLatestPickForUser(uid: string): Promise<{
  questionId: string | null;
  outcome: "yes" | "no" | null;
} | null> {
  try {
    const snap = await db
      .collection("picks")
      .where("userId", "==", uid)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) return null;

    const docSnap = snap.docs[0];
    const data = docSnap.data() as any;

    const questionId = typeof data.questionId === "string" ? data.questionId : null;
    const outcome = data.pick === "yes" || data.pick === "no" ? data.pick : null;

    if (!questionId || !outcome) return null;

    const userRef = db.collection("users").doc(uid);
    await userRef.set(
      {
        activeQuestionId: questionId,
        activePick: outcome,
        lastPickAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
      },
      { merge: true }
    );

    return { questionId, outcome };
  } catch (err) {
    console.error("[/api/user-picks] getLatestPickForUser error", err);
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    let questionId: string | null = null;
    let outcome: "yes" | "no" | null = null;

    if (userSnap.exists) {
      const data = userSnap.data() as any;
      questionId = typeof data.activeQuestionId === "string" ? data.activeQuestionId : null;
      outcome = data.activePick === "yes" || data.activePick === "no" ? data.activePick : null;
    }

    if (!questionId || !outcome) {
      const fallback = await getLatestPickForUser(uid);
      if (fallback) {
        questionId = fallback.questionId;
        outcome = fallback.outcome;
      }
    }

    return NextResponse.json({ questionId, outcome });
  } catch (error) {
    console.error("[/api/user-picks] GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * ✅ DELETE handler
 * - Deletes a specific pick doc for the current user + questionId
 * - Clears users/{uid}.activeQuestionId / activePick only if it matches that questionId
 *
 * Usage:
 * DELETE /api/user-picks?questionId=abc123
 * Headers: Authorization: Bearer <token>
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const questionId = url.searchParams.get("questionId");

    if (!questionId || !questionId.trim()) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 });
    }

    const qid = questionId.trim();
    const now = Timestamp.now();

    const userRef = db.collection("users").doc(uid);
    const pickId = `${uid}_${qid}`;
    const pickRef = db.collection("picks").doc(pickId);

    // Do it transactionally so activePick is consistent.
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      if (userSnap.exists) {
        const data = userSnap.data() as any;
        const activeQuestionId =
          typeof data?.activeQuestionId === "string" ? data.activeQuestionId : null;

        // Only clear active fields if the deleted pick is the active one.
        if (activeQuestionId === qid) {
          tx.set(
            userRef,
            {
              activeQuestionId: FieldValue.delete(),
              activePick: FieldValue.delete(),
              lastPickAt: now,
            },
            { merge: true }
          );
        } else {
          // still stamp activity time if you want (optional)
          tx.set(
            userRef,
            {
              lastPickAt: now,
            },
            { merge: true }
          );
        }
      } else {
        // user doc missing - nothing to clear, but also not an error
      }

      // Delete pick doc (no-op if missing)
      tx.delete(pickRef);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/user-picks] DELETE error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await req.json();

    const action: string | null =
      typeof body?.action === "string" ? body.action.trim().toLowerCase() : null;

    const questionId: string | undefined = body?.questionId;

    const roundNumber: number | null =
      typeof body?.roundNumber === "number" ? body.roundNumber : null;

    const gameId: string | null =
      typeof body?.gameId === "string" && body.gameId.trim() ? body.gameId.trim() : null;

    const now = Timestamp.now();

    const userRef = db.collection("users").doc(uid);

    // ✅ CLEAR PICK (kept for backward compatibility with your current client flow)
    if (action === "clear") {
      if (!questionId) {
        return NextResponse.json({ error: "Missing questionId for clear" }, { status: 400 });
      }

      // remove active fields (don’t touch streak stats here)
      await userRef.set(
        {
          activeQuestionId: FieldValue.delete(),
          activePick: FieldValue.delete(),
          lastPickAt: now,
        },
        { merge: true }
      );

      // delete the pick doc for that question
      const pickId = `${uid}_${questionId}`;
      await db.collection("picks").doc(pickId).delete().catch(() => {});

      return NextResponse.json({ ok: true });
    }

    // ✅ NORMAL PICK SET
    const outcome: "yes" | "no" | undefined = body?.outcome;
    if (!questionId || (outcome !== "yes" && outcome !== "no")) {
      return NextResponse.json(
        { error: "Missing or invalid questionId/outcome" },
        { status: 400 }
      );
    }

    // 1) Update user's active pick fields
    await userRef.set(
      {
        activeQuestionId: questionId,
        activePick: outcome,
        lastPickAt: now,
      },
      { merge: true }
    );

    // 2) Upsert pick doc; ensure createdAt only set once
    const pickId = `${uid}_${questionId}`;
    const pickRef = db.collection("picks").doc(pickId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(pickRef);
      const base: any = {
        userId: uid,
        questionId,
        roundNumber,
        pick: outcome,
        updatedAt: now,
      };
      if (gameId) base.gameId = gameId;

      if (!snap.exists) {
        base.createdAt = now;
      }

      tx.set(pickRef, base, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/user-picks] POST error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
