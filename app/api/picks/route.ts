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
  StartTime: string; // ISO string
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

  // ✅ user + community fields
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  // ✅ sponsor fields
  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorBlurb?: string;

  // ✅ outcome / result pill fields
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

  // ✅ dashboard fields (ROUND ONLY — resets each round automatically)
  currentStreak: number; // best match streak for THIS round
  leaderScore: number; // leader best match streak for THIS round
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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─────────────────────────────────────────────
// ✅ Optimised pick reads (NO full collection scans)
// - pulls only picks for THIS round's questionIds
// - builds: pickStats, userPicks, picksByUser
// ─────────────────────────────────────────────

async function fetchPicksForQuestionIds(params: {
  questionIds: Set<string>;
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

  if (!questionIds.size) return { pickStats, userPicks, picksByUser };

  // Firestore "in" supports up to 10 values per query
  const qidList = Array.from(questionIds);
  const chunks = chunkArray(qidList, 10);

  try {
    for (const ch of chunks) {
      const snap = await db.collection("picks").where("questionId", "in", ch).get();

      snap.forEach((docSnap) => {
        const data = docSnap.data() as {
          userId?: string;
          questionId?: string;
          pick?: "yes" | "no";
        };

        const uid = data.userId;
        const qid = data.questionId;
        const pick = data.pick;

        if (!uid || !qid) return;
        if (pick !== "yes" && pick !== "no") return;
        if (!questionIds.has(qid)) return;

        // stats
        if (!pickStats[qid]) pickStats[qid] = { yes: 0, no: 0, total: 0 };
        pickStats[qid][pick] += 1;
        pickStats[qid].total += 1;

        // current user picks
        if (currentUserId && uid === currentUserId) {
          userPicks[qid] = pick;
        }

        // all user picks (for leader calc)
        if (!picksByUser[uid]) picksByUser[uid] = {};
        picksByUser[uid][qid] = pick;
      });
    }
  } catch (error) {
    console.error("[/api/picks] Error fetching picks for questionIds", error);
  }

  return { pickStats, userPicks, picksByUser };
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
    const snap = await db
      .collection("comments")
      .where("roundNumber", "==", roundNumber)
      .get();

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
  const map: Record<string, boolean> = {};

  const gameIds = Array.from(new Set(roundRows.map((r) => `${roundCode}-G${r.Game}`)));
  if (!gameIds.length) return map;

  const chunks = chunkArray(gameIds, 10);

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

// ─────────────────────────────────────────────
// ✅ Streak helpers (Clean Sweep per match)
// ─────────────────────────────────────────────

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
  for (const g of games) best = Math.max(best, computeMatchStreak(g, picksForUser));
  return best;
}

async function readUserDisplayName(uid: string): Promise<string | null> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;

    const firstName = (data?.firstName as string) || "";
    const surname = (data?.surname as string) || "";
    const username = (data?.username as string) || "";

    const displayName =
      (firstName || surname)
        ? `${firstName} ${surname}`.trim()
        : (username || "Player");

    return displayName || null;
  } catch (e) {
    console.warn("[/api/picks] Failed to read user displayName", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Main GET handler (AFL only)
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    // ✅ AFL only (Torpie)
    const roundParam = url.searchParams.get("round");
    let roundNumber: number | null = null;

    if (roundParam !== null) {
      const parsed = Number(roundParam);
      if (!Number.isNaN(parsed) && parsed >= 0) roundNumber = parsed;
    }
    if (roundNumber === null) roundNumber = 0;

    const currentUserId = await getUserIdFromRequest(req);

    const roundCode = getRoundCode(roundNumber);
    const roundRows = rows.filter((r) => r.Round === roundCode);

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

    // Build stable questionIds for THIS round (so pickStats stays round-only)
    const questionIdsForRound = new Set<string>();

    // Must replicate questionId generation logic exactly:
    // `${roundCode}-G${Game}-Q${index+1}` where index is per-game order of rows.
    const perGameIndex: Record<string, number> = {};

    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;

      if (perGameIndex[gameId] === undefined) perGameIndex[gameId] = 0;
      const idx = perGameIndex[gameId]++;
      const qid = `${gameId}-Q${idx + 1}`;

      questionIdsForRound.add(qid);
    }

    // parallel-ish reads (safe)
    const [sponsorConfig, commentCounts, statusOverrides, gameLocks, picksData] =
      await Promise.all([
        getSponsorQuestionConfig(),
        getCommentCountsForRound(roundNumber),
        getQuestionStatusForRound(roundNumber),
        getGameLocksForRound(roundCode, roundRows),
        fetchPicksForQuestionIds({ questionIds: questionIdsForRound, currentUserId }),
      ]);

    const { pickStats, userPicks, picksByUser } = picksData;

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
          startTime: r.StartTime,
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
        effectiveStatus === "final" || effectiveStatus === "void"
          ? statusInfo?.outcome
          : undefined;

      const userPick = userPicks[questionId];

      // ✅ correctPick rules:
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
        !!sponsorConfig &&
        sponsorConfig.roundNumber === roundNumber &&
        sponsorConfig.questionId === questionId;

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
        sponsorName: isSponsorQuestion ? (sponsorConfig?.sponsorName ?? "OFFICIAL PARTNER") : undefined,
        sponsorBlurb: isSponsorQuestion ? sponsorConfig?.sponsorBlurb : undefined,

        correctOutcome: finalOutcome,
        outcome: finalOutcome,
        correctPick,
      };

      gamesById[gameId].questions.push(apiQuestion);
    }

    const games = Object.values(gamesById);

    // ✅ ROUND-ONLY streak + leader (resets automatically because games are per round)
    const currentStreak = currentUserId
      ? computeBestStreakAcrossGames(games, userPicks)
      : 0;

    let leaderScore = 0;
    let leaderUid: string | null = null;

    for (const uid of Object.keys(picksByUser)) {
      const score = computeBestStreakAcrossGames(games, picksByUser[uid]);
      if (score > leaderScore) {
        leaderScore = score;
        leaderUid = uid;
      }
    }

    const leaderName = leaderUid ? await readUserDisplayName(leaderUid) : null;

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
