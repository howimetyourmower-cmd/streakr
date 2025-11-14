export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type ProfileStats = {
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

type RecentPick = {
  id: string;
  round: string | number;
  match: string;
  question: string;
  userPick: "yes" | "no";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string; // ISO string
};

type InternalPick = {
  id: string;
  round: string | number;
  match: string;
  question: string;
  userPick: string;
  result: "correct" | "wrong" | "pending" | "void" | string;
  settledAt?: Timestamp | Date;
};

// GET /api/profile
export async function GET() {
  try {
    // For MVP we're hard-coding a demo user
    const userId = "demo-user";

    // 1) Load user profile
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data() as any;

    // 2) Load this user's picks for the season
    const picksSnap = await db
      .collection("picks")
      .where("userID", "==", userId)
      .where("season", "==", 2026)
      .orderBy("settledAt", "desc")
      .get();

    const picks: InternalPick[] = picksSnap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        round: data.round ?? "",
        match: data.match ?? "",
        question: data.question ?? "",
        // raw answer as string, we'll normalise later
        userPick: (data.answer ?? "").toString(),
        result: (data.result ?? "pending") as
          | "correct"
          | "wrong"
          | "pending"
          | "void"
          | string,
        settledAt: (data.settledAt ?? undefined) as
          | Timestamp
          | Date
          | undefined,
      };
    });

    // 3) Compute stats
    const totalPicks = picks.length;
    const correctPicks = picks.filter((p) => p.result === "correct").length;
    const roundsPlayedSet = new Set(picks.map((p) => String(p.round ?? "")));

    // Current streak = count from most recent until first non-correct
    let currentStreak = 0;
    for (const p of picks) {
      if (p.result === "correct") {
        currentStreak++;
      } else if (p.result === "wrong") {
        break;
      }
    }

    // Best streak = max streak of consecutive correct results
    let bestStreak = 0;
    let running = 0;
    for (const p of [...picks].reverse()) {
      if (p.result === "correct") {
        running++;
        if (running > bestStreak) bestStreak = running;
      } else if (p.result === "wrong") {
        running = 0;
      }
    }

    const correctPercentage =
      totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0;

    const stats: ProfileStats = {
      displayName: userData.displayName ?? "Player",
      username: userData.username ?? "",
      favouriteTeam: userData.favouriteTeam ?? "",
      suburb2: userData.suburb ?? "",
      state: userData.state ?? "",
      currentStreak,
      bestStreak,
      correctPercentage,
      roundsPlayed: roundsPlayedSet.size,
    };

    // 4) Last 5 settled picks (normalising userPick & settledAt safely)
    const recentPicks: RecentPick[] = picks.slice(0, 5).map((p) => {
      // normalise settledAt (Timestamp | Date | undefined) -> ISO string
      let settledAt: string | undefined;
      if (p.settledAt) {
        const value: any = p.settledAt;
        const date: Date = value.toDate ? value.toDate() : value;
        settledAt = date.toISOString();
      }

      const rawUserPick = p.userPick ?? "";
      const lower = rawUserPick.toLowerCase();

      const normalisedUserPick: "yes" | "no" =
        lower === "yes" ? "yes" : "no";

      const normalisedResult =
        p.result === "correct" ||
        p.result === "wrong" ||
        p.result === "pending" ||
        p.result === "void"
          ? p.result
          : "pending";

      return {
        id: p.id,
        round: p.round ?? "",
        match: p.match ?? "",
        question: p.question ?? "",
        userPick: normalisedUserPick,
        result: normalisedResult,
        settledAt,
      };
    });

    return NextResponse.json({ stats, recentPicks });
  } catch (error) {
    console.error("Error in /api/profile:", error);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
