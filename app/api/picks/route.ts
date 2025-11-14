export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string
  questions: Question[];
};

type RoundDoc = {
  round?: number;
  season?: number;
  games?: any[];
};

const CURRENT_SEASON = 2026;

// Normalise a Firestore Timestamp | Date | undefined to ISO string
function toIsoString(value: Timestamp | Date | undefined): string {
  if (!value) return "";
  const v: any = value;
  const date: Date = v.toDate ? v.toDate() : v;
  return date.toISOString();
}

// Clamp status to allowed values
function normaliseStatus(raw: any): QuestionStatus {
  if (raw === "final" || raw === "pending" || raw === "void") {
    return raw;
  }
  return "open";
}

export async function GET() {
  try {
    const roundsSnap = await db
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .get();

    const games: Game[] = [];

    roundsSnap.forEach((roundDoc) => {
      const data = roundDoc.data() as RoundDoc;
      const gamesArr = data.games ?? [];

      gamesArr.forEach((g: any, gameIndex: number) => {
        const gameId = `${roundDoc.id}_game_${gameIndex}`;

        const match: string =
          g.match ?? g.fixture ?? g.matchup ?? "TBD match";
        const venue: string = g.venue ?? g.venueName ?? "TBD venue";

        const startTimeIso = toIsoString(
          (g.startTime ?? g.kickoffTime) as Timestamp | Date | undefined
        );

        const questions: Question[] = (g.questions ?? []).map(
          (q: any, qIndex: number) => {
            const rawStatus = q.status ?? "open";
            const status = normaliseStatus(rawStatus);

            let userPick: "yes" | "no" | undefined;
            if (typeof q.userPick === "string") {
              const lower = q.userPick.toLowerCase();
              if (lower === "yes" || lower === "no") {
                userPick = lower;
              }
            }

            const yesPercent =
              typeof q.yesPercent === "number" ? q.yesPercent : undefined;
            const noPercent =
              typeof q.noPercent === "number" ? q.noPercent : undefined;

            return {
              id: q.id ?? `${gameId}_q${qIndex + 1}`,
              quarter: Number(q.quarter ?? 1),
              question: q.question ?? "",
              status,
              userPick,
              yesPercent,
              noPercent,
            };
          }
        );

        games.push({
          id: gameId,
          match,
          venue,
          startTime: startTimeIso,
          questions,
        });
      });
    });

    // Sort by start time so they appear in order
    games.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error in /api/picks:", error);
    return NextResponse.json(
      { error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
