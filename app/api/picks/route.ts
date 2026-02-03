// /app/api/picks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

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
  correctPick?: boolean | null;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;

  // ✅ Keep for compatibility, but ALWAYS true now.
  // All questions/picks are available to everyone (no free/premium gating).
  isUnlockedForPicks?: boolean;

  questions: ApiQuestion[];
};

type FreeKickInfo = {
  used: boolean;
  gameId?: string;
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null;

  // ✅ golden free kick insurance (once per season)
  freeKick: FreeKickInfo;
};

type SponsorQuestionConfig = {
  roundNumber: number;
  questionId: string;
  sponsorName?: string;
  sponsorBlurb?: string;
};

type QuestionStatusDoc = {
  roundNumber?: number;
  questionId?: string;
  status?: QuestionStatus;
  outcome?: QuestionOutcome | "lock" | string;
  result?: QuestionOutcome | "lock" | string;
  updatedAt?: FirebaseFirestore.Timestamp | any;
};

type FirestoreRoundDoc = {
  season?: number;
  roundNumber?: number;
  roundKey?: string;
  label?: string;
  games?: {
    match?: string;
    venue?: string;
    startTime?: string;
    questions?: { quarter?: number; question?: string; status?: string }[];
  }[];
};

const SEASON = 2026;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getRoundCode(roundNumber: number): string {
  return roundNumber === 0 ? "OR" : `R${roundNumber}`;
}

function sanitiseStartTime(input: string): string {
  const s = String(input ?? "").trim();
  if (!s) return s;
  return s.replace(/T(\d{2})\.(\d{2}):/g, "T$1:$2:");
}

function safeTimeMs(startTime: string): number {
  const t = new Date(sanitiseStartTime(startTime)).getTime();
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

// ─────────────────────────────────────────────
// ✅ Stable questionId
// ─────────────────────────────────────────────

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function stableQuestionId(params: { roundNumber: number; gameId: string; quarter: number; question: string }): string {
  const base = `${params.roundNumber}|${params.gameId}|Q${params.quarter}|${String(params.question || "")
    .trim()
    .toLowerCase()}`;
  const hash = fnv1a(base);
  return `${params.gameId}-Q${params.quarter}-${hash}`;
}

// ─────────────────────────────────────────────
// Firestore reads
// ─────────────────────────────────────────────

async function getPublishedRoundNumber(): Promise<number> {
  try {
    const snap = await db.collection("config").doc(`season-${SEASON}`).get();
    if (!snap.exists) return 0;

    const cfg = (snap.data() as any) || {};
    const n = Number(cfg.currentRoundNumber);
    if (Number.isFinite(n) && n >= 0) return n;
    return 0;
  } catch (e) {
    console.error("[/api/picks] Failed to read published round from config", e);
    return 0;
  }
}

async function getRoundDocByNumber(roundNumber: number): Promise<FirestoreRoundDoc | null> {
  try {
    const snap = await db
      .collection("rounds")
      .where("season", "==", SEASON)
      .where("roundNumber", "==", roundNumber)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const docSnap = snap.docs[0];
    return (docSnap.data() as FirestoreRoundDoc) || null;
  } catch (e) {
    console.error("[/api/picks] Failed to read round doc", e);
    return null;
  }
}

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
    const snap = await db.collection("config").doc(`season-${SEASON}`).get();
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

function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}

function toMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  const d = ts instanceof Date ? ts : new Date(ts);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function getQuestionStatusForQuestionIds(params: {
  roundNumber: number;
  questionIds: Set<string>;
}): Promise<Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }>> {
  const { roundNumber, questionIds } = params;
  const out: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome; updatedAtMs: number }> = {};

  const ids = Array.from(questionIds);
  if (!ids.length) return {};

  const refs = ids.map((qid) => db.collection("questionStatus").doc(questionStatusDocId(roundNumber, qid)));

  try {
    // @ts-ignore admin supports getAll
    const snaps: FirebaseFirestore.DocumentSnapshot[] = await db.getAll(...refs);

    for (const snap of snaps) {
      if (!snap.exists) continue;

      const data = (snap.data() as QuestionStatusDoc) || {};

      const qid =
        (typeof data.questionId === "string" && data.questionId) || snap.id.split("__").slice(1).join("__");

      const status = data.status as QuestionStatus | undefined;
      if (!qid || !status) continue;

      const rawOutcome = (data.outcome as any) ?? (data.result as any);
      const outcome = normaliseOutcomeValue(rawOutcome);

      const updatedAtMs = toMs((data as any).updatedAt);

      const existing = out[qid];
      if (!existing || updatedAtMs >= existing.updatedAtMs) {
        out[qid] = { status, outcome, updatedAtMs };
      }
    }
  } catch (error) {
    console.error("[/api/picks] Error fetching questionStatus by ids", error);
  }

  const clean: Record<string, { status: QuestionStatus; outcome?: QuestionOutcome }> = {};
  Object.entries(out).forEach(([qid, v]) => {
    clean[qid] = { status: v.status, outcome: v.outcome };
  });

  return clean;
}

async function loadPicksByUserForQuestionIds(questionIds: Set<string>): Promise<Record<string, Record<string, "yes" | "no">>> {
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

async function readUsername(uid: string): Promise<string | null> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return null;

    const data = (snap.data() as any) || {};
    const username = (data?.username as string) || "";
    const cleaned = String(username).trim();
    return cleaned ? cleaned : null;
  } catch (e) {
    console.warn("[/api/picks] Failed to read username", e);
    return null;
  }
}

async function getFreeKickInfoForUser(uid: string | null): Promise<FreeKickInfo> {
  if (!uid) return { used: false };
  try {
    const snap = await db.collection("freeKickUses").doc(`${SEASON}__${uid}`).get();
    if (!snap.exists) return { used: false };
    const data = snap.data() as any;
    const gameId = typeof data?.gameId === "string" ? data.gameId : undefined;
    return { used: true, gameId };
  } catch (e) {
    console.error("[/api/picks] Failed to read freeKickUses", e);
    return { used: false };
  }
}

// ─────────────────────────────────────────────
// ✅ Streak (outcome-based) + Golden Free Kick
// ─────────────────────────────────────────────

function computeRunningStreakAcrossGames(
  games: ApiGame[],
  picksForUser: Record<string, "yes" | "no">,
  freeKick: FreeKickInfo
): number {
  const sorted = [...games].sort((a, b) => safeTimeMs(a.startTime) - safeTimeMs(b.startTime));
  let running = 0;

  for (const g of sorted) {
    const pickedQs = (g.questions || []).filter((q) => {
      const pick = picksForUser[q.id];
      return pick === "yes" || pick === "no";
    });

    if (pickedQs.length === 0) continue;

    const anyUnsettled = pickedQs.some((q) => q.status !== "final" && q.status !== "void");
    if (anyUnsettled) continue;

    const anyWrong = pickedQs.some((q) => {
      const pick = picksForUser[q.id];
      if (!pick) return false;

      if (q.status === "void" || q.outcome === "void") return false;

      const outcome = q.outcome;
      if (outcome !== "yes" && outcome !== "no") return false;

      return pick !== outcome;
    });

    if (anyWrong) {
      // ✅ Golden Free Kick logic:
      // If user used the free kick on THIS game, streak does NOT reset,
      // and NO correct questions from this game count.
      if (freeKick?.used && freeKick?.gameId && freeKick.gameId === g.id) {
        continue; // keep running as-is
      }

      running = 0;
      continue;
    }

    const correct = pickedQs.filter((q) => {
      const pick = picksForUser[q.id];
      if (!pick) return false;

      if (q.status === "void" || q.outcome === "void") return false;

      const outcome = q.outcome;
      if (outcome !== "yes" && outcome !== "no") return false;

      return pick === outcome;
    }).length;

    running += correct;
  }

  return running;
}

// ─────────────────────────────────────────────
// Main GET handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const roundParam = url.searchParams.get("round");

    // ✅ if ?round=X provided => use it
    // ✅ otherwise use the published round from Firestore config
    let roundNumber: number;
    if (roundParam === null) {
      roundNumber = await getPublishedRoundNumber();
    } else {
      const parsed = Number(roundParam);
      roundNumber = !Number.isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }

    const currentUserId = await getUserIdFromRequest(req);
    const freeKick = await getFreeKickInfoForUser(currentUserId);

    const roundCode = getRoundCode(roundNumber);
    const roundDoc = await getRoundDocByNumber(roundNumber);

    if (!roundDoc || !Array.isArray(roundDoc.games) || roundDoc.games.length === 0) {
      const empty: PicksApiResponse = {
        games: [],
        roundNumber,
        currentStreak: 0,
        leaderScore: 0,
        leaderName: null,
        freeKick,
      };
      return NextResponse.json(empty, { headers: { "Cache-Control": "no-store" } });
    }

    const sponsorConfig = await getSponsorQuestionConfig();
    const commentCounts = await getCommentCountsForRound(roundNumber);

    // build questionIds set for stats/status reads
    const questionIdsForRound = new Set<string>();
    roundDoc.games.forEach((g, gi) => {
      const gameId = `${roundCode}-G${gi + 1}`;
      (g.questions ?? []).forEach((q) => {
        const qid = stableQuestionId({
          roundNumber,
          gameId,
          quarter: Number(q.quarter ?? 1),
          question: String(q.question ?? ""),
        });
        questionIdsForRound.add(qid);
      });
    });

    const statusOverrides = await getQuestionStatusForQuestionIds({
      roundNumber,
      questionIds: questionIdsForRound,
    });

    const { pickStats, userPicks } = await getPickStatsForQuestionIds({
      questionIds: questionIdsForRound,
      currentUserId,
    });

    const games: ApiGame[] = roundDoc.games.map((g, gi) => {
      const gameId = `${roundCode}-G${gi + 1}`;

      const match = String(g.match ?? `Game ${gi + 1}`);
      const venue = String(g.venue ?? "");
      const startTime = sanitiseStartTime(String(g.startTime ?? ""));

      const questions: ApiQuestion[] = (g.questions ?? []).map((q) => {
        const questionText = String(q.question ?? "");
        const quarter = Number(q.quarter ?? 1);

        const questionId = stableQuestionId({
          roundNumber,
          gameId,
          quarter,
          question: questionText,
        });

        const stats = pickStats[questionId] ?? { yes: 0, no: 0, total: 0 };
        const total = stats.total;
        const yesPercent = total > 0 ? Math.round((stats.yes / total) * 100) : 0;
        const noPercent = total > 0 ? Math.round((stats.no / total) * 100) : 0;

        const statusInfo = statusOverrides[questionId];
        const effectiveStatus: QuestionStatus = statusInfo?.status ?? normaliseStatusValue(q.status ?? "open");

        const effectiveOutcome =
          effectiveStatus === "final" || effectiveStatus === "void" ? statusInfo?.outcome : undefined;

        const userPick = userPicks[questionId];

        let correctPick: boolean | null | undefined = undefined;
        let finalOutcome: QuestionOutcome | undefined = effectiveOutcome;

        if (effectiveStatus === "void" || finalOutcome === "void") {
          correctPick = null;
          finalOutcome = "void";
        } else if (effectiveStatus === "final" && finalOutcome && userPick) {
          correctPick = userPick === finalOutcome;
        }

        const isSponsorQuestion =
          !!sponsorConfig && sponsorConfig.roundNumber === roundNumber && sponsorConfig.questionId === questionId;

        return {
          id: questionId,
          gameId,
          quarter,
          question: questionText,
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
      });

      return {
        id: gameId,
        match,
        venue,
        startTime,

        // ✅ ALWAYS unlocked now (all questions available to everyone)
        isUnlockedForPicks: true,

        questions: [...questions].sort((a, b) => a.quarter - b.quarter || a.question.localeCompare(b.question)),
      };
    });

    const sortedGames = [...games].sort((a, b) => safeTimeMs(a.startTime) - safeTimeMs(b.startTime));

    const currentStreak = currentUserId ? computeRunningStreakAcrossGames(sortedGames, userPicks, freeKick) : 0;

    let leaderScore = 0;
    let leaderUid: string | null = null;

    const picksByUser = await loadPicksByUserForQuestionIds(questionIdsForRound);

    // for leader we do NOT apply free kick (optional).
    // If you want leaderboards to include free kicks, you'd need to load each user's freeKick doc too.
    // Keeping it simple for now: leader is pure streak without insurance.
    for (const uid of Object.keys(picksByUser)) {
      const score = computeRunningStreakAcrossGames(sortedGames, picksByUser[uid], { used: false });
      if (score > leaderScore) {
        leaderScore = score;
        leaderUid = uid;
      }
    }

    const leaderName = leaderUid ? await readUsername(leaderUid) : null;

    const response: PicksApiResponse = {
      games: sortedGames,
      roundNumber,
      currentStreak,
      leaderScore,
      leaderName,
      freeKick,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
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
        freeKick: { used: false },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
