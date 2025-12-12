// /app/api/settlement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

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

  const [picksSnap, userPicksSnap] = await Promise.all([
    db.collection("picks").where("questionId", "==", questionId).get(),
    db.collection("userPicks").where("questionId", "==", questionId).get(),
  ]);

  // From `picks` collection (field: pick)
  picksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const pick = data.pick;

    if (typeof userId === "string" && (pick === "yes" || pick === "no")) {
      results.push({ userId, outcome: pick });
    }
  });

  // From legacy `userPicks` collection (field: outcome)
  userPicksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const userId = data.userId;
    const out = data.outcome;

    if (typeof userId === "string" && (out === "yes" || out === "no")) {
      results.push({ userId, outcome: out });
    }
  });

  return results;
}

/**
 * Try to resolve a question document that contains gameId.
 * Supports:
 *  - /questions/{questionId}
 *  - any collectionGroup("questions") where documentId == questionId
 */
async function getQuestionDocWithGameId(questionId: string) {
  // 1) Top-level questions/{id}
  const direct = await db.collection("questions").doc(questionId).get();
  if (direct.exists) return direct;

  // 2) collectionGroup("questions") by documentId
  const cg = await db
    .collectionGroup("questions")
    .where(FieldPath.documentId(), "==", questionId)
    .limit(1)
    .get();

  if (!cg.empty) return cg.docs[0];

  return null;
}

/**
 * Get all questionIds in the same game.
 * Attempts:
 *  - query the same collection as the found question doc using `gameId`
 *  - otherwise, fall back to collectionGroup("questions") where gameId == ...
 */
async function getGameQuestionIds(gameId: string, fromDocPath?: string) {
  const ids = new Set<string>();

  // If we found the question inside some parent collection, try querying sibling collection
  // Example path: rounds/{roundId}/games/{gameId}/questions/{questionId}
  if (fromDocPath && fromDocPath.includes("/questions/")) {
    const parentColPath = fromDocPath.split("/questions/")[0] + "/questions";
    try {
      const snap = await db.collection(parentColPath).where("gameId", "==", gameId).get();
      snap.forEach((d) => ids.add(d.id));
      if (ids.size > 0) return Array.from(ids);
    } catch {
      // ignore and fall back
    }
  }

  // Try top-level questions
  try {
    const snap = await db.collection("questions").where("gameId", "==", gameId).get();
    snap.forEach((d) => ids.add(d.id));
    if (ids.size > 0) return Array.from(ids);
  } catch {
    // ignore
  }

  // Fall back: collectionGroup
  const cg = await db.collectionGroup("questions").where("gameId", "==", gameId).get();
  cg.forEach((d) => ids.add(d.id));

  return Array.from(ids);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Game-score mechanic:
 * - picksMade = number of questions in this game user picked (yes/no)
 * - if ANY picked & settled question is WRONG => gameScore = 0 and currentStreak = 0
 * - if NO wrong picks and the game is COMPLETE => currentStreak = picksMade
 *
 * NOTE: This makes backend streak match your UI mechanic.
 */
async function recomputeStreaksForGameByQuestionStatus(
  roundNumber: number,
  gameId: string,
  questionIds: string[]
) {
  if (!questionIds.length) return;

  // Load questionStatus docs for this game
  const qsRefs = questionIds.map((qid) =>
    db.collection("questionStatus").doc(questionStatusDocId(roundNumber, qid))
  );

  const qsSnaps = await db.getAll(...qsRefs);

  const statusByQid: Record<string, QuestionStatus | undefined> = {};
  const outcomeByQid: Record<string, QuestionOutcome | undefined> = {};

  for (const s of qsSnaps) {
    if (!s.exists) continue;
    const d = s.data() as any;
    const qid = d.questionId as string;
    statusByQid[qid] = d.status as QuestionStatus;
    const o = d.outcome;
    if (o === "yes" || o === "no" || o === "void") outcomeByQid[qid] = o;
  }

  const isGameComplete = questionIds.every((qid) => {
    const st = statusByQid[qid];
    return st === "final" || st === "void";
  });

  // Gather picks for ALL questions in game (from picks + legacy userPicks)
  // Firestore "in" limits => chunk into 10
  const qChunks = chunk(questionIds, 10);

  type PickRow = { userId: string; pick: "yes" | "no"; questionId: string };

  const allPickRows: PickRow[] = [];

  for (const ids of qChunks) {
    const [picksSnap, legacySnap] = await Promise.all([
      db.collection("picks").where("questionId", "in", ids).get(),
      db.collection("userPicks").where("questionId", "in", ids).get(),
    ]);

    picksSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (
        typeof data.userId === "string" &&
        typeof data.questionId === "string" &&
        (data.pick === "yes" || data.pick === "no")
      ) {
        allPickRows.push({
          userId: data.userId,
          questionId: data.questionId,
          pick: data.pick,
        });
      }
    });

    legacySnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (
        typeof data.userId === "string" &&
        typeof data.questionId === "string" &&
        (data.outcome === "yes" || data.outcome === "no")
      ) {
        allPickRows.push({
          userId: data.userId,
          questionId: data.questionId,
          pick: data.outcome,
        });
      }
    });
  }

  if (!allPickRows.length) return;

  // Build per-user picks map for this game
  const picksByUser: Record<string, Record<string, "yes" | "no">> = {};
  for (const r of allPickRows) {
    picksByUser[r.userId] = picksByUser[r.userId] || {};
    // last write wins if duplicates exist
    picksByUser[r.userId][r.questionId] = r.pick;
  }

  const userIds = Object.keys(picksByUser);
  if (!userIds.length) return;

  // Compute gameScore + wrong flag per user
  const userGameScore: Record<
    string,
    { picksMade: number; hasWrong: boolean }
  > = {};

  for (const uid of userIds) {
    const mp = picksByUser[uid] || {};
    const pickedQids = Object.keys(mp);
    const picksMade = pickedQids.length;

    let hasWrong = false;

    for (const qid of pickedQids) {
      const st = statusByQid[qid];
      const out = outcomeByQid[qid];

      // void => ignore
      if (st === "void" || out === "void") continue;

      // only judge wrong when settled final with yes/no
      if (st === "final" && (out === "yes" || out === "no")) {
        if (mp[qid] !== out) {
          hasWrong = true;
          break;
        }
      }
    }

    userGameScore[uid] = { picksMade, hasWrong };
  }

  // Apply to user docs
  const writes: Promise<unknown>[] = [];

  for (const uid of userIds) {
    const { picksMade, hasWrong } = userGameScore[uid];
    const userRef = db.collection("users").doc(uid);

    // If any wrong pick is known => streak must be 0 immediately.
    // If no wrong picks => only "lock in" streak when game complete.
    const nextStreak =
      hasWrong ? 0 : isGameComplete ? picksMade : undefined;

    const p = db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      let currentStreak = 0;
      let longestStreak = 0;

      if (snap.exists) {
        const u = snap.data() as any;
        currentStreak = typeof u.currentStreak === "number" ? u.currentStreak : 0;
        longestStreak = typeof u.longestStreak === "number" ? u.longestStreak : 0;
      }

      // If we shouldn't update streak yet (game not complete and no wrong),
      // we still store the per-game UI value so frontend can show it reliably if you want.
      const payload: any = {
        lastUpdatedAt: FieldValue.serverTimestamp(),
        currentGameId: gameId,
        currentGamePicksMade: picksMade,
        currentGameHasWrong: hasWrong,
        currentGameScore: hasWrong ? 0 : picksMade,
      };

      if (typeof nextStreak === "number") {
        payload.currentStreak = nextStreak;
        if (nextStreak > longestStreak) {
          payload.longestStreak = nextStreak;
        }
      }

      tx.set(userRef, payload, { merge: true });
    });

    writes.push(p);
  }

  await Promise.all(writes);
}

/**
 * Apply lifetime stats changes for a settled question.
 * (We keep this per-question: wins/losses, rounds played, etc.)
 * BUT we no longer use it to manage "currentStreak" (that is now game-based above).
 */
async function updateLifetimeStatsForQuestion(
  roundNumber: number,
  questionId: string,
  outcome: QuestionOutcome
) {
  if (outcome === "void") return;

  const picks = await getPicksForQuestion(questionId);
  if (!picks.length) return;

  const updates: Promise<unknown>[] = [];

  for (const { userId, outcome: pick } of picks) {
    const userRef = db.collection("users").doc(userId);

    const p = db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      let lifetimeWins = 0;
      let lifetimeLosses = 0;
      let roundsPlayed = 0;
      let roundsPlayedRounds: number[] = [];

      if (snap.exists) {
        const u = snap.data() as any;
        lifetimeWins = typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses =
          typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
        roundsPlayed = typeof u.roundsPlayed === "number" ? u.roundsPlayed : 0;
        roundsPlayedRounds = Array.isArray(u.roundsPlayedRounds)
          ? u.roundsPlayedRounds
          : [];
      }

      const wasCorrect = pick === outcome;

      if (wasCorrect) lifetimeWins += 1;
      else lifetimeLosses += 1;

      // Rounds played – once per round per user
      let shouldUpdateRounds = false;
      let newRoundsPlayed = roundsPlayed;

      if (!roundsPlayedRounds.includes(roundNumber)) {
        shouldUpdateRounds = true;
        newRoundsPlayed = roundsPlayed + 1;
      }

      const payload: any = {
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
 * Revert lifetime stats effect for this question when a FINAL
 * result is reopened or changed.
 * (We do NOT touch longestStreak here; streak is recomputed per-game now.)
 */
async function revertLifetimeStatsForQuestion(
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

      let lifetimeWins = 0;
      let lifetimeLosses = 0;

      if (snap.exists) {
        const u = snap.data() as any;
        lifetimeWins = typeof u.lifetimeWins === "number" ? u.lifetimeWins : 0;
        lifetimeLosses =
          typeof u.lifetimeLosses === "number" ? u.lifetimeLosses : 0;
      }

      const wasCorrect = pick === previousOutcome;

      if (wasCorrect) lifetimeWins = Math.max(0, lifetimeWins - 1);
      else lifetimeLosses = Math.max(0, lifetimeLosses - 1);

      tx.set(
        userRef,
        {
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

    // ── Lifetime stats (per-question) ───────────────────────────

    // If this question is now FINAL, apply stats.
    if (
      status === "final" &&
      (outcome === "yes" || outcome === "no" || outcome === "void")
    ) {
      // If it was previously FINAL with a different outcome, revert that first.
      if (prevStatus === "final" && prevOutcome && prevOutcome !== outcome) {
        await revertLifetimeStatsForQuestion(roundNumber, questionId, prevOutcome);
      }

      await updateLifetimeStatsForQuestion(
        roundNumber,
        questionId,
        outcome as QuestionOutcome
      );
    }

    // If we REOPEN a previously-final question, revert its effect.
    if (
      status === "open" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no" || prevOutcome === "void")
    ) {
      await revertLifetimeStatsForQuestion(roundNumber, questionId, prevOutcome);
    }

    // If we mark a previously-final question as VOID, also revert.
    if (
      status === "void" &&
      prevStatus === "final" &&
      (prevOutcome === "yes" || prevOutcome === "no")
    ) {
      await revertLifetimeStatsForQuestion(roundNumber, questionId, prevOutcome);
    }

    // ── NEW: Game-based streak recompute ────────────────────────
    // We recompute streak based on the whole game so UI gameScore and backend currentStreak match.

    const qDoc = await getQuestionDocWithGameId(questionId);
    const gameId = qDoc?.exists ? ((qDoc.data() as any)?.gameId as string) : "";

    if (typeof gameId === "string" && gameId.trim()) {
      const fromPath = qDoc?.ref?.path;
      const gameQuestionIds = await getGameQuestionIds(gameId, fromPath);

      await recomputeStreaksForGameByQuestionStatus(
        roundNumber,
        gameId,
        gameQuestionIds
      );
    } else {
      // If we can’t resolve gameId, we can’t safely recompute game-score streak.
      // This avoids breaking production; you’ll see a console warning to fix schema.
      console.warn(
        "[/api/settlement] Could not resolve gameId for questionId:",
        questionId
      );
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
