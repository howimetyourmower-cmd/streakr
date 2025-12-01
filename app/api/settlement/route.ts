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

  // legacy style
  status?: QuestionStatus;
  outcome?: string; // we’ll normalise this

  // new style
  action?: string; // we’ll normalise this too
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
 */
async function updateStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  // VOID does not change streaks
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

/** Normalise any string into an outcome or "lock" if possible */
function normaliseOutcome(
  value: string | undefined
): QuestionOutcome | "lock" | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  if (v === "yes" || v === "no" || v === "void") return v;
  if (v === "lock") return "lock";
  return undefined;
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

    let status: QuestionStatus | undefined;
    let outcome: QuestionOutcome | "lock" | undefined;

    // ── 1) Try to interpret `action` first ──────────────────────
    const action = body.action ? body.action.toLowerCase().trim() : undefined;

    if (action) {
      switch (action) {
        case "lock":
          status = "pending";
          outcome = "lock";
          break;
        case "reopen":
          status = "open";
          outcome = undefined;
          break;

        // Explicit new-style finals
        case "final_yes":
          status = "final";
          outcome = "yes";
          break;
        case "final_no":
          status = "final";
          outcome = "no";
          break;
        case "final_void":
          status = "void";
          outcome = "void";
          break;

        // If the UI just sends "yes" / "no" / "void" as action,
        // treat that as a final result too.
        case "yes":
          status = "final";
          outcome = "yes";
          break;
        case "no":
          status = "final";
          outcome = "no";
          break;
        case "void":
          status = "void";
          outcome = "void";
          break;
        default:
        // leave status/outcome undefined – we’ll fall back below
      }
    }

    // ── 2) Legacy fields: status + outcome ──────────────────────
    if (!status) {
      // existing status field wins if present
      if (body.status) {
        status = body.status;
      }

      // normalise outcome field (handles YES/NO/VOID/lock etc.)
      const normalisedOutcome = normaliseOutcome(body.outcome);
      if (!outcome) {
        outcome = normalisedOutcome;
      }

      // if we still have no status but *do* have an outcome,
      // infer the status from it.
      if (!status && normalisedOutcome) {
        if (normalisedOutcome === "lock") {
          status = "pending";
        } else if (normalisedOutcome === "void") {
          status = "void";
        } else {
          status = "final"; // yes / no
        }
      }
    }

    // ── 3) Final guard ──────────────────────────────────────────
    if (!status) {
      // At this point we had roundNumber & questionId,
      // but nothing indicating what to do.
      return NextResponse.json(
        { error: "status or action is required" },
        { status: 400 }
      );
    }

    // ── 4) Write / overwrite questionStatus doc ─────────────────
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
      // when reopening, clear any previous outcome
      payload.outcome = FieldValue.delete();
    }

    await qsRef.set(payload, { merge: true });

    // ── 5) If this is a final result, update user streaks ───────
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
