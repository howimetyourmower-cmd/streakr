// /app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid" },
        { status: 400 }
      );
    }

    // ── 1) Load user doc ───────────────────────────────────────
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const emptyStats: ApiProfileStats = {
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
        recentPicks: [] as ApiRecentPick[],
      });
    }

    const u = userSnap.data() as any;

    const username: string = u.username ?? "";
    const firstName: string = u.firstName ?? "";
    const email: string = u.email ?? "";
    const suburb: string = u.suburb ?? "";
    const state: string = u.state ?? "";
    const favouriteTeam: string = u.team ?? "";

    const currentStreak: number =
      typeof u.currentStreak === "number" ? u.currentStreak : 0;
    const longestStreak: number =
      typeof u.longestStreak === "number" ? u.longestStreak : 0;

    const displayName =
      firstName ||
      username ||
      email ||
      "Player";

    // ── 2) Load picks for roundsPlayed + "Last 5 picks" ────────
    const picksSnap = await db
      .collection("picks")
      .where("userId", "==", uid)
      .limit(25)
      .get();

    const roundsPlayedSet = new Set<number>();
    const recentPicks: ApiRecentPick[] = [];

    picksSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;

      const roundNumber: number =
        typeof data.roundNumber === "number" ? data.roundNumber : 0;
      const match: string = data.match ?? "";
      const question: string = data.question ?? "";
      const pick: "yes" | "no" =
        data.pick === "no" ? "no" : "yes";

      roundsPlayedSet.add(roundNumber);

      // Build a simple "pending" recent pick entry.
      if (recentPicks.length < 5) {
        recentPicks.push({
          id: docSnap.id,
          round: roundNumber,
          match,
          question,
          userPick: pick,
          result: "pending",
          settledAt: undefined,
        });
      }
    });

    const roundsPlayed = roundsPlayedSet.size;

    // For now we keep correct% at 0 until we wire full results
    const correctPercentage = 0;

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

    return NextResponse.json({
      stats,
      recentPicks,
    });
  } catch (error) {
    console.error("[/api/profile] Error:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
