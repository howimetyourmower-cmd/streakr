// src/app/api/user-picks/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

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

/**
 * GET – return the user's current active streak pick
 * Shape: { questionId: string | null, outcome: "yes" | "no" | null }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({
        questionId: null,
        outcome: null,
      });
    }

    const data = userSnap.data() as any;
    const questionId: string | null =
      typeof data.activeQuestionId === "string" ? data.activeQuestionId : null;
    const outcome: "yes" | "no" | null =
      data.activePick === "yes" || data.activePick === "no"
        ? data.activePick
        : null;

    return NextResponse.json({
      questionId,
      outcome,
    });
  } catch (error) {
    console.error("[/api/user-picks] GET error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST – set/update the user's active streak pick
 * Body: { questionId: string, outcome: "yes" | "no", roundNumber?: number | null }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const questionId: string | undefined = body?.questionId;
    const outcome: "yes" | "no" | undefined = body?.outcome;
    const roundNumber: number | null =
      typeof body?.roundNumber === "number" ? body.roundNumber : null;

    if (!questionId || (outcome !== "yes" && outcome !== "no")) {
      return NextResponse.json(
        { error: "Missing or invalid questionId/outcome" },
        { status: 400 }
      );
    }

    const now = Timestamp.now();

    // 1) Update the user's active pick fields
    const userRef = db.collection("users").doc(uid);
    await userRef.set(
      {
        activeQuestionId: questionId,
        activePick: outcome,
        lastPickAt: now,
      },
      { merge: true }
    );

    // 2) Upsert a pick document for this user & question
    const pickId = `${uid}_${questionId}`;
    const pickRef = db.collection("picks").doc(pickId);

    await pickRef.set(
      {
        userId: uid,
        questionId,
        roundNumber,
        pick: outcome,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/user-picks] POST error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
