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
  // old style
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock";
  // or new style from UI
  action?:
    | "lock"
    | "reopen"
    | "final_yes"
    | "final_no"
    | "final_void"
    | "void";
};

/**
 * Helper: deterministic doc id for questionStatus so we can overwrite safely.
 */
function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

/**
 * Recalculate streaks for all players who picked this question.
 * outcome:
 *   - "yes" / "no"  => correct answer
 *   - "void"        => does not change streak
 */
async function updateStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  // If void, we don't change anyone's streak – question is just ignored.
  if (outcome === "void") return;

  const picksSnap = await db
    .collection("picks")
    .where("roundNumber", "==", roundNumber)
    .where("questionId", "==", questionId)
    .get();

  if (picksSnap.empty) return;

  const updates: Promise<unknown>[] = [];

  picksSnap.forEach((pickDoc) => {
    const data = pickDoc.data() as {
      userId?: string;
      pick?: "yes" | "no";
    };

    const userId = data.userId;
    const pick = data.pick;

    if (!userId || (pick !== "yes" && pick !== "no")) return;

    const userRef = db.collection("users").doc(userId);

    // Use a transaction per user so multiple questions still behave.
    const p = db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;

      if (snap.exists) {
        const u = snap.data() as any;
        currentStreak =
          typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak =
          typeof u.longestStreak === "number" ? u.longestStreak : 0;
      }

      // If user picked the correct outcome, streak +1; otherwise reset to 0.
      if (pick === outcome) {
        currentStreak += 1;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }

      tx.set(
        userRef,
        {
          currentStreak,
          longestStreak,
          // optional extra stats you can use later
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    updates.push(p);
  });

  await Promise.all(updates);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as RequestBody;

    const { roundNumber, questionId } = body;

    if (
      typeof roundNumber !== "number" ||
      Number.isNaN(roundNumber) ||
      !questionId
    ) {
      return NextResponse.json(
        { error: "roundNumber and questionId are required" },
        { status: 400 }
      );
    }

    // Work out final status + outcome from either action or direct fields.
    let status: QuestionStatus | undefined = body.status;
    let outcome: QuestionOutcome | "lock" | undefined = body.outcome;

    if (body.action) {
      switch (body.action) {
        case "lock":
          status = "pending";
          outcome = "lock";
          break;
        case "reopen":
          status = "open";
          outcome = undefined;
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
          break;
      }
    }

    if (!status) {
      return NextResponse.json(
        { error: "status or action is required" },
        { status: 400 }
      );
    }

    // Write / overwrite questionStatus doc so /api/picks can read it.
    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) {
      payload.outcome = outcome;
    } else {
      // Clear any previous outcome when reopening back to OPEN.
      payload.outcome = FieldValue.delete();
    }

    await qsRef.set(payload, { merge: true });

    // If this is a final result (YES / NO / VOID),
    // update user streaks based on picks for this question.
    if (
      status === "final" &&
      (outcome === "yes" || outcome === "no" || outcome === "void")
    ) {
      await updateStreaksForQuestion(
        roundNumber,
        questionId,
        outcome as QuestionOutcome
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] Error:", error);
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}
