// /app/api/picks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin"; // ✅ use your existing admin.ts
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";

type JsonQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport?: string;
};

type JsonGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  questions: JsonQuestion[];
};

type JsonRound = {
  roundNumber: number;
  games: JsonGame[];
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

// ---- Helpers ----

// Normalise JSON in case it's either an array or { rounds: [...] }
const allRounds: JsonRound[] = Array.isArray((rounds2026 as any).rounds)
  ? ((rounds2026 as any).rounds as JsonRound[])
  : (rounds2026 as JsonRound[]);

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken); // ✅ use admin.ts auth
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

// ---- Main handler ----

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1) Figure out which round to load
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    let roundNumber: number | null = null;

    if (roundParam) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed > 0) {
        roundNumber = parsed;
      }
    }

    // Default to Round 1 if not specified
    if (!roundNumber) {
      roundNumber = 1;
    }

    // 2) Load the round from JSON
    const jsonRound = allRounds.find((r) => r.roundNumber === roundNumber);

    if (!jsonRound) {
      const emptyResponse: PicksApiResponse = {
        games: [],
        roundNumber,
      };
      return NextResponse.json(emptyResponse);
    }

    // 3) Identify current user (for userPick)
    const currentUserId = await getUserIdFromRequest(req);

    // 4) Fetch sponsor question config from Firestore
    const sponsorConfig = await getSponsorQuestionConfig();

    // 5) Fetch pick stats and user picks from Firestore
    const { pickStats, userPicks } = await getPickStatsForRound(
      roundNumber,
      currentUserId
    );

    // 6) Fetch comment counts from Firestore
    const commentCounts = await getCommentCountsForRound(roundNumber);

    // 7) Build API games array from JSON, enriching with stats + sponsor flag
    const games: ApiGame[] = jsonRound.games.map((game) => {
      const sport = game.sport;

      const questions: ApiQuestion[] = game.questions.map((q) => {
        const stats = pickStats[q.id] ?? { yes: 0, no: 0, total: 0 };
        const total = stats.total;

        const yesPercent =
          total > 0 ? Math.round((stats.yes / total) * 100) : 0;
        const noPercent =
          total > 0 ? Math.round((stats.no / total) * 100) : 0;

        const isSponsorQuestion =
          sponsorConfig &&
          sponsorConfig.roundNumber === roundNumber &&
          sponsorConfig.questionId === q.id;

        return {
          id: q.id,
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          sport: q.sport ?? sport,
          isSponsorQuestion: !!isSponsorQuestion,
          userPick: userPicks[q.id],
          yesPercent,
          noPercent,
          commentCount: commentCounts[q.id] ?? 0,
        };
      });

      return {
        id: game.id,
        match: game.match,
        sport,
        venue: game.venue,
        startTime: game.startTime,
        questions,
      };
    });

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
