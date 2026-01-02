// /app/api/leaderboard/route.ts
export const dynamic = "force-dynamic";

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
  | "finals";

type Sport = "AFL" | "BBL";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;

  rank: number;

  // ✅ Torpie ranking metric (ONLY)
  currentStreak: number;

  // Kept for backward compatibility if you still use these elsewhere
  longestStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number; // 0–1
};

type UserLifetimeStats = {
  currentStreak: number;
  longestStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[]; // ✅ return all so UI stats are real
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
  roundComplete: boolean; // kept (safe), even if UI doesn't use it
};

function normalizeSport(input: string | null): Sport {
  const s = (input || "").trim().toUpperCase();
  if (s === "BBL") return "BBL";
  return "AFL";
}

function num(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function readRoundCompleteFlag(sport: Sport, scope: Scope): Promise<boolean> {
  try {
    const docId = `${sport}_${scope}`;
    const ref = db.collection("leaderboardMeta").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const data = snap.data() as any;
    return data?.roundComplete === true;
  } catch (e) {
    console.warn("Failed to read leaderboardMeta roundComplete:", e);
    return false;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    const scope = (url.searchParams.get("scope") || "overall") as Scope;
    const sport: Sport = normalizeSport(url.searchParams.get("sport"));

    // Identify current user (for highlight + chase card)
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

    // ✅ Torpie rule: leaderboard ALWAYS ranks by CURRENT streak
    // Scope is kept for future round-specific leaderboards, but for now:
    // - ranking is currentStreak for all scopes
    // - if later you want per-round ranking, compute/store that separately.
    void scope;

    const snap = await db.collection("users").get();

    const entries: LeaderboardEntry[] = [];
    let userLifetime: UserLifetimeStats | null = null;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const uid = docSnap.id;

      const firstName = (data.firstName as string) || "";
      const surname = (data.surname as string) || "";
      const username = (data.username as string) || "";
      const avatarUrl = (data.avatarUrl as string) || (data.photoURL as string) || "";

      const displayName =
        (firstName || surname)
          ? `${firstName} ${surname}`.trim()
          : (username || "Player");

      // ✅ Sport-scoped stats preferred
      const sportStats = data?.stats && data.stats[sport] ? data.stats[sport] : null;

      const currentStreak = sportStats ? num(sportStats.currentStreak, 0) : num(data.currentStreak, 0);
      const longestStreak = sportStats ? num(sportStats.longestStreak, 0) : num(data.longestStreak, 0);
      const totalWins = sportStats ? num(sportStats.totalWins, 0) : num(data.totalWins, 0);
      const totalLosses = sportStats ? num(sportStats.totalLosses, 0) : num(data.totalLosses, 0);

      const totalPicks = sportStats
        ? num(sportStats.totalPicks, totalWins + totalLosses)
        : num(data.totalPicks, totalWins + totalLosses);

      const denom = totalPicks > 0 ? totalPicks : totalWins + totalLosses;
      const winPct = denom > 0 ? totalWins / denom : 0;

      const entry: LeaderboardEntry = {
        uid,
        displayName,
        username,
        avatarUrl,
        rank: 0,
        currentStreak,
        longestStreak,
        totalWins,
        totalLosses,
        winPct,
      };

      entries.push(entry);

      if (currentUid && uid === currentUid) {
        userLifetime = {
          currentStreak,
          longestStreak,
          totalWins,
          totalLosses,
          winPct,
        };
      }
    });

    // ✅ Deterministic sort: currentStreak desc, then winPct desc, then name asc
    entries.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return a.displayName.localeCompare(b.displayName);
    });

    // Assign ranks 1..N
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    const userEntry =
      currentUid ? entries.find((e) => e.uid === currentUid) || null : null;

    // Keep this field (harmless) in case UI wants a “ROUND COMPLETE” badge later
    const roundComplete = await readRoundCompleteFlag(sport, scope);

    const response: LeaderboardApiResponse = {
      entries, // ✅ full list so UI stats + bands are real
      userEntry,
      userLifetime,
      roundComplete,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/leaderboard] Error:", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
