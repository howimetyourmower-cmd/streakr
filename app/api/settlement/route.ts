// /app/api/settlement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type RequestBody = {
  roundNumber: number;
  questionId: string;
  action:
    | "lock"
    | "reopen"
    | "final_yes"
    | "final_no"
    | "final_void"
    | "void";
};

type JsonRow = {
  Round: string; // "OR", "R1", ...
  Game: number; // 1,2,3...
  Match: string;
  Venue: string;
  StartTime: string;
  Question: string;
  Quarter: number;
  Status: string;
};

type QuestionStatusDoc = {
  roundNumber: number;
  questionId: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string; // legacy
  updatedAt?: FirebaseFirestore.Timestamp;
};

type PickDoc = {
  userId?: string;
  questionId?: string;
  pick?: "yes" | "no";
  outcome?: "yes" | "no"; // legacy (userPicks)
};

function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

// Normalise any outcome-ish value to "yes" | "no" | "void" | undefined
function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return undefined;
}

/**
 * 🚨 IMPORTANT:
 * This MUST match /app/api/picks/route.ts questionId generation exactly.
 *
 * In /api/picks you do:
 *   - roundRows = rows.filter(row.Round === roundCode)
 *   - iterate roundRows IN THEIR EXISTING ORDER
 *   - gameKey = `${roundCode}-G${row.Game}`
 *   - questionId = `${gameKey}-Q${qIndex+1}` (qIndex increments per game in encounter order)
 *
 * So we do the SAME here: no sorting.
 */
function buildRoundStructure(roundNumber: number): {
  roundCode: string;
  gameIdsInOrder: string[];
  questionIdsByGame: Record<string, string[]>;
} {
  const roundCode = getRoundCode(roundNumber);
  const rows = rounds2026 as JsonRow[];
  const roundRows = rows.filter((r) => r.Round === roundCode);

  const gameIdsInOrder: string[] = [];
  const questionIdsByGame: Record<string, string[]> = {};
  const questionIndexByGame: Record<string, number> = {};

  for (const row of roundRows) {
    const gameId = `${roundCode}-G${row.Game}`;

    if (!questionIdsByGame[gameId]) {
      questionIdsByGame[gameId] = [];
      questionIndexByGame[gameId] = 0;
      gameIdsInOrder.push(gameId); // insertion order = picks API order
    }

    const idx = questionIndexByGame[gameId]++;
    const questionId = `${gameId}-Q${idx + 1}`;
    questionIdsByGame[gameId].push(questionId);
  }

  return { roundCode, gameIdsInOrder, questionIdsByGame };
}

/**
 * Read all questionStatus docs for this round and keep the latest per questionId.
 * Accepts both outcome and legacy result; normalises casing.
 */
async function getLatestQuestionStatusMap(
  roundNumber: number
): Promise<Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }>> {
  const temp: Record<
    string,
    { status?: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }
  > = {};

  const snap = await db
    .collection("questionStatus")
    .where("roundNumber", "==", roundNumber)
    .get();

  snap.forEach((docSnap) => {
    const d = docSnap.data() as QuestionStatusDoc;
    if (!d.questionId) return;

    const rawOutcome = (d.outcome as any) ?? (d.result as any);
    const outcome = normaliseOutcomeValue(rawOutcome);

    const updatedAtMs =
      d.updatedAt && typeof (d.updatedAt as any).toMillis === "function"
        ? (d.updatedAt as any).toMillis()
        : 0;

    const existing = temp[d.questionId];
    if (!existing || updatedAtMs >= existing.updatedAtMs) {
      temp[d.questionId] = { status: d.status, outcome, updatedAtMs };
    }
  });

  const finalMap: Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }> =
    {};
  for (const [qid, v] of Object.entries(temp)) {
    finalMap[qid] = { status: v.status, outcome: v.outcome };
  }
  return finalMap;
}

/**
 * ✅ Affected users MUST include:
 *  - picks collection
 *  - legacy userPicks collection
 */
async function getAffectedUserIdsForQuestion(questionId: string): Promise<string[]> {
  const set = new Set<string>();

  const [picksSnap, legacySnap] = await Promise.all([
    db.collection("picks").where("questionId", "==", questionId).get(),
    db.collection("userPicks").where("questionId", "==", questionId).get(),
  ]);

  picksSnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    if (typeof d.userId === "string") set.add(d.userId);
  });

  legacySnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    if (typeof d.userId === "string") set.add(d.userId);
  });

  return Array.from(set);
}

/**
 * Get all picks for user in this round (combine picks + legacy userPicks).
 * We filter by questionId prefix = `${roundCode}-G`
 * (Avoid relying on pick.roundNumber because it can be null/mismatched.)
 *
 * If both exist, `picks` wins.
 */
async function getUserPicksForRound(
  uid: string,
  roundCode: string
): Promise<Record<string, "yes" | "no">> {
  const map: Record<string, "yes" | "no"> = {};

  const [picksSnap, legacySnap] = await Promise.all([
    db.collection("picks").where("userId", "==", uid).get(),
    db.collection("userPicks").where("userId", "==", uid).get(),
  ]);

  // primary: picks (field: pick)
  picksSnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    const qid = d.questionId;
    const pick = d.pick;
    if (!qid || (pick !== "yes" && pick !== "no")) return;
    if (!qid.startsWith(`${roundCode}-G`)) return;
    map[qid] = pick;
  });

  // legacy: userPicks (field: outcome) ONLY if not already present
  legacySnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    const qid = d.questionId;
    const out = d.outcome;
    if (!qid || (out !== "yes" && out !== "no")) return;
    if (!qid.startsWith(`${roundCode}-G`)) return;
    if (!map[qid]) map[qid] = out;
  });

  return map;
}

/**
 * ✅ NEW ROLLING SCORING RULES (your “Rolling Baby!” rules)
 *
 * - In a game:
 *    - If you picked N questions and ANY settled yes/no is wrong => busted => game contributes 0 and streak resets to 0
 *    - Otherwise game contributes the count of correct settled yes/no picks (void + unsettled don't count)
 * - Rolling streak continues across games until busted.
 *
 * We recompute deterministically from scratch for the round.
 */
async function recomputeUserStreakForRound(uid: string, roundNumber: number) {
  const { roundCode, gameIdsInOrder, questionIdsByGame } =
    buildRoundStructure(roundNumber);

  const [statusMap, userPicks] = await Promise.all([
    getLatestQuestionStatusMap(roundNumber),
    getUserPicksForRound(uid, roundCode),
  ]);

  let rollingStreak = 0;

  for (const gameId of gameIdsInOrder) {
    const qids = questionIdsByGame[gameId] || [];
    const pickedQids = qids.filter((qid) => userPicks[qid] === "yes" || userPicks[qid] === "no");

    if (!pickedQids.length) continue;

    let gameBusted = false;
    let gameAdd = 0;

    for (const qid of pickedQids) {
      const pick = userPicks[qid];
      const st = statusMap[qid];

      // only settled outcomes affect score
      const settledOutcome =
        st?.status === "final" || st?.status === "void" ? st?.outcome : undefined;

      if (!settledOutcome) {
        // not settled yet → ignore (no add, no bust)
        continue;
      }

      if (settledOutcome === "void") {
        // void → ignore (no add, no bust)
        continue;
      }

      // settled yes/no:
      if (pick !== settledOutcome) {
        gameBusted = true;
        break;
      }

      // correct settled
      gameAdd += 1;
    }

    if (gameBusted) {
      rollingStreak = 0;
      // once busted, the roll is reset; next games can build again
      continue;
    }

    rollingStreak += gameAdd;
  }

  // Persist:
  // - Update currentStreak to match the rolling score.
  // - Only ever increase longestStreak (we don't decrease lifetime records here).
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existingLongest =
      snap.exists && typeof (snap.data() as any).longestStreak === "number"
        ? (snap.data() as any).longestStreak
        : 0;

    const newLongest = Math.max(existingLongest, rollingStreak);

    tx.set(
      userRef,
      {
        currentStreak: rollingStreak,
        longestStreak: newLongest,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as RequestBody;
    const { roundNumber, questionId, action } = body;

    if (
      typeof roundNumber !== "number" ||
      Number.isNaN(roundNumber) ||
      !questionId ||
      !action
    ) {
      return NextResponse.json(
        { error: "roundNumber, questionId, and action are required" },
        { status: 400 }
      );
    }

    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    // Resolve status/outcome from action
    let status: QuestionStatus;
    let outcome: QuestionOutcome | undefined;

    switch (action) {
      case "lock":
        status = "pending";
        outcome = undefined;
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
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Write questionStatus doc
    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await qsRef.set(payload, { merge: true });

    // ✅ Recompute streaks for users who picked this question (picks + legacy)
    const affectedUserIds = await getAffectedUserIdsForQuestion(questionId);

    if (affectedUserIds.length) {
      await Promise.all(
        affectedUserIds.map((uid) => recomputeUserStreakForRound(uid, roundNumber))
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
