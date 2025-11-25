import { NextResponse } from "next/server";
import rounds from "@/data/rounds-2026.json"; // IMPORTANT

export const runtime = "nodejs";

export async function GET() {
  try {
    // Determine current round from meta
    let roundNumber = 0;

    // You can later hook this into Firestore meta/currentSeason
    // For now keep it 0 for Opening Round.

    // Filter JSON for this round
    const games = rounds
      .filter((q: any) => q.Round === "OR")       // Opening Round
      .reduce((acc: any[], q: any) => {
        const match = q.Match;
        const venue = q.Venue;
        const startTime = q.StartTime;

        let game = acc.find((g) => g.match === match);
        if (!game) {
          game = {
            id: match.toLowerCase().replace(/\s+/g, "-"),
            match,
            venue,
            startTime,
            sport: "AFL",
            questions: [],
          };
          acc.push(game);
        }

        game.questions.push({
          id: `${game.id}-q${q.Quarter}-${game.questions.length + 1}`,
          quarter: q.Quarter,
          question: q.Question,
          status: q.Status.toLowerCase(),
          sport: "AFL",
          venue,
          startTime,
          isSponsorQuestion: q.IsSponsor === true,
        });

        return acc;
      }, []);

    return NextResponse.json({ games, roundNumber });
  } catch (e) {
    console.error("API /picks error:", e);
    return NextResponse.json(
      { games: [], roundNumber: 0, error: "Failed to load picks" },
      { status: 500 }
    );
  }
}
