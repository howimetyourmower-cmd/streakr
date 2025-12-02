// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type ApiProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb2: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  wins: number;
  losses: number;
  totalPicks: number;
  correctPercentage: number;
  roundsPlayed: number;
};

type ApiRecentPick = {
  id: string;
  round: string | number;
  match: string;
  question: string;
  userPick: "yes" | "no";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string;
};

// ──────────────────────────────────────
// Rounds JSON → question meta lookup
// ──────────────────────────────────────

type JsonRow = {
  Round: string; // "OR", "R1", ...
  Game: number;
  Match: string;
  Venue: string;
  StartTime: string;
  Question: string;
  Quarter: number;
  Status: string;
};

const rows: JsonRow[] = rounds2026 as JsonRow[];

type QuestionMeta = {
  roundNumber: number;
  roundCode: string;
  match: string;
  question: string;
};

const questionMetaById: Record<string, QuestionMeta> = {};

function roundCodeToNumber(code: string): number {
  if (code === "OR") return 0;
  if (code.startsWith("R")) {
    const n = Number(code.slice(1));
    return Number.isNaN(n) ? 0 : n;
  }
  if (code === "FINALS") return 99;
  return 0;
}

// Build a deterministic questionId map, same pattern as /api/picks
(() => {
  const qIndexByGame: Record<string, number> = {};
  for (const row of rows) {
    const roundCode = row.Round;
    const roundNumber = roundCodeToNumber(roundCode);
    const gameKey = `${roundCode}-G${row.Game}`;
    const nextIndex = (qIndexByGame[gameKey] ?? 0) + 1;
    qIndexByGame[gameKey] = nextIndex;
    const questionId = `${gameKey}-Q${nextIndex}`;

    questionMetaById[questionId] = {
      roundNumber,
      roundCode,
      match: row.Match,
      question: row.Question,
    };
  }
})();

type QuestionStatusDoc = {
  roundNumber: number;
  questionId: string;
  status: QuestionStatus;
  outcome?: QuestionOutcome | "lock";
  updatedAt?: FirebaseFirestore.Timestamp;
};

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  let uid = url.searchParams.get("uid");

  if (!uid) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring("Bearer ".length).trim();
      try {
        const decoded = await auth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        // ignore
      }
    }
  }

  return uid ?? null;
}

/**
 * For this user, load all their picks and join with questionStatus to build:
 *  - wins, losses, totalPicks
 *  - roundsPlayed
 *  - recent settled picks (max 5)
 */
async function buildStatsFromPicks(
  uid: string
): Promise<{
  wins: number;
  losses: number;
  totalPicks: number;
  roundsPlayed: number;
  correctPercentage: number;
  recentPicks: ApiRecentPick[];
}> {
  const picksSnap = await db
    .collection("picks")
    .where("userId", "==", uid)
    .get();

  if (picksSnap.empty) {
    return {
      wins: 0,
      losses: 0,
      totalPicks: 0,
      roundsPlayed: 0,
      correctPercentage: 0,
      recentPicks: [],
    };
  }

  type PickRow = {
    id: string;
    questionId: string;
    roundNumber: number | null;
    pick: "yes" | "no";
    createdAt?: FirebaseFirestore.Timestamp;
  };

  const picks: PickRow[] = [];
  const roundNumbersSet = new Set<number>();

  picksSnap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const questionId = data.questionId as string | undefined;
    const pick = data.pick as "yes" | "no" | undefined;
    const rn =
      typeof data.roundNumber === "number" ? (data.roundNumber as number) : null;

    if (!questionId || (pick !== "yes" && pick !== "no")) return;

    picks.push({
      id: docSnap.id,
      questionId,
      roundNumber: rn,
      pick,
      createdAt: data.createdAt as FirebaseFirestore.Timestamp | undefined,
    });

    if (rn !== null) roundNumbersSet.add(rn);
  });

  if (!picks.length) {
    return {
      wins: 0,
      losses: 0,
      totalPicks: 0,
      roundsPlayed: 0,
      correctPercentage: 0,
      recentPicks: [],
    };
  }

  // Load questionStatus per round that this user has picks in
  const statusMap: Record<
    string,
    {
      status: QuestionStatus;
      outcome?: QuestionOutcome;
      updatedAt?: FirebaseFirestore.Timestamp;
    }
  > = {};

  for (const rn of Array.from(roundNumbersSet)) {
    const qsSnap = await db
      .collection("questionStatus")
      .where("roundNumber", "==", rn)
      .get();

    qsSnap.forEach((docSnap) => {
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

      const prev = statusMap[data.questionId];
      const updatedAt =
        data.updatedAt &&
        typeof (data.updatedAt as any).toMillis === "function"
          ? data.updatedAt
          : undefined;

      if (!prev) {
        statusMap[data.questionId] = {
          status: data.status,
          outcome,
          updatedAt,
        };
      } else {
        // Keep the latest by updatedAt
        const prevMs =
          prev.updatedAt &&
          typeof (prev.updatedAt as any).toMillis === "function"
            ? (prev.updatedAt as any).toMillis()
            : 0;
        const curMs =
          updatedAt && typeof (updatedAt as any).toMillis === "function"
            ? (updatedAt as any).toMillis()
            : 0;
        if (curMs >= prevMs) {
          statusMap[data.questionId] = {
            status: data.status,
            outcome,
            updatedAt,
          };
        }
      }
    });
  }

  let wins = 0;
  let losses = 0;
  let totalPicks = 0;
  const roundsPlayedSet = new Set<number>();

  type RecentPickInternal = ApiRecentPick & {
    settledAtMs: number;
  };

  const recentInternal: RecentPickInternal[] = [];

  for (const p of picks) {
    const qs = statusMap[p.questionId];
    const meta = questionMetaById[p.questionId];

    const roundNumber = meta?.roundNumber ?? p.roundNumber ?? 0;

    if (roundNumber !== null) {
      roundsPlayedSet.add(roundNumber);
    }

    let result: ApiRecentPick["result"] = "pending";
    let settledAtIso: string | undefined;
    let settledAtMs = 0;

    if (qs) {
      const { status, outcome, updatedAt } = qs;

      const isFinal =
        status === "final" || status === "void" || outcome === "void";

      if (isFinal) {
        if (outcome === "void" || status === "void") {
          result = "void";
        } else if (outcome === p.pick) {
          result = "correct";
          wins += 1;
          totalPicks += 1;
        } else {
          result = "wrong";
          losses += 1;
          totalPicks += 1;
        }

        if (updatedAt && typeof (updatedAt as any).toMillis === "function") {
          settledAtMs = (updatedAt as any).toMillis();
          settledAtIso = new Date(settledAtMs).toISOString();
        }
      }
    }

    // For "last 5 picks" we only show ones that are not pending
    if (result !== "pending") {
      recentInternal.push({
        id: p.id,
        round: roundNumber,
        match: meta?.match ?? "Match",
        question: meta?.question ?? "Question",
        userPick: p.pick,
        result,
        settledAt: settledAtIso,
        settledAtMs,
      });
    }
  }

  const roundsPlayed = roundsPlayedSet.size;
  const correctPercentage =
    wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  // Sort recent picks by settled time (desc) and take 5
  recentInternal.sort((a, b) => b.settledAtMs - a.settledAtMs);
  const recentPicks: ApiRecentPick[] = recentInternal
    .slice(0, 5)
    .map(({ settledAtMs, ...rest }) => rest);

  return {
    wins,
    losses,
    totalPicks,
    roundsPlayed,
    correctPercentage,
    recentPicks,
  };
}

// ──────────────────────────────────────
// Main handler
// ──────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const uid = await getUserIdFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 401 });
    }

    // Base user doc
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const data = (snap.exists ? snap.data() : {}) as any;

    const firstName = (data.firstName as string) || "";
    const surname = (data.surname as string) || "";
    const username = (data.username as string) || "";
    const suburb = (data.suburb as string) || "";
    const state = (data.state as string) || "";
    const favouriteTeam = (data.team as string) || "";

    const displayName =
      firstName || surname
        ? `${firstName} ${surname}`.trim()
        : username || "Player";

    const currentStreak =
      typeof data.currentStreak === "number" ? data.currentStreak : 0;
    const longestStreak =
      typeof data.longestStreak === "number" ? data.longestStreak : 0;

    // Build win/loss + recent picks from picks + questionStatus
    const {
      wins,
      losses,
      totalPicks,
      roundsPlayed,
      correctPercentage,
      recentPicks,
    } = await buildStatsFromPicks(uid);

    const stats: ApiProfileStats = {
      displayName,
      username,
      favouriteTeam,
      suburb2: suburb,
      state,
      currentStreak,
      bestStreak: longestStreak,
      wins,
      losses,
      totalPicks,
      correctPercentage,
      roundsPlayed,
    };

    return NextResponse.json({ stats, recentPicks });
  } catch (error) {
    console.error("[/api/profile] Error:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
