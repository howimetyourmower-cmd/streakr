// /app/api/freekick/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type QuestionStatusDoc = {
  roundNumber?: number;
  questionId?: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string;
  updatedAt?: FirebaseFirestore.Timestamp | any;
};

type FirestoreRoundDoc = {
  season?: number;
  roundNumber?: number;
  roundKey?: string;
  label?: string;
  games?: {
    match?: string;
    venue?: string;
    startTime?: string;
    questions?: { quarter?: number; question?: string; status?: string }[];
  }[];
};

const SEASON = 2026;

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (error) {
    console.error("[/api/freekick] Failed to verify ID token", error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Helpers (same hashing as /api/picks)
// ─────────────────────────────────────────────

function getRoundCode(roundNumber: number): string {
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

function stableQuestionId(params: { roundNumber: number; gameId: string; quarter: number; question: string }): string {
  const base = `${params.roundNumber}|${params.gameId}|Q${params.quarter}|${String(params.question || "")
    .trim()
    .toLowerCase()}`;
  const hash = fnv1a(base);
  return `${params.gameId}-Q${params.quarter}-${hash}`;
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

function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  const d = ts instanceof Date ? ts : new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

// ─────────────────────────────────────────────
// Firestore reads
// ─────────────────────────────────────────────

async function getRoundDocByNumber(roundNumber: number): Promise<FirestoreRoundDoc | null> {
  try {
    const snap = await db
      .collection("rounds")
      .where("season", "==", SEASON)
      .where("roundNumber", "==", roundNumber)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return (snap.docs[0].data() as FirestoreRoundDoc) || null;
  } catch (e) {
    console.error("[/api/freekick] Failed to read round doc", e);
    return null;
  }
}

async function getQuestionStatusForQuestionIds(params: {
  roundNumber: number;
  questionIds: Set<string>;
}): Promise<Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>> {
  const { roundNumber, questionIds } = params;
  const out: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }> = {};

  const ids = Array.from(questionIds);
  if (!ids.length) return {};

  const refs = ids.map((qid) => db.collection("questionStatus").doc(questionStatusDocId(roundNumber, qid)));

  try {
    // @ts-ignore admin supports getAll
    const snaps: FirebaseFirestore.DocumentSnapshot[] = await db.getAll(...refs);

    for (const snap of snaps) {
      if (!snap.exists) continue;

      const data = (snap.data() as QuestionStatusDoc) || {};
      const qid =
        (typeof data.questionId === "string" && data.questionId) || snap.id.split("__").slice(1).join("__");

      const status = data.status as QuestionStatus | undefined;
      if (!qid || !status) continue;

      const rawOutcome = (data.outcome as any) ?? (data.result as any);
      const outcome = normaliseOutcomeValue(rawOutcome);

      const updatedAtMs = toMs((data as any).updatedAt);

      const existing = out[qid];
      if (!existing || updatedAtMs >= existing.updatedAtMs) {
        out[qid] = { status, outcome, updatedAtMs };
      }
    }
  } catch (error) {
    console.error("[/api/freekick] Error fetching questionStatus by ids", error);
  }

  const clean: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }> = {};
  Object.entries(out).forEach(([qid, v]) => {
    clean[qid] = { status: v.status, outcome: v.outcome };
  });

  return clean;
}

async function loadUserPicksForQuestionIds(params: {
  uid: string;
  questionIds: Set<string>;
}): Promise<Record<string, "yes" | "no">> {
  const { uid, questionIds } = params;
  const userPicks: Record<string, "yes" | "no"> = {};
  if (!questionIds.size) return userPicks;

  try {
    const snap = await db.collection("picks").get();
    snap.forEach((docSnap) => {
      const data = docSnap.data() as { userId?: string; questionId?: string; pick?: "yes" | "no" };
      if (data.userId !== uid) return;
      if (!data.questionId) return;
      if (!questionIds.has(data.questionId)) return;
      if (data.pick !== "yes" && data.pick !== "no") return;
      userPicks[data.questionId] = data.pick;
    });
  } catch (e) {
    console.error("[/api/freekick] Error reading picks", e);
  }

  return userPicks;
}

function parseGameId(gameIdRaw: string): { roundNumber: number; gameIndex: number } | null {
  const s = String(gameIdRaw || "").trim().toUpperCase();
  // OR-G1 or R4-G6 etc
  const m = s.match(/^(OR|R(\d+))\-G(\d+)$/);
  if (!m) return null;

  const roundNumber = m[1] === "OR" ? 0 : Number(m[2]);
  const gameIndex = Number(m[3]);
  if (!Number.isFinite(roundNumber) || roundNumber < 0) return null;
  if (!Number.isFinite(gameIndex) || gameIndex < 1) return null;
  return { roundNumber, gameIndex };
}

// ─────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const uid = await getUserIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const gameId = String(body?.gameId || "").trim();
  const parsed = parseGameId(gameId);
  if (!parsed) return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });

  const { roundNumber, gameIndex } = parsed;

  // one per season per user
  const useRef = db.collection("freeKickUses").doc(`${SEASON}__${uid}`);
  const useSnap = await useRef.get();
  if (useSnap.exists) {
    return NextResponse.json({ error: "Free kick already used this season" }, { status: 409 });
  }

  const roundDoc = await getRoundDocByNumber(roundNumber);
  if (!roundDoc || !Array.isArray(roundDoc.games) || roundDoc.games.length < gameIndex) {
    return NextResponse.json({ error: "Round/game not found" }, { status: 404 });
  }

  const roundCode = getRoundCode(roundNumber);
  const gameIdComputed = `${roundCode}-G${gameIndex}`;
  if (gameIdComputed !== gameId.toUpperCase()) {
    // keep strict, but allow lower-case by normalising above
  }

  const game = roundDoc.games[gameIndex - 1];
  const questionsSrc = game?.questions ?? [];

  const questionIds = new Set<string>();
  const questionIdToQuarter: Record<string, number> = {};

  questionsSrc.forEach((q) => {
    const quarter = Number(q.quarter ?? 1);
    const questionText = String(q.question ?? "");
    const qid = stableQuestionId({ roundNumber, gameId: gameIdComputed, quarter, question: questionText });
    questionIds.add(qid);
    questionIdToQuarter[qid] = quarter;
  });

  if (!questionIds.size) {
    return NextResponse.json({ error: "No questions for this game" }, { status: 400 });
  }

  // apply overrides/outcomes
  const statusOverrides = await getQuestionStatusForQuestionIds({ roundNumber, questionIds });
  const userPicks = await loadUserPicksForQuestionIds({ uid, questionIds });

  const pickedQuestionIds = Object.keys(userPicks).filter((qid) => questionIds.has(qid));
  if (pickedQuestionIds.length === 0) {
    return NextResponse.json({ error: "No picks submitted for this game" }, { status: 400 });
  }

  // game settled for the USER = all picked questions are final/void
  const allPickedSettled = pickedQuestionIds.every((qid) => {
    const st = statusOverrides[qid]?.status;
    return st === "final" || st === "void";
  });

  if (!allPickedSettled) {
    return NextResponse.json({ error: "Game not settled yet" }, { status: 409 });
  }

  // user lost = at least 1 wrong (ignoring void)
  const anyWrong = pickedQuestionIds.some((qid) => {
    const status = statusOverrides[qid]?.status;
    const outcome = statusOverrides[qid]?.outcome;

    if (status === "void" || outcome === "void") return false;
    if (status !== "final") return false;
    if (outcome !== "yes" && outcome !== "no") return false;

    const pick = userPicks[qid];
    return pick !== outcome;
  });

  if (!anyWrong) {
    return NextResponse.json({ error: "Free kick can only be used after a loss" }, { status: 409 });
  }

  await useRef.set(
    {
      season: SEASON,
      userId: uid,
      gameId: gameIdComputed,
      roundNumber,
      gameIndex,
      usedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, season: SEASON, gameId: gameIdComputed });
}
