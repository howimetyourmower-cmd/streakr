// /app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/admin";

export const dynamic = "force-dynamic";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  streak: number; // meaning depends on scope
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

type Scope = "overall" | string;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);

    const scopeParam = (searchParams.get("scope") ?? "overall") as Scope;
    const uidParam = searchParams.get("uid") || null;
    // season is currently unused but safe to accept
    // const seasonParam = searchParams.get("season");

    // -------------------------------
    // 1) Load all users
    // -------------------------------
    const usersSnap = await db.collection("users").get();

    const rows: Omit<LeaderboardEntry, "rank">[] = [];

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;

      const currentStreak =
        typeof data.currentStreak === "number" ? data.currentStreak : 0;
      const longestStreak =
        typeof data.longestStreak === "number" ? data.longestStreak : 0;

      // Decide which streak to show for this scope
      const streakForScope =
        scopeParam === "overall" ? longestStreak : currentStreak;

      const displayName: string =
        (typeof data.username === "string" && data.username.trim()) ||
        (typeof data.firstName === "string" && data.firstName.trim()) ||
        (typeof data.displayName === "string" && data.displayName.trim()) ||
        (typeof data.email === "string" && data.email.trim()) ||
        "Player";

      const username =
        typeof data.username === "string" && data.username.trim().length > 0
          ? data.username.trim()
          : undefined;

      const avatarUrl =
        typeof data.avatarUrl === "string" && data.avatarUrl.trim().length > 0
          ? data.avatarUrl.trim()
          : undefined;

      rows.push({
        uid: docSnap.id,
        displayName,
        username,
        avatarUrl,
        streak: streakForScope,
      });
    });

    // -------------------------------
    // 2) Sort & rank
    // -------------------------------
    rows.sort((a, b) => {
      // Highest streak first
      if (b.streak !== a.streak) return b.streak - a.streak;
      // Tie-break alphabetically by name
      return a.displayName.localeCompare(b.displayName);
    });

    const entries: LeaderboardEntry[] = rows.map((r, index) => ({
      ...r,
      rank: index + 1,
    }));

    // -------------------------------
    // 3) Logged-in user's row (if uid passed in)
    // -------------------------------
    const userEntry =
      uidParam !== null
        ? entries.find((e) => e.uid === uidParam) ?? null
        : null;

    const payload: LeaderboardApiResponse = {
      entries,
      userEntry,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[/api/leaderboard] Error loading leaderboard", error);
    return NextResponse.json(
      {
        entries: [],
        userEntry: null,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
