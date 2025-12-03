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
  // new style
  action?:
    | "lock"
    | "reopen"
    | "final_yes"
    | "final_no"
    | "final_void"
    | "void";
};

/** Deterministic doc id for questionStatus */
function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

/**
 * Recalculate streaks for all players who picked this question.
 * outcome:
 *   - "yes" / "no"  => correct answer
 *   - "void"        => does not change streak
 *
 * We now use the `userPicks` collection, where documents look like:
 *   { userId, roundNumber, questionId, outcome: "yes" | "no" }
 */
async function updateStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  // If void, we don't change anyone's streak – question is just ignored.
  if (outcome === "void") return;

  // IMPORTANT:
  // Only filter by questionId so this works even if userPicks.roundNumber
  // is missing or stored as a different type (string vs number).
  const picksSnap = await db
    .collection("userPicks")
    .where("questionId", "==", questionId)
    .get();

  if (picksSnap.empty) return;

  const updates: Promise<unknown>[] = [];

  picksSnap.forEach((pickDoc) => {
    const data = pickDoc.data() as {
      userId?: string;
      outcome?: "yes" | "no";
    };

    const userId = data.userId;
    const pick = data.outcome; // user’s chosen side

    if (!userId || (pick !== "yes" && pick !== "no")) return;

    const userRef = db.collection("users").doc(userId);

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
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    updates.push(p);
  });

  await Promise.all(updates);
}

/**
 * Revert the streak effect for this question when a FINAL result is reopened.
 *
 * If the question *used to be* final_yes / final_no and is now reopened,
 * any user who was previously CORRECT on that result will have their
 * currentStreak reduced by 1 (down to a minimum of 0).
 *
 * We intentionally do NOT touch longestStreak so "best ever" stays as a record.
 */
async function revertStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  previousOutcome: QuestionOutcome
) {
  if (previousOutcome === "void") return;

  // Same as above: only filter by questionId for robustness.
  const picksSnap = await db
    .collection("userPicks")
    .where("questionId", "==", questionId)
    .get();

  if (picksSnap.empty) return;

  const updates: Promise<unknown>[] = [];

  picksSnap.forEach((pickDoc) => {
    const data = pickDoc.data() as {
      userId?: string;
      outcome?: "yes" | "no";
    };

    const userId = data.userId;
    const pick = data.outcome;

    if (!userId || (pick !== "yes" && pick !== "no")) return;

    // Only revert players who were previously CORRECT on this question.
    if (pick !== previousOutcome) return;

    const userRef = db.collection("users").doc(userId);

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

      // Revert the +1 we previously gave them for this result.
      currentStreak = Math.max(0, currentStreak - 1);

      tx.set(
        userRef,
        {
          currentStreak,
          longestStreak,
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

    // ── Look up previous status/outcome so we can detect reopen ──
    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const prevSnap = await qsRef.get();
    const prevData = prevSnap.exists
      ? (prevSnap.data() as {
          status?: QuestionStatus;
          outcome?: QuestionOutcome | "lock";
        })
      : null;

    const prevStatus = prevData?.status;
    const prevOutcome =
      prevData?.outcome === "yes" ||
      prevData?.outcome === "no" ||
      prevData?.outcome === "void"
        ? (prevData.outcome as QuestionOutcome)
        : undefined;

    // ── Work out final status + outcome from body ───────────────
    let status: QuestionStatus | undefined = body.status;
    let outcome: QuestionOutcome | "lock" | undefined = body.outcome;

    // New style: action takes priority
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

    // 🔙 Backwards-compat:
    // old UI sometimes sends only { outcome: "yes" | "no" | "void" }
    if (
      !status &&
      outcome &&
      (outcome === "yes" || outcome === "no" || outcome === "void")
    ) {
      status = outcome === "void" ? "void" : "final";
    }

    if (!status) {
      return NextResponse.json(
        { error: "status or action is required" },
        { status: 400 }
      );
    }

    // ── Write / overwrite questionStatus doc ────────────────────
    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) {
      payload.outcome = outcome;
    } else {
      payload.outcome = FieldValue.delete();
    }

    await qsRef.set(payload, { merge: true });

    // ── Apply streak changes for FINAL results ───────────────────
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

    // ── Revert streak changes if we REOPEN a previously-final question ──
    if (
      status === "open" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no" || prevOutcome === "void")
    ) {
      await revertStreaksForQuestion(
        roundNumber,
        questionId,
        prevOutcome as QuestionOutcome
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
