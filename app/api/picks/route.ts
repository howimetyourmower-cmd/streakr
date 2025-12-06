// /app/api/picks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

// This matches the flat JSON rows in rounds-2026.json
type JsonRow = {
  Round: string; // "OR", "R1", "R2", ...
  Game: number; // 1, 2, 3...
  Match: string; // "Sydney vs Carlton"
  Venue: string; // "SCG, Sydney"
  StartTime: string; // "2026-03-05T19:30:00+11:00"
  Question: string;
  Quarter: number;
  Status: string; // "Open", "Final", "Pending", "Void"
};

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;

  // user data
  userPick?: "yes" | "no";

  // crowd stats
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  // settlement data
  correctOutcome?: QuestionOutcome;       // result of the question
  outcome?: QuestionOutcome;             // duplicate for backwards compat
  correctPick?: boolean | null;          // did CURRENT user get it right?
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
};

type QuestionStatusDoc = {
  roundNumber: number;
  questionId: string;
  status: QuestionStatus;
  outcome?: QuestionOutcome | "lock";
  updatedAt?: FirebaseFirestore.Timestamp;
};

// Coerce raw JSON to array of rows
const rows: JsonRow[] = rounds2026 as JsonRow[];

// Map numeric roundNumber (used in Firestore & URL) → code used in JSON
// 0 -> "OR" (Opening Round), 1 -> "R1", 2 -> "R2", etc.
function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

// ─────────────────────────────────────────────
// Helper functions
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
    console.error("[/api/picks] Failed to verify ID token", error);
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

/**
 * Get pick stats for all questions.
 *
 * We deliberately do NOT filter by roundNumber here, because questionId
 * is globally unique (e.g. "OR-G1-Q1") and some picks may be missing
 * or have mismatched roundNumber. Using questionId only is safest.
 */
async function getPickStatsForRound(
  _roundNumber: number,
  currentUserId: string | null
): Promise<{
  pickStats: Record<string, { yes: number; no: number; total: number }>;
  userPicks: Record<string, "yes" | "no">;
}> {
  const pickStats: Record<string, { yes: number; no: number; total: number }> =
    {};
  const userPicks: Record<string, "yes" | "no"> = {};

  try {
    const snap = await db.collection("picks").get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as {
        userId?: string;
        roundNumber?: number;
        questionId?: string;
        pick?: "yes" | "no";
      };

      const questionId = data.questionId;
      const pick = data.pick;
      if (!questionId || (pick !== "yes" && pick !== "no")) return;

      if (!pickStats[questionId]) {
        pickStats[questionId] = { yes: 0, no: 0, total: 0 };
      }

      pickStats[questionId][pick] += 1;
      pickStats[questionId].total += 1;

      if (currentUserId && data.userId === currentUserId) {
        userPicks[questionId] = pick;
      }
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching picks", error);
  }

  return { pickStats, userPicks };
}

async function getCommentCountsForRound(
  roundNumber: number
): Promise<Record<string, number>> {
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

/**
 * Read questionStatus, but if multiple docs exist for the same questionId,
 * we ALWAYS use the one with the latest updatedAt.
 */
async function getQuestionStatusForRound(
  roundNumber: number
): Promise<
  Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>
> {
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

      let outcome: QuestionOutcome | undefined;
      if (
        data.outcome === "yes" ||
        data.outcome === "no" ||
        data.outcome === "void"
      ) {
        outcome = data.outcome;
      }

      const updatedAtMs =
        data.updatedAt &&
        typeof (data.updatedAt as any).toMillis === "function"
          ? (data.updatedAt as any).toMillis()
          : 0;

      const existing = temp[data.questionId];

      if (!existing || updatedAtMs >= existing.updatedAtMs) {
        temp[data.questionId] = {
          status: data.status,
          outcome,
          updatedAtMs,
        };
      }
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching questionStatus", error);
  }

  const finalMap: Record<
    string,
    { status: QuestionStatus; outcome?: QuestionOutcome }
  > = {};

  Object.entries(temp).forEach(([qid, value]) => {
    finalMap[qid] = {
      status: value.status,
      outcome: value.outcome,
    };
  });

  return finalMap;
}

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1) Determine round number (?round=0, ?round=1, ...)
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    let roundNumber: number | null = null;
    if (roundParam !== null) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        roundNumber = parsed;
      }
    }

    // Default: Opening Round (0)
    if (roundNumber === null) {
      roundNumber = 0;
    }

    const roundCode = getRoundCode(roundNumber);

    // 2) Filter JSON rows for this round
    const roundRows = rows.filter((row) => row.Round === roundCode);

    if (!roundRows.length) {
      const empty: PicksApiResponse = { games: [], roundNumber };
      return NextResponse.json(empty);
    }

    // 3) Identify user (for userPick)
    const currentUserId = await getUserIdFromRequest(req);

    // 4) Sponsor config
    const sponsorConfig = await getSponsorQuestionConfig();

    // 5) Stats & comments
    const { pickStats, userPicks } = await getPickStatsForRound(
      roundNumber,
      currentUserId
    );
    const commentCounts = await getCommentCountsForRound(roundNumber);

    // 6) Status overrides + outcomes from questionStatus
    const statusOverrides = await getQuestionStatusForRound(roundNumber);

    // 7) Group rows into games and build final API shape
    const gamesByKey: Record<string, ApiGame> = {};
    const questionIndexByGame: Record<string, number> = {};

    for (const row of roundRows) {
      const gameKey = `${roundCode}-G${row.Game}`;

      if (!gamesByKey[gameKey]) {
        gamesByKey[gameKey] = {
          id: gameKey,
          match: row.Match,
          sport: "AFL",
          venue: row.Venue,
          startTime: row.StartTime,
          questions: [],
        };
        questionIndexByGame[gameKey] = 0;
      }

      const qIndex = questionIndexByGame[gameKey]++;
      const questionId = `${gameKey}-Q${qIndex + 1}`;

      const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
      const total = stats.total;

      const yesPercent =
        total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent =
        total > 0 ? Math.round((stats.no / total) * 100) : 0;

      const isSponsorQuestion =
        sponsorConfig &&
        sponsorConfig.roundNumber === roundNumber &&
        sponsorConfig.questionId === questionId;

      const statusInfo = statusOverrides[questionId];

      const jsonStatusRaw = row.Status || "Open";
      const jsonStatus = jsonStatusRaw.toLowerCase() as QuestionStatus;

      const effectiveStatus = statusInfo?.status ?? jsonStatus;
      const correctOutcome = statusInfo?.outcome;

      const userPick = userPicks[questionId];

      let correctPick: boolean | null = null;
      if (correctOutcome && userPick) {
        correctPick = userPick === correctOutcome;
      }

      const apiQuestion: ApiQuestion = {
        id: questionId,
        quarter: row.Quarter,
        question: row.Question,
        status: effectiveStatus,
        sport: "AFL",
        isSponsorQuestion: !!isSponsorQuestion,
        userPick,
        yesPercent,
        noPercent,
        commentCount: commentCounts[questionId] ?? 0,
        correctOutcome,
        outcome: correctOutcome, // backwards compatibility
        correctPick,
      };

      gamesByKey[gameKey].questions.push(apiQuestion);
    }

    const games = Object.values(gamesByKey);

    const response: PicksApiResponse = {
      games,
      roundNumber,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/picks] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error", games: [], roundNumber: 0 },
      { status: 500 }
    );
  }
}
