// /app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

type Scope =
  | "overall"
  | "opening-round"
  | "round-1"
  | "round-2"
  | "round-3"
  | "round-4"
  | "round-5"
  | "round-6"
  | "round-7"
  | "round-8"
  | "round-9"
  | "round-10"
  | "round-11"
  | "round-12"
  | "round-13"
  | "round-14"
  | "round-15"
  | "round-16"
  | "round-17"
  | "round-18"
  | "round-19"
  | "round-20"
  | "round-21"
  | "round-22"
  | "round-23"
  | "finals"
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

      // avatar can be stored as avatarUrl (profile page) or photoURL (copied from auth)
      const avatarUrl =
        (data.avatarUrl as string | undefined) ||
        (data.photoURL as string | undefined) ||
        "";

      const displayName =
        firstName || surname
          ? `${firstName} ${surname}`.trim()
          : username || "Player";

      const currentStreak =
        typeof data.currentStreak === "number" ? data.currentStreak : 0;
      const longestStreak =
        typeof data.longestStreak === "number" ? data.longestStreak : 0;

      const streak = useLongest ? longestStreak : currentStreak;

      entries.push({
        uid,
        displayName,
        username,
        avatarUrl,
        rank: 0, // will be filled below
        streak,
      });
    });

    // Sort by streak desc, then name as tiebreaker
    entries.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.displayName.localeCompare(b.displayName);
    });

    // Assign ranks (1-based)
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
