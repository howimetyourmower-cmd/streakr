// /app/leagues/LeaguesClient.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  Query,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type Momentum = "hot" | "rising" | "stable";

type TopLeague = {
  id: string;
  name: string;
  tagLine?: string;
  avgStreak: number;
  players: number;
  topStreakThisWeek?: number;
  momentum?: Momentum;
};

type ActivityItem = {
  id: string;
  timeAgo: string;
  message: string;
  type?: "join" | "streak" | "milestone" | "message";
};

type HallOfFameItem = {
  label: string;
  value: string;
  note?: string;
  trend?: "up" | "down" | "stable";
};

type MyLeague = {
  id: string;
  name: string;
  inviteCode: string;
  isManager: boolean;
  unreadMessages?: number;
  rank?: number;
  totalMembers?: number;
};

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

type Testimonial = {
  quote: string;
  author: string;
  leagueName: string;
  streak: number;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "Absolutely cooked the boys this week. 12-game streak and they're all sweating.",
    author: "Macca",
    leagueName: "Friday Night Lights",
    streak: 12,
  },
  {
    quote: "Started with 8 mates, now we've got 47 in the league. It's chaos and I love it.",
    author: "Jess T",
    leagueName: "Office Degenerates",
    streak: 9,
  },
  {
    quote: "Never thought I'd care this much about quarter predictions. Here we are.",
    author: "Big Dave",
    leagueName: "The Comeback Kids",
    streak: 15,
  },
];

function safeNum(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function getMomentum(avgStreak: number): Momentum {
  if (avgStreak >= 8) return "hot";
  if (avgStreak >= 5) return "rising";
  return "stable";
}

function getMomentumBadge(momentum?: Momentum) {
  switch (momentum) {
    case "hot":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-300 uppercase tracking-wider">
          <span className="animate-pulse">🔥</span> Hot
        </span>
      );
    case "rising":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
          <span>📈</span> Rising
        </span>
      );
    default:
      return null;
  }
}

function getActivityIcon(type?: ActivityItem["type"]) {
  switch (type) {
    case "join":
      return "👋";
    case "streak":
      return "🔥";
    case "milestone":
      return "🎯";
    default:
      return "💬";
  }
}

/**
 * Note: The hub intentionally uses only league-level fields.
 * We do NOT do per-member reads here (scale + speed).
 */
export default function LeaguesClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [topLeagues, setTopLeagues] = useState<TopLeague[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [hallOfFame, setHallOfFame] = useState<HallOfFameItem[]>([
    { label: "Longest streak ever", value: "-", note: "All-time record", trend: "stable" },
    { label: "Active leagues", value: "-", note: "Playing right now", trend: "up" },
    { label: "Total players", value: "-", note: "And counting", trend: "up" },
    { label: "Biggest league", value: "-", note: "Most competitive", trend: "stable" },
  ]);

  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Rotate testimonials every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // --- Top public leagues (with momentum badge) ---
  useEffect(() => {
    const leaguesRef = collection(db, "leagues");

    // If avgStreak isn't present on some docs, Firestore orderBy can still work
    // as long as those docs are missing the field (they'll appear last), but any
    // mixed types could error. We keep defensive parsing in the mapper.
    const qRef = query(
      leaguesRef,
      where("isPublic", "==", true),
      orderBy("avgStreak", "desc"),
      limit(12)
    ) as Query<DocumentData>;

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const docs: TopLeague[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const avgStreak = safeNum(data.avgStreak, 0);
          const memberCount = safeNum(data.memberCount, 0);

          const topStreakThisWeekRaw = data.topStreakThisWeek;
          const topStreakThisWeek =
            typeof topStreakThisWeekRaw === "number" && Number.isFinite(topStreakThisWeekRaw)
              ? topStreakThisWeekRaw
              : undefined;

          return {
            id: docSnap.id,
            name: safeStr(data.name, "Untitled league"),
            tagLine: safeStr(data.tagLine, ""),
            avgStreak,
            players: memberCount,
            topStreakThisWeek,
            momentum: getMomentum(avgStreak),
          };
        });

        setTopLeagues(docs);
      },
      (error) => {
        console.error("Error loading top leagues:", error);
        setTopLeagues([]);
      }
    );

    return () => unsub();
  }, []);

  // --- My leagues (membership) ---
  useEffect(() => {
    if (!user?.uid) {
      setMyLeagues([]);
      setSelectedLeagueId("");
      return;
    }

    const leaguesRef = collection(db, "leagues");
    const qRef = query(leaguesRef, where("memberIds", "array-contains", user.uid));

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const docs: MyLeague[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const isManager = data.managerId === user.uid;

          return {
            id: docSnap.id,
            name: safeStr(data.name, "Untitled league"),
            inviteCode: safeStr(data.inviteCode, "—"),
            isManager,
            unreadMessages: safeNum(data.unreadCounts?.[user.uid], 0),
            rank: typeof data.memberRanks?.[user.uid] === "number" ? data.memberRanks[user.uid] : undefined,
            totalMembers: safeNum(data.memberCount, 0),
          };
        });

        setMyLeagues(docs);
        setSelectedLeagueId((prev) => {
          if (prev) return prev;
          return docs.length ? docs[0].id : "";
        });
      },
      (error) => {
        console.error("Error loading my leagues:", error);
        setMyLeagues([]);
        setSelectedLeagueId("");
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // --- Activity feed (leagueActivity collection) ---
  useEffect(() => {
    const activityRef = collection(db, "leagueActivity");
    const qRef = query(activityRef, orderBy("createdAt", "desc"), limit(15));

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const items: ActivityItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const createdAt =
            data.createdAt?.toDate?.() ??
            (data.createdAt instanceof Date ? data.createdAt : new Date());

          return {
            id: docSnap.id,
            message: safeStr(data.message, ""),
            timeAgo: formatTimeAgo(createdAt),
            type: (data.type as ActivityItem["type"]) ?? "message",
          };
        });

        setActivityFeed(items);
      },
      (error) => {
        console.error("Error loading activity:", error);
        setActivityFeed([]);
      }
    );

    return () => unsub();
  }, []);

  // --- Global stats (Hall of fame) ---
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsDocRef = doc(db, "stats", "global");
        const statsSnap = await getDoc(statsDocRef);

        if (!statsSnap.exists()) {
          // keep default placeholders
          return;
        }

        const data = statsSnap.data() as any;

        setHallOfFame([
          {
            label: "Longest streak ever",
            value: String(data.longestStreak ?? "-"),
            note: "All-time record",
            trend: (data.longestStreakTrend as any) ?? "stable",
          },
          {
            label: "Active leagues",
            value: String(data.activeLeagues ?? data.totalLeagues ?? "-"),
            note: "Playing right now",
            trend: "up",
          },
          {
            label: "Total players",
            value: String(data.totalPlayers ?? "-"),
            note: "And counting",
            trend: "up",
          },
          {
            label: "Biggest league",
            value: String(data.biggestLeagueSize ?? "-"),
            note: "Most competitive",
            trend: (data.biggestLeagueTrend as any) ?? "stable",
          },
        ]);
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    loadStats();
  }, []);

  const selectedLeague = useMemo(
    () => myLeagues.find((l) => l.id === selectedLeagueId) ?? myLeagues[0],
    [myLeagues, selectedLeagueId]
  );

  const totalUnread = useMemo(() => {
    return myLeagues.reduce((sum, l) => sum + safeNum(l.unreadMessages, 0), 0);
  }, [myLeagues]);

  const handleCreateLeague = () => router.push("/leagues/create");
  const handleJoinLeague = () => router.push("/leagues/join");
  const handleManageLeague = () => {
    if (!selectedLeague) return;
    router.push(`/leagues/${selectedLeague.id}/manage`);
  };
  const handleViewLeague = () => {
    if (!selectedLeague) return;
    router.push(`/leagues/${selectedLeague.id}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-8">
        {/* Hero */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 px-4 py-1.5 text-xs font-bold text-orange-300 uppercase tracking-wide">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
            </span>
            {hallOfFame[1]?.value !== "-"
              ? `${hallOfFame[1].value} leagues live right now`
              : "Private leagues are live"}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl lg:text-6xl bg-gradient-to-r from-white via-orange-100 to-orange-300 bg-clip-text text-transparent">
                Battle Your Mates
              </h1>
              <p className="max-w-2xl text-base text-zinc-300 md:text-lg">
                Create a private league, share one code, and watch the banter fly.
                Your streak counts globally while you climb your own ladder. It&apos;s STREAKr,
                but now it&apos;s <span className="font-bold text-orange-400">personal</span>.
              </p>
            </div>

            {/* Social Proof Counters */}
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 text-center min-w-[120px]">
                <div className="text-2xl font-black text-orange-400">
                  {hallOfFame[2]?.value ?? "—"}
                </div>
                <div className="text-[11px] text-zinc-400 uppercase tracking-wide">Total Players</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 text-center min-w-[120px]">
                <div className="text-2xl font-black text-orange-400">
                  {myLeagues.length > 0 ? myLeagues.length : hallOfFame[1]?.value ?? "—"}
                </div>
                <div className="text-[11px] text-zinc-400 uppercase tracking-wide">
                  {myLeagues.length > 0 ? "Your Leagues" : "Active Leagues"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Quick Actions */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* Create */}
          <div className="group relative overflow-hidden rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/30 via-orange-500/10 to-zinc-900 p-6 shadow-xl shadow-orange-500/20 transition-all hover:shadow-2xl hover:shadow-orange-500/30 hover:border-orange-500/60">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/20 blur-2xl transition-all group-hover:bg-orange-500/30" />
            <div className="relative space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">Start Your League</h2>
                <span className="text-3xl">🏆</span>
              </div>
              <p className="text-sm text-zinc-100 leading-relaxed">
                You&apos;re the commissioner. Name it, share the code, and start the trash talk.
                Takes 30 seconds.
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-200/90">
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Instant setup, zero fees
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Share one invite code
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-orange-400">✓</span> Real-time chat & leaderboard
                </li>
              </ul>
              <button
                onClick={handleCreateLeague}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-bold text-black transition-all hover:bg-orange-400 hover:scale-[1.02] active:scale-[0.98]"
              >
                Create Your League <span className="text-lg">→</span>
              </button>
            </div>
          </div>

          {/* Join */}
          <div className="group relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/30 via-sky-500/10 to-zinc-900 p-6 shadow-xl shadow-sky-500/20 transition-all hover:shadow-2xl hover:shadow-sky-500/30 hover:border-sky-500/60">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/20 blur-2xl transition-all group-hover:bg-sky-500/30" />
            <div className="relative space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">Join a League</h2>
                <span className="text-3xl">🎯</span>
              </div>
              <p className="text-sm text-zinc-100 leading-relaxed">
                Got a code from the crew? Drop it in and you&apos;ll be on the ladder instantly.
                No approvals, no waiting.
              </p>
              <ul className="space-y-1.5 text-xs text-zinc-200/90">
                <li className="flex items-center gap-2">
                  <span className="text-sky-400">✓</span> Join unlimited leagues
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sky-400">✓</span> Compete on multiple ladders
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sky-400">✓</span> Still counts globally
                </li>
              </ul>
              <button
                onClick={handleJoinLeague}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-black transition-all hover:bg-sky-400 hover:scale-[1.02] active:scale-[0.98]"
              >
                Enter Invite Code <span className="text-lg">→</span>
              </button>
            </div>
          </div>

          {/* My Leagues */}
          <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-800/50 to-zinc-900 p-6 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold">My Leagues</h2>
                {totalUnread > 0 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white animate-pulse">
                    {totalUnread}
                  </span>
                )}
              </div>

              {!user && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-300">
                    Log in to see your leagues, check your rank, and jump into the chat.
                  </p>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-400">
                    💡 Your picks and streaks sync across all your leagues automatically
                  </div>
                </div>
              )}

              {user && myLeagues.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-300">
                    You&apos;re not in any leagues yet. Time to create one or join the action!
                  </p>
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
                    <p className="text-xs text-orange-200 font-medium">
                      <span className="text-base">🚀</span> Pro tip: Leagues with 8-15 players have the best
                      banter-to-competition ratio
                    </p>
                  </div>
                </div>
              )}

              {user && myLeagues.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-200">
                    {myLeagues.length === 1 ? "Your league:" : `Jump into one of your ${myLeagues.length} leagues:`}
                  </p>

                  <div className="space-y-2">
                    <select
                      value={selectedLeagueId}
                      onChange={(e) => setSelectedLeagueId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2 cursor-pointer"
                    >
                      {myLeagues.map((league) => (
                        <option key={league.id} value={league.id}>
                          {league.name}
                          {league.isManager ? " 👑" : ""}
                          {league.unreadMessages && league.unreadMessages > 0 ? ` (${league.unreadMessages} new)` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedLeague && (
                      <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm truncate">{selectedLeague.name}</span>
                              {selectedLeague.isManager && <span className="text-xs">👑</span>}
                            </div>
                            {selectedLeague.rank && selectedLeague.totalMembers ? (
                              <p className="text-xs text-zinc-400">
                                Rank {selectedLeague.rank} of {selectedLeague.totalMembers}
                              </p>
                            ) : (
                              <p className="text-xs text-zinc-500">Jump in to see the ladder and chat.</p>
                            )}
                          </div>

                          <div className="rounded-lg bg-zinc-900 border border-zinc-700 px-2.5 py-1 text-center">
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Code</div>
                            <div className="font-mono text-xs font-bold text-orange-400">
                              {selectedLeague.inviteCode || "—"}
                            </div>
                          </div>
                        </div>

                        {selectedLeague.unreadMessages && selectedLeague.unreadMessages > 0 && (
                          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs text-red-300 font-medium">
                              {selectedLeague.unreadMessages} new{" "}
                              {selectedLeague.unreadMessages === 1 ? "message" : "messages"}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={handleViewLeague}
                            className="flex-1 rounded-full bg-orange-500 hover:bg-orange-400 px-4 py-2 text-xs font-bold text-black transition-colors"
                          >
                            Open League
                          </button>
                          {selectedLeague.isManager && (
                            <button
                              onClick={handleManageLeague}
                              className="rounded-full border border-zinc-600 hover:border-orange-500 hover:bg-orange-500/10 px-4 py-2 text-xs font-bold text-zinc-100 transition-colors"
                            >
                              Manage
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Trending Leagues */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Trending Leagues</h2>
              <p className="text-sm text-zinc-400 mt-1">
                The hottest public leagues based on average streak and activity
              </p>
            </div>
          </div>

          {topLeagues.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-sm text-zinc-500">
                Public leagues will appear here once there&apos;s enough data. Be the first to create one!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topLeagues.map((league, idx) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg transition-all hover:border-orange-500/60 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1"
                >
                  {idx < 3 && (
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-500/10 blur-2xl transition-all group-hover:bg-orange-500/20" />
                  )}

                  <div className="relative space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {idx === 0 && <span className="text-lg">🥇</span>}
                          {idx === 1 && <span className="text-lg">🥈</span>}
                          {idx === 2 && <span className="text-lg">🥉</span>}
                          <h3 className="font-bold text-base truncate">{league.name}</h3>
                        </div>
                        {league.tagLine && (
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{league.tagLine}</p>
                        )}
                      </div>
                      {getMomentumBadge(league.momentum)}
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-800">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Streak</p>
                        <p className="text-2xl font-black text-orange-400">{league.avgStreak.toFixed(1)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Players</p>
                        <p className="text-2xl font-black text-zinc-300">{league.players}</p>
                      </div>
                      {league.topStreakThisWeek &&
                        league.topStreakThisWeek > league.avgStreak && (
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Top</p>
                            <p className="text-2xl font-black text-emerald-400">{league.topStreakThisWeek}</p>
                          </div>
                        )}
                    </div>

                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 group-hover:text-orange-300">
                        View league <span className="transition-transform group-hover:translate-x-1">→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Social Proof Section */}
        <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
          {/* Live Activity */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Live Activity</h2>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </div>
            </div>
            <p className="mb-5 text-sm text-zinc-400">
              Real-time updates from leagues across the platform
            </p>

            {activityFeed.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 text-center">
                <p className="text-sm text-zinc-500">
                  Activity feed will light up once players start making picks and joining leagues.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {activityFeed.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 rounded-xl bg-zinc-950/80 border border-zinc-800/50 px-4 py-3 text-sm transition-colors hover:border-zinc-700 hover:bg-zinc-950"
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">{getActivityIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-100 leading-relaxed">{item.message}</p>
                      <p className="mt-1.5 text-[10px] text-zinc-500 uppercase tracking-wide">{item.timeAgo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 p-4">
              <p className="text-xs text-zinc-300">
                <span className="font-bold text-orange-400">Want your league featured?</span>{" "}
                Get your crew active, keep those streaks climbing, and you&apos;ll show up here.{" "}
                <Link href="/picks" className="font-bold text-orange-400 hover:text-orange-300 underline">
                  Start picking →
                </Link>
              </p>
            </div>
          </div>

          {/* Stats + Testimonial */}
          <div className="flex flex-col gap-6">
            {/* Hall of Fame */}
            <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-900 p-6 shadow-lg shadow-orange-500/20">
              <h2 className="mb-3 text-lg font-bold">Platform Stats</h2>
              <p className="mb-4 text-xs text-zinc-100/80">
                Real numbers from the STREAKr community right now
              </p>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                {hallOfFame.map((item) => (
                  <div key={item.label} className="rounded-xl bg-zinc-950/70 border border-zinc-800 px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      {item.label}
                      {item.trend === "up" && <span className="text-emerald-400">↗</span>}
                      {item.trend === "down" && <span className="text-red-400">↘</span>}
                    </dt>
                    <dd className="mt-2 text-2xl font-black text-orange-300">{item.value}</dd>
                    {item.note && <p className="mt-1 text-[10px] text-zinc-400">{item.note}</p>}
                  </div>
                ))}
              </dl>
            </div>

            {/* Rotating Testimonials */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 min-h-[200px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">What Players Say</h3>
                  <div className="flex gap-1">
                    {testimonials.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentTestimonial(idx)}
                        className={`h-1.5 w-1.5 rounded-full transition-all ${
                          idx === currentTestimonial ? "bg-orange-500 w-4" : "bg-zinc-700 hover:bg-zinc-600"
                        }`}
                        aria-label={`View testimonial ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="relative min-h-[120px]">
                  {testimonials.map((testimonial, idx) => (
                    <div
                      key={idx}
                      className={`absolute inset-0 transition-all duration-500 ${
                        idx === currentTestimonial ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
                      }`}
                    >
                      <blockquote className="space-y-3">
                        <p className="text-sm text-zinc-100 leading-relaxed italic">
                          &quot;{testimonial.quote}&quot;
                        </p>
                        <footer className="flex items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-bold text-orange-400">{testimonial.author}</p>
                            <p className="text-zinc-500">{testimonial.leagueName}</p>
                          </div>
                          <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-center">
                            <div className="font-black text-orange-400">{testimonial.streak}</div>
                            <div className="text-[9px] text-zinc-500 uppercase">Streak</div>
                          </div>
                        </footer>
                      </blockquote>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-500/20 via-zinc-900 to-zinc-900 p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏅</span>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-purple-300">Coming Soon: League Prizes</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Top-performing leagues will earn bonus merch, badges, and exclusive rewards.
                    Make sure your league is ready for launch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-500/20 via-zinc-900 to-zinc-900 p-8 text-center shadow-xl shadow-orange-500/20">
          <h2 className="text-2xl font-black mb-3 md:text-3xl">Ready to Talk Trash?</h2>
          <p className="text-zinc-200 mb-6 max-w-2xl mx-auto">
            Create your league in 30 seconds, share one code with your mates,
            and let the competition begin. No fees, no BS, just pure footy prediction warfare.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={handleCreateLeague}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 hover:bg-orange-400 px-8 py-4 text-base font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              Create League Now <span className="text-xl">🚀</span>
            </button>
            <button
              onClick={handleJoinLeague}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 px-8 py-4 text-base font-bold text-white transition-all"
            >
              Join with Code
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
