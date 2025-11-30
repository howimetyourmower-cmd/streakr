// /app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Scope = "overall" | string;

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

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const idToken = authHeader.substring("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid ?? null;
  } catch (err) {
    console.error("[/api/leaderboard] Failed to verify ID token", err);
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") || "overall") as Scope;

    // season is currently unused but kept for future flexibility
    const _season = url.searchParams.get("season") || "";

    const currentUserId = await getUserIdFromRequest(req);

    // For "overall" we rank by longest streak, otherwise by current streak.
    const orderField =
      scope === "overall" ? "longestStreak" : "currentStreak";

    const snap = await db
      .collection("users")
      .orderBy(orderField, "desc")
      .orderBy("username", "asc")
      .limit(100)
      .get();

    const entries: LeaderboardEntry[] = [];
    let userEntry: LeaderboardEntry | null = null;
    let rank = 1;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;

      const rawStreak =
        typeof data[orderField] === "number" ? data[orderField] : 0;

      // Don’t show players with 0 streak for this scope.
      if (rawStreak <= 0) return;

      const displayName: string =
        data.firstName ||
        data.username ||
        data.email ||
        "Player";

      const entry: LeaderboardEntry = {
        uid: docSnap.id,
        displayName,
        username: data.username ?? "",
        avatarUrl: data.avatarUrl ?? "",
        rank,
        streak: rawStreak,
      };

      entries.push(entry);

      if (currentUserId && docSnap.id === currentUserId) {
        userEntry = entry;
      }

      rank += 1;
    });

    const response: LeaderboardApiResponse = {
      entries,
      userEntry,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/leaderboard] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
