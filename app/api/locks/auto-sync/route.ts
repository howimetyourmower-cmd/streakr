// /app/api/locks/auto-sync/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";

type SquiggleGame = {
  squiggleId: number;
  startTimeUtc: string;
  status: "scheduled" | "live" | "final";
};

type QuestionStatusDoc = {
  questionId: string;
  status?: "open" | "pending" | "final" | "void";
  overrideMode?: "manual" | "auto";
};

function resolveRoundDocId(season: number, roundNumber: number): string {
  // Matches your confirmed Firestore reality
  if (roundNumber === 0) return `${season}-0`;
  if (roundNumber === 1) return `${season}-1`;
  return `afl-${season}-r${roundNumber}`;
}

async function fetchSquiggleGames(
  season: number,
  roundNumber: number
): Promise<SquiggleGame[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/squiggle/games?year=${season}&round=${roundNumber}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch Squiggle games");
  }

  const json = (await res.json()) as { games?: SquiggleGame[] };
  return Array.isArray(json.games) ? json.games : [];
}

export async function POST(req: NextRequest) {
  try {
    const { season, roundNumber } = (await req.json()) as {
      season?: number;
      roundNumber?: number;
    };

    if (
      typeof season !== "number" ||
      typeof roundNumber !== "number"
    ) {
      return NextResponse.json(
        { error: "season and roundNumber required" },
        { status: 400 }
      );
    }

    const roundDocId = resolveRoundDocId(season, roundNumber);

    // Fetch Squiggle games for this round
    const squiggleGames = await fetchSquiggleGames(season, roundNumber);

    // Determine if the round has started (any game live/final)
    const roundHasStarted = squiggleGames.some(
      (g) => g.status === "live" || g.status === "final"
    );

    if (!roundHasStarted) {
      return NextResponse.json({
        ok: true,
        locked: 0,
        message: "No games have started yet",
      });
    }

    // Load question status docs for this round
    const statusSnap = await db
      .collection("questionStatus")
      .where("roundNumber", "==", roundNumber)
      .get();

    let lockedCount = 0;

    const batch = db.batch();

    statusSnap.forEach((doc) => {
      const data = doc.data() as QuestionStatusDoc;

      // Manual override always wins
      if (data.overrideMode === "manual") return;

      // Already locked/finalised → skip
      if (data.status && data.status !== "open") return;

      batch.set(
        doc.ref,
        {
          status: "pending",
          overrideMode: "auto",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      lockedCount++;
    });

    if (lockedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      locked: lockedCount,
      round: roundDocId,
    });
  } catch (e) {
    console.error("[auto-lock-sync] error", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
