// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

export const dynamic = "force-dynamic";

type ApiProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb2: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number; // 0–100
  roundsPlayed: number;
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

type ProfileResponse = {
  stats: ApiProfileStats;
  recentPicks: ApiRecentPick[];
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid" },
        { status: 400 }
      );
    }

    // 1) Load user document
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    const userData = (userSnap.exists ? userSnap.data() : {}) as any;

    const currentStreak =
      typeof userData.currentStreak === "number"
        ? userData.currentStreak
        : 0;
    const longestStreak =
      typeof userData.longestStreak === "number"
        ? userData.longestStreak
        : 0;

    const displayName: string =
      (typeof userData.username === "string" && userData.username.trim()) ||
      (typeof userData.firstName === "string" && userData.firstName.trim()) ||
      (typeof userData.displayName === "string" && userData.displayName.trim()) ||
      (typeof userData.email === "string" && userData.email.trim()) ||
      "Player";

    const username: string =
      (typeof userData.username === "string" && userData.username.trim()) ||
      "";

    const favouriteTeam: string =
      (typeof userData.team === "string" && userData.team.trim()) || "";

    const suburb2: string =
      (typeof userData.suburb === "string" && userData.suburb.trim()) || "";

    const state: string | undefined =
      typeof userData.state === "string" ? userData.state : undefined;

    // 2) Basic rounds played from picks
    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", uid)
      .get();

    const roundSet = new Set<number>();

    picksSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (typeof data.roundNumber === "number") {
        roundSet.add(data.roundNumber);
      }
    });

    const roundsPlayed = roundSet.size;

    // NOTE: for now we keep correctPercentage + recentPicks simple.
    // We can wire them to questionStatus later if you want.
    const correctPercentage = 0;
    const recentPicks: ApiRecentPick[] = [];

    const stats: ApiProfileStats = {
      displayName,
      username,
      favouriteTeam,
      suburb2,
      state,
      currentStreak,
      bestStreak: longestStreak,
      correctPercentage,
      roundsPlayed,
    };

    const payload: ProfileResponse = {
      stats,
      recentPicks,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[/api/profile] Error loading profile", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
