// app/api/profile/route.ts
import { NextResponse } from "next/server";

type ProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb?: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number; // 0-100
  roundsPlayed: number;
};

type RecentPick = {
  id: string;
  round: number;
  match: string;
  question: string;
  userPick: "Yes" | "No";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string;
};

type ProfileData = {
  stats: ProfileStats;
  recentPicks: RecentPick[];
};

export async function GET() {
  // TODO: later replace this with real Firestore logic.
  const mock: ProfileData = {
    stats: {
      displayName: "Glenn M",
      username: "glennmadds",
      favouriteTeam: "Carlton",
      suburb: "Bentleigh",
      state: "VIC",
      currentStreak: 5,
      bestStreak: 12,
      correctPercentage: 68,
      roundsPlayed: 14,
    },
    recentPicks: [
      {
        id: "1",
        round: 8,
        match: "Carlton v Brisbane",
        question:
          "Will Patrick Cripps get 6 or more disposals in the 1st quarter?",
        userPick: "Yes",
        result: "correct",
        settledAt: "2026-04-12T10:30:00Z",
      },
      {
        id: "2",
        round: 8,
        match: "Carlton v Brisbane",
        question: "Will Charlie Curnow kick a goal in the 2nd quarter?",
        userPick: "Yes",
        result: "wrong",
        settledAt: "2026-04-12T11:00:00Z",
      },
      {
        id: "3",
        round: 7,
        match: "Richmond v Collingwood",
        question: "Will Collingwood win or draw against Richmond?",
        userPick: "No",
        result: "correct",
        settledAt: "2026-04-05T09:50:00Z",
      },
      {
        id: "4",
        round: 7,
        match: "Richmond v Collingwood",
        question:
          "Will Nick Daicos have 7 or more disposals in the 3rd quarter?",
        userPick: "Yes",
        result: "pending",
      },
      {
        id: "5",
        round: 6,
        match: "Hawthorn v Essendon",
        question: "Will Hawthorn beat Essendon by 22 points or more?",
        userPick: "No",
        result: "void",
      },
    ],
  };

  return NextResponse.json(mock);
}
