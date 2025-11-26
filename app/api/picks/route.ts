// /app/api/picks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type QuestionStatus = "open" | "final" | "pending" | "void";

// This matches the flat rows in rounds-2026.json
type JsonRow = {
  Round: string;      // e.g. "OR", "R1", "R2"
  Game: number;       // 1, 2, 3...
  Match: string;      // "Sydney vs Carlton"
  Venue: string;      // "SCG, Sydney"
  StartTime: string;  // ISO-ish string
  Question: string;
  Quarter: number;
  Status: string;     // "Open" | "Final"...
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

// Coerce raw JSON to array of rows
const rows: JsonRow[] = rounds2026 as JsonRow[];

// Map numeric roundNumber (used in Firestore) → string code used in JSON
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
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

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
    const configDocRef = db.collection("config").doc("season-2026");
    const snap = await configDocRef.get();

    if (!snap.exists) return null;

    const data = snap.data() || {};
    const sponsorQuestion = data.sponsorQuestion as SponsorQuestionConfig | undefined;

    if (!sponsorQuestion || !sponsorQuestion.questionId) {
      return null;
    }

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
  const pickStats: Record<string, { yes: number; no: number; total: number }> = {};
  const userPicks: Record<string, "yes" | "no"> = {};

  try {
    const picksQuery = db
      .collection("picks")
      .where("roundNumber", "==", roundNumber);

    const picksSnap = await picksQuery.get();

    picksSnap.forEach((docSnap) => {
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
    const commentsQuery = db
      .collection("comments")
      .where("roundNumber", "==", roundNumber);

    const commentsSnap = await commentsQuery.get();

    commentsSnap.forEach((docSnap) => {
      const data = docSnap.data() as {
        questionId?: string;
      };

      const questionId = data.questionId;
      if (!questionId) return;

      commentCounts[questionId] = (commentCounts[questionId] ?? 0) + 1;
    });
  } catch (error) {
    console.error("[/api/picks] Error fetching comment counts", error);
  }

  return commentCounts;
}

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1) Determine round number (?round=0, ?round=1, etc.)
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    let roundNumber: number | null = null;

    if (roundParam) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        roundNumber = parsed;
      }
    }

    // Default to Opening Round (0) if nothing provided
    if (roundNumber === null) {
      roundNumber = 0;
    }

    const roundCode = getRoundCode(roundNumber);

    // 2) Filter JSON rows for this round
    const roundRows = rows.filter((row) => row.Round === roundCode);

    if (!roundRows.length) {
      const emptyResponse: PicksApiResponse = {
        games: [],
        roundNumber,
      };
      return NextResponse.json(emptyResponse);
    }

    // 3) Current user
    const currentUserId = await getUserIdFromRequest(req);

    // 4) Sponsor config
    const sponsorConfig = await getSponsorQuestionConfig();

    // 5) Picks + user picks
    const { pickStats, userPicks } = await getPickStatsForRound(
      roundNumber,
      currentUserId
    );

    // 6) Comment counts
    const commentCounts = await getCommentCountsForRound(roundNumber);

    // 7) Group rows into games, build questions
    const gamesByKey: Record<string, ApiGame> = {};
    const questionIndexByGame: Record<string, number> = {};

    for (const row of roundRows) {
      const gameKey = `${roundCode}-G${row.Game}`;

      if (!gamesByKey[gameKey]) {
        gamesByKey[gameKey] = {
          id: gameKey,
          match: row.Match,
          sport: "AFL",         // All AFL for this JSON
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

      const statusLower = row.Status.toLowerCase() as QuestionStatus;

      const apiQuestion: ApiQuestion = {
        id: questionId,
        quarter: row.Quarter,
        question: row.Question,
        status: statusLower,
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

    const responseBody: PicksApiResponse = {
      games,
      roundNumber,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[/api/picks] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error", games: [], roundNumber: 0 },
      { status: 500 }
    );
  }
}
