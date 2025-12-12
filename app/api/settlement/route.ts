// /app/api/settlement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type RequestBody = {
  roundNumber: number;
  questionId: string;
  action?:
    | "lock"
    | "reopen"
    | "final_yes"
    | "final_no"
    | "final_void"
    | "void";
};

function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

async function getPicksForQuestion(questionId: string): Promise<
  { userId: string; pick: "yes" | "no" }[]
> {
  const results: { userId: string; pick: "yes" | "no" }[] = [];

  const snap = await db
    .collection("picks")
    .where("questionId", "==", questionId)
    .get();

  snap.forEach((doc) => {
    const d = doc.data() as any;
    if (d.userId && (d.pick === "yes" || d.pick === "no")) {
      results.push({ userId: d.userId, pick: d.pick });
    }
  });

  return results;
}

/**
 * Compute per-game score:
 * - Any wrong pick → 0
 * - Otherwise → number of picks made
 */
function computeGameScore(
  results: Record<string, "correct" | "wrong">
): number {
  const values = Object.values(results);
  if (!values.length) return 0;
  if (values.some((v) => v === "wrong")) return 0;
  return values.length;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as RequestBody;
    const { roundNumber, questionId, action } = body;

    if (
      typeof roundNumber !== "number" ||
      !questionId ||
      !action
    ) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const prevSnap = await qsRef.get();
    const prevData = prevSnap.exists ? (prevSnap.data() as any) : null;

    let status: QuestionStatus;
    let outcome: QuestionOutcome | undefined;

    switch (action) {
      case "lock":
        status = "pending";
        break;
      case "reopen":
        status = "open";
        break;
      case "final_yes":
        status = "final";
        outcome = "yes";
        break;
      case "final_no":
        status = "final";
        outcome = "no";
        break;
      case "final_void":
      case "void":
        status = "void";
        outcome = "void";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    await qsRef.set(
      {
        roundNumber,
        questionId,
        status,
        outcome,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Only apply scoring on FINAL yes/no
    if (status !== "final" || !outcome || outcome === "void") {
      return NextResponse.json({ ok: true });
    }

    const picks = await getPicksForQuestion(questionId);
    if (!picks.length) {
      return NextResponse.json({ ok: true });
    }

    const byUser: Record<
      string,
      Record<string, "correct" | "wrong">
    > = {};

    for (const { userId, pick } of picks) {
      if (!byUser[userId]) byUser[userId] = {};
      byUser[userId][questionId] =
        pick === outcome ? "correct" : "wrong";
    }

    const updates: Promise<unknown>[] = [];

    for (const userId of Object.keys(byUser)) {
      const userRef = db.collection("users").doc(userId);

      const p = db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const u = snap.exists ? (snap.data() as any) : {};

        const prevCurrent =
          typeof u.currentStreak === "number" ? u.currentStreak : 0;
        const prevLongest =
          typeof u.longestStreak === "number" ? u.longestStreak : 0;

        const gameScore = computeGameScore(byUser[userId]);

        let newCurrent = 0;
        if (gameScore > 0) {
          newCurrent = prevCurrent + gameScore;
        }

        const newLongest = Math.max(prevLongest, newCurrent);

        tx.set(
          userRef,
          {
            currentStreak: newCurrent,
            longestStreak: newLongest,
            lastUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      updates.push(p);
    }

    await Promise.all(updates);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/settlement] Error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
