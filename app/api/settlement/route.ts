// /app/api/settlement/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";
type SportKey = "AFL" | "BBL";

type RequestBody = {
  // AFL (required for AFL)
  roundNumber?: number;

  // Shared
  sport?: SportKey;
  questionId: string;
  action:
    | "lock"
    | "reopen"
    | "final_yes"
    | "final_no"
    | "final_void"
    | "void";

  // BBL
  docId?: string; // cricketRounds/{docId}
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
  pick?: "yes" | "no"; // picks collection
  outcome?: "yes" | "no"; // legacy userPicks
};

function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return undefined;
}

function normaliseStatusValue(val: unknown): QuestionStatus {
  const s = String(val ?? "open").trim().toLowerCase();
  if (s === "open") return "open";
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  if (s.includes("open")) return "open";
  if (s.includes("final")) return "final";
  if (s.includes("pend")) return "pending";
  if (s.includes("void")) return "void";
  return "open";
}

/**
 * 🚨 IMPORTANT (AFL):
 * Must match /app/api/picks/route.ts questionId generation exactly.
 * No sorting.
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
      gameIdsInOrder.push(gameId);
    }

    const idx = questionIndexByGame[gameId]++;
    const questionId = `${gameId}-Q${idx + 1}`;
    questionIdsByGame[gameId].push(questionId);
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

async function getUserPicksAll(): Promise<
  Record<string, Record<string, "yes" | "no">>
> {
  // Not used; left here intentionally (no-op placeholder).
  return {};
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
 * AFL recompute (existing logic)
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

    if (!pickedQids.length) continue;

    let gameBusted = false;
    let gameAdd = 0;

    for (const qid of pickedQids) {
      const pick = userPicks[qid];
      const st = statusMap[qid];

      const settledOutcome =
        st?.status === "final" || st?.status === "void" ? st?.outcome : undefined;

      if (!settledOutcome) continue;
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

/**
 * BBL helpers: your Firestore doc in screenshot is:
 * cricketRounds/{docId} with fields like:
 *  - matchId
 *  - match
 *  - questions: [{id, quarter, question, status, outcome?}]
 *
 * We update that question in-place and recompute streak by scanning
 * ALL cricketRounds docs for league/sport "BBL" (small scale, but works now).
 */

type BblQuestion = {
  id: string;
  quarter: number;
  question: string;
  status?: QuestionStatus | string;
  outcome?: QuestionOutcome | null | string;
  isSponsorQuestion?: boolean;
};

type BblRoundDoc = {
  League?: string; // in your screenshot
  sport?: string; // optional
  match?: string;
  matchId?: string;
  venue?: string;
  startTime?: string;
  questions?: BblQuestion[];

  // (optional future shape) games array
  games?: Array<{
    id?: string;
    match?: string;
    venue?: string;
    startTime?: string;
    sport?: string;
    questions?: BblQuestion[];
  }>;
};

function getBblDocLeague(d: BblRoundDoc): string {
  const league = String(d.League ?? d.sport ?? "BBL").toUpperCase();
  return league === "CRICKET" ? "BBL" : league;
}

function extractAllBblQuestions(docId: string, d: BblRoundDoc): BblQuestion[] {
  // Support both shapes:
  if (Array.isArray(d.questions)) return d.questions;

  // games[] shape (if you ever move to it)
  const fromGames: BblQuestion[] = [];
  if (Array.isArray(d.games)) {
    d.games.forEach((g) => {
      (g.questions || []).forEach((q) => fromGames.push(q));
    });
  }
  return fromGames;
}

async function updateBblQuestionInDoc(params: {
  docId: string;
  questionId: string;
  nextStatus: QuestionStatus;
  nextOutcome: QuestionOutcome | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { docId, questionId, nextStatus, nextOutcome } = params;

  const ref = db.collection("cricketRounds").doc(docId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: false, error: `BBL doc not found: cricketRounds/${docId}` };
  }

  const data = snap.data() as BblRoundDoc;

  // Update in questions[] if present
  if (Array.isArray(data.questions)) {
    let found = false;
    const nextQuestions = data.questions.map((q) => {
      if (q.id === questionId) {
        found = true;
        return {
          ...q,
          status: nextStatus,
          outcome: nextOutcome,
        };
      }
      return q;
    });

    if (!found) {
      return { ok: false, error: `Question not found in questions[]: ${questionId}` };
    }

    await ref.set(
      {
        questions: nextQuestions,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }

  // Update in games[].questions[] if you ever use it
  if (Array.isArray(data.games)) {
    let found = false;

    const nextGames = data.games.map((g) => {
      const qs = Array.isArray(g.questions) ? g.questions : [];
      const nextQs = qs.map((q) => {
        if (q.id === questionId) {
          found = true;
          return {
            ...q,
            status: nextStatus,
            outcome: nextOutcome,
          };
        }
        return q;
      });

      return { ...g, questions: nextQs };
    });

    if (!found) {
      return { ok: false, error: `Question not found in games[].questions[]: ${questionId}` };
    }

    await ref.set(
      {
        games: nextGames,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  }

  return { ok: false, error: `BBL doc has no questions[] (and no games[])` };
}

async function getUserPicksForBBL(uid: string): Promise<Record<string, "yes" | "no">> {
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
    map[qid] = pick;
  });

  legacySnap.forEach((docSnap) => {
    const d = docSnap.data() as PickDoc;
    const qid = d.questionId;
    const out = d.outcome;
    if (!qid || (out !== "yes" && out !== "no")) return;
    if (!map[qid]) map[qid] = out;
  });

  return map;
}

async function recomputeUserStreakForBBL(uid: string) {
  // Scan cricketRounds for BBL docs. This is fine for MVP scale.
  const snap = await db.collection("cricketRounds").get();

  const docs: Array<{ id: string; data: BblRoundDoc }> = [];
  snap.forEach((d) => {
    const data = d.data() as BblRoundDoc;
    const league = getBblDocLeague(data);
    if (league === "BBL") docs.push({ id: d.id, data });
  });

  // Stable order: startTime if available, else docId
  docs.sort((a, b) => {
    const aT = String(a.data.startTime || "").trim();
    const bT = String(b.data.startTime || "").trim();
    if (aT && bT) return aT.localeCompare(bT);
    return a.id.localeCompare(b.id);
  });

  const userPicks = await getUserPicksForBBL(uid);

  let rollingStreak = 0;

  for (const doc of docs) {
    const allQs = extractAllBblQuestions(doc.id, doc.data);
    if (!allQs.length) continue;

    const picked = allQs.filter((q) => {
      const p = userPicks[q.id];
      return p === "yes" || p === "no";
    });

    if (!picked.length) continue;

    let busted = false;
    let add = 0;

    for (const q of picked) {
      const pick = userPicks[q.id];
      const st = normaliseStatusValue(q.status ?? "open");
      const out = normaliseOutcomeValue(q.outcome);

      // only settled affects score
      const settled = st === "final" || st === "void" ? out : undefined;
      if (!settled) continue;
      if (settled === "void") continue;

      if (pick !== settled) {
        busted = true;
        break;
      }

      add += 1;
    }

    if (busted) {
      rollingStreak = 0;
      continue;
    }

    rollingStreak += add;
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

    const sport: SportKey = (String(body.sport ?? "AFL").toUpperCase() as SportKey) || "AFL";
    const questionId = String(body.questionId ?? "").trim();
    const action = body.action;

    if (!questionId || !action) {
      return NextResponse.json(
        { error: "questionId and action are required" },
        { status: 400 }
      );
    }

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

    // ─────────────────────────────
    // BBL: write into cricketRounds/{docId}
    // ─────────────────────────────
    if (sport === "BBL") {
      const docId = String(body.docId ?? "").trim();
      if (!docId) {
        return NextResponse.json(
          { error: "docId is required for BBL settlement" },
          { status: 400 }
        );
      }

      const updated = await updateBblQuestionInDoc({
        docId,
        questionId,
        nextStatus: status,
        nextOutcome: outcome,
      });

      if (!updated.ok) {
        return NextResponse.json({ error: updated.error }, { status: 404 });
      }

      // Recompute streaks for users who picked this question
      const affectedUserIds = await getAffectedUserIdsForQuestion(questionId);
      if (affectedUserIds.length) {
        await Promise.all(affectedUserIds.map((uid) => recomputeUserStreakForBBL(uid)));
      }

      return NextResponse.json({ ok: true });
    }

    // ─────────────────────────────
    // AFL: existing questionStatus collection flow
    // ─────────────────────────────
    const roundNumber =
      typeof body.roundNumber === "number" && !Number.isNaN(body.roundNumber)
        ? body.roundNumber
        : null;

    if (roundNumber === null) {
      return NextResponse.json(
        { error: "roundNumber is required for AFL settlement" },
        { status: 400 }
      );
    }

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

    const affectedUserIds = await getAffectedUserIdsForQuestion(questionId);
    if (affectedUserIds.length) {
      await Promise.all(
        affectedUserIds.map((uid) => recomputeUserStreakForRound(uid, roundNumber))
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/settlement] Unexpected error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
