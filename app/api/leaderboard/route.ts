import { NextResponse } from "next/server";
import { db } from "@/lib/admin"; // 🔧 adjust path if needed
import { Timestamp } from "firebase-admin/firestore";

type LeaderboardEntry = {
  rank: number;
  displayName: string;
  username: string;
  favouriteTeam: string;
  currentStreak: number;
  bestStreak: number;
};

type LeaderboardData = {
  round: number;
  season: number;
  roundLeaderboard: LeaderboardEntry[];
  seasonLeaderboard: LeaderboardEntry[];
  yourPosition: {
    roundRank: number | null;
    seasonRank: number | null;
    currentStreak: number;
    bestStreak: number;
  };
};

const CURRENT_SEASON = 2026;
// For now, treat YOU as this user
const DEMO_USER_ID = "demo-user";

// Streaks per user using ordered picks
function computeStreaks(picks: { result: string; settledAtDate?: Date }[]) {
  // Ensure time order
  const ordered = [...picks].sort((a, b) => {
    const aTime = a.settledAtDate ? a.settledAtDate.getTime() : 0;
    const bTime = b.settledAtDate ? b.settledAtDate.getTime() : 0;
    return aTime - bTime;
  });

  let current = 0;
  let best = 0;

  for (const p of ordered) {
    if (p.result === "correct") {
      current++;
      if (current > best) best = current;
    } else if (p.result === "wrong") {
      current = 0;
    }
  }

  return { current, best };
}

export async function GET() {
  try {
    // 1) Load all picks for current season
    const picksSnap = await db
      .collection("picks")
      .where("season", "==", CURRENT_SEASON)
      .get();

    type RawPick = {
      userID: string;
      round: number;
      result: string;
      settledAtDate?: Date;
    };

    const rawPicks: RawPick[] = picksSnap.docs.map((doc) => {
      const data = doc.data() as any;
      const ts = data.settledAt as Timestamp | undefined;
      const roundNumber = Number(data.round ?? 0); // round is string in your DB

      return {
        userID: (data.userID ?? "") as string,
        round: roundNumber,
        result: (data.result ?? "pending") as string,
        settledAtDate: ts ? ts.toDate() : undefined,
      };
    });

    // 2) Group picks by userID
    const picksByUser = new Map<string, RawPick[]>();
    for (const p of rawPicks) {
      if (!p.userID) continue;
      if (!picksByUser.has(p.userID)) picksByUser.set(p.userID, []);
      picksByUser.get(p.userID)!.push(p);
    }

    // 3) Compute streaks for each user
    type UserStats = {
      userID: string;
      currentStreak: number;
      bestStreak: number;
    };

    const userStats: UserStats[] = [];
    for (const [userID, picks] of picksByUser.entries()) {
      const { current, best } = computeStreaks(picks);
      userStats.push({ userID, currentStreak: current, bestStreak: best });
    }

    // 4) Load user profiles
    const userIDs = Array.from(picksByUser.keys());
    const userDocs = await Promise.all(
      userIDs.map((uid) => db.collection("users").doc(uid).get())
    );

    const userInfo = new Map<
      string,
      { displayName: string; username: string; favouriteTeam: string }
    >();

    userDocs.forEach((doc) => {
      if (!doc.exists) return;
      const data = doc.data() as any;
      userInfo.set(doc.id, {
        displayName: data.displayName ?? "Player",
        username: data.username ?? "user",
        favouriteTeam: data.favouriteTeam ?? "Unknown",
      });
    });

    // 5) Build leaderboard rows
    type Row = LeaderboardEntry & { userID: string };

    const rows: Row[] = userStats.map((s) => {
      const info = userInfo.get(s.userID);
      return {
        userID: s.userID,
        rank: 0, // temp
        displayName: info?.displayName ?? "Player",
        username: info?.username ?? "user",
        favouriteTeam: info?.favouriteTeam ?? "Unknown",
        currentStreak: s.currentStreak,
        bestStreak: s.bestStreak,
      };
    });

    // Sort by current streak desc, then best streak desc
    rows.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      return b.bestStreak - a.bestStreak;
    });

    // Assign ranks
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    // You don’t yet track “round-specific” streaks,
    // so for now we use the same list for both round + season.
    const roundLeaderboard: LeaderboardEntry[] = rows.slice(0, 100).map(
      ({ userID, ...rest }) =>
        rest // strip userID from public output
    );
    const seasonLeaderboard: LeaderboardEntry[] = roundLeaderboard;

    // Pick some round number: use max round we saw, or 1 if none
    const maxRound =
      rawPicks.length > 0
        ? rawPicks.reduce((max, p) => Math.max(max, p.round), 1)
        : 1;

    // Your position
    const yourRow = rows.find((r) => r.userID === DEMO_USER_ID);

    const payload: LeaderboardData = {
      round: maxRound,
      season: CURRENT_SEASON,
      roundLeaderboard,
      seasonLeaderboard,
      yourPosition: {
        roundRank: yourRow?.rank ?? null,
        seasonRank: yourRow?.rank ?? null,
        currentStreak: yourRow?.currentStreak ?? 0,
        bestStreak: yourRow?.bestStreak ?? 0,
      },
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error in /api/leaderboard:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
