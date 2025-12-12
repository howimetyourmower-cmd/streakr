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
 * We keep a per-user per-round per-game doc that stores correctness per question.
 * This makes streak/game-score order independent (settle YES then NO or vice versa).
 *
 * Doc id: `${round}__${gameId}__${userId}`
 *
 * Shape:
 * {
 *   roundNumber,
 *   gameId,
 *   userId,
 *   results: { [questionId]: "correct" | "wrong" }  // only for picks they made
 *   updatedAt
 * }
 */
function userGameStateDocId(roundNumber: number, gameId: string, userId: string) {
  return `${roundNumber}__${gameId}__${userId}`;
}

type PickRow = { userId: string; outcome: "yes" | "no"; gameId?: string | null };

/**
 * Fetch all picks for a given question from both:
 *  - `picks`      (current collection written by /api/user-picks, field `pick`)
 *  - `userPicks`  (legacy collection, field `outcome`)
 *
 * We ALSO try to read `gameId` off the pick docs if it exists.
 */
async function getPicksForQuestion(questionId: string): Promise<PickRow[]> {
  const results: PickRow[] = [];

  const [picksSnap, userPicksSnap] = await Promise.all([
    db.collection("picks").where("questionId", "==", questionId).get(),
    db.collection("userPicks").where("questionId", "==", questionId).get(),
  ]);

  picksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const pick = data.pick;
    const gameId = typeof data.gameId === "string" ? data.gameId : null;

    if (typeof userId === "string" && (pick === "yes" || pick === "no")) {
      results.push({ userId, outcome: pick, gameId });
    }
  });

  userPicksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const out = data.outcome;
    const gameId = typeof data.gameId === "string" ? data.gameId : null;

    if (typeof userId === "string" && (out === "yes" || out === "no")) {
      results.push({ userId, outcome: out, gameId });
    }
  });

  return results;
}

/**
 * Recompute gameScore from a results map.
 * - if any "wrong" => 0
 * - else => count("correct")
 */
function computeGameScore(results: Record<string, "correct" | "wrong">) {
  const vals = Object.values(results || {});
  if (vals.some((v) => v === "wrong")) return 0;
  return vals.filter((v) => v === "correct").length;
}

/**
 * Apply game-score mechanics for a settled question (final yes/no).
 * Also updates lifetime wins/losses like before.
 *
 * IMPORTANT:
 * - currentStreak now becomes GAME SCORE for that game (order independent).
 */
async function applyGameScoringForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  if (outcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick, gameId } of picks) {
    // If we don't know the gameId, we can’t do per-game scoring safely.
    // We’ll still do the old per-question lifetime wins/losses update,
    // but we won’t touch currentStreak (to avoid wrong state).
    const canDoGame = typeof gameId === "string" && gameId.length > 0;

    const userRef = db.collection("users").doc(userId);

    const p = db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;
      let lifetimeWins = 0;
      let lifetimeLosses = 0;
      let roundsPlayed = 0;
      let roundsPlayedRounds: number[] = [];

      if (userSnap.exists) {
        const u = userSnap.data() as any;
        currentStreak = typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak = typeof u.longestStreak === "number" ? u.longestStreak : 0;
        lifetimeWins = typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses = typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
        roundsPlayed = typeof u.roundsPlayed === "number" ? u.roundsPlayed : 0;
        roundsPlayedRounds = Array.isArray(u.roundsPlayedRounds) ? u.roundsPlayedRounds : [];
      }

      const wasCorrect = pick === outcome;

      // Lifetime stats remain per-question (as you had)
      if (wasCorrect) lifetimeWins += 1;
      else lifetimeLosses += 1;

      // Rounds played – once per round per user (same as before)
      let shouldUpdateRounds = false;
      let newRoundsPlayed = roundsPlayed;

      if (!roundsPlayedRounds.includes(roundNumber)) {
        shouldUpdateRounds = true;
        newRoundsPlayed = roundsPlayed + 1;
      }

      let nextCurrentStreak = currentStreak;

      if (canDoGame) {
        const gsRef = db
          .collection("userGameState")
          .doc(userGameStateDocId(roundNumber, gameId!, userId));

        const gsSnap = await tx.get(gsRef);
        const prev = gsSnap.exists ? (gsSnap.data() as any) : {};
        const prevResults: Record<string, "correct" | "wrong"> =
          prev?.results && typeof prev.results === "object" ? prev.results : {};

        const nextResults: Record<string, "correct" | "wrong"> = {
          ...prevResults,
          [questionId]: wasCorrect ? "correct" : "wrong",
        };

        const gameScore = computeGameScore(nextResults);

        // ✅ currentStreak now mirrors GAME SCORE (all-or-nothing)
        nextCurrentStreak = gameScore;

        // Longest streak is now "best game score achieved" (if you want it that way)
        // If you want longestStreak to stay lifetime best *gameScore*, this is correct:
        if (typeof gameScore === "number" && gameScore > longestStreak) {
          longestStreak = gameScore;
        }

        tx.set(
          gsRef,
          {
            roundNumber,
            gameId,
            userId,
            results: nextResults,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const payload: any = {
        currentStreak: nextCurrentStreak,
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
 * Revert effects of a previously-final yes/no when reopened or changed.
 * We must:
 * - revert lifetime wins/losses
 * - remove the stored correctness for that question from userGameState and recompute gameScore
 * - set users.currentStreak to recomputed gameScore (so it doesn’t bounce wrong)
 */
async function revertGameScoringForQuestion(
  roundNumber: number,
  questionId: string,
  previousOutcome: QuestionOutcome
) {
  if (previousOutcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick, gameId } of picks) {
    const canDoGame = typeof gameId === "string" && gameId.length > 0;

    const userRef = db.collection("users").doc(userId);

    const p = db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;
      let lifetimeWins = 0;
      let lifetimeLosses = 0;

      if (userSnap.exists) {
        const u = userSnap.data() as any;
        currentStreak = typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak = typeof u.longestStreak === "number" ? u.longestStreak : 0;
        lifetimeWins = typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses = typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
      }

      const wasCorrect = pick === previousOutcome;

      // Revert lifetime stats per-question
      if (wasCorrect) lifetimeWins = Math.max(0, lifetimeWins - 1);
      else lifetimeLosses = Math.max(0, lifetimeLosses - 1);

      let nextCurrentStreak = currentStreak;

      if (canDoGame) {
        const gsRef = db
          .collection("userGameState")
          .doc(userGameStateDocId(roundNumber, gameId!, userId));

        const gsSnap = await tx.get(gsRef);
        const prev = gsSnap.exists ? (gsSnap.data() as any) : {};
        const prevResults: Record<string, "correct" | "wrong"> =
          prev?.results && typeof prev.results === "object" ? prev.results : {};

        const nextResults = { ...prevResults };
        delete nextResults[questionId];

        const gameScore = computeGameScore(nextResults);
        nextCurrentStreak = gameScore;

        tx.set(
          gsRef,
          {
            roundNumber,
            gameId,
            userId,
            results: nextResults,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      tx.set(
        userRef,
        {
          currentStreak: nextCurrentStreak,
          longestStreak, // we do not reduce longest
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

    if (typeof roundNumber !== "number" || Number.isNaN(roundNumber) || !questionId) {
      return NextResponse.json(
        { error: "roundNumber and questionId are required" },
        { status: 400 }
      );
    }

    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const prevSnap = await qsRef.get();
    const prevData = prevSnap.exists
      ? (prevSnap.data() as { status?: QuestionStatus; outcome?: QuestionOutcome | "lock" })
      : null;

    const prevStatus = prevData?.status;
    const prevOutcome =
      prevData?.outcome === "yes" || prevData?.outcome === "no" || prevData?.outcome === "void"
        ? (prevData.outcome as QuestionOutcome)
        : undefined;

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
      }
    }

    if (!status && outcome && (outcome === "yes" || outcome === "no" || outcome === "void")) {
      status = outcome === "void" ? "void" : "final";
    }

    if (!status) {
      return NextResponse.json({ error: "status or action is required" }, { status: 400 });
    }

    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await qsRef.set(payload, { merge: true });

    // ── Revert/Apply ─────────────────────────────────────────────

    // If changing from one final outcome to another, revert old first
    if (status === "final" && (outcome === "yes" || outcome === "no" || outcome === "void")) {
      if (prevStatus === "final" && prevOutcome && prevOutcome !== outcome) {
        await revertGameScoringForQuestion(roundNumber, questionId, prevOutcome);
      }

      await applyGameScoringForQuestion(roundNumber, questionId, outcome as QuestionOutcome);
    }

    // Reopen previously-final => revert
    if (status === "open" && prevStatus === "final" && prevOutcome) {
      await revertGameScoringForQuestion(roundNumber, questionId, prevOutcome);
    }

    // Mark previously-final as void => revert
    if (status === "void" && prevStatus === "final" && (prevOutcome === "yes" || prevOutcome === "no")) {
      await revertGameScoringForQuestion(roundNumber, questionId, prevOutcome as QuestionOutcome);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] Unexpected error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
