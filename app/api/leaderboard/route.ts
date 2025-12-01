// /app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

type Scope =
  | "overall"
  | "opening-round"
  | "round-1"
  | "round-2"
  | string; // we only really care about "overall" vs not

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
    const scope = (url.searchParams.get("scope") || "overall") as Scope;

    // Identify current user (for highlighting / "You" row)
    let currentUid: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring("Bearer ".length).trim();
      try {
        const decoded = await auth.verifyIdToken(token);
        currentUid = decoded.uid;
      } catch {
        currentUid = null;
      }
    }

    // We keep it simple: for "overall" use longestStreak, otherwise currentStreak.
    const useLongest = scope === "overall";

    const snap = await db.collection("users").get();

    const entries: LeaderboardEntry[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const uid = docSnap.id;

      const firstName = (data.firstName as string) || "";
      const surname = (data.surname as string) || "";
      const username = (data.username as string) || "";
      const avatarUrl = (data.avatarUrl as string) || "";

      const displayName =
        (firstName || surname)
          ? `${firstName} ${surname}`.trim()
          : username || "Player";

      const currentStreak =
        typeof data.currentStreak === "number" ? data.currentStreak : 0;
      const longestStreak =
        typeof data.longestStreak === "number" ? data.longestStreak : 0;

      const streak = useLongest ? longestStreak : currentStreak;

      // You can choose to hide pure zero rows; for testing keep everyone
      entries.push({
        uid,
        displayName,
        username,
        avatarUrl,
        rank: 0, // temp, we’ll fill below
        streak,
      });
    });

    // Sort by streak desc, then name as tiebreaker
    entries.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.displayName.localeCompare(b.displayName);
    });

    // Assign ranks (1-based, with ties having same rank if you want; for
    // now keep it simple: index + 1)
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const topEntries = entries.slice(0, 50); // safety cap

    const userEntry =
      currentUid
        ? topEntries.find((e) => e.uid === currentUid) ||
          entries.find((e) => e.uid === currentUid) ||
          null
        : null;

    const response: LeaderboardApiResponse = {
      entries: topEntries,
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
