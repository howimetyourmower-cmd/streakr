// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

type StatsResponse = {
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

type RecentPickResponse = {
  id: string;
  round: string | number;
  match: string;
  question: string;
  userPick: "yes" | "no";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string;
};

// Optional helper – only used if no ?uid is passed
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (err) {
    console.error("[/api/profile] Failed to verify ID token", err);
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    let uid = url.searchParams.get("uid");

    // Fallback to auth header if no uid query param
    if (!uid) {
      uid = await getUserIdFromRequest(req);
    }

    if (!uid) {
      return NextResponse.json(
        { error: "Unauthorised: missing uid" },
        { status: 401 }
      );
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      // Create a super-basic default so UI still works
      const emptyStats: StatsResponse = {
        displayName: "Player",
        username: "",
        favouriteTeam: "",
        suburb2: "",
        state: "",
        currentStreak: 0,
        bestStreak: 0,
        correctPercentage: 0,
        roundsPlayed: 0,
      };

      return NextResponse.json({
        stats: emptyStats,
        recentPicks: [] as RecentPickResponse[],
      });
    }

    const data = snap.data() as any;

    const displayName: string =
      data.firstName ||
      data.username ||
      data.email ||
      "Player";

    const stats: StatsResponse = {
      displayName,
      username: data.username ?? "",
      favouriteTeam: data.team ?? "",
      suburb2: data.suburb ?? "",
      state: data.state ?? "",
      currentStreak:
        typeof data.currentStreak === "number" ? data.currentStreak : 0,
      bestStreak:
        typeof data.longestStreak === "number" ? data.longestStreak : 0,
      // For now we keep these simple – you can wire them to real history later
      correctPercentage:
        typeof data.correctPercentage === "number"
          ? data.correctPercentage
          : 0,
      roundsPlayed:
        typeof data.roundsPlayed === "number" ? data.roundsPlayed : 0,
    };

    // To keep it robust and avoid complex joins, we’ll return an empty list
    // for recentPicks for now. Your Profile page already handles this nicely.
    const recentPicks: RecentPickResponse[] = [];

    return NextResponse.json({ stats, recentPicks });
  } catch (err) {
    console.error("[/api/profile] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
