// /app/api/leaderboard/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db, auth } from "@/lib/admin";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
  longestStreak: number;
};

export async function GET(req: NextRequest) {
  try {
    let currentUid: string | null = null;
    const authHeader = req.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await auth.verifyIdToken(
          authHeader.replace("Bearer ", "")
        );
        currentUid = decoded.uid;
      } catch {}
    }

    const snap = await db.collection("users").get();

    const entries: LeaderboardEntry[] = [];

    snap.forEach((doc) => {
      const d = doc.data() as any;

      const displayName =
        d.firstName || d.lastName
          ? `${d.firstName || ""} ${d.lastName || ""}`.trim()
          : d.username || "Player";

      entries.push({
        uid: doc.id,
        displayName,
        username: d.username,
        avatarUrl: d.avatarUrl || d.photoURL,
        rank: 0,
        currentStreak: Number(d.currentStreak || 0),
        longestStreak: Number(d.longestStreak || 0),
      });
    });

    entries.sort((a, b) => b.currentStreak - a.currentStreak);
    entries.forEach((e, i) => (e.rank = i + 1));

    return NextResponse.json({
      entries,
      userEntry: currentUid
        ? entries.find((e) => e.uid === currentUid) ?? null
        : null,
    });
  } catch (e) {
    console.error("[leaderboard] error", e);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
