// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

type ApiProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb2: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number; // placeholder for now
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

async function getUserIdFromRequest(
  req: NextRequest,
  explicitUid: string | null
): Promise<string | null> {
  if (explicitUid) return explicitUid;

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring("Bearer ".length).trim();
  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid ?? null;
  } catch (err) {
    console.error("[/api/profile] Failed to verify ID token", err);
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const uidParam = url.searchParams.get("uid");

    const uid = await getUserIdFromRequest(req, uidParam);
    if (!uid) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    // 1) Load user doc
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = (userSnap.exists ? userSnap.data() : {}) as any;

    const firstName: string = userData.firstName ?? "";
    const surname: string = userData.surname ?? "";
    const username: string = userData.username ?? "";
    const email: string = userData.email ?? "";
    const team: string = userData.team ?? "";
    const suburb: string = userData.suburb ?? "";
    const state: string = userData.state ?? "";

    const displayName =
      (firstName && surname && `${firstName} ${surname}`) ||
      username ||
      email ||
      "Player";

    const currentStreak: number =
      typeof userData.currentStreak === "number"
        ? userData.currentStreak
        : 0;

    const bestStreak: number =
      typeof userData.longestStreak === "number"
        ? userData.longestStreak
        : 0;

    // 2) Basic stats from picks: rounds played
    let roundsPlayed = 0;
    let correctPercentage = 0; // keep at 0 for now

    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", uid)
      .get();

    if (!picksSnap.empty) {
      const roundSet = new Set<number>();
      picksSnap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        if (typeof d.roundNumber === "number") {
          roundSet.add(d.roundNumber);
        }
      });
      roundsPlayed = roundSet.size;
    }

    const stats: ApiProfileStats = {
      displayName,
      username,
      favouriteTeam: team,
      suburb2: suburb,
      state,
      currentStreak,
      bestStreak,
      correctPercentage,
      roundsPlayed,
    };

    // 3) Recent picks – keep empty for now (Profile page will say “No settled picks yet”)
    const recentPicks: ApiRecentPick[] = [];

    return NextResponse.json({ stats, recentPicks });
  } catch (error) {
    console.error("[/api/profile] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
