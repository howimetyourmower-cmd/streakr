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
 * Fetch all picks for a given question from both:
 *  - `picks`      (current collection written by /api/user-picks, field `pick`)
 *  - `userPicks`  (legacy collection, field `outcome`)
 *
 * Returns a normalised array of { userId, outcome: "yes" | "no" }.
 */
async function getPicksForQuestion(questionId: string): Promise<
  { userId: string; outcome: "yes" | "no" }[]
> {
  const results: { userId: string; outcome: "yes" | "no" }[] = [];

  // 1) Current collection: `picks` (written by /api/user-picks)
  const [picksSnap, userPicksSnap] = await Promise.all([
    db.collection("picks").where("questionId", "==", questionId).get(),
    db.collection("userPicks").where("questionId", "==", questionId).get(),
  ]);

  // From `picks` collection (field: pick)
  picksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const pick = data.pick;

    if (
      typeof userId === "string" &&
      (pick === "yes" || pick === "no")
    ) {
      results.push({ userId, outcome: pick });
    }
  });

  // From legacy `userPicks` collection (field: outcome)
  userPicksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const out = data.outcome;

    if (
      typeof userId === "string" &&
      (out === "yes" || out === "no")
    ) {
      results.push({ userId, outcome: out });
    }
  });

  return results;
}

/**
 * Apply streak changes for a settled question.
 *
 * outcome:
 *  - "yes" / "no"  => correct answer; correct picks get +1 streak,
 *                    incorrect picks reset to 0.
 *  - "void"        => ignored for streak (no change).
 */
async function updateStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  // If void, we don't change anyone's streak – question is just ignored.
  if (outcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick } of picks) {
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
  }

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

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick } of picks) {
    // Only revert players who were previously CORRECT on this question.
    if (pick !== previousOutcome) continue;

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
  }

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
