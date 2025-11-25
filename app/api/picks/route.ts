// app/api/picks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

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
  isSponsorQuestion?: boolean;
  sport?: string;
  venue?: string;
  startTime?: string;
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
  roundNumber?: number;
};

/** Normalise Firestore Timestamp / Date / string → ISO string */
function toIso(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

export async function GET() {
  let roundNumber = 0;
  let seasonId = "season-2026";

  try {
    // --- 1) Try to read current season meta (but don't fail if missing) ---
    try {
      const metaSnap = await db.collection("meta").doc("currentSeason").get();
      if (metaSnap.exists) {
        const meta = metaSnap.data() as any;
        if (typeof meta.currentRound === "number") {
          roundNumber = meta.currentRound;
        }
        if (typeof meta.seasonId === "string" && meta.seasonId.trim()) {
          seasonId = meta.seasonId;
        }
      }
    } catch (metaErr) {
      console.error("meta/currentSeason read error:", metaErr);
      // fall back to defaults
    }

    // --- 2) Load games for this season + round ---
    const seasonRef = db.collection("config").doc(seasonId);
    const roundRef = seasonRef.collection("rounds").doc(String(roundNumber));

    const gamesSnap = await roundRef.collection("games").get();

    const games: ApiGame[] = [];

    for (const gameDoc of gamesSnap.docs) {
      const gData = gameDoc.data() as any;

      const match: string =
        gData.match ||
        `${gData.homeTeam ?? "Home"} vs ${gData.awayTeam ?? "Away"}`;
      const venue: string = gData.venue ?? "";
      const sport: string = gData.sport ?? "AFL";
      const startTimeIso: string =
        toIso(gData.startTime) ?? new Date().toISOString();

      // --- 3) Questions under each game ---
      const questionsSnap = await gameDoc.ref.collection("questions").get();
      const questions: ApiQuestion[] = [];

      questionsSnap.forEach((qDoc) => {
        const data = qDoc.data() as any;

        const status: QuestionStatus =
          (data.status as QuestionStatus) ?? "open";

        questions.push({
          id: qDoc.id,
          quarter: typeof data.quarter === "number" ? data.quarter : 1,
          question: data.question ?? "",
          status,
          yesPercent:
            typeof data.yesPercent === "number" ? data.yesPercent : 0,
          noPercent:
            typeof data.noPercent === "number" ? data.noPercent : 0,
          commentCount:
            typeof data.commentCount === "number" ? data.commentCount : 0,
          isSponsorQuestion: !!data.isSponsorQuestion, // <– sponsor flag
          sport: data.sport ?? sport,
          venue: data.venue ?? venue,
          startTime: toIso(data.startTime) ?? startTimeIso,
        });
      });

      games.push({
        id: gameDoc.id,
        match,
        venue,
        startTime: startTimeIso,
        sport,
        questions,
      });
    }

    const payload: PicksApiResponse = {
      games,
      roundNumber,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error in /api/picks:", err);
    // Still return 200 so the front-end doesn't show "Failed to load picks"
    const fallback: PicksApiResponse = {
      games: [],
      roundNumber,
    };
    return NextResponse.json(fallback);
  }
}
