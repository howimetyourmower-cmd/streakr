// app/leagues/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collectionGroup,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type MyLeagueRow = {
  id: string;
  name: string;
  code: string;
  role: string;
};

export default function LeaguesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [myLeagues, setMyLeagues] = useState<MyLeagueRow[]>([]);
  const [isLoadingMyLeagues, setIsLoadingMyLeagues] = useState(false);
  const [myLeaguesError, setMyLeaguesError] = useState<string | null>(null);

  // Load leagues where the current user is a member
  useEffect(() => {
    const loadMyLeagues = async () => {
      // If still checking auth, or no user, just clear and bail
      if (!user) {
        setMyLeagues([]);
        return;
      }

      try {
        setIsLoadingMyLeagues(true);
        setMyLeaguesError(null);

        // Copy uid into a local constant so TS knows it's non-nullable
        const uid = user.uid;

        const membersQ = query(
          collectionGroup(db, "members"),
          where("uid", "==", uid),
          limit(20)
        );

        const membersSnap = await getDocs(membersQ);

        const leaguePromises = membersSnap.docs.map(async (memberDoc) => {
          const memberData = memberDoc.data() as { role?: string } | undefined;

          // Parent of the "members" subcollection = league document
          const leagueRef = memberDoc.ref.parent.parent;
          if (!leagueRef) return null;

          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) return null;

          const leagueData = leagueSnap.data() as {
            name?: string;
            code?: string;
          };

          return {
            id: leagueSnap.id,
            name: leagueData.name ?? "Untitled league",
            code: leagueData.code ?? "",
            role: memberData?.role ?? "member",
          } as MyLeagueRow;
        });

        const leagues = (await Promise.all(leaguePromises)).filter(
          (l): l is MyLeagueRow => l !== null
        );

        setMyLeagues(leagues);
      } catch (err) {
        console.error("Failed to load my leagues", err);
        setMyLeaguesError("Failed to load your leagues. Please try again.");
      } finally {
        setIsLoadingMyLeagues(false);
      }
    };

    if (!loading) {
      loadMyLeagues();
    }
  }, [user, loading]);

  return (
    <div className="py-6 md:py-8">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Leagues</h1>
        <p className="text-slate-300 max-w-2xl text-sm md:text-base">
          Play Streakr with your mates, work crew or fantasy league. Create a
          private league, invite friends with a code, and battle it out on your
          own ladder while still counting towards the global Streak leaderboard.
        </p>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* CREATE LEAGUE */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Create a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              You&apos;re the commish. Name your league, set how many mates can
              join, and share a single invite code with your group.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mb-4">
              <li>• You automatically join as League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone&apos;s streak still counts globally</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => router.push("/leagues/create")}
            className="mt-2 inline-flex justify-center items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm shadow-lg transition-colors disabled:opacity-60"
            disabled={!user}
          >
            {user ? "Create league" : "Login to create a league"}
          </button>
        </section>

        {/* JOIN LEAGUE */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Join a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mb-4">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost – still 100% free</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => router.push("/leagues/join")}
            className="mt-2 inline-flex justify-center items-center px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-black font-semibold text-sm shadow-lg transition-colors disabled:opacity-60"
            disabled={!user}
          >
            {user ? "Join with a code" : "Login to join a league"}
          </button>
        </section>

        {/* MY LEAGUES */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">My leagues</h2>
            {isLoadingMyLeagues && (
              <span className="text-xs text-slate-400">Loading…</span>
            )}
          </div>

          {!user && (
            <p className="text-slate-300 text-sm mt-2">
              Log in to see the leagues you&apos;ve joined.
            </p>
          )}

          {user && myLeaguesError && (
            <p className="text-xs text-red-400 mt-2">{myLeaguesError}</p>
          )}

          {user && !myLeaguesError && !isLoadingMyLeagues && myLeagues.length === 0 && (
            <p className="text-slate-300 text-sm mt-2">
              You haven&apos;t joined any private leagues yet. Create one or
              join with a code from a mate.
            </p>
          )}

          {user && myLeagues.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {myLeagues.map((league) => (
                <li
                  key={league.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 hover:border-orange-500/80 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/leagues/${league.id}`)}
                      className="text-left"
                    >
                      <div className="font-semibold truncate">
                        {league.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Role: {league.role} • Code:{" "}
                        <span className="font-mono text-slate-300">
                          {league.code || "—"}
                        </span>
                      </div>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/leagues/${league.id}`)}
                    className="ml-2 text-xs font-semibold text-orange-400 hover:text-orange-300 whitespace-nowrap"
                  >
                    View →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Small helper footer text */}
      <p className="mt-6 text-xs text-slate-500 max-w-3xl">
        Private leagues are just for bragging rights with your mates. Your
        streak still counts on the global leaderboard, and all prizes are based
        on your overall streak performance – leagues are purely for fun.
      </p>
    </div>
  );
}
