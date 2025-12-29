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

  // sport-scoped stats
  currentStreak: number;
  longestStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number; // 0–1

  // ✅ Phase 2 (eligibility UI)
  gamesPlayed?: number; // ≥1 pick in a game (per round scope)
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

  // ✅ Phase 2 (winner strip)
  roundComplete: boolean;
};

function normalizeSport(input: string | null): Sport {
  const s = (input || "").trim().toUpperCase();
  if (s === "BBL") return "BBL";
  return "AFL"; // default
}

function num(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function scopeToRoundNumber(scope: Scope): number | null {
  if (scope === "opening-round") return 0;
  const m = scope.match(/^round-(\d+)$/);
  if (m?.[1]) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  // "overall" and "finals" are not numeric rounds in your current API design
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function readRoundCompleteFlag(sport: Sport, scope: Scope): Promise<boolean> {
  try {
    // ✅ Settlement can set this later:
    // leaderboardMeta/{sport}_{scope} -> { roundComplete: true }
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

async function hydrateGamesPlayedForTop(
  topEntries: LeaderboardEntry[],
  sport: Sport,
  roundNumber: number | null
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!topEntries.length) return map;
  if (roundNumber === null) return map;

  // Default 0 so UI is consistent even if no picks found
  topEntries.forEach((e) => map.set(e.uid, 0));

  // We only care about the top 50 users returned
  const uids = topEntries.map((e) => e.uid);

  // Firestore "in" query supports up to 10 values
  const uidChunks = chunk(uids, 10);

  // Track unique gameIds per uid
  const perUidGameIds = new Map<string, Set<string>>();

  for (const uidChunk of uidChunks) {
    try {
      // Assumption: picks are stored in collection "userPicks"
      // with fields: uid, roundNumber, gameId, outcome, (optional) sport
      // This matches your /api/user-picks payload (questionId/outcome/roundNumber/gameId).
      const q = db
        .collection("userPicks")
        .where("roundNumber", "==", roundNumber)
        .where("userid", "in", uidChunk);

      const snap = await q.get();

      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;

        const uid = String(d?.uid || "");
        const gameId = String(d?.gameId || "");

        if (!uid || !gameId) return;

        // If you store sport on the pick docs, we respect it.
        // If you don't, this simply won’t filter anything out.
        const pickSport = (d?.sport || "").toString().toUpperCase();
        if (pickSport && pickSport !== sport) return;

        if (!perUidGameIds.has(uid)) perUidGameIds.set(uid, new Set<string>());
        perUidGameIds.get(uid)!.add(gameId);
      });
    } catch (e) {
      // If the collection/index doesn't exist yet, we just keep gamesPlayed at 0.
      console.warn("hydrateGamesPlayed chunk query failed:", e);
    }
  }

  for (const [uid, set] of perUidGameIds.entries()) {
    map.set(uid, set.size);
  }

  return map;
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
        firstName || surname ? `${firstName} ${surname}`.trim() : username || "Player";

      /**
       * ✅ Sport-scoped stats live here:
       * users/{uid}.stats.AFL or users/{uid}.stats.BBL
       *
       * Backwards compatibility:
       * if stats[sport] doesn't exist yet, fall back to old top-level fields
       */
      const sportStats = data?.stats && data.stats[sport] ? data.stats[sport] : null;

      const currentStreak = sportStats ? num(sportStats.currentStreak, 0) : num(data.currentStreak, 0);
      const longestStreak = sportStats ? num(sportStats.longestStreak, 0) : num(data.longestStreak, 0);
      const totalWins = sportStats ? num(sportStats.totalWins, 0) : num(data.totalWins, 0);
      const totalLosses = sportStats ? num(sportStats.totalLosses, 0) : num(data.totalLosses, 0);

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
        // gamesPlayed hydrated later for top entries only
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
        ? topEntries.find((e) => e.uid === currentUid) || entries.find((e) => e.uid === currentUid) || null
        : null;

    // ✅ Phase 2: roundComplete flag (scope-aware, settlement can toggle this)
    const roundComplete = await readRoundCompleteFlag(sport, scope);

    // ✅ Phase 2: gamesPlayed for top 50 (scope-aware where possible)
    const roundNumber = scopeToRoundNumber(scope);
    const gamesPlayedByUid = await hydrateGamesPlayedForTop(topEntries, sport, roundNumber);

    const enrichedTop = topEntries.map((e) => ({
      ...e,
      gamesPlayed: gamesPlayedByUid.get(e.uid) ?? 0,
    }));

    // Ensure userEntry also has gamesPlayed if it’s outside top 50 (rare but possible)
    const enrichedUserEntry =
      userEntry && !enrichedTop.some((e) => e.uid === userEntry.uid)
        ? { ...userEntry, gamesPlayed: userEntry.gamesPlayed ?? 0 }
        : enrichedTop.find((e) => e.uid === userEntry?.uid) ?? userEntry;

    const response: LeaderboardApiResponse = {
      entries: enrichedTop,
      userEntry: enrichedUserEntry ?? null,
      userLifetime,
      roundComplete,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/leaderboard] Error:", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
