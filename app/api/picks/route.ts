// /app/api/picks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

// If Next/Vercel ever complains about DYNAMIC_SERVER_USAGE, uncomment this:
// export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type QuestionStatus = "open" | "final" | "pending" | "void";

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
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
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
  roundNumber: number | string | null;
  questionId: string;
  status: QuestionStatus;
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
      (data.sponsorQuestion as SponsorQuestionConfig | undefined) ??
      null;
    if (!sponsorQuestion || !sponsorQuestion.questionId) return null;

    return sponsorQuestion;
  } catch (error) {
    console.error("[/api/picks] Error fetching sponsorQuestion config", error);
    return null;
  }
}

async function getPickStatsForRound(
  roundNumber: number,
  currentUserId: string | null
): Promise<{
  pickStats: Record<string, { yes: number; no: number; total: number }>;
  userPicks: Record<string, "yes" | "no">;
}> {
  const pickStats: Record<
    string,
    { yes: number; no: number; total: number }
  > = {};
  const userPicks: Record<string, "yes" | "no"> = {};

  try {
    const snap = await db
      .collection("picks")
      .where("roundNumber", "==", roundNumber)
      .get();

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
 * Question status overrides stored in `questionStatus`.
 * We used to filter by `roundNumber` in the query; instead we now
 * load all docs and match in code, tolerating number vs string.
 */
async function getQuestionStatusForRound(
  roundNumber: number
): Promise<Record<string, QuestionStatus>> {
  const map: Record<string, QuestionStatus> = {};
  const rnStr = String(roundNumber);

  try {
    const snap = await db.collection("questionStatus").get();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as QuestionStatusDoc;
      const qid = data.questionId;
      if (!qid) return;

      const rn = data.roundNumber;
      const rnMatches =
        rn === roundNumber || String(rn) === rnStr || rn === null;

      if (!rnMatches) return;

      const rawStatus = (data.status || "open") as QuestionStatus;
      let status: QuestionStatus;
      switch (rawStatus) {
        case "pending":
        case "final":
        case "void":
        case "open":
          status = rawStatus;
          break;
        default:
          status = "open";
      }

      map[qid] = status;
    });

    console.log(
      "[/api/picks] questionStatus overrides for round",
      roundNumber,
      Object.keys(map)
    );
  } catch (error) {
    console.error("[/api/picks] Error fetching questionStatus", error);
  }

  return map;
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

    // 6) Status overrides from questionStatus
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

      const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

      const isSponsorQuestion =
        sponsorConfig &&
        sponsorConfig.roundNumber === roundNumber &&
        sponsorConfig.questionId === questionId;

      const jsonStatusRaw = row.Status || "Open";
      const jsonStatus = jsonStatusRaw.toLowerCase() as QuestionStatus;
      const dbStatus = statusOverrides[questionId];
      const effectiveStatus = dbStatus ?? jsonStatus;

      const apiQuestion: ApiQuestion = {
        id: questionId,
        quarter: row.Quarter,
        question: row.Question,
        status: effectiveStatus,
        sport: "AFL",
        isSponsorQuestion: !!isSponsorQuestion,
        userPick: userPicks[questionId],
        yesPercent,
        noPercent,
        commentCount: commentCounts[questionId] ?? 0,
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
