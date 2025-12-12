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
  action?:
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

function getGameIdFromQuestionId(questionId: string): string {
  // questionId looks like: OR-G1-Q1  / R1-G3-Q4
  // so gameId is everything before "-Q"
  const idx = questionId.lastIndexOf("-Q");
  if (idx > 0) return questionId.slice(0, idx);
  // fallback: still try first 2 segments
  const parts = questionId.split("-Q");
  return parts[0] || questionId;
}

/**
 * Build ordered gameIds + questionIds for this round from rounds2026.json
 * so we can deterministically recompute streaks.
 */
function buildRoundStructure(roundNumber: number): {
  roundCode: string;
  gameIdsInOrder: string[];
  questionIdsByGame: Record<string, string[]>;
} {
  const roundCode = getRoundCode(roundNumber);
  const rows = rounds2026 as JsonRow[];

  const roundRows = rows.filter((r) => r.Round === roundCode);

  // Keep game order by StartTime then Game number (stable)
  const uniqueGames = new Map<number, { startTime: string }>();
  for (const r of roundRows) {
    if (!uniqueGames.has(r.Game)) {
      uniqueGames.set(r.Game, { startTime: r.StartTime });
    }
  }

  const gameNums = Array.from(uniqueGames.keys()).sort((a, b) => {
    const aT = uniqueGames.get(a)?.startTime || "";
    const bT = uniqueGames.get(b)?.startTime || "";
    const aMs = new Date(aT).getTime();
    const bMs = new Date(bT).getTime();
    if (!Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs !== bMs) return aMs - bMs;
    return a - b;
  });

  const gameIdsInOrder = gameNums.map((g) => `${roundCode}-G${g}`);
  const questionIdsByGame: Record<string, string[]> = {};

  for (const gameNum of gameNums) {
    const gameId = `${roundCode}-G${gameNum}`;
    const gameRows = roundRows.filter((r) => r.Game === gameNum);

    // Deterministic question order: Quarter asc, then original order
    // We must match your /api/picks questionId generation: Q1..Qn in the same order used there.
    // /api/picks increments by iteration order of roundRows loop; to match reliably we sort:
    const ordered = [...gameRows].sort((a, b) => {
      if (a.Quarter !== b.Quarter) return a.Quarter - b.Quarter;
      // tie-breaker: question text
      return String(a.Question || "").localeCompare(String(b.Question || ""));
    });

    questionIdsByGame[gameId] = ordered.map((_, idx) => `${gameId}-Q${idx + 1}`);
  }

  return { roundCode, gameIdsInOrder, questionIdsByGame };
}

/**
 * Read all questionStatus docs for this round and keep the latest per questionId.
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

  const finalMap: Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }> = {};
  for (const [qid, v] of Object.entries(temp)) {
    finalMap[qid] = { status: v.status, outcome: v.outcome };
  }
  return finalMap;
}

/**
 * Get all picks for affected users on a specific question (used to find which users to recompute).
 */
async function getUserIdsForQuestion(questionId: string): Promise<string[]> {
  const snap = await db.collection("picks").where("questionId", "==", questionId).get();
  const set = new Set<string>();
  snap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    if (typeof d.userId === "string") set.add(d.userId);
  });
  return Array.from(set);
}

/**
 * Get all picks for user in this round (filter by questionId prefix = roundCode-G)
 * (We avoid relying on pick.roundNumber because it can be null/mismatched.)
 */
async function getUserPicksForRound(
  uid: string,
  roundCode: string
): Promise<Record<string, "yes" | "no">> {
  const map: Record<string, "yes" | "no"> = {};

  // NOTE: This fetches all picks for the user. OK for now.
  // If later needed, add an indexed query on roundNumber and fall back to prefix.
  const snap = await db.collection("picks").where("userId", "==", uid).get();

  snap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    const qid = d.questionId;
    const pick = d.pick;
    if (!qid || (pick !== "yes" && pick !== "no")) return;
    if (!qid.startsWith(`${roundCode}-G`)) return;
    map[qid] = pick;
  });

  return map;
}

/**
 * ✅ NEW STREAK RULES (game score + rollover):
 * - In a game: if you picked N questions...
 *    - if ANY picked question is wrong (based on settled outcome) => game score = 0
 *    - else game score = number of picked questions that are currently correct+settled
 *      (void doesn't count)
 * - Your STREAK is the rolling total across games since the last busted game.
 * - If a game is busted (any wrong), your streak becomes 0 and stays 0 for the rest of that game.
 * - Next game: you can start building again from 0.
 *
 * We recompute deterministically from scratch for the round whenever settlement changes.
 */
async function recomputeUserStreakForRound(uid: string, roundNumber: number) {
  const { roundCode, gameIdsInOrder, questionIdsByGame } = buildRoundStructure(roundNumber);

  const [statusMap, userPicks] = await Promise.all([
    getLatestQuestionStatusMap(roundNumber),
    getUserPicksForRound(uid, roundCode),
  ]);

  let currentStreak = 0;
  let longestStreak = 0;

  for (const gameId of gameIdsInOrder) {
    const qids = questionIdsByGame[gameId] || [];

    // Gather picked questions in this game
    const pickedQids = qids.filter((qid) => userPicks[qid] === "yes" || userPicks[qid] === "no");
    if (!pickedQids.length) {
      // No picks in this game → streak unchanged
      longestStreak = Math.max(longestStreak, currentStreak);
      continue;
    }

    // Evaluate game
    let gameBusted = false;
    let gameCorrectSettledCount = 0;

    for (const qid of pickedQids) {
      const pick = userPicks[qid];
      const st = statusMap[qid];

      // only settled outcomes affect score
      const outcome =
        st?.status === "final" || st?.status === "void" ? st?.outcome : undefined;

      if (!outcome) {
        // not settled yet → ignore for now (doesn't add, doesn't bust)
        continue;
      }

      if (outcome === "void") {
        // void doesn't add and doesn't bust
        continue;
      }

      if (pick !== outcome) {
        gameBusted = true;
        break;
      }

      // correct settled
      gameCorrectSettledCount += 1;
    }

    if (gameBusted) {
      // busted game resets entire run
      currentStreak = 0;
      longestStreak = Math.max(longestStreak, currentStreak);
      // IMPORTANT: once busted, we do NOT add anything else from this game
      continue;
    }

    // not busted: add the correct settled picks so far in this game
    currentStreak += gameCorrectSettledCount;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  // Persist
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        currentStreak,
        longestStreak,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
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

    // For reference/debug (not strictly required)
    const prevSnap = await qsRef.get();
    const prev = prevSnap.exists ? (prevSnap.data() as any) : null;
    void prev;

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

    // Write questionStatus
    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await qsRef.set(payload, { merge: true });

    // ✅ Recompute streaks for ONLY users who picked this question
    const affectedUserIds = await getUserIdsForQuestion(questionId);

    // If nobody picked it, we're done
    if (!affectedUserIds.length) {
      return NextResponse.json({ ok: true });
    }

    // Recompute in parallel (safe; each user doc is independent)
    await Promise.all(
      affectedUserIds.map((uid) => recomputeUserStreakForRound(uid, roundNumber))
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] Unexpected error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
