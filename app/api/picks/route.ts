// app/api/picks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import rounds2026 from "@/data/rounds-2026.json";

// --- Types that match what PicksClient expects ---

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  sport?: string;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

// --- JSON row type (from data/rounds-2026.json) ---

type RawRow = {
  Round: string;        // e.g. "OR", "R1", "R2"
  Game: number;         // 1..9 etc
  Match: string;        // "Sydney vs Carlton"
  Venue: string;        // "SCG, Sydney"
  StartTime: string;    // ISO-ish string
  Question: string;
  Quarter: number;
  Status: string;       // "Open", "Final", "Pending", "Void"
  Sport?: string;       // "AFL" etc (optional)
  // if you later add "IsSponsor": true to JSON, we can also use that
};

// --- Helpers ---

function slugifyMatch(match: string): string {
  return match
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseStatus(raw: string): QuestionStatus {
  const s = (raw || "").toLowerCase();
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  return "open";
}

// --- GET handler ---

export async function GET() {
  try {
    // 1) Load current round config from Firestore
    //    doc: config/season-2026
    const configSnap = await db.collection("config").doc("season-2026").get();

    let currentRoundKey = "OR"; // matches "Round" in JSON
    let currentRoundNumber = 0;
    let currentRoundId: string | undefined;

    if (configSnap.exists) {
      const data = configSnap.data() as any;
      if (typeof data.currentRoundKey === "string") {
        currentRoundKey = data.currentRoundKey;
      }
      if (typeof data.currentRoundNumber === "number") {
        currentRoundNumber = data.currentRoundNumber;
      }
      if (typeof data.currentRoundId === "string") {
        currentRoundId = data.currentRoundId;
      }
    }

    // 2) Filter JSON rows for the active round
    const allRows = rounds2026 as RawRow[];
    const roundRows = allRows.filter(
      (row) => (row.Round || "").toString() === currentRoundKey
    );

    if (!roundRows.length) {
      // No questions for this round in JSON – return empty but with roundNumber
      return NextResponse.json<PicksApiResponse>({
        games: [],
        roundNumber: currentRoundNumber,
      });
    }

    // 3) Build game + question structures from JSON
    const gamesMap = new Map<string, ApiGame>();
    const questionCounters: Record<string, number> = {};

    for (const row of roundRows) {
      const match = row.Match;
      const matchSlug = slugifyMatch(match);
      const sport = row.Sport ?? "AFL";

      // ensure game entry
      let game = gamesMap.get(matchSlug);
      if (!game) {
        game = {
          id: matchSlug,
          match,
          venue: row.Venue,
          startTime: row.StartTime,
          sport,
          questions: [],
        };
        gamesMap.set(matchSlug, game);
      }

      const quarterNum = Number(row.Quarter) || 0;
      const status = normaliseStatus(row.Status);

      // Build a stable questionId that matches your existing scheme:
      // e.g. "sydney-vs-carlton-q1-1"
      const qKey = `${matchSlug}-q${quarterNum}`;
      const indexWithinQuarter = (questionCounters[qKey] ?? 0) + 1;
      questionCounters[qKey] = indexWithinQuarter;

      const questionId = `${matchSlug}-q${quarterNum}-${indexWithinQuarter}`;

      const apiQuestion: ApiQuestion = {
        id: questionId,
        quarter: quarterNum,
        question: row.Question,
        status,
        yesPercent: 0,
        noPercent: 0,
        commentCount: 0,
        sport,
      };

      game.questions.push(apiQuestion);
    }

    const games: ApiGame[] = Array.from(gamesMap.values());

    // 4) Fetch sponsorQuestionId from Firestore for this round
    if (currentRoundId) {
      const roundSnap = await db.collection("rounds").doc(currentRoundId).get();
      if (roundSnap.exists) {
        const roundData = roundSnap.data() as any;
        const sponsorId: string | undefined = roundData?.sponsorQuestionId;

        if (sponsorId) {
          // mark the matching question
          for (const g of games) {
            for (const q of g.questions) {
              if (q.id === sponsorId) {
                q.isSponsorQuestion = true;
              }
            }
          }
        }
      }
    }

    // 5) Return response
    return NextResponse.json<PicksApiResponse>({
      games,
      roundNumber: currentRoundNumber,
    });
  } catch (err) {
    console.error("Error in /api/picks:", err);
    return NextResponse.json(
      { error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
