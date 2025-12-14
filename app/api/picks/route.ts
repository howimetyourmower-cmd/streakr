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
// BBL / Cricket shapes (support BOTH structures)
// ─────────────────────────────────────────────

// Structure A:
// cricketRounds/{docId} contains match/meta + questions[]
type CricketMatchQuestion = {
  id: string;
  quarter: number; // 0 for match-level
  question: string;
  status?: QuestionStatus | string;
  isSponsorQuestion?: boolean;
};

type CricketMatchDoc = {
  league?: string; // "BBL"
  sport?: string; // "BBL"
  match?: string;
  matchId?: string;
  venue?: string;
  startTime?: string;
  questions?: CricketMatchQuestion[];
};

// Structure B:
// cricketRounds/{docId} contains games:[{match,venue,startTime,questions:[]}]
type CricketSeedQuestion = {
  id: string;
  quarter: number;
  question: string;
  status?: QuestionStatus | string;
  isSponsorQuestion?: boolean;
};

type CricketSeedGame = {
  id?: string;
  match: string;
  venue?: string;
  startTime?: string;
  sport?: string;
  questions: CricketSeedQuestion[];
};

type CricketRoundDoc = {
  season?: number;
  roundNumber?: number;
  round?: number;
  label?: string;
  sport?: string;
  games?: CricketSeedGame[];
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

/**
 * ✅ NEW: For BBL we don’t have roundNumber logic.
 * We fetch the latest status/outcome by questionId (in chunks of 10).
 */
async function getLatestQuestionStatusByQuestionIds(
  questionIds: string[]
): Promise<Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }>> {
  const temp: Record<
    string,
    { status?: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }
  > = {};

  const unique = Array.from(new Set(questionIds.filter(Boolean)));
  if (!unique.length) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));

  try {
    for (const chunk of chunks) {
      const snap = await db
        .collection("questionStatus")
        .where("questionId", "in", chunk)
        .get();

      snap.forEach((docSnap) => {
        const d = docSnap.data() as QuestionStatusDoc;
        if (!d.questionId) return;

        const rawOutcome = (d.outcome as any) ?? (d.result as any);
        const outcome = normaliseOutcomeValue(rawOutcome);

        const updatedAtMs =
          d.updatedAt && typeof (d.updatedAt as any).toMillis === "function"
            ? (d.updatedAt as any).toMillis()
            : 0;

        const existing = temp[d.questionId];
        if (!existing || updatedAtMs >= existing.updatedAtMs) {
          temp[d.questionId] = {
            status: d.status ? normaliseStatusValue(d.status) : undefined,
            outcome,
            updatedAtMs,
          };
        }
      });
    }
  } catch (error) {
    console.error("[/api/picks] Error fetching questionStatus by ids", error);
  }

  const out: Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }> =
    {};
  for (const [qid, v] of Object.entries(temp)) {
    out[qid] = { status: v.status, outcome: v.outcome };
  }
  return out;
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
// BBL helper: build API response from either doc shape
// ─────────────────────────────────────────────

function enrichQuestionWithStatusAndOutcome(params: {
  q: {
    id: string;
    gameId: string;
    quarter: number;
    question: string;
    status: QuestionStatus;
    sport: string;
    isSponsorQuestion?: boolean;
  };
  statusOverride?: { status?: QuestionStatus; outcome?: QuestionOutcome };
  userPick?: "yes" | "no";
  yesPercent: number;
  noPercent: number;
}) : ApiQuestion {
  const { q, statusOverride, userPick, yesPercent, noPercent } = params;

  const effectiveStatus: QuestionStatus =
    statusOverride?.status ?? q.status;

  const correctOutcome =
    effectiveStatus === "final" || effectiveStatus === "void"
      ? statusOverride?.outcome
      : undefined;

  let correctPick: boolean | null = null;
  if (correctOutcome && userPick) {
    correctPick = userPick === correctOutcome;
  }

  return {
    id: q.id,
    gameId: q.gameId,
    quarter: q.quarter,
    question: q.question,
    status: effectiveStatus,
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

function buildBblGameFromMatchDoc(
  docId: string,
  data: CricketMatchDoc,
  pickStats: Record<string, { yes: number; no: number; total: number }>,
  userPicks: Record<string, "yes" | "no">,
  statusByQid: Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }>
): ApiGame {
  const sport = String(data.sport || data.league || "BBL").trim().toUpperCase();
  const match = String(data.match || "").trim();
  const venue = String(data.venue || "").trim();
  const startTime = String(data.startTime || "").trim();

  const questionsArr = Array.isArray(data.questions) ? data.questions : [];

  const questions: ApiQuestion[] = questionsArr.map((q, idx) => {
    const qid = String(q.id || "").trim() || `${docId}-Q${idx + 1}`;

    const stats = pickStats[qid] ?? { yes: 0, no: 0, total: 0 };
    const total = stats.total;
    const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
    const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

    const base = {
      id: qid,
      gameId: docId,
      quarter: Number.isFinite(Number(q.quarter)) ? Number(q.quarter) : 0,
      question: String(q.question || "").trim(),
      status: normaliseStatusValue(q.status ?? "open"),
      sport,
      isSponsorQuestion: Boolean(q.isSponsorQuestion ?? false),
    };

    return enrichQuestionWithStatusAndOutcome({
      q: base,
      statusOverride: statusByQid[qid],
      userPick: userPicks[qid],
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
  data: CricketRoundDoc,
  pickStats: Record<string, { yes: number; no: number; total: number }>,
  userPicks: Record<string, "yes" | "no">,
  statusByQid: Record<string, { status?: QuestionStatus; outcome?: QuestionOutcome }>
): ApiGame[] {
  const gamesArr = Array.isArray(data.games) ? data.games : [];
  const baseSport = String(data.sport || "BBL").trim().toUpperCase();

  return gamesArr.map((g, gi) => {
    const gameId = String(g.id || "").trim() || `${docId}-G${gi + 1}`;
    const match = String(g.match || "").trim();
    const venue = String(g.venue || "").trim();
    const startTime = String(g.startTime || "").trim();
    const sport = String(g.sport || baseSport || "BBL").trim().toUpperCase();

    const qs = Array.isArray(g.questions) ? g.questions : [];
    const questions: ApiQuestion[] = qs.map((q, qi) => {
      const qid = String(q.id || "").trim() || `${gameId}-Q${qi + 1}`;

      const stats = pickStats[qid] ?? { yes: 0, no: 0, total: 0 };
      const total = stats.total;
      const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
      const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

      const base = {
        id: qid,
        gameId,
        quarter: Number.isFinite(Number(q.quarter)) ? Number(q.quarter) : 0,
        question: String(q.question || "").trim(),
        status: normaliseStatusValue(q.status ?? "open"),
        sport,
        isSponsorQuestion: Boolean(q.isSponsorQuestion ?? false),
      };

      return enrichQuestionWithStatusAndOutcome({
        q: base,
        statusOverride: statusByQid[qid],
        userPick: userPicks[qid],
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
    // BBL / Cricket path (Firestore)
    // ─────────────────────────────
    if (sportParam === "BBL" || sportParam === "CRICKET") {
      const docId = String(url.searchParams.get("docId") ?? "").trim();

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

      const hasGamesArray = Array.isArray((raw as any).games);
      const hasQuestionsArray = Array.isArray((raw as any).questions);

      // Collect all questionIds so we can fetch their settlement outcomes
      const qids: string[] = [];

      if (hasGamesArray) {
        const data = raw as CricketRoundDoc;
        const gamesArr = Array.isArray(data.games) ? data.games : [];
        for (const g of gamesArr) {
          const qs = Array.isArray(g.questions) ? g.questions : [];
          for (const q of qs) {
            const qid = String(q.id || "").trim();
            if (qid) qids.push(qid);
          }
        }
      } else if (hasQuestionsArray) {
        const data = raw as CricketMatchDoc;
        const qs = Array.isArray(data.questions) ? data.questions : [];
        for (const q of qs) {
          const qid = String(q.id || "").trim();
          if (qid) qids.push(qid);
        }
      }

      const statusByQid = await getLatestQuestionStatusByQuestionIds(qids);

      let games: ApiGame[] = [];
      let effectiveRoundNumber = roundNumber;

      if (hasGamesArray) {
        const data = raw as CricketRoundDoc;
        effectiveRoundNumber =
          Number(data.roundNumber ?? data.round ?? roundNumber) || 0;

        games = buildBblGamesFromRoundDoc(docId, data, pickStats, userPicks, statusByQid);
      } else if (hasQuestionsArray) {
        const data = raw as CricketMatchDoc;
        effectiveRoundNumber = roundNumber;

        games = [buildBblGameFromMatchDoc(docId, data, pickStats, userPicks, statusByQid)];
      } else {
        const empty: PicksApiResponse = { games: [], roundNumber };
        return NextResponse.json({
          ...empty,
          error:
            `cricketRounds/${docId} exists but has no games[] or questions[]. ` +
            `Expected either:\n- games: [{ match, venue, startTime, questions: [...] }]\n` +
            `OR\n- match/venue/startTime + questions: [...]`,
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
