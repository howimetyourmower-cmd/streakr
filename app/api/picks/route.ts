import { NextResponse } from "next/server";
import { db } from "@/lib/admin";

// GET /api/picks
export async function GET() {
  try {
    // Read all games/questions from the "rounds" collection
    const snapshot = await db.collection("rounds").get();

    const games = snapshot.docs.map((doc) => {
      const data = doc.data() as any;

      return {
        id: doc.id,
        match: data.match ?? "",
        venue: data.venue ?? "",
        startTime: data.startTime ?? "", // should be ISO string or Timestamp
        status: data.status ?? "open",
        round: data.round ?? 1,
        season: data.season ?? 2026,
        questions: (data.questions ?? []).map((q: any, index: number) => ({
          id: q.id ?? `${doc.id}-q${index + 1}`,
          quarter: q.quarter ?? 1,
          question: q.question ?? "",
          status: q.status ?? "open",
          yesPercent: q.yesPercent ?? 0,
          noPercent: q.noPercent ?? 0,
        })),
      };
    });

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error in /api/picks:", error);
    return NextResponse.json(
      { error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
