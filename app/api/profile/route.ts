export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

// GET /api/profile
export async function GET() {
  try {
    // TEMP — replace' demo-user' once auth is wired in
    const userId = "demo-user";

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data() as any;

    const picksSnap = await db
      .collection("picks")
      .where("userID", "==", userId)
      .where("season", "==", 2026)
      .orderBy("settledAt", "desc")
      .get();

    const picks = picksSnap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        round: data.round ?? "",
        match: data.match ?? "",
        question: data.question ?? "",
        userPick: (data.answer ?? "").toString(),
        result: data.result ?? "pending",
        settledAt: data.settledAt ?? undefined,
      };
    });

    const total = picks.length;
    const correct = picks.filter((p) => p.result === "correct").length;

    let currentStreak = 0;
    for (const p of picks) {
      if (p.result === "correct") currentStreak++;
      else if (p.result === "wrong") break;
    }

    let bestStreak = 0;
    let running = 0;
    for (const p of [...picks].reverse()) {
      if (p.result === "correct") {
        running++;
        bestStreak = Math.max(bestStreak, running);
      } else running = 0;
    }

    const stats = {
      displayName: userData.displayName ?? "Player",
      username: userData.username ?? "",
      favouriteTeam: userData.favouriteTeam ?? "",
      suburb2: userData.suburb ?? "",
      state: userData.state ?? "",
      currentStreak,
      bestStreak,
      correctPercentage: total ? Math.round((correct / total) * 100) : 0,
      roundsPlayed: new Set(picks.map((p) => p.round)).size,
    };

    const recentPicks = picks.slice(0, 5).map((p) => ({
      ...p,
      settledAt:
        p.settledAt instanceof Timestamp
          ? p.settledAt.toDate().toISOString()
          : p.settledAt,
      userPick: p.userPick === "yes" ? "yes" : "no",
      result: ["correct", "wrong", "pending", "void"].includes(p.result)
        ? p.result
        : "pending",
    }));

    return NextResponse.json({ stats, recentPicks });
  } catch (err) {
    console.error("Error in /api/profile:", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 }
    );
  }
}
