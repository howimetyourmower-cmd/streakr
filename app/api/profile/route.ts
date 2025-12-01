// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

type ApiProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb2: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number;
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    let uid = url.searchParams.get("uid");

    // Fallback: try auth token if uid not provided
    if (!uid) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring("Bearer ".length).trim();
        try {
          const decoded = await auth.verifyIdToken(token);
          uid = decoded.uid;
        } catch {
          // ignore; we'll just return 401 below
        }
      }
    }

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid" },
        { status: 401 }
      );
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    const data = (snap.exists ? snap.data() : {}) as any;

    const firstName = (data.firstName as string) || "";
    const surname = (data.surname as string) || "";
    const username = (data.username as string) || "";
    const suburb = (data.suburb as string) || "";
    const state = (data.state as string) || "";
    const favouriteTeam = (data.team as string) || "";

    const displayName =
      (firstName || surname) ?
        `${firstName} ${surname}`.trim() :
        username || "Player";

    const currentStreak =
      typeof data.currentStreak === "number" ? data.currentStreak : 0;
    const longestStreak =
      typeof data.longestStreak === "number" ? data.longestStreak : 0;

    // For now keep these simple – you can wire real stats later
    const correctPercentage =
      typeof data.correctPercentage === "number"
        ? data.correctPercentage
        : 0;
    const roundsPlayed =
      typeof data.roundsPlayed === "number" ? data.roundsPlayed : 0;

    const stats: ApiProfileStats = {
      displayName,
      username,
      favouriteTeam,
      suburb2: suburb,
      state,
      currentStreak,
      bestStreak: longestStreak,
      correctPercentage,
      roundsPlayed,
    };

    // You can fill these in properly later – for now just return empty
    const recentPicks: ApiRecentPick[] = [];

    return NextResponse.json({ stats, recentPicks });
  } catch (error) {
    console.error("[/api/profile] Error:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
