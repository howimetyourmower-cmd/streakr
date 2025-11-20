"use client";

import React, { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type TopLeague = {
  id: string;
  name: string;
  tagLine?: string;
  avgStreak: number;
  players: number;
};

type ActivityItem = {
  id: string;
  timeAgo: string;
  message: string;
};

type HallOfFameItem = {
  label: string;
  value: string;
  note?: string;
};

type MyLeague = {
  id: string;
  name: string;
  inviteCode: string;
  isManager: boolean;
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

export default function LeaguesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [topLeagues, setTopLeagues] = useState<TopLeague[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [hallOfFame, setHallOfFame] = useState<HallOfFameItem[]>([
    { label: "Longest streak", value: "-", note: "Global all-time" },
    { label: "Best round", value: "-", note: "Perfect picks" },
    { label: "Leagues this season", value: "-", note: "And counting" },
    { label: "Biggest league", value: "-", note: "Players in one crew" },
  ]);

  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  // --- Top public leagues ---
  useEffect(() => {
    const leaguesRef = collection(db, "leagues");

    // Adjust the where/orderBy fields to match your schema if different
    const q = query(
      leaguesRef,
      where("isPublic", "==", true),
      orderBy("avgStreak", "desc"),
      limit(8)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: data.name ?? "Untitled league",
            tagLine: data.tagLine ?? "",
            avgStreak: typeof data.avgStreak === "number" ? data.avgStreak : 0,
            players:
              typeof data.memberCount === "number" ? data.memberCount : 0,
          } satisfies TopLeague;
        });
        setTopLeagues(docs);
      },
      (error) => {
        console.error("Error loading top leagues:", error);
      }
    );

    return () => unsub();
  }, []);

  // --- My leagues (where current user is a member) ---
  useEffect(() => {
    if (!user?.uid) {
      setMyLeagues([]);
      setSelectedLeagueId("");
      return;
    }

    const leaguesRef = collection(db, "leagues");

    // This assumes leagues have a memberIds: string[] field containing user IDs.
    // If you use a different membership structure (e.g. leagueMembers collection),
    // update this query accordingly.
    const q = query(leaguesRef, where("memberIds", "array-contains", user.uid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const isManager = data.managerId === user.uid;

          return {
            id: docSnap.id,
            name: data.name ?? "Untitled league",
            inviteCode: data.inviteCode ?? "—",
            isManager,
          } satisfies MyLeague;
        });

        setMyLeagues(docs);
        if (docs.length && !selectedLeagueId) {
          setSelectedLeagueId(docs[0].id);
        }
      },
      (error) => {
        console.error("Error loading my leagues:", error);
      }
    );

    return () => unsub();
  }, [user?.uid, selectedLeagueId]);

  // --- Activity feed (leagueActivity collection) ---
  useEffect(() => {
    const activityRef = collection(db, "leagueActivity");
    const q = query(activityRef, orderBy("createdAt", "desc"), limit(8));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: ActivityItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const createdAt =
            data.createdAt?.toDate?.() ??
            (data.createdAt instanceof Date ? data.createdAt : new Date());

          return {
            id: docSnap.id,
            message: data.message ?? "",
            timeAgo: formatTimeAgo(createdAt),
          };
        });

        setActivityFeed(items);
      },
      (error) => {
        console.error("Error loading activity:", error);
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

        if (!statsSnap.exists()) return;

        const data = statsSnap.data() as any;

        setHallOfFame([
          {
            label: "Longest streak",
            value: String(data.longestStreak ?? "-"),
            note: "Global all-time",
          },
          {
            label: "Best round",
            value: String(data.bestRound ?? "-"),
            note: "Perfect picks",
          },
          {
            label: "Leagues this season",
            value: String(data.totalLeagues ?? "-"),
            note: "And counting",
          },
          {
            label: "Biggest league",
            value: String(data.biggestLeagueSize ?? "-"),
            note: "Players in one crew",
          },
        ]);
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    loadStats();
  }, []);

  const selectedLeague =
    myLeagues.find((l) => l.id === selectedLeagueId) ?? myLeagues[0];

  const handleCreateLeague = () => {
    // TODO: route to your "Create league" flow, e.g.
    // router.push("/leagues/create");
    router.push("/leagues/create");
  };

  const handleJoinLeague = () => {
    // TODO: route to your "Join league" flow, e.g.
    // router.push("/leagues/join");
    router.push("/leagues/join");
  };

  const handleManageLeague = () => {
    if (!selectedLeague) return;
    // TODO: adjust path to your league manager page route
    router.push(`/leagues/${selectedLeague.id}/manage`);
  };

  const handleViewLadder = () => {
    if (!selectedLeague) return;
    // TODO: adjust path to your league ladder page route
    router.push(`/leagues/${selectedLeague.id}/ladder`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-20 pt-10">
        {/* Page heading */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
            </span>
            Private leagues are live
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Leagues
          </h1>
          <p className="max-w-2xl text-sm text-zinc-300 md:text-base">
            Play STREAKr with your mates, work crew or fantasy league.
            Create a private league, invite your friends with a code, and
            battle it out on your own ladder while still counting towards
            the global Streak leaderboard.
          </p>
        </header>

        {/* Main league boxes */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Create league */}
          <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-900 p-5 shadow-lg shadow-orange-500/30">
            <h2 className="mb-2 text-lg font-semibold">Create a league</h2>
            <p className="mb-4 text-sm text-zinc-200">
              You&apos;re the commish. Name your league, set how many mates
              can join, and share a single invite code with your group.
            </p>
            <ul className="mb-4 space-y-1 text-xs text-zinc-200/90">
              <li>• Automatically become League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone&apos;s streak still counts globally</li>
            </ul>
            <button
              onClick={handleCreateLeague}
              className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              Create league
            </button>
          </div>

          {/* Join league */}
          <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-zinc-900 to-zinc-900 p-5 shadow-lg shadow-sky-500/30">
            <h2 className="mb-2 text-lg font-semibold">Join a league</h2>
            <p className="mb-4 text-sm text-zinc-200">
              Got a code from a mate? Drop it in and you&apos;ll appear on
              that league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="mb-4 space-y-1 text-xs text-zinc-200/90">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost – still 100% free</li>
            </ul>
            <button
              onClick={handleJoinLeague}
              className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400"
            >
              Join with a code
            </button>
          </div>

          {/* My leagues */}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5">
            <h2 className="mb-2 text-lg font-semibold">My leagues</h2>
            {!user && (
              <p className="mb-4 text-sm text-zinc-300">
                Log in to see and manage your leagues.
              </p>
            )}
            {user && myLeagues.length === 0 && (
              <p className="mb-4 text-sm text-zinc-300">
                You&apos;re not in any leagues yet. Create one or join with a
                code to get started.
              </p>
            )}
            {user && myLeagues.length > 0 && (
              <>
                <p className="mb-4 text-sm text-zinc-200">
                  Jump back into one of your existing leagues, manage invites
                  or check your ladder position.
                </p>

                <div className="space-y-3">
                  <label className="text-xs font-medium text-zinc-400">
                    Select a league
                  </label>
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2"
                  >
                    {myLeagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                        {league.isManager ? " (Manager)" : ""}
                      </option>
                    ))}
                  </select>

                  {selectedLeague && (
                    <div className="rounded-xl bg-zinc-950/80 px-3 py-3 text-xs text-zinc-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {selectedLeague.name}
                        </span>
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                          Invite code:{" "}
                          <span className="font-mono">
                            {selectedLeague.inviteCode || "—"}
                          </span>
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        {selectedLeague.isManager
                          ? "You’re the League Manager. Share the code, approve new players and keep the banter flowing."
                          : "You’re a player in this league. Keep your streak alive and climb the ladder."}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {selectedLeague.isManager && (
                          <button
                            onClick={handleManageLeague}
                            className="flex-1 rounded-full border border-zinc-600 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:border-orange-500 hover:text-orange-300"
                          >
                            League manager
                          </button>
                        )}
                        <button
                          onClick={handleViewLadder}
                          className="flex-1 rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-700"
                        >
                          View ladder
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Top public leagues */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold md:text-xl">
              Top public leagues this week
            </h2>
            <span className="text-xs text-zinc-400">
              Based on average active streak
            </span>
          </div>

          {topLeagues.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Public leagues will show here once there&apos;s enough data.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {topLeagues.map((league) => (
                <div
                  key={league.id}
                  className="min-w-[240px] flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 shadow-md hover:border-orange-500/60 hover:shadow-orange-500/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{league.name}</p>
                      {league.tagLine && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                          {league.tagLine}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-zinc-400">Avg streak</p>
                      <p className="text-lg font-bold text-orange-400">
                        {league.avgStreak.toFixed(1)}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {league.players} players
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity + Hall of Fame row */}
        <section className="grid gap-6 md:grid-cols-[1.4fr,1fr]">
          {/* Activity feed */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live league activity</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Updating in real time
              </span>
            </div>
            <p className="mb-4 text-xs text-zinc-400">
              A quick snapshot of what&apos;s happening across private leagues.
            </p>

            {activityFeed.length === 0 ? (
              <p className="text-xs text-zinc-500">
                League activity will show here once players start joining and
                making picks.
              </p>
            ) : (
              <ul className="space-y-3">
                {activityFeed.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-3 rounded-xl bg-zinc-950/80 px-3 py-2.5 text-xs"
                  >
                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                    <div className="flex-1">
                      <p className="text-zinc-100">{item.message}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {item.timeAgo}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 text-[11px] text-zinc-500">
              Want your league here?{" "}
              <Link
                href="/picks"
                className="font-semibold text-orange-400 hover:text-orange-300"
              >
                Start making picks tonight.
              </Link>
            </div>
          </div>

          {/* Hall of fame / stats */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-900 p-4">
              <h2 className="mb-2 text-sm font-semibold">
                Hall of fame snapshot
              </h2>
              <p className="mb-3 text-xs text-zinc-100/80">
                A taste of what the best Streakrs and leagues are doing right
                now.
              </p>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {hallOfFame.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-zinc-950/70 px-3 py-2"
                  >
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-lg font-bold text-orange-300">
                      {item.value}
                    </dd>
                    {item.note && (
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {item.note}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-xs text-zinc-200">
              <p className="mb-1 text-sm font-semibold">
                Win bragging rights (and actual rewards)
              </p>
              <p className="text-[11px] text-zinc-400">
                Coming soon: bonus prizes for leagues that finish in the top
                tier of the global ladder — merch drops, badges and more.
                Make sure your league is ready.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
