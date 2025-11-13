import { NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/admin"; // 🔧 adjust this path to your existing admin file
import { Timestamp } from "firebase-admin/firestore";

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

// 👉 For now we hard-code you as the logged-in user.
// Make sure this matches a doc id in your `users` collection
// AND the `userID` field in your `picks` docs.
const DEMO_USER_ID = "demo-user";
const CURRENT_SEASON = 2026;

// Streak calculation from ordered picks
function computeStreaks(picks: { result: string }[]) {
  let current = 0;
  let best = 0;

  for (const p of picks) {
    if (p.result === "correct") {
      current++;
      if (current > best) best = current;
    } else if (p.result === "wrong") {
      current = 0;
    }
    // pending / void do not change streak
  }

  return { current, best };
}

export async function GET() {
  try {
    // 1) Load the user doc
    const userSnap = await adminDb.collection("users").doc(DEMO_USER_ID).get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userSnap.data() as any;

    // 2) Load all picks for this user + season
    const picksSnap = await adminDb
      .collection("picks")
      .where("userID", "==", DEMO_USER_ID) // note: userID (capital D) to match your screenshot
      .where("season", "==", CURRENT_SEASON)
      .get();

    const rawPicks = picksSnap.docs.map((doc) => {
      const data = doc.data() as any;
      const ts = data.settledAt as Timestamp | undefined;

      const roundNumber = Number(data.round ?? 0); // your `round` is a string

      return {
        id: doc.id,
        round: roundNumber,
        match: (data.match ?? "") as string,
        question: (data.question ?? "") as string,
        userPick: (data.answer ?? "Yes") as "Yes" | "No",
        result: (data.result ?? "pending") as
          | "correct"
          | "wrong"
          | "pending"
          | "void",
        settledAtDate: ts ? ts.toDate() : undefined,
      };
    });

    // Sort by round then settledAt so streaks are in the right order
    rawPicks.sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      const aTime = a.settledAtDate ? a.settledAtDate.getTime() : 0;
      const bTime = b.settledAtDate ? b.settledAtDate.getTime() : 0;
      return aTime - bTime;
    });

    // 3) Compute stats
    const totalPicks = rawPicks.length;
    const correctPicks = rawPicks.filter((p) => p.result === "correct").length;
    const roundsPlayed = new Set(rawPicks.map((p) => p.round)).size;

    const { current, best } = computeStreaks(rawPicks);

    const correctPercentage =
      totalPicks === 0
        ? 0
        : Math.round((correctPicks / totalPicks) * 100);

    // Convert to API shape + sort newest first for recent picks
    const recentPicks: RecentPick[] = rawPicks
      .map((p) => ({
        id: p.id,
        round: p.round,
        match: p.match,
        question: p.question,
        userPick: p.userPick,
        result: p.result,
        settledAt: p.settledAtDate
          ? p.settledAtDate.toISOString()
          : undefined,
      }))
      .sort((a, b) => {
        const aTime = a.settledAt ? Date.parse(a.settledAt) : 0;
        const bTime = b.settledAt ? Date.parse(b.settledAt) : 0;
        return bTime - aTime;
      })
      .slice(0, 5);

    const stats: ProfileStats = {
      displayName: user.displayName ?? "Player",
      username: user.username ?? "user",
      favouriteTeam: user.favouriteTeam ?? "Unknown",
      suburb: user.suburb ?? undefined,
      state: user.state ?? undefined,
      currentStreak: current,
      bestStreak: best,
      correctPercentage,
      roundsPlayed,
    };

    const payload: ProfileData = {
      stats,
      recentPicks,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error in /api/profile:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
