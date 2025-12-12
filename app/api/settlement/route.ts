// /app/api/settlement/route.ts
// GAME-LEVEL SCORING (AUTHORITATIVE)
//
// Rules implemented:
// - Scoring is PER GAME, not per question
// - User can pick N questions in a game
// - If ANY picked question is wrong → gameScore = 0
// - If ALL picked questions are correct → gameScore = N
// - currentStreak reflects the CURRENT GAME SCORE ONLY
// - Streak can NEVER rebound within the same game
// - Settlement order does NOT matter
// - Reopen cleanly removes the game result and recomputes
//
// Leaderboard reads users.currentStreak (now correct)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type RequestBody = {
  roundNumber: number;
  questionId: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock";
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

type PickRow = {
  userId: string;
  outcome: "yes" | "no";
  gameId: string;
};

async function getPicksForQuestion(questionId: string): Promise<PickRow[]> {
  const results: PickRow[] = [];

  const snap = await db
    .collection("picks")
    .where("questionId", "==", questionId)
    .get();

  snap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    if (
      typeof d.userId === "string" &&
      (d.pick === "yes" || d.pick === "no") &&
      typeof d.gameId === "string"
    ) {
      results.push({
        userId: d.userId,
        outcome: d.pick,
        gameId: d.gameId,
      });
    }
  });

  return results;
}

/**
 * Per-user per-game state
 *
 * userGameState/{round}__{gameId}__{userId}
 * {
 *   roundNumber,
 *   gameId,
 *   userId,
 *   results: { [questionId]: "correct" | "wrong" }
 * }
 */
function userGameStateDocId(
  roundNumber: number,
  gameId: string,
  userId: string
) {
  return `${roundNumber}__${gameId}__${userId}`;
}

function computeGameScore(
  results: Record<string, "correct" | "wrong">
) {
  const vals = Object.values(results);
  if (vals.some((v) => v === "wrong")) return 0;
  return vals.length;
}

async function applyGameScoring(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  if (outcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<any>[] = [];

  for (const { userId, outcome: pick, gameId } of picks) {
    const userRef = db.collection("users").doc(userId);
    const gsRef = db
      .collection("userGameState")
      .doc(userGameStateDocId(roundNumber, gameId, userId));

    const p = db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const gsSnap = await tx.get(gsRef);

      const wasCorrect = pick === outcome;

      const prevResults: Record<string, "correct" | "wrong"> =
        gsSnap.exists && typeof gsSnap.data()?.results === "object"
          ? gsSnap.data()!.results
          : {};

      const nextResults = {
        ...prevResults,
        [questionId]: wasCorrect ? "correct" : "wrong",
      };

      const gameScore = computeGameScore(nextResults);

      let longestStreak =
        userSnap.exists && typeof userSnap.data()?.longestStreak === "number"
          ? userSnap.data()!.longestStreak
          : 0;

      if (gameScore > longestStreak) {
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

      tx.set(
        userRef,
        {
          currentStreak: gameScore,
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

async function revertGameScoring(
  roundNumber: number,
  questionId: string,
  previousOutcome: QuestionOutcome
) {
  if (previousOutcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<any>[] = [];

  for (const { userId, gameId } of picks) {
    const userRef = db.collection("users").doc(userId);
    const gsRef = db
      .collection("userGameState")
      .doc(userGameStateDocId(roundNumber, gameId, userId));

    const p = db.runTransaction(async (tx) => {
      const gsSnap = await tx.get(gsRef);

      const prevResults: Record<string, "correct" | "wrong"> =
        gsSnap.exists && typeof gsSnap.data()?.results === "object"
          ? gsSnap.data()!.results
          : {};

      const nextResults = { ...prevResults };
      delete nextResults[questionId];

      const gameScore = computeGameScore(nextResults);

      tx.set(
        gsRef,
        {
          results: nextResults,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        userRef,
        {
          currentStreak: gameScore,
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
      !questionId
    ) {
      return NextResponse.json(
        { error: "roundNumber and questionId required" },
        { status: 400 }
      );
    }

    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const prevSnap = await qsRef.get();
    const prev = prevSnap.exists ? prevSnap.data() as any : {};
    const prevStatus = prev.status as QuestionStatus | undefined;
    const prevOutcome = prev.outcome as QuestionOutcome | undefined;

    let status = body.status;
    let outcome = body.outcome;

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

    if (!status) {
      return NextResponse.json(
        { error: "status or action required" },
        { status: 400 }
      );
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

    if (
      status === "final" &&
      (outcome === "yes" || outcome === "no" || outcome === "void")
    ) {
      if (
        prevStatus === "final" &&
        prevOutcome &&
        prevOutcome !== outcome
      ) {
        await revertGameScoring(roundNumber, questionId, prevOutcome);
      }

      await applyGameScoring(
        roundNumber,
        questionId,
        outcome as QuestionOutcome
      );
    }

    if (
      status === "open" &&
      prevStatus === "final" &&
      prevOutcome
    ) {
      await revertGameScoring(roundNumber, questionId, prevOutcome);
    }

    if (
      status === "void" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no")
    ) {
      await revertGameScoring(roundNumber, questionId, prevOutcome);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
