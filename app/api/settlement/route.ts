// /app/api/settlement/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type RequestBody = {
  roundNumber: number; // ✅ required (AFL) - but we will verify against questionId
  questionId: string;
  action: "lock" | "reopen" | "final_yes" | "final_no" | "final_void" | "void";
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
  updatedAt?: any; // Timestamp (preferred), but tolerate Date/number
};

type PickDoc = {
  userId?: string;
  questionId?: string;
  pick?: "yes" | "no"; // picks collection
  outcome?: "yes" | "no"; // legacy userPicks
};

function questionStatusDocId(roundNumber: number, questionId: string) {
  // ✅ Must match picks + settlement reader logic
  return `${roundNumber}__${questionId}`;
}

function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

/**
 * ✅ Critical: infer roundNumber from questionId, so admin UI can't break leaderboard.
 * questionId format: "OR-G1-Q1-xxxx" or "R1-G1-Q1-xxxx"
 */
function inferRoundNumberFromQuestionId(questionId: string): number | null {
  const q = String(questionId || "").trim().toUpperCase();
  if (!q) return null;

  if (q.startsWith("OR-")) return 0;

  const m = q.match(/^R(\d+)-/);
  if (m?.[1]) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return undefined;
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : 0;
  const d = new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

// ─────────────────────────────────────────────
// ✅ MUST MATCH /app/api/picks/route.ts stableQuestionId()
// ─────────────────────────────────────────────

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function stableQuestionId(params: {
  roundNumber: number;
  gameId: string;
  quarter: number;
  question: string;
}): string {
  const base = `${params.roundNumber}|${params.gameId}|Q${params.quarter}|${String(
    params.question || ""
  )
    .trim()
    .toLowerCase()}`;
  const hash = fnv1a(base);
  return `${params.gameId}-Q${params.quarter}-${hash}`;
}

/**
 * ✅ IMPORTANT (AFL):
 * This MUST produce the same questionIds as /api/picks.
 * We build from rounds2026 rows and generate stableQuestionId per row.
 * No sorting within a game (keeps JSON order).
 */
function buildRoundStructure(roundNumber: number): {
  roundCode: string;
  gameIdsInOrder: string[];
  questionIdsByGame: Record<string, string[]>;
} {
  const roundCode = getRoundCode(roundNumber);
  const rows = rounds2026 as JsonRow[];

  const roundRows = rows.filter(
    (r) => String(r.Round).trim().toUpperCase() === roundCode
  );

  const gameIdsInOrder: string[] = [];
  const questionIdsByGame: Record<string, string[]> = {};

  for (const row of roundRows) {
    const gameId = `${roundCode}-G${row.Game}`;

    if (!questionIdsByGame[gameId]) {
      questionIdsByGame[gameId] = [];
      gameIdsInOrder.push(gameId);
    }

    const qid = stableQuestionId({
      roundNumber,
      gameId,
      quarter: Number(row.Quarter ?? 1),
      question: String(row.Question ?? ""),
    });

    questionIdsByGame[gameId].push(qid);
  }

  return { roundCode, gameIdsInOrder, questionIdsByGame };
}

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

    const updatedAtMs = toMs(d.updatedAt);

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

async function getUserPicksForRound(
  uid: string,
  roundCode: string
): Promise<Record<string, "yes" | "no">> {
  const map: Record<string, "yes" | "no"> = {};

  const [picksSnap, legacySnap] = await Promise.all([
    db.collection("picks").where("userId", "==", uid).get(),
    db.collection("userPicks").where("userId", "==", uid).get(),
  ]);

  picksSnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    const qid = d.questionId;
    const pick = d.pick;
    if (!qid || (pick !== "yes" && pick !== "no")) return;
    if (!qid.startsWith(`${roundCode}-G`)) return;
    map[qid] = pick;
  });

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
 * ✅ AFL recompute streak for the round
 * Clean Sweep per game; running across games.
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
    const pickedQids = qids.filter(
      (qid) => userPicks[qid] === "yes" || userPicks[qid] === "no"
    );

    // no picks => does not affect streak
    if (!pickedQids.length) continue;

    let gameBusted = false;
    let gameAdd = 0;

    for (const qid of pickedQids) {
      const pick = userPicks[qid];
      const st = statusMap[qid];

      // Only settled questions affect scoring
      const settledOutcome =
        st?.status === "final" || st?.status === "void" ? st?.outcome : undefined;

      // Unsettled => ignore for now (do not bust, do not add)
      if (!settledOutcome) continue;

      // void => ignore for now (do not bust, do not add)
      if (settledOutcome === "void") continue;

      if (pick !== settledOutcome) {
        gameBusted = true;
        break;
      }

      gameAdd += 1;
    }

    if (gameBusted) {
      rollingStreak = 0;
      continue;
    }

    rollingStreak += gameAdd;
  }

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

    const bodyRoundNumber =
      typeof body.roundNumber === "number" && !Number.isNaN(body.roundNumber)
        ? body.roundNumber
        : null;

    const questionId = String(body.questionId ?? "").trim();
    const action = body.action;

    if (bodyRoundNumber === null) {
      return NextResponse.json({ error: "roundNumber is required" }, { status: 400 });
    }

    if (!questionId || !action) {
      return NextResponse.json(
        { error: "questionId and action are required" },
        { status: 400 }
      );
    }

    // ✅ Infer round from questionId to prevent desync (leaderboard showing 0)
    const inferredRound = inferRoundNumberFromQuestionId(questionId);
    const roundNumber = inferredRound ?? bodyRoundNumber;

    // Resolve status/outcome from action
    let status: QuestionStatus;
    let outcome: QuestionOutcome | null = null;

    switch (action) {
      case "lock":
        status = "pending";
        outcome = null;
        break;
      case "reopen":
        status = "open";
        outcome = null;
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

    // ✅ One canonical doc per (roundNumber, questionId)
    const qsRef = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    const payload: any = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await qsRef.set(payload, { merge: true });

    // Recompute streaks for users who picked this question
    const affectedUserIds = await getAffectedUserIdsForQuestion(questionId);
    if (affectedUserIds.length) {
      await Promise.all(
        affectedUserIds.map((uid) => recomputeUserStreakForRound(uid, roundNumber))
      );
    }

    return NextResponse.json({
      ok: true,
      roundNumberUsed: roundNumber,
      roundNumberFromBody: bodyRoundNumber,
      roundNumberInferred: inferredRound,
    });
  } catch (error) {
    console.error("[/api/settlement] Unexpected error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
