// /app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type JsonRow = {
  Round: string | number;
  Game: number;
  Match: string;
  Venue: string;
  StartTime: string;
  Question: string;
  Quarter: number;
  Status: string;
};

type ApiQuestion = {
  id: string;
  gameId: string;
  quarter: number;
  question: string;
  status: QuestionStatus;

  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorBlurb?: string;

  correctOutcome?: QuestionOutcome;
  outcome?: QuestionOutcome;
  correctPick?: boolean | null;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  isUnlockedForPicks?: boolean;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null;
};

type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
  sponsorName?: string;
  sponsorBlurb?: string;
};

type QuestionStatusDoc = {
  roundNumber?: number;
  questionId?: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string;
  updatedAt?: FirebaseFirestore.Timestamp | any;
};

type GameLockDoc = {
  roundNumber?: number;
  gameId: string;
  isUnlockedForPicks?: boolean;
  updatedAt?: FirebaseFirestore.Timestamp;
};

const rows: JsonRow[] = rounds2026 as JsonRow[];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getRoundCode(roundNumber: number): string {
  return roundNumber === 0 ? "OR" : `R${roundNumber}`;
}

function parseRoundNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val) && val >= 0) return val;

  const c = String(val ?? "").trim().toUpperCase();
  if (!c) return null;
  if (c === "OR") return 0;

  if (c.startsWith("R")) {
    const n = Number(c.slice(1));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const n = Number(c);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function sanitiseStartTime(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return s;
  return s.replace(/T(\d{2})\.(\d{2}):/g, "T$1:$2:");
}

function safeTimeMs(startTime: string): number {
  const t = new Date(sanitiseStartTime(startTime)).getTime();
  return Number.isFinite(t) ? t : NaN;
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

function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return undefined;
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (error) {
    console.error("[/api/picks] Failed to verify ID token", error);
    return null;
  }
}

// ─────────────────────────────────────────────
// ✅ Stable questionId (keep your approach)
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

// ─────────────────────────────────────────────
// Firestore reads
// ─────────────────────────────────────────────

async function getPickStatsForQuestionIds(params: {
  questionIds: Set<string>;
  currentUserId: string | null;
}): Promise<{
  pickStats: Record<string, { yes: number; no: number; total: number }>;
  userPicks: Record<string, "yes" | "no">;
}> {
  const { questionIds, currentUserId } = params;

  const pickStats: Record<string, { yes: number; no: number; total: number }> = {};
  const userPicks: Record<string, "yes" | "no"> = {};

  if (!questionIds.size) return { pickStats, userPicks };

  try {
    const snap = await db.collection("picks").get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as {
        userId?: string;
        questionId?: string;
        pick?: "yes" | "no";
      };

      const qid = data.questionId;
      const pick = data.pick;

      if (!qid || (pick !== "yes" && pick !== "no")) return;
      if (!questionIds.has(qid)) return;

      if (!pickStats[qid]) pickStats[qid] = { yes: 0, no: 0, total: 0 };
      pickStats[qid][pick] += 1;
      pickStats[qid].total += 1;

      if (currentUserId && data.userId === currentUserId) {
        userPicks[qid] = pick;
      }
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching picks", error);
  }

  return { pickStats, userPicks };
}

async function getSponsorQuestionConfig(): Promise<SponsorQuestionConfig | null> {
  try {
    const snap = await db.collection("config").doc("season-2026").get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    const sponsorQuestion =
      (data.sponsorQuestion as SponsorQuestionConfig | undefined) || undefined;

    if (!sponsorQuestion || !sponsorQuestion.questionId) return null;
    return sponsorQuestion;
  } catch (error) {
    console.error("[/api/picks] Error fetching sponsorQuestion config", error);
    return null;
  }
}

async function getCommentCountsForRound(roundNumber: number): Promise<Record<string, number>> {
  const commentCounts: Record<string, number> = {};

  try {
    const snap = await db.collection("comments").where("roundNumber", "==", roundNumber).get();
    snap.forEach((docSnap) => {
      const data = docSnap.data() as { questionId?: string };
      const qid = data.questionId;
      if (!qid) return;
      commentCounts[qid] = (commentCounts[qid] ?? 0) + 1;
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching comments", error);
  }

  return commentCounts;
}

function questionStatusDocId(roundNumber: number, questionId: string) {
  // ✅ MUST match /app/api/settlement/route.ts
  return `${roundNumber}__${questionId}`;
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  const d = ts instanceof Date ? ts : new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * ✅ FIXED: read the correct docs (roundNumber__questionId)
 * and map them back to questionId.
 *
 * Also: if multiple docs ever exist, we pick the newest by updatedAt.
 */
async function getQuestionStatusForQuestionIds(params: {
  roundNumber: number;
  questionIds: Set<string>;
}): Promise<Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>> {
  const { roundNumber, questionIds } = params;
  const out: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }> = {};

  const ids = Array.from(questionIds);
  if (!ids.length) return {};

  const refs = ids.map((qid) =>
    db.collection("questionStatus").doc(questionStatusDocId(roundNumber, qid))
  );

  try {
    // @ts-ignore admin supports getAll
    const snaps: FirebaseFirestore.DocumentSnapshot[] = await db.getAll(...refs);

    for (const snap of snaps) {
      if (!snap.exists) continue;

      const data = (snap.data() as QuestionStatusDoc) || {};

      // Primary key is the questionId stored in doc; fallback: parse from docId
      const qid =
        (typeof data.questionId === "string" && data.questionId) ||
        snap.id.split("__").slice(1).join("__"); // safe even if questionId contains "__" (unlikely)

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
    console.error("[/api/picks] Error fetching questionStatus by ids", error);
  }

  // Strip updatedAtMs for return type
  const clean: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }> = {};
  Object.entries(out).forEach(([qid, v]) => {
    clean[qid] = { status: v.status, outcome: v.outcome };
  });

  return clean;
}

async function getGameLocksForRound(roundCode: string, roundRows: JsonRow[]): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  const gameIds = Array.from(new Set(roundRows.map((r) => `${roundCode}-G${r.Game}`)));
  if (!gameIds.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < gameIds.length; i += 10) chunks.push(gameIds.slice(i, i + 10));

  try {
    for (const chunk of chunks) {
      const snap = await db.collection("gameLocks").where("gameId", "in", chunk).get();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as GameLockDoc;
        if (!data.gameId) return;
        map[data.gameId] = !!data.isUnlockedForPicks;
      });
    }
  } catch (error) {
    console.error("[/api/picks] Error fetching gameLocks", error);
  }

  return map;
}

async function loadPicksByUserForQuestionIds(
  questionIds: Set<string>
): Promise<Record<string, Record<string, "yes" | "no">>> {
  const out: Record<string, Record<string, "yes" | "no">> = {};
  if (!questionIds.size) return out;

  try {
    const snap = await db.collection("picks").get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as {
        userId?: string;
        questionId?: string;
        pick?: "yes" | "no";
      };

      if (!data.userId || !data.questionId) return;
      if (data.pick !== "yes" && data.pick !== "no") return;
      if (!questionIds.has(data.questionId)) return;

      if (!out[data.userId]) out[data.userId] = {};
      out[data.userId][data.questionId] = data.pick;
    });
  } catch (e) {
    console.error("[/api/picks] Error building picksByUser map", e);
  }

  return out;
}

async function readUsername(uid: string): Promise<string | null> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;

    const data = (snap.data() as any) || {};
    const username = (data?.username as string) || "";
    const cleaned = String(username).trim();
    return cleaned ? cleaned : null;
  } catch (e) {
    console.warn("[/api/picks] Failed to read username", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Streak
// ─────────────────────────────────────────────

function computeRunningStreakAcrossGames(
  games: ApiGame[],
  picksForUser: Record<string, "yes" | "no">
): number {
  const sorted = [...games].sort((a, b) => safeTimeMs(a.startTime) - safeTimeMs(b.startTime));
  let running = 0;

  for (const g of sorted) {
    const pickedQs = (g.questions || []).filter((q) => {
      const pick = picksForUser[q.id];
      return pick === "yes" || pick === "no";
    });

    if (pickedQs.length === 0) continue;

    const anyUnsettled = pickedQs.some((q) => q.status !== "final" && q.status !== "void");
    if (anyUnsettled) continue;

    const anyWrong = pickedQs.some((q) => q.correctPick === false);
    if (anyWrong) {
      running = 0;
      continue;
    }

    const correct = pickedQs.filter((q) => q.correctPick === true).length;
    running += correct;
  }

  return running;
}

function autoDetectRoundNumber(nowMs: number): number {
  let nextRow: JsonRow | null = null;
  let nextMs = Infinity;

  for (const r of rows) {
    const t = safeTimeMs(r.StartTime);
    if (!Number.isFinite(t)) continue;

    if (t >= nowMs && t < nextMs) {
      nextMs = t;
      nextRow = r;
    }
  }

  if (nextRow) return parseRoundNumber(nextRow.Round) ?? 0;

  let max = 0;
  for (const r of rows) {
    const rn = parseRoundNumber(r.Round);
    if (rn !== null) max = Math.max(max, rn);
  }
  return max;
}

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    let roundNumber: number;
    if (roundParam === null) roundNumber = autoDetectRoundNumber(Date.now());
    else {
      const parsed = Number(roundParam);
      roundNumber = !Number.isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }

    const currentUserId = await getUserIdFromRequest(req);
    const roundCode = getRoundCode(roundNumber);

    const roundRows = rows.filter((r) => parseRoundNumber(r.Round) === roundNumber);

    if (!roundRows.length) {
      const empty: PicksApiResponse = {
        games: [],
        roundNumber,
        currentStreak: 0,
        leaderScore: 0,
        leaderName: null,
      };
      return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
    }

    const sponsorConfig = await getSponsorQuestionConfig();
    const commentCounts = await getCommentCountsForRound(roundNumber);

    // Build stable questionIds for the round
    const questionIdsForRound = new Set<string>();
    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;
      questionIdsForRound.add(
        stableQuestionId({
          roundNumber,
          gameId,
          quarter: Number(r.Quarter ?? 1),
          question: String(r.Question ?? ""),
        })
      );
    }

    // ✅ FIX: read overrides from questionStatus/{round__qid}
    const statusOverrides = await getQuestionStatusForQuestionIds({
      roundNumber,
      questionIds: questionIdsForRound,
    });

    const gameLocks = await getGameLocksForRound(roundCode, roundRows);

    const { pickStats, userPicks } = await getPickStatsForQuestionIds({
      questionIds: questionIdsForRound,
      currentUserId,
    });

    const gamesById: Record<string, ApiGame> = {};

    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;

      if (!gamesById[gameId]) {
        gamesById[gameId] = {
          id: gameId,
          match: r.Match,
          venue: r.Venue,
          startTime: sanitiseStartTime(r.StartTime),
          isUnlockedForPicks: !!gameLocks[gameId],
          questions: [],
        };
      }

      const questionId = stableQuestionId({
        roundNumber,
        gameId,
        quarter: Number(r.Quarter ?? 1),
        question: String(r.Question ?? ""),
      });

      const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
      const total = stats.total;
      const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

      const statusInfo = statusOverrides[questionId];

      const effectiveStatus: QuestionStatus =
        statusInfo?.status ?? normaliseStatusValue(r.Status || "Open");

      // Only meaningful if settled
      const effectiveOutcome =
        effectiveStatus === "final" || effectiveStatus === "void" ? statusInfo?.outcome : undefined;

      const userPick = userPicks[questionId];

      let correctPick: boolean | null | undefined = undefined;
      let finalOutcome: QuestionOutcome | undefined = effectiveOutcome;

      if (effectiveStatus === "void" || finalOutcome === "void") {
        correctPick = null;
        finalOutcome = "void";
      } else if (effectiveStatus === "final" && finalOutcome && userPick) {
        correctPick = userPick === finalOutcome;
      }

      const isSponsorQuestion =
        !!sponsorConfig &&
        sponsorConfig.roundNumber === roundNumber &&
        sponsorConfig.questionId === questionId;

      gamesById[gameId].questions.push({
        id: questionId,
        gameId,
        quarter: Number(r.Quarter ?? 1),
        question: String(r.Question ?? ""),
        status: effectiveStatus,

        userPick,
        yesPercent,
        noPercent,
        commentCount: commentCounts[questionId] ?? 0,

        isSponsorQuestion,
        sponsorName: isSponsorQuestion
          ? sponsorConfig?.sponsorName ?? "OFFICIAL PARTNER"
          : undefined,
        sponsorBlurb: isSponsorQuestion ? sponsorConfig?.sponsorBlurb : undefined,

        correctOutcome: finalOutcome,
        outcome: finalOutcome,
        correctPick,
      });
    }

    const games: ApiGame[] = Object.values(gamesById)
      .sort((a, b) => safeTimeMs(a.startTime) - safeTimeMs(b.startTime))
      .map((g) => ({
        ...g,
        questions: [...g.questions].sort(
          (a, b) => a.quarter - b.quarter || a.question.localeCompare(b.question)
        ),
      }));

    const currentStreak = currentUserId ? computeRunningStreakAcrossGames(games, userPicks) : 0;

    let leaderScore = 0;
    let leaderUid: string | null = null;

    const picksByUser = await loadPicksByUserForQuestionIds(questionIdsForRound);

    for (const uid of Object.keys(picksByUser)) {
      const score = computeRunningStreakAcrossGames(games, picksByUser[uid]);
      if (score > leaderScore) {
        leaderScore = score;
        leaderUid = uid;
      }
    }

    const leaderName = leaderUid ? await readUsername(leaderUid) : null;

    const response: PicksApiResponse = {
      games,
      roundNumber,
      currentStreak,
      leaderScore,
      leaderName,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("[/api/picks] Unexpected error", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        games: [],
        roundNumber: 0,
        currentStreak: 0,
        leaderScore: 0,
        leaderName: null,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
