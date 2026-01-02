// /app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type JsonRow = {
  Round: string; // "OR", "R1", "R2", ...
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

  isSponsorQuestion?: boolean;

  // user + stats
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  // result fields
  correctOutcome?: QuestionOutcome;
  outcome?: QuestionOutcome;
  correctPick?: boolean | null; // true/false/null(void)
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

  // dashboard
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null;
};

type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
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

async function getCurrentRoundFromConfig(): Promise<number | null> {
  try {
    const snap = await db.collection("config").doc("season-2026").get();
    if (!snap.exists) return null;
    const data = snap.data() as any;

    const v =
      data?.currentRoundNumber ??
      data?.currentRound ??
      data?.roundNumber ??
      data?.round ??
      null;

    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
    return null;
  } catch (e) {
    console.warn("[/api/picks] Could not read current round from config/season-2026", e);
    return null;
  }
}

async function getSponsorQuestionConfig(): Promise<SponsorQuestionConfig | null> {
  try {
    const docRef = db.collection("config").doc("season-2026");
    const snap = await docRef.get();
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
    const snap = await db
      .collection("comments")
      .where("roundNumber", "==", roundNumber)
      .get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as { questionId?: string };
      const questionId = data.questionId;
      if (!questionId) return;
      commentCounts[questionId] = (commentCounts[questionId] ?? 0) + 1;
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching comments", error);
  }
  return commentCounts;
}

async function getQuestionStatusForRound(
  roundNumber: number
): Promise<Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>> {
  const temp: Record<
    string,
    { status: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }
  > = {};

  try {
    const snap = await db
      .collection("questionStatus")
      .where("roundNumber", "==", roundNumber)
      .get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as QuestionStatusDoc;
      if (!data.questionId || !data.status) return;

      const rawOutcome =
        (data.outcome as string | undefined) ??
        (data.result as string | undefined);

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

async function getGameLocksForRound(
  roundCode: string,
  roundRows: JsonRow[]
): Promise<Record<string, boolean>> {
  // Default should be true (safer) unless a lock doc overrides it.
  const map: Record<string, boolean> = {};
  const gameIds = Array.from(new Set(roundRows.map((row) => `${roundCode}-G${row.Game}`)));
  if (!gameIds.length) return map;

  // Firestore "in" supports up to 10 items.
  const chunks: string[][] = [];
  for (let i = 0; i < gameIds.length; i += 10) chunks.push(gameIds.slice(i, i + 10));

  try {
    for (const chunk of chunks) {
      const snap = await db.collection("gameLocks").where("gameId", "in", chunk).get();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as GameLockDoc;
        if (!data.gameId) return;
        map[data.gameId] = data.isUnlockedForPicks !== false; // true unless explicitly false
      });
    }
  } catch (error) {
    console.error("[/api/picks] Error fetching gameLocks", error);
  }

  return map;
}

function computeMatchStreak(game: ApiGame, picksForUser: Record<string, "yes" | "no">): number {
  let correctCount = 0;

  for (const q of game.questions || []) {
    const pick = picksForUser[q.id];
    if (!pick) continue;

    const status = q.status;
    const outcome = (q.correctOutcome ?? q.outcome) as QuestionOutcome | undefined;

    // only settled questions affect streak
    if (status !== "final" && status !== "void") continue;

    // voids don't count
    if (status === "void" || outcome === "void" || !outcome) continue;

    if (pick === outcome) {
      correctCount += 1;
      continue;
    }

    // ❌ any wrong = match streak becomes 0 (Clean Sweep)
    return 0;
  }

  return correctCount;
}

function computeBestStreakAcrossGames(
  games: ApiGame[],
  picksForUser: Record<string, "yes" | "no">
): number {
  let best = 0;
  for (const g of games) {
    best = Math.max(best, computeMatchStreak(g, picksForUser));
  }
  return best;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * ✅ Round-scoped pick stats + user picks
 * Only counts picks for the questionIds in THIS round.
 * Uses chunked "in" queries.
 */
async function getPickStatsForQuestionIds(params: {
  questionIds: string[];
  currentUserId: string | null;
}): Promise<{
  pickStats: Record<string, { yes: number; no: number; total: number }>;
  userPicks: Record<string, "yes" | "no">;
  picksByUser: Record<string, Record<string, "yes" | "no">>;
}> {
  const { questionIds, currentUserId } = params;

  const pickStats: Record<string, { yes: number; no: number; total: number }> = {};
  const userPicks: Record<string, "yes" | "no"> = {};
  const picksByUser: Record<string, Record<string, "yes" | "no">> = {};

  if (!questionIds.length) return { pickStats, userPicks, picksByUser };

  try {
    const chunks = chunkArray(questionIds, 10);

    for (const chunk of chunks) {
      const snap = await db.collection("picks").where("questionId", "in", chunk).get();

      snap.forEach((docSnap) => {
        const data = docSnap.data() as {
          userId?: string;
          questionId?: string;
          pick?: "yes" | "no";
        };

        const qid = data.questionId;
        const pick = data.pick;
        const uid = data.userId;

        if (!qid || !uid) return;
        if (pick !== "yes" && pick !== "no") return;

        if (!pickStats[qid]) pickStats[qid] = { yes: 0, no: 0, total: 0 };
        pickStats[qid][pick] += 1;
        pickStats[qid].total += 1;

        if (!picksByUser[uid]) picksByUser[uid] = {};
        picksByUser[uid][qid] = pick;

        if (currentUserId && uid === currentUserId) {
          userPicks[qid] = pick;
        }
      });
    }
  } catch (e) {
    console.error("[/api/picks] Error fetching picks for questionIds", e);
  }

  return { pickStats, userPicks, picksByUser };
}

async function getLeaderNameByUid(uid: string | null): Promise<string | null> {
  if (!uid) return null;
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;

    const firstName = (data.firstName as string) || "";
    const surname = (data.surname as string) || "";
    const username = (data.username as string) || "";
    const display =
      (firstName || surname)
        ? `${firstName} ${surname}`.trim()
        : (username || "Player");

    return display || null;
  } catch (e) {
    console.warn("[/api/picks] Failed to get leader name", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Main GET handler (AFL only)
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    // round selection: explicit param OR config fallback
    const roundParam = url.searchParams.get("round");
    let roundNumber: number | null = null;

    if (roundParam !== null) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) roundNumber = parsed;
    }

    if (roundNumber === null) {
      const fromConfig = await getCurrentRoundFromConfig();
      roundNumber = fromConfig ?? 0;
    }

    const currentUserId = await getUserIdFromRequest(req);

    const roundCode = getRoundCode(roundNumber);
    const roundRows = rows.filter((row) => row.Round === roundCode);

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

    // Build deterministic game/question IDs + collect questionIds
    const gamesByKey: Record<string, ApiGame> = {};
    const questionIndexByGame: Record<string, number> = {};
    const questionIds: string[] = [];

    for (const row of roundRows) {
      const gameKey = `${roundCode}-G${row.Game}`;

      if (!gamesByKey[gameKey]) {
        gamesByKey[gameKey] = {
          id: gameKey,
          match: row.Match,
          venue: row.Venue,
          startTime: row.StartTime,
          isUnlockedForPicks: true, // default true (safe)
          questions: [],
        };
        questionIndexByGame[gameKey] = 0;
      }

      const qIndex = questionIndexByGame[gameKey]++;
      const questionId = `${gameKey}-Q${qIndex + 1}`;
      questionIds.push(questionId);

      // We'll fill stats/userPick/status/outcome after we fetch round-scoped data.
      gamesByKey[gameKey].questions.push({
        id: questionId,
        gameId: gameKey,
        quarter: row.Quarter,
        question: row.Question,
        status: normaliseStatusValue(row.Status || "Open"),
        yesPercent: 0,
        noPercent: 0,
        commentCount: 0,
      });
    }

    // Fetch restored extras
    const sponsorConfig = await getSponsorQuestionConfig();
    const commentCounts = await getCommentCountsForRound(roundNumber);
    const statusOverrides = await getQuestionStatusForRound(roundNumber);
    const gameLocks = await getGameLocksForRound(roundCode, roundRows);

    // Apply gameLocks (default true unless explicitly false)
    Object.values(gamesByKey).forEach((g) => {
      const v = gameLocks[g.id];
      g.isUnlockedForPicks = v !== undefined ? v : true;
    });

    // Round-scoped pick stats + user picks + picksByUser
    const { pickStats, userPicks, picksByUser } = await getPickStatsForQuestionIds({
      questionIds,
      currentUserId,
    });

    // Enrich questions with status/outcome + stats + comments + sponsor + userPick + correctPick
    for (const g of Object.values(gamesByKey)) {
      g.questions = g.questions.map((q) => {
        const stats = pickStats[q.id] ?? { yes: 0, no: 0, total: 0 };
        const total = stats.total;
        const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
        const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

        const statusInfo = statusOverrides[q.id];
        const effectiveStatus = statusInfo?.status ?? q.status;

        const rawOutcome = statusInfo?.outcome;
        const correctOutcome =
          effectiveStatus === "final" || effectiveStatus === "void" ? rawOutcome : undefined;

        const isSponsorQuestion =
          sponsorConfig &&
          sponsorConfig.roundNumber === roundNumber &&
          sponsorConfig.questionId === q.id;

        const userPick = userPicks[q.id];

        let correctPick: boolean | null = null;
        if (correctOutcome && userPick) {
          if (correctOutcome === "void") correctPick = null;
          else correctPick = userPick === correctOutcome;
        }

        return {
          ...q,
          status: effectiveStatus,
          isSponsorQuestion: !!isSponsorQuestion,
          userPick,
          yesPercent,
          noPercent,
          commentCount: commentCounts[q.id] ?? 0,
          correctOutcome,
          outcome: correctOutcome,
          correctPick,
        };
      });
    }

    const games = Object.values(gamesByKey);

    // ✅ streaks are automatically per-round because games/questions are per round
    const currentStreak = currentUserId ? computeBestStreakAcrossGames(games, userPicks) : 0;

    // Leader across users for THIS round’s questionIds
    let leaderScore = 0;
    let leaderUid: string | null = null;

    for (const uid of Object.keys(picksByUser)) {
      const score = computeBestStreakAcrossGames(games, picksByUser[uid]);
      if (score > leaderScore) {
        leaderScore = score;
        leaderUid = uid;
      }
    }

    const leaderName = await getLeaderNameByUid(leaderUid);

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
