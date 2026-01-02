import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

export const dynamic = "force-dynamic";

/* ───────────────────────────────────────────── */
/* Types */
/* ───────────────────────────────────────────── */

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type JsonRow = {
  Round: string;
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
  userPick?: "yes" | "no";
  correctOutcome?: QuestionOutcome;
  correctPick?: boolean | null;
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
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null;
};

/* ───────────────────────────────────────────── */
/* Helpers */
/* ───────────────────────────────────────────── */

const rows: JsonRow[] = rounds2026 as JsonRow[];

function getRoundCode(roundNumber: number) {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

async function getUserId(req: NextRequest): Promise<string | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;

  try {
    const decoded = await auth.verifyIdToken(h.replace("Bearer ", ""));
    return decoded.uid;
  } catch {
    return null;
  }
}

function normaliseOutcome(val?: string): QuestionOutcome | undefined {
  if (!val) return;
  const v = val.toLowerCase();
  if (["yes", "y"].includes(v)) return "yes";
  if (["no", "n"].includes(v)) return "no";
  if (["void"].includes(v)) return "void";
}

function normaliseStatus(val?: string): QuestionStatus {
  const v = (val || "").toLowerCase();
  if (v.includes("final")) return "final";
  if (v.includes("void")) return "void";
  if (v.includes("pend")) return "pending";
  return "open";
}

/* ───────────────────────────────────────────── */
/* CORE LOGIC — ROUND-SCOPED */
/* ───────────────────────────────────────────── */

function computeMatchStreak(
  game: ApiGame,
  userPicks: Record<string, "yes" | "no">
): number {
  let correct = 0;

  for (const q of game.questions) {
    const pick = userPicks[q.id];
    if (!pick) continue;

    if (q.status !== "final" && q.status !== "void") continue;
    if (!q.correctOutcome || q.correctOutcome === "void") continue;

    if (pick !== q.correctOutcome) return 0;
    correct++;
  }

  return correct;
}

function computeRoundStreak(
  games: ApiGame[],
  userPicks: Record<string, "yes" | "no">
): number {
  let streak = 0;
  for (const g of games) {
    const s = computeMatchStreak(g, userPicks);
    if (s === 0) return 0;
    streak += s;
  }
  return streak;
}

/* ───────────────────────────────────────────── */
/* GET */
/* ───────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const roundNumber = Number(url.searchParams.get("round") ?? 0);
    const roundCode = getRoundCode(roundNumber);

    const userId = await getUserId(req);

    /* ───── Load round games from JSON ───── */

    const roundRows = rows.filter((r) => r.Round === roundCode);
    if (!roundRows.length) {
      return NextResponse.json({
        games: [],
        roundNumber,
        currentStreak: 0,
        leaderScore: 0,
        leaderName: null,
      });
    }

    const gamesMap: Record<string, ApiGame> = {};

    for (const r of roundRows) {
      const gameId = `${roundCode}-G${r.Game}`;

      if (!gamesMap[gameId]) {
        gamesMap[gameId] = {
          id: gameId,
          match: r.Match,
          venue: r.Venue,
          sport: "AFL",
          startTime: r.StartTime,
          questions: [],
        };
      }

      const qIndex = gamesMap[gameId].questions.length + 1;
      const qId = `${gameId}-Q${qIndex}`;

      gamesMap[gameId].questions.push({
        id: qId,
        gameId,
        quarter: r.Quarter,
        question: r.Question,
        status: normaliseStatus(r.Status),
        sport: "AFL",
      });
    }

    const games = Object.values(gamesMap);

    /* ───── Load PICKS — ROUND ONLY ───── */

    const userPicks: Record<string, "yes" | "no"> = {};
    const picksByUser: Record<string, Record<string, "yes" | "no">> = {};

    const picksSnap = await db
      .collection("picks")
      .where("roundNumber", "==", roundNumber)
      .get();

    picksSnap.forEach((d) => {
      const { userId: uid, questionId, pick } = d.data();
      if (!uid || !questionId || !pick) return;

      if (!picksByUser[uid]) picksByUser[uid] = {};
      picksByUser[uid][questionId] = pick;

      if (uid === userId) userPicks[questionId] = pick;
    });

    /* ───── Load QUESTION RESULTS — ROUND ONLY ───── */

    const statusSnap = await db
      .collection("questionStatus")
      .where("roundNumber", "==", roundNumber)
      .get();

    const statusMap: Record<
      string,
      { status: QuestionStatus; outcome?: QuestionOutcome }
    > = {};

    statusSnap.forEach((d) => {
      const data = d.data();
      statusMap[data.questionId] = {
        status: normaliseStatus(data.status),
        outcome: normaliseOutcome(data.outcome),
      };
    });

    for (const g of games) {
      for (const q of g.questions) {
        const s = statusMap[q.id];
        if (!s) continue;
        q.status = s.status;
        q.correctOutcome = s.outcome;

        const pick = userPicks[q.id];
        if (pick && s.outcome && s.outcome !== "void") {
          q.correctPick = pick === s.outcome;
        } else if (pick && s.outcome === "void") {
          q.correctPick = null;
        }
      }
    }

    /* ───── Compute CURRENT + LEADER (ROUND ONLY) ───── */

    const currentStreak = userId
      ? computeRoundStreak(games, userPicks)
      : 0;

    let leaderScore = 0;

    for (const uid of Object.keys(picksByUser)) {
      const score = computeRoundStreak(games, picksByUser[uid]);
      if (score > leaderScore) leaderScore = score;
    }

    const response: PicksApiResponse = {
      games,
      roundNumber,
      currentStreak,
      leaderScore,
      leaderName: null,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("[/api/picks] error", e);
    return NextResponse.json(
      {
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
