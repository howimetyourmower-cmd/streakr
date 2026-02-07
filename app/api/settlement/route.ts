// /app/api/settlement/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import rounds2026 from "@/data/rounds-2026.json";
import {
  inferRoundNumberFromQuestionId,
  questionStatusDocId,
} from "../../lib/questionStatusKey";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type RequestBody = {
  roundNumber?: number;
  questionId: string;
  action: "lock" | "reopen" | "final_yes" | "final_no" | "final_void" | "void";
};

type PickDoc = {
  userId?: string;
  questionId?: string;
  pick?: "yes" | "no";
};

type QuestionStatusDoc = {
  questionId: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome;
  updatedAt?: unknown;
};

type OverrideMode = "manual" | "auto";

/**
 * NOTE:
 * - "manual" means set by settlement/admin (lock/reopen/final/void)
 * - "auto" means set by system (Squiggle auto-locker, etc.)
 *
 * Manual must always win — so auto processes should never overwrite docs
 * where overrideMode === "manual".
 */

// ─────────────────────────────────────────────
// Recompute streak (IDENTICAL LOGIC to picks)
// ─────────────────────────────────────────────

function getRoundCode(roundNumber: number) {
  return roundNumber === 0 ? "OR" : `R${roundNumber}`;
}

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
}) {
  const base = `${params.roundNumber}|${params.gameId}|Q${params.quarter}|${params.question
    .trim()
    .toLowerCase()}`;
  return `${params.gameId}-Q${params.quarter}-${fnv1a(base)}`;
}

async function recomputeUserStreak(uid: string, roundNumber: number) {
  const roundCode = getRoundCode(roundNumber);

  const rows = rounds2026.filter(
    (r: unknown) => String((r as any).Round).toUpperCase() === roundCode
  );

  const games: Record<string, string[]> = {};

  for (const r of rows) {
    const gameId = `${roundCode}-G${(r as any).Game}`;
    if (!games[gameId]) games[gameId] = [];

    games[gameId].push(
      stableQuestionId({
        roundNumber,
        gameId,
        quarter: Number((r as any).Quarter),
        question: String((r as any).Question ?? ""),
      })
    );
  }

  const [statusSnap, picksSnap] = await Promise.all([
    db
      .collection("questionStatus")
      .where("roundNumber", "==", roundNumber)
      .get(),
    db.collection("picks").where("userId", "==", uid).get(),
  ]);

  const statusMap: Record<
    string,
    { status?: QuestionStatus; outcome?: QuestionOutcome }
  > = {};

  statusSnap.forEach((d) => {
    const data = d.data() as QuestionStatusDoc;
    statusMap[data.questionId] = {
      status: data.status,
      outcome: data.outcome,
    };
  });

  const userPicks: Record<string, "yes" | "no"> = {};
  picksSnap.forEach((d) => {
    const p = d.data() as PickDoc;
    if (p.questionId && p.pick) userPicks[p.questionId] = p.pick;
  });

  let streak = 0;

  for (const gameId of Object.keys(games)) {
    const qids = games[gameId].filter((q) => userPicks[q]);
    if (!qids.length) continue;

    let busted = false;
    let add = 0;

    for (const qid of qids) {
      const st = statusMap[qid];
      if (!st || st.status !== "final") continue;
      if (st.outcome === "void") continue;
      if (userPicks[qid] !== st.outcome) {
        busted = true;
        break;
      }
      add++;
    }

    if (busted) {
      streak = 0;
    } else {
      streak += add;
    }
  }

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        currentStreak: streak,
        longestStreak: FieldValue.increment(0),
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const questionId = String(body.questionId || "").trim();
    if (!questionId) {
      return NextResponse.json(
        { error: "questionId required" },
        { status: 400 }
      );
    }

    const inferredRound = inferRoundNumberFromQuestionId(questionId);
    const roundNumber =
      inferredRound ??
      (typeof body.roundNumber === "number" ? body.roundNumber : null);

    if (roundNumber === null) {
      return NextResponse.json(
        { error: "roundNumber required" },
        { status: 400 }
      );
    }

    let status: QuestionStatus;
    let outcome: QuestionOutcome | null = null;

    switch (body.action) {
      case "lock":
        status = "pending";
        break;
      case "reopen":
        status = "open";
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

    const ref = db
      .collection("questionStatus")
      .doc(questionStatusDocId(roundNumber, questionId));

    // Manual actions: always mark overrideMode as "manual"
    const overrideMode: OverrideMode = "manual";

    const payload: {
      roundNumber: number;
      questionId: string;
      status: QuestionStatus;
      updatedAt: FirebaseFirestore.FieldValue;
      overrideMode: OverrideMode;
      overrideAction: RequestBody["action"];
      outcome?:
        | QuestionOutcome
        | FirebaseFirestore.FieldValue; // delete
    } = {
      roundNumber,
      questionId,
      status,
      updatedAt: FieldValue.serverTimestamp(),
      overrideMode,
      overrideAction: body.action,
    };

    if (outcome) payload.outcome = outcome;
    else payload.outcome = FieldValue.delete();

    await ref.set(payload, { merge: true });

    const picksSnap = await db
      .collection("picks")
      .where("questionId", "==", questionId)
      .get();

    const users = new Set<string>();
    picksSnap.forEach((d) => {
      const p = d.data() as PickDoc;
      if (p.userId) users.add(p.userId);
    });

    await Promise.all(Array.from(users).map((uid) => recomputeUserStreak(uid, roundNumber)));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[settlement] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
