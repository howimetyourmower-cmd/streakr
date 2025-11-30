// /app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

type Scope = "overall" | string;

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  streak: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "overall") as Scope;
    const uid = url.searchParams.get("uid");

    const isOverall = scope === "overall";
    const streakField = isOverall ? "longestStreak" : "currentStreak";

    // Single-field orderBy so we don't need any composite indexes.
    const snap = await db
      .collection("users")
      .orderBy(streakField, "desc")
      .limit(100)
      .get();

    const entries: LeaderboardEntry[] = [];
    let userEntry: LeaderboardEntry | null = null;

    let rank = 1;
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;

      const streakVal =
        typeof data[streakField] === "number" ? data[streakField] : 0;

      const username: string = data.username ?? "";
      const firstName: string = data.firstName ?? "";
      const email: string = data.email ?? "";
      const displayName =
        firstName ||
        username ||
        email ||
        "Player";

      const entry: LeaderboardEntry = {
        uid: docSnap.id,
        displayName,
        username: username || undefined,
        avatarUrl: data.avatarUrl ?? undefined,
        rank,
        streak: streakVal,
      };

      entries.push(entry);

      if (uid && docSnap.id === uid) {
        userEntry = entry;
      }

      rank += 1;
    });

    const response: LeaderboardApiResponse = {
      entries,
      userEntry,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/leaderboard] Error:", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
