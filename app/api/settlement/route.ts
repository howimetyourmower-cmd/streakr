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
 *
 * IMPORTANT:
 * We de-dupe by userId to avoid running multiple transactions for the same user
 * (which can cause contention/aborted transactions and 500s on Vercel).
 */
async function getPicksForQuestion(
  questionId: string
): Promise<{ userId: string; outcome: "yes" | "no" }[]> {
  const byUser = new Map<string, "yes" | "no">();

  const [picksSnap, userPicksSnap] = await Promise.all([
    db.collection("picks").where("questionId", "==", questionId).get(),
    db.collection("userPicks").where("questionId", "==", questionId).get(),
  ]);

  // Prefer the newer `picks` collection when both exist.
  // So: load legacy first, then overwrite with picks.
  userPicksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const out = data.outcome;

    if (typeof userId === "string" && (out === "yes" || out === "no")) {
      byUser.set(userId, out);
    }
  });

  picksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const pick = data.pick;

    if (typeof userId === "string" && (pick === "yes" || pick === "no")) {
      byUser.set(userId, pick);
    }
  });

  return Array.from(byUser.entries()).map(([userId, outcome]) => ({
    userId,
    outcome,
  }));
}

/**
 * Apply streak + lifetime stats changes for a settled question.
 *
 * outcome:
 *  - "yes" / "no"  => correct answer; correct picks get +1 streak & +1 win,
 *                    incorrect picks reset streak to 0 & +1 loss.
 *  - "void"        => ignored for streak/stats (no change).
 *
 * Also:
 *  - roundsPlayed is incremented once per round per user, the first time
 *    they appear in a non-void final result for that round.
 */
async function updateStreaksForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  if (outcome === "void") return; // void does not affect streak or stats

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick } of picks) {
    const userRef = db.collection("users").doc(userId);

    const p = db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;
      let lifetimeWins = 0;
      let lifetimeLosses = 0;
      let roundsPlayed = 0;
      let roundsPlayedRounds: number[] = [];

      if (snap.exists) {
        const u = snap.data() as any;
        currentStreak =
          typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak =
          typeof u.longestStreak === "number" ? u.longestStreak : 0;
        lifetimeWins =
          typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses =
          typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
        roundsPlayed =
          typeof u.roundsPlayed === "number" ? u.roundsPlayed : 0;
        roundsPlayedRounds = Array.isArray(u.roundsPlayedRounds)
          ? u.roundsPlayedRounds
          : [];
      }

      const wasCorrect = pick === outcome;

      // Streak logic
      if (wasCorrect) {
        currentStreak += 1;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
        lifetimeWins += 1;
      } else {
        currentStreak = 0;
        lifetimeLosses += 1;
      }

      // Rounds played – once per round per user
      let shouldUpdateRounds = false;
      let newRoundsPlayed = roundsPlayed;

      if (!roundsPlayedRounds.includes(roundNumber)) {
        shouldUpdateRounds = true;
        newRoundsPlayed = roundsPlayed + 1;
      }

      const payload: any = {
        currentStreak,
        longestStreak,
        lifetimeWins,
        lifetimeLosses,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      };

      if (shouldUpdateRounds) {
        payload.roundsPlayed = newRoundsPlayed;
        payload.roundsPlayedRounds = FieldValue.arrayUnion(roundNumber);
      }

      tx.set(userRef, payload, { merge: true });
    });

    updates.push(p);
  }

  await Promise.all(updates);
}

/**
 * Revert the streak + lifetime stats effect for this question when a FINAL
 * result is reopened or changed.
 *
 * We intentionally do NOT touch longestStreak so "best ever" stays as a record.
 * We also never decrement roundsPlayed – once you've played a round, it counts.
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
    const userRef = db.collection("users").doc(userId);

    const p = db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;
      let lifetimeWins = 0;
      let lifetimeLosses = 0;

      if (snap.exists) {
        const u = snap.data() as any;
        currentStreak =
          typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak =
          typeof u.longestStreak === "number" ? u.longestStreak : 0;
        lifetimeWins =
          typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses =
          typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
      }

      const wasCorrect = pick === previousOutcome;

      if (wasCorrect) {
        currentStreak = Math.max(0, currentStreak - 1);
        lifetimeWins = Math.max(0, lifetimeWins - 1);
      } else {
        lifetimeLosses = Math.max(0, lifetimeLosses - 1);
      }

      tx.set(
        userRef,
        {
          currentStreak,
          longestStreak,
          lifetimeWins,
          lifetimeLosses,
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

    // ── Look up previous status/outcome so we can detect reopen / changes ──
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

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await qsRef.set(payload, { merge: true });

    // ── Apply / revert streak + lifetime stats ───────────────────

    // 1) If this question is now FINAL, apply stats.
    if (
      status === "final" &&
      (outcome === "yes" || outcome === "no" || outcome === "void")
    ) {
      // If it was previously FINAL with a different outcome, revert that first.
      if (prevStatus === "final" && prevOutcome && prevOutcome !== outcome) {
        await revertStreaksForQuestion(roundNumber, questionId, prevOutcome);
      }

      await updateStreaksForQuestion(
        roundNumber,
        questionId,
        outcome as QuestionOutcome
      );
    }

    // 2) If we REOPEN a previously-final question, revert its effect.
    if (
      status === "open" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no" || prevOutcome === "void")
    ) {
      await revertStreaksForQuestion(roundNumber, questionId, prevOutcome);
    }

    // 3) If we mark a previously-final question as VOID, also revert.
    if (
      status === "void" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no")
    ) {
      await revertStreaksForQuestion(roundNumber, questionId, prevOutcome);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
