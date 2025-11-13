import { NextResponse } from "next/server";

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  username: string;
  favouriteTeam: string;
  currentStreak: number;
  bestStreak: number;
};

type LeaderboardData = {
  round: number;
  season: number;
  roundLeaderboard: LeaderboardEntry[];
  seasonLeaderboard: LeaderboardEntry[];
  yourPosition: {
    roundRank: number | null;
    seasonRank: number | null;
    currentStreak: number;
    bestStreak: number;
  };
};

export async function GET() {
  // MOCK DATA for MVP – later we’ll replace with Firestore query
  const mock: LeaderboardData = {
    round: 8,
    season: 2026,
    roundLeaderboard: [
      {
        rank: 1,
        displayName: "Glenn M",
        username: "glennmadds",
        favouriteTeam: "Carlton",
        currentStreak: 9,
        bestStreak: 12,
      },
      {
        rank: 2,
        displayName: "Sarah B",
        username: "sarahb",
        favouriteTeam: "Collingwood",
        currentStreak: 8,
        bestStreak: 10,
      },
      {
        rank: 3,
        displayName: "Tom R",
        username: "tomr",
        favouriteTeam: "Brisbane",
        currentStreak: 7,
        bestStreak: 7,
      },
    ],
    seasonLeaderboard: [
      {
        rank: 1,
        displayName: "Sarah B",
        username: "sarahb",
        favouriteTeam: "Collingwood",
        currentStreak: 8,
        bestStreak: 18,
      },
      {
        rank: 2,
        displayName: "Glenn M",
        username: "glennmadds",
        favouriteTeam: "Carlton",
        currentStreak: 9,
        bestStreak: 17,
      },
      {
        rank: 3,
        displayName: "Tom R",
        username: "tomr",
        favouriteTeam: "Brisbane",
        currentStreak: 7,
        bestStreak: 15,
      },
    ],
    yourPosition: {
      roundRank: 1,
      seasonRank: 2,
      currentStreak: 9,
      bestStreak: 17,
    },
  };

  return NextResponse.json(mock);
}
