// /app/api/leaderboard/route.ts
export const dynamic = "force-dynamic"
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

  // sport-scoped stats
  currentStreak: number;
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
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
};

function normalizeSport(input: string | null): Sport {
  const s = (input || "").trim().toUpperCase();
  if (s === "BBL") return "BBL";
  return "AFL"; // default
}

function num(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);

    const scope = (url.searchParams.get("scope") || "overall") as Scope;
    const sport: Sport = normalizeSport(url.searchParams.get("sport"));

    // Identify current user (for highlighting / lifetime box)
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

    // NOTE: your existing behavior: "overall" sorts by longestStreak,
    // everything else sorts by currentStreak.
    const useLongest = scope === "overall";

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
        firstName || surname
          ? `${firstName} ${surname}`.trim()
          : username || "Player";

      /**
       * ✅ Sport-scoped stats live here:
       * users/{uid}.stats.AFL or users/{uid}.stats.BBL
       *
       * Backwards compatibility:
       * if stats[sport] doesn't exist yet, fall back to old top-level fields
       * so nothing crashes while you migrate settlement.
       */
      const sportStats = (data?.stats && data.stats[sport]) ? data.stats[sport] : null;

      const currentStreak = sportStats
        ? num(sportStats.currentStreak, 0)
        : num(data.currentStreak, 0);

      const longestStreak = sportStats
        ? num(sportStats.longestStreak, 0)
        : num(data.longestStreak, 0);

      const totalWins = sportStats
        ? num(sportStats.totalWins, 0)
        : num(data.totalWins, 0);

      const totalLosses = sportStats
        ? num(sportStats.totalLosses, 0)
        : num(data.totalLosses, 0);

      const totalPicks = sportStats
        ? num(sportStats.totalPicks, totalWins + totalLosses)
        : num(data.totalPicks, totalWins + totalLosses);

      const games = totalPicks > 0 ? totalPicks : totalWins + totalLosses;
      const winPct = games > 0 ? totalWins / games : 0;

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

    // Sort by relevant streak (overall = longest, otherwise current)
    entries.sort((a, b) => {
      const aVal = useLongest ? a.longestStreak : a.currentStreak;
      const bVal = useLongest ? b.longestStreak : b.currentStreak;

      if (bVal !== aVal) return bVal - aVal;
      // tie-breaker: higher win% first
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return a.displayName.localeCompare(b.displayName);
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const topEntries = entries.slice(0, 50);

    const userEntry =
      currentUid
        ? topEntries.find((e) => e.uid === currentUid) ||
          entries.find((e) => e.uid === currentUid) ||
          null
        : null;

    const response: LeaderboardApiResponse = {
      entries: topEntries,
      userEntry,
      userLifetime,
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
