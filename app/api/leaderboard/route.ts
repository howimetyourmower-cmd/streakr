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
  streak: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.substring("Bearer ".length).trim();
  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
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

    const currentUserId = await getUserIdFromRequest(req);

    // 1) Load all users
    const snap = await db.collection("users").get();

    const entries: LeaderboardEntry[] = [];

    snap.forEach((docSnap) => {
      const u = docSnap.data() as any;
      const uid = docSnap.id;

      const firstName: string = u.firstName ?? "";
      const surname: string = u.surname ?? "";
      const username: string = u.username ?? "";
      const email: string = u.email ?? "";
      const avatarUrl: string | undefined = u.avatarUrl ?? undefined;

      const displayName =
        (firstName && surname && `${firstName} ${surname}`) ||
        username ||
        email ||
        "Player";

      const currentStreak: number =
        typeof u.currentStreak === "number" ? u.currentStreak : 0;
      const longestStreak: number =
        typeof u.longestStreak === "number" ? u.longestStreak : 0;

      const streak =
        scope === "overall" ? longestStreak : currentStreak;

      // You *can* filter out zero-streak players by uncommenting this:
      // if (streak <= 0) return;

      entries.push({
        uid,
        displayName,
        username,
        avatarUrl,
        rank: 0, // we assign below
        streak,
      });
    });

    // 2) Sort and assign ranks
    entries.sort(
      (a, b) =>
        b.streak - a.streak ||
        a.displayName.localeCompare(b.displayName)
    );

    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // 3) Find current user's row (for the orange highlight)
    const userEntry =
      currentUserId &&
      entries.find((e) => e.uid === currentUserId) ||
      null;

    const payload: LeaderboardApiResponse = {
      entries,
      userEntry,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[/api/leaderboard] Unexpected error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
