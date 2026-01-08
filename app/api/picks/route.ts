// /app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type JsonRow = {
  Round: string | number; // tolerant: "OR", "R1", "1", 1, ...
  Game: number;
  Match: string;
  Venue: string;
  StartTime: string; // may be slightly non-ISO ("19.30")
  Question: string;
  Quarter: number;
  Status: string; // tolerant: "Open"/"Final"/etc
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
  correctPick?: boolean | null; // true=correct, false=wrong, null=void
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

  // ✅ Torpie truth: running streak across matches (current streak), NOT best streak.
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null; // username only
};

type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
  sponsorName?: string;
  sponsorBlurb?: string;
};

type QuestionStatusDoc = {
  roundNumber?: number;
  questionId: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string;
  updatedAt?: FirebaseFirestore.Timestamp;
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
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

/**
 * ✅ tolerant round parsing
 * Accepts:
 * - "OR" => 0
 * - "R1" => 1
 * - "1"  => 1
 * - 1    => 1
 */
function parseRoundNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val) && val >= 0) return val;

  const c = String(val ?? "").trim().toUpperCase();
  if (!c) return null;

  if (c === "OR") return 0;

  if (c.startsWith("R")) {
    const n = Number(c.slice(1));
    if (Number.isFinite(n) && n >= 0) return n;
    return null;
  }

  // allow plain numeric strings e.g. "1"
  const n = Number(c);
  if (Number.isFinite(n) && n >= 0) return n;

  return null;
}

/**
 * Fix common non-ISO time "T19.30:00+11:00" -> "T19:30:00+11:00"
 * Leaves valid ISO unchanged.
 */
function sanitiseStartTime(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return s;

  // Replace ONLY the hour.minute right after the 'T'
  // Example: 2026-03-05T19.30:00+11:00 -> 2026-03-05T19:30:00+11:00
  return s.replace(/T(\d{2})\.(\d{2}):/g, "T$1:$2:");
}

function safeTimeMs(startTime: string): number {
  const fixed = sanitiseStartTime(startTime);
  const t = new Date(fixed).getTime();
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

/**
 * ✅ Round-only pick stats:
 * Only counts picks for the questionIds in this round.
 * Also returns the current user's picks (if logged in).
 */
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
    const sponsorQuestion = (data.sponsorQuestion as SponsorQuestionConfig | undefined) || undefined;

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

async function getQuestionStatusForRound(
  roundNumber: number
): Promise<Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>> {
  const temp: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }> = {};

  try {
    const snap = await db.collection("questionStatus").where("roundNumber", "==", roundNumber).get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as QuestionStatusDoc;

      if (!data.questionId || !data.status) return;

      const rawOutcome = (data.outcome as string | undefined) ?? (data.result as string | undefined);
      const outcome = normaliseOutcomeValue(rawOutcome);

      const updatedAtMs =
        data.updatedAt && typeof (data.updatedAt as any).toMillis === "function"
          ? (data.updatedAt as any).toMillis()
          : 0;

      const existing = temp[data.questionId];
      if (!existing || updatedAtMs >= existing.updatedAtMs) {
        temp[data.questionId] = { status: data.status, outcome, updatedAtMs };
      }
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching questionStatus", error);
  }

  const finalMap: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }> = {};
  Object.entries(temp).forEach(([qid, value]) => {
    finalMap[qid] = { status: value.status, outcome: value.outcome };
  });

  return finalMap;
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

/**
 * ✅ Torpie rule:
 * LeaderName MUST be username only.
 */
async function readUsername(uid: string): Promise<string | null> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;

    const data = (snap.data() as any) || {};
    const username = (data?.username as string) || "";

    const cleaned = String(username).trim();
    if (!cleaned) return null;

    return cleaned;
  } catch (e) {
    console.warn("[/api/picks] Failed to read username", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// ✅ Streak: running across games (Clean Sweep per match)
// ─────────────────────────────────────────────

function computeRunningStreakAcrossGames(games: ApiGame[], picksForUser: Record<string, "yes" | "no">): number {
  const sorted = [...games].sort((a, b) => safeTimeMs(a.startTime) - safeTimeMs(b.startTime));

  let running = 0;

  for (const g of sorted) {
    const pickedQs = (g.questions || []).filter((q) => {
      const pick = picksForUser[q.id];
      return pick === "yes" || pick === "no";
    });

    // no picks => streak unchanged
    if (pickedQs.length === 0) continue;

    // if any picked question unsettled, don't apply this game yet
    const anyUnsettled = pickedQs.some((q) => q.status !== "final" && q.status !== "void");
    if (anyUnsettled) continue;

    // if any wrong => reset to 0
    const anyWrong = pickedQs.some((q) => q.correctPick === false);
    if (anyWrong) {
      running = 0;
      continue;
    }

    // add correct only (voids are correctPick null, don't add)
    const correct = pickedQs.filter((q) => q.correctPick === true).length;
    running += correct;
  }

  return running;
}

// ─────────────────────────────────────────────
// ✅ Auto-pick “current round” if no ?round provided:
// choose the round containing the NEXT upcoming game; if none upcoming, choose latest round.
// ─────────────────────────────────────────────

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

  if (nextRow) {
    const rn = parseRoundNumber(nextRow.Round);
    return rn ?? 0;
  }

  // no future games: pick max round we have
  let max = 0;
  for (const r of rows) {
    const rn = parseRoundNumber(r.Round);
    if (rn !== null) max = Math.max(max, rn);
  }
  return max;
}

// ─────────────────────────────────────────────
// Main GET handler (AFL only)
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    const roundParam = url.searchParams.get("round");

    let roundNumber: number;
    if (roundParam === null) {
      roundNumber = autoDetectRoundNumber(Date.now());
    } else {
      const parsed = Number(roundParam);
      roundNumber = !Number.isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }

    const currentUserId = await getUserIdFromRequest(req);
    const roundCode = getRoundCode(roundNumber);

    // ✅ FIX: match rows by parsed round number (tolerant), not by string code only
    const roundRows = rows.filter((r) => parseRoundNumber(r.Round) === roundNumber);

    if (!roundRows.length) {
      const empty: PicksApiResponse = {
        games: [],
        roundNumber,
        currentStreak: 0,
        leaderScore: 0,
        leaderName: null,
      };
      return NextResponse.json(empty);
    }

    // Build stable questionIds for THIS round
    const questionIdsForRound = new Set<string>();

    // questionId generation: `${roundCode}-G${Game}-Q${index+1}` where index is per-game order of rows.
    const perGameIndex: Record<string, number> = {};
    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;
      if (perGameIndex[gameId] === undefined) perGameIndex[gameId] = 0;
      const idx = perGameIndex[gameId]++;
      const qid = `${gameId}-Q${idx + 1}`;
      questionIdsForRound.add(qid);
    }

    const sponsorConfig = await getSponsorQuestionConfig();
    const commentCounts = await getCommentCountsForRound(roundNumber);
    const statusOverrides = await getQuestionStatusForRound(roundNumber);
    const gameLocks = await getGameLocksForRound(roundCode, roundRows);

    const { pickStats, userPicks } = await getPickStatsForQuestionIds({
      questionIds: questionIdsForRound,
      currentUserId,
    });

    // Build games + questions
    const gamesById: Record<string, ApiGame> = {};
    const questionIndexByGame: Record<string, number> = {};

    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;

      if (!gamesById[gameId]) {
        gamesById[gameId] = {
          id: gameId,
          match: r.Match,
          venue: r.Venue,
          // ✅ FIX: return sanitised startTime so client parsing is stable
          startTime: sanitiseStartTime(r.StartTime),
          isUnlockedForPicks: !!gameLocks[gameId],
          questions: [],
        };
        questionIndexByGame[gameId] = 0;
      }

      const qIndex = questionIndexByGame[gameId]++;
      const questionId = `${gameId}-Q${qIndex + 1}`;

      const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
      const total = stats.total;

      const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

      const statusInfo = statusOverrides[questionId];
      const effectiveStatus = statusInfo?.status ?? normaliseStatusValue(r.Status || "Open");

      // outcome only meaningful when final/void
      const correctOutcome =
        effectiveStatus === "final" || effectiveStatus === "void" ? statusInfo?.outcome : undefined;

      const userPick = userPicks[questionId];

      // correctPick rules:
      // - void status or void outcome => null
      // - otherwise compare pick vs outcome
      let correctPick: boolean | null | undefined = undefined;
      let finalOutcome: QuestionOutcome | undefined = correctOutcome;

      if (effectiveStatus === "void" || correctOutcome === "void") {
        correctPick = null;
        finalOutcome = "void";
      } else if (effectiveStatus === "final" && finalOutcome && userPick) {
        correctPick = userPick === finalOutcome;
      }

      const isSponsorQuestion =
        !!sponsorConfig && sponsorConfig.roundNumber === roundNumber && sponsorConfig.questionId === questionId;

      const apiQuestion: ApiQuestion = {
        id: questionId,
        gameId,
        quarter: r.Quarter,
        question: r.Question,
        status: effectiveStatus,

        userPick,
        yesPercent,
        noPercent,
        commentCount: commentCounts[questionId] ?? 0,

        isSponsorQuestion,
        sponsorName: isSponsorQuestion ? sponsorConfig?.sponsorName ?? "OFFICIAL PARTNER" : undefined,
        sponsorBlurb: isSponsorQuestion ? sponsorConfig?.sponsorBlurb : undefined,

        correctOutcome: finalOutcome,
        outcome: finalOutcome,
        correctPick,
      };

      gamesById[gameId].questions.push(apiQuestion);
    }

    const games = Object.values(gamesById);

    // ✅ CURRENT user running streak (across games)
    const currentStreak = currentUserId ? computeRunningStreakAcrossGames(games, userPicks) : 0;

    // ✅ Leader running streak (across games)
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

    return NextResponse.json(response);
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
      { status: 500 }
    );
  }
}
