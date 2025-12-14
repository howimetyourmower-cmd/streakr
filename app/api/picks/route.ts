// /app/api/picks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

// AFL flat JSON rows
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
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  correctOutcome?: QuestionOutcome;
  outcome?: QuestionOutcome;
  correctPick?: boolean | null;
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  isUnlockedForPicks?: boolean;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

// Firestore docs used for AFL locks/status (existing)
type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
};

type QuestionStatusDoc = {
  roundNumber: number;
  questionId: string;
  status: QuestionStatus;
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

// ─────────────────────────────────────────────
// Cricket/BBL Firestore shapes
// ─────────────────────────────────────────────

// Shape 1: what you seeded (your screenshot shows this)
type BblGamesDoc = {
  league?: string; // "BBL"
  sport?: string; // "BBL"
  match?: string;
  venue?: string;
  startTime?: string;
  matchId?: string;
  questions?: Array<{
    id?: string;
    quarter?: number; // often 0 in your seeding UI
    question?: string;
    status?: QuestionStatus | string;
    isSponsorQuestion?: boolean;
  }>;
};

// Shape 2: optional (if you ever use cricketRounds docs)
type CricketSeedQuestion = {
  id: string;
  quarter: number;
  question: string;
  status?: QuestionStatus;
  isSponsorQuestion?: boolean;
};

type CricketSeedGame = {
  id?: string;
  match: string;
  venue?: string;
  startTime?: string;
  sport?: string; // "BBL"
  questions: CricketSeedQuestion[];
};

type CricketRoundDoc = {
  season: number;
  roundNumber?: number;
  round?: number;
  label?: string;
  sport?: string;
  games: CricketSeedGame[];
};

// ─────────────────────────────────────────────
// AFL helpers
// ─────────────────────────────────────────────

const rows: JsonRow[] = rounds2026 as JsonRow[];

function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

function normaliseOutcomeValue(val: unknown): QuestionOutcome | undefined {
  if (typeof val !== "string") return undefined;
  const s = val.trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "correct" || s === "win") return "yes";
  if (s === "no" || s === "n" || s === "wrong" || s === "loss") return "no";
  if (s === "void" || s === "cancelled" || s === "canceled") return "void";
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

// ─────────────────────────────────────────────
// Shared helpers
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

/**
 * Pick stats for all questions (questionId uniqueness is key).
 * NOTE: Right now this reads ALL picks (not filtered by round/sport). That’s ok for MVP.
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

// AFL-only helpers
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

  const finalMap: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }> =
    {};

  Object.entries(temp).forEach(([qid, value]) => {
    finalMap[qid] = { status: value.status, outcome: value.outcome };
  });

  return finalMap;
}

async function getGameLocksForRound(
  roundCode: string,
  roundRows: JsonRow[]
): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};

  const gameIds = Array.from(
    new Set(roundRows.map((row) => `${roundCode}-G${row.Game}`))
  );
  if (!gameIds.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < gameIds.length; i += 10) {
    chunks.push(gameIds.slice(i, i + 10));
  }

  try {
    for (const chunk of chunks) {
      const snap = await db
        .collection("gameLocks")
        .where("gameId", "in", chunk)
        .get();

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

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    const sportParam = String(url.searchParams.get("sport") ?? "AFL")
      .trim()
      .toUpperCase();

    const roundParam = url.searchParams.get("round");
    let roundNumber: number | null = null;
    if (roundParam !== null) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) roundNumber = parsed;
    }
    if (roundNumber === null) roundNumber = 0;

    const currentUserId = await getUserIdFromRequest(req);

    const { pickStats, userPicks } = await getPickStatsForRound(
      roundNumber,
      currentUserId
    );

    // ─────────────────────────────
    // BBL / Cricket path (Firestore)
    // ─────────────────────────────
    if (sportParam === "BBL" || sportParam === "CRICKET") {
      const docId = String(url.searchParams.get("docId") ?? "").trim();

      if (!docId) {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error:
            "Missing docId. Call /api/picks?sport=BBL&docId=<your-doc-id>",
        });
      }

      // 1) Try cricketRounds first (optional legacy/alternate)
      const cricketSnap = await db.collection("cricketRounds").doc(docId).get();
      if (cricketSnap.exists) {
        const data = cricketSnap.data() as CricketRoundDoc;
        const effectiveRoundNumber =
          Number(data.roundNumber ?? data.round ?? roundNumber) || 0;

        const games: ApiGame[] = (data.games || []).map((g, gi) => {
          const gameId = g.id?.trim() || `${docId}-G${gi + 1}`;
          const match = String(g.match || "").trim();
          const venue = String(g.venue || "").trim();
          const startTime = String(g.startTime || "").trim();
          const sport = String(g.sport || data.sport || "BBL").toUpperCase();

          const questions: ApiQuestion[] = (g.questions || []).map((q) => {
            const qid = String(q.id || "").trim();
            // Make IDs stable so picks can attach
            const questionId = qid ? `${gameId}-${qid}` : `${gameId}-QX`;

            const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
            const total = stats.total;

            const yesPercent =
              total > 0 ? Math.round((stats.yes / total) * 100) : 0;
            const noPercent =
              total > 0 ? Math.round((stats.no / total) * 100) : 0;

            const userPick = userPicks[questionId];

            const rawQuarter = Number.isFinite(Number(q.quarter))
              ? Number(q.quarter)
              : 1;
            const safeQuarter = rawQuarter <= 0 ? 1 : rawQuarter;

            return {
              id: questionId,
              gameId,
              quarter: safeQuarter,
              question: String(q.question || "").trim(),
              status: normaliseStatusValue(q.status ?? "open"),
              sport,
              isSponsorQuestion: Boolean(q.isSponsorQuestion ?? false),
              userPick,
              yesPercent,
              noPercent,
              commentCount: 0,
              correctOutcome: undefined,
              outcome: undefined,
              correctPick: null,
            };
          });

          return {
            id: gameId,
            match,
            sport,
            venue,
            startTime,
            isUnlockedForPicks: true,
            questions,
          };
        });

        return NextResponse.json({
          games,
          roundNumber: effectiveRoundNumber,
        } satisfies PicksApiResponse);
      }

      // 2) ✅ Fallback to the collection you ACTUALLY seeded: games/<docId>
      const gameSnap = await db.collection("games").doc(docId).get();
      if (!gameSnap.exists) {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error: `BBL doc not found in cricketRounds/${docId} or games/${docId}`,
        });
      }

      const gameDoc = gameSnap.data() as BblGamesDoc;

      const sport = String(gameDoc.sport || gameDoc.league || "BBL").toUpperCase();
      const match = String(gameDoc.match || "").trim();
      const venue = String(gameDoc.venue || "").trim();
      const startTime = String(gameDoc.startTime || "").trim();

      const gameId = String(gameDoc.matchId || docId).trim() || docId;

      const questions: ApiQuestion[] = (gameDoc.questions || []).map((q, idx) => {
        const rawId = String(q.id || `Q${idx + 1}`).trim();
        // Make IDs stable and unique (THIS MATTERS)
        const questionId = `${gameId}-${rawId}`;

        const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
        const total = stats.total;

        const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
        const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

        const userPick = userPicks[questionId];

        // ✅ quarter 0 often causes UI filters to drop it, so force into 1..4
        const rawQuarter = Number.isFinite(Number(q.quarter)) ? Number(q.quarter) : 1;
        const safeQuarter = rawQuarter <= 0 ? 1 : rawQuarter;

        return {
          id: questionId,
          gameId,
          quarter: safeQuarter,
          question: String(q.question || "").trim(),
          status: normaliseStatusValue(q.status ?? "open"),
          sport,
          isSponsorQuestion: Boolean(q.isSponsorQuestion ?? false),
          userPick,
          yesPercent,
          noPercent,
          commentCount: 0,
          correctOutcome: undefined,
          outcome: undefined,
          correctPick: null,
        };
      });

      const games: ApiGame[] = [
        {
          id: gameId,
          match,
          sport,
          venue,
          startTime,
          isUnlockedForPicks: true,
          questions,
        },
      ];

      return NextResponse.json({
        games,
        roundNumber: 0,
      } satisfies PicksApiResponse);
    }

    // ─────────────────────────────
    // AFL path (existing JSON logic)
    // ─────────────────────────────

    const roundCode = getRoundCode(roundNumber);
    const roundRows = rows.filter((row) => row.Round === roundCode);

    if (!roundRows.length) {
      const empty: PicksApiResponse = { games: [], roundNumber };
      return NextResponse.json(empty);
    }

    const sponsorConfig = await getSponsorQuestionConfig();
    const commentCounts = await getCommentCountsForRound(roundNumber);
    const statusOverrides = await getQuestionStatusForRound(roundNumber);
    const gameLocks = await getGameLocksForRound(roundCode, roundRows);

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
          isUnlockedForPicks: !!gameLocks[gameKey],
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

      const statusInfo = statusOverrides[questionId];
      const effectiveStatus =
        statusInfo?.status ?? normaliseStatusValue(row.Status || "Open");

      const correctOutcome =
        effectiveStatus === "final" || effectiveStatus === "void"
          ? statusInfo?.outcome
          : undefined;

      const userPick = userPicks[questionId];

      let correctPick: boolean | null = null;
      if (correctOutcome && userPick) {
        correctPick = userPick === correctOutcome;
      }

      const apiQuestion: ApiQuestion = {
        id: questionId,
        gameId: gameKey,
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
        outcome: correctOutcome,
        correctPick,
      };

      gamesByKey[gameKey].questions.push(apiQuestion);
    }

    const games = Object.values(gamesByKey);
    const response: PicksApiResponse = { games, roundNumber };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/picks] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error", games: [], roundNumber: 0 },
      { status: 500 }
    );
  }
}
