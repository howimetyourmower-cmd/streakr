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

  // outcome-pill fields
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
 * Works across sports as long as questionId is unique.
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

// AFL-only helpers (kept as-is)
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
        temp[data.questionId] = { status: data.status, outcome, updatedAtMs };
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
// BBL parsing helpers (tolerant to key casing + variants)
// ─────────────────────────────────────────────

function firstString(obj: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function firstArray(obj: any, keys: string[]): any[] {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function safeUpper(val: string) {
  return String(val || "").trim().toUpperCase();
}

function enrichQuestionForApi(params: {
  q: {
    id: string;
    gameId: string;
    quarter: number;
    question: string;
    status: QuestionStatus;
    outcome?: QuestionOutcome;
    sport: string;
    isSponsorQuestion?: boolean;
  };
  userPick?: "yes" | "no";
  yesPercent: number;
  noPercent: number;
}): ApiQuestion {
  const { q, userPick, yesPercent, noPercent } = params;

  const correctOutcome =
    q.status === "final" || q.status === "void" ? q.outcome : undefined;

  let correctPick: boolean | null = null;
  if (correctOutcome && userPick) {
    if (correctOutcome === "void") correctPick = null;
    else correctPick = userPick === correctOutcome;
  }

  return {
    id: q.id,
    gameId: q.gameId,
    quarter: q.quarter,
    question: q.question,
    status: q.status,
    sport: q.sport,
    isSponsorQuestion: q.isSponsorQuestion,
    userPick,
    yesPercent,
    noPercent,
    commentCount: 0,
    correctOutcome,
    outcome: correctOutcome,
    correctPick,
  };
}

function normaliseCricketQuestion(
  rawQ: any,
  fallbackId: string,
  gameId: string,
  sport: string
): {
  id: string;
  gameId: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  outcome?: QuestionOutcome;
  sport: string;
  isSponsorQuestion?: boolean;
} {
  const id =
    (typeof rawQ?.id === "string" && rawQ.id.trim()) ||
    (typeof rawQ?.Id === "string" && rawQ.Id.trim()) ||
    fallbackId;

  const question = firstString(rawQ, ["question", "Question"], "").trim();
  const quarterRaw = rawQ?.quarter ?? rawQ?.Quarter ?? 0;
  const quarter = Number.isFinite(Number(quarterRaw)) ? Number(quarterRaw) : 0;

  const statusRaw = rawQ?.status ?? rawQ?.Status ?? "open";
  const status = normaliseStatusValue(statusRaw);

  const outcomeRaw =
    rawQ?.outcome ??
    rawQ?.Outcome ??
    rawQ?.result ??
    rawQ?.Result ??
    rawQ?.correctOutcome ??
    rawQ?.CorrectOutcome;

  const outcome = normaliseOutcomeValue(outcomeRaw);

  const isSponsorQuestion = Boolean(
    rawQ?.isSponsorQuestion ??
      rawQ?.IsSponsorQuestion ??
      rawQ?.sponsor ??
      rawQ?.Sponsor ??
      false
  );

  return {
    id,
    gameId,
    quarter,
    question,
    status,
    outcome,
    sport,
    isSponsorQuestion,
  };
}

function buildBblGameFromMatchDoc(
  docId: string,
  raw: any,
  pickStats: Record<string, { yes: number; no: number; total: number }>,
  userPicks: Record<string, "yes" | "no">
): ApiGame {
  const sport = safeUpper(
    firstString(raw, ["sport", "Sport", "league", "League"], "BBL")
  );

  const match = firstString(raw, ["match", "Match"], "").trim();
  const venue = firstString(raw, ["venue", "Venue"], "").trim();
  const startTime = firstString(raw, ["startTime", "StartTime"], "").trim();

  const questionsArr = firstArray(raw, [
    "questions",
    "Questions",
    "matchQuestions",
    "MatchQuestions",
  ]);

  const questions: ApiQuestion[] = questionsArr.map((q: any, idx: number) => {
    const fallbackId = `${docId}-Q${idx + 1}`;
    const base = normaliseCricketQuestion(q, fallbackId, docId, sport);

    const stats = pickStats[base.id] ?? { yes: 0, no: 0, total: 0 };
    const total = stats.total;
    const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
    const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

    return enrichQuestionForApi({
      q: base,
      userPick: userPicks[base.id],
      yesPercent,
      noPercent,
    });
  });

  return {
    id: docId,
    match,
    sport,
    venue,
    startTime,
    isUnlockedForPicks: true,
    questions,
  };
}

function buildBblGamesFromRoundDoc(
  docId: string,
  raw: any,
  pickStats: Record<string, { yes: number; no: number; total: number }>,
  userPicks: Record<string, "yes" | "no">
): ApiGame[] {
  const baseSport = safeUpper(firstString(raw, ["sport", "Sport"], "BBL"));

  const gamesArr = firstArray(raw, ["games", "Games", "matches", "Matches"]);

  return gamesArr.map((g: any, gi: number) => {
    const gameId =
      firstString(g, ["id", "Id"], "")?.trim() || `${docId}-G${gi + 1}`;

    const match = firstString(g, ["match", "Match"], "").trim();
    const venue = firstString(g, ["venue", "Venue"], "").trim();
    const startTime = firstString(g, ["startTime", "StartTime"], "").trim();
    const sport = safeUpper(firstString(g, ["sport", "Sport"], baseSport));

    const qs = firstArray(g, ["questions", "Questions"]);
    const questions: ApiQuestion[] = qs.map((q: any, qi: number) => {
      const fallbackId = `${gameId}-Q${qi + 1}`;
      const base = normaliseCricketQuestion(q, fallbackId, gameId, sport);

      const stats = pickStats[base.id] ?? { yes: 0, no: 0, total: 0 };
      const total = stats.total;
      const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

      return enrichQuestionForApi({
        q: base,
        userPick: userPicks[base.id],
        yesPercent,
        noPercent,
      });
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
    // BBL / Cricket path (Firestore) — tolerant parsing
    // ─────────────────────────────
    if (sportParam === "BBL" || sportParam === "CRICKET") {
      // support docId or docid
      const docId = String(
        url.searchParams.get("docId") ?? url.searchParams.get("docid") ?? ""
      ).trim();

      if (!docId) {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error:
            "Missing docId. Call /api/picks?sport=BBL&docId=<cricketRounds-docId>",
        });
      }

      const snap = await db.collection("cricketRounds").doc(docId).get();
      if (!snap.exists) {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error: `BBL doc not found: cricketRounds/${docId}`,
        });
      }

      const raw = snap.data() || {};

      // detect games or questions (support casing/variants)
      const gamesArr = firstArray(raw as any, ["games", "Games", "matches", "Matches"]);
      const questionsArr = firstArray(raw as any, [
        "questions",
        "Questions",
        "matchQuestions",
        "MatchQuestions",
      ]);

      let games: ApiGame[] = [];
      let effectiveRoundNumber = roundNumber;

      if (gamesArr.length) {
        effectiveRoundNumber =
          Number(
            (raw as any).roundNumber ??
              (raw as any).RoundNumber ??
              (raw as any).round ??
              (raw as any).Round ??
              roundNumber
          ) || 0;

        games = buildBblGamesFromRoundDoc(docId, raw, pickStats, userPicks);
      } else if (questionsArr.length) {
        effectiveRoundNumber = roundNumber;
        games = [buildBblGameFromMatchDoc(docId, raw, pickStats, userPicks)];
      } else {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error:
            `cricketRounds/${docId} exists but has no games[] or questions[] (including casing variants). ` +
            `Tried: games/Games/matches/Matches and questions/Questions/matchQuestions/MatchQuestions.`,
        });
      }

      const response: PicksApiResponse = {
        games,
        roundNumber: effectiveRoundNumber,
      };

      return NextResponse.json(response);
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
        if (correctOutcome === "void") correctPick = null;
        else correctPick = userPick === correctOutcome;
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
