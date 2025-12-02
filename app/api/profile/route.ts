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
  correctPercentage: number;
  roundsPlayed: number;
  // lifetime record
  lifetimeBestStreak: number;
  lifetimeWins: number;
  lifetimeLosses: number;
  lifetimeWinRate: number;
  lifetimeTotalPicks: number;
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

type QuestionStatusDoc = {
  roundNumber: number;
  questionId: string;
  status: QuestionStatus;
  outcome?: QuestionOutcome | "lock";
  updatedAt?: FirebaseFirestore.Timestamp;
};

type JsonRow = {
  Round: string | number;
  Game: number;
  Match: string;
  Venue: string;
  StartTime: string;
  Question: string;
  Quarter: number;
  Status: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toMillisSafe(v: any): number {
  return v && typeof v.toMillis === "function" ? v.toMillis() : 0;
}

/**
 * Map round code from JSON ("OR", "R1", 1, 2, "FINALS") → numeric roundNumber.
 * Opening Round = 0, R1 = 1, ..., Finals = 99.
 * This is defensive so we never get `.startsWith` errors again.
 */
function roundCodeToNumber(code: any): number {
  const str = String(code).trim().toUpperCase();

  if (str === "OR") return 0;
  if (str === "FINALS") return 99;

  if (str.startsWith("R")) {
    const n = Number(str.slice(1));
    return Number.isNaN(n) ? 0 : n;
  }

  // Plain number string like "1", "2" etc.
  const direct = Number(str);
  if (!Number.isNaN(direct)) return direct;

  return 0;
}

/**
 * Pre-build a map of questionId → metadata using the same ID pattern
 * as /api/picks:
 *   gameKey = `${roundCode}-G${row.Game}`
 *   questionId = `${gameKey}-Q${indexWithinGame}`
 */
type QuestionMeta = {
  roundCode: string;
  roundNumber: number;
  match: string;
  question: string;
};

const QUESTION_META: Record<string, QuestionMeta> = (() => {
  const rows = rounds2026 as JsonRow[];
  const gameCounters: Record<string, number> = {};
  const map: Record<string, QuestionMeta> = {};

  for (const row of rows) {
    const roundCode = String(row.Round).trim().toUpperCase();
    const roundNumber = roundCodeToNumber(roundCode);

    const gameKey = `${roundCode}-G${row.Game}`;
    if (!gameCounters[gameKey]) gameCounters[gameKey] = 0;
    gameCounters[gameKey] += 1;

    const qIndex = gameCounters[gameKey];
    const questionId = `${gameKey}-Q${qIndex}`;

    map[questionId] = {
      roundCode,
      roundNumber,
      match: row.Match,
      question: row.Question,
    };
  }

  return map;
})();

function resultFromOutcome(
  pick: "yes" | "no",
  statusDoc?: { status: QuestionStatus; outcome?: QuestionOutcome | "lock" }
): "correct" | "wrong" | "pending" | "void" {
  if (!statusDoc) return "pending";

  const { status, outcome } = statusDoc;

  if (outcome === "void" || status === "void") return "void";
  if (status !== "final" || (outcome !== "yes" && outcome !== "no")) {
    return "pending";
  }

  return outcome === pick ? "correct" : "wrong";
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    let uid = url.searchParams.get("uid");

    // Fallback: try auth token if uid not provided
    if (!uid) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring("Bearer ".length).trim();
        try {
          const decoded = await auth.verifyIdToken(token);
          uid = decoded.uid;
        } catch {
          // ignore – we'll handle missing uid below
        }
      }
    }

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid" },
        { status: 401 }
      );
    }

    // ── 1) Base user info ──────────────────────
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

    // ── 2) Pull all picks for this user ─────────────────
    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", uid)
      .get();

    type RawPick = {
      id: string;
      questionId: string;
      roundNumber: number;
      pick: "yes" | "no";
      createdAtMs: number;
    };

    const rawPicks: RawPick[] = [];
    const roundNumbersSet = new Set<number>();
    const questionIdsSet = new Set<string>();

    picksSnap.forEach((docSnap) => {
      const p = docSnap.data() as any;
      const questionId = p.questionId as string | undefined;
      const pick = p.pick as "yes" | "no" | undefined;
      if (!questionId || (pick !== "yes" && pick !== "no")) return;

      const roundNumber =
        typeof p.roundNumber === "number" ? p.roundNumber : 0;

      const createdAtMs =
        toMillisSafe(p.updatedAt) || toMillisSafe(p.createdAt) || 0;

      rawPicks.push({
        id: docSnap.id,
        questionId,
        roundNumber,
        pick,
        createdAtMs,
      });

      roundNumbersSet.add(roundNumber);
      questionIdsSet.add(questionId);
    });

    // If no picks, return early with defaults but still send base stats
    if (rawPicks.length === 0) {
      const stats: ApiProfileStats = {
        displayName,
        username,
        favouriteTeam,
        suburb2: suburb,
        state,
        currentStreak,
        bestStreak: longestStreak,
        correctPercentage: 0,
        roundsPlayed: 0,
        lifetimeBestStreak: longestStreak,
        lifetimeWins: 0,
        lifetimeLosses: 0,
        lifetimeWinRate: 0,
        lifetimeTotalPicks: 0,
      };

      return NextResponse.json({ stats, recentPicks: [] });
    }

    // ── 3) Load questionStatus for all relevant rounds ────────────
    const statusByKey: Record<
      string,
      { status: QuestionStatus; outcome?: QuestionOutcome | "lock"; updatedAtMs: number }
    > = {};

    const roundNumbers = Array.from(roundNumbersSet);
    for (const rn of roundNumbers) {
      const qsSnap = await db
        .collection("questionStatus")
        .where("roundNumber", "==", rn)
        .get();

      qsSnap.forEach((docSnap) => {
        const qs = docSnap.data() as QuestionStatusDoc;
        if (!qs.questionId || !qs.status) return;

        const key = `${qs.roundNumber}__${qs.questionId}`;
        const updatedAtMs = toMillisSafe(qs.updatedAt);

        const existing = statusByKey[key];
        if (!existing || updatedAtMs >= existing.updatedAtMs) {
          statusByKey[key] = {
            status: qs.status,
            outcome:
              qs.outcome === "yes" ||
              qs.outcome === "no" ||
              qs.outcome === "void"
                ? qs.outcome
                : undefined,
            updatedAtMs,
          };
        }
      });
    }

    // ── 4) Compute lifetime stats & build recent picks ────────────
    let wins = 0;
    let losses = 0;
    let voids = 0;

    const recentCandidates: (ApiRecentPick & {
      _settledAtMs: number;
    })[] = [];

    for (const p of rawPicks) {
      const key = `${p.roundNumber}__${p.questionId}`;
      const statusDoc = statusByKey[key];
      const result = resultFromOutcome(p.pick, statusDoc);

      // Lifetime aggregate
      if (result === "correct") wins += 1;
      else if (result === "wrong") losses += 1;
      else if (result === "void") voids += 1;

      const meta = QUESTION_META[p.questionId];

      const settledAtMs =
        statusDoc?.updatedAtMs || p.createdAtMs || 0;

      recentCandidates.push({
        id: p.id,
        round: meta?.roundNumber ?? p.roundNumber,
        match: meta?.match ?? "Match",
        question: meta?.question ?? p.questionId,
        userPick: p.pick,
        result,
        settledAt: settledAtMs
          ? new Date(settledAtMs).toISOString()
          : undefined,
        _settledAtMs: settledAtMs,
      });
    }

    const totalDecided = wins + losses;
    const totalNonVoid = wins + losses; // voids excluded from % for now

    const correctPercentage =
      totalNonVoid > 0 ? Math.round((wins / totalNonVoid) * 100) : 0;

    const winRate =
      totalNonVoid > 0 ? wins / totalNonVoid : 0;

    // Unique rounds played based on picks
    const roundsPlayed = roundNumbers.length;

    // Sort recent picks by settledAt / createdAt desc and take 5
    recentCandidates.sort((a, b) => b._settledAtMs - a._settledAtMs);
    const recentPicks: ApiRecentPick[] = recentCandidates
      .slice(0, 5)
      .map(({ _settledAtMs, ...rest }) => rest);

    const lifetimeTotalPicks = wins + losses + voids;

    const stats: ApiProfileStats = {
      displayName,
      username,
      favouriteTeam,
      suburb2: suburb,
      state,
      currentStreak,
      bestStreak: longestStreak,
      correctPercentage,
      roundsPlayed,
      lifetimeBestStreak: longestStreak,
      lifetimeWins: wins,
      lifetimeLosses: losses,
      lifetimeWinRate: winRate,
      lifetimeTotalPicks,
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
