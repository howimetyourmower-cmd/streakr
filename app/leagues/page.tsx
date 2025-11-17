"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collectionGroup,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type MyLeague = {
  id: string;
  name: string;
  code: string;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const { user, loading } = useAuth();
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [myLeaguesLoading, setMyLeaguesLoading] = useState(false);
  const [myLeaguesError, setMyLeaguesError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || loading) return;

    async function loadMyLeagues() {
      setMyLeaguesLoading(true);
      setMyLeaguesError(null);

      try {
        // members subcollection docs live at:
        // leagues/{leagueId}/members/{uid}
        const membersSnap = await getDocs(
          collectionGroup(db, "members")
        );

        if (!user) return: // <-- TS wants this inside async closure
          
        const myMemberDocs = membersSnap.docs.filter(
          (doc) => doc.data().uid === user.uid
        );

        const leaguePromises = myMemberDocs.map(async (memberDoc) => {
          const memberData = memberDoc.data() as {
            uid: string;
            role?: "manager" | "member";
          };

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
            name: leagueData.name || "Unnamed league",
            code: leagueData.code || "",
            role: memberData.role || "member",
          } satisfies MyLeague;
        });

        const leagues = (await Promise.all(leaguePromises)).filter(
          (l): l is MyLeague => Boolean(l)
        );

        setMyLeagues(leagues);
      } catch (err) {
        console.error("Failed to load my leagues", err);
        setMyLeaguesError("Failed to load your leagues.");
      } finally {
        setMyLeaguesLoading(false);
      }
    }

    loadMyLeagues();
  }, [user, loading]);

  return (
    <div className="py-6 md:py-8 space-y-6">
      <div className="mb-4">
        <Link
          href="/picks"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to picks
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Leagues</h1>
        <p className="text-slate-300 max-w-2xl text-sm md:text-base">
          Play Streakr with your mates, work crew or fantasy league. Create a
          private league, invite friends with a code, and battle it out on your
          own ladder while still counting towards the global Streak leaderboard.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Create league */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Create a league</h2>
            <p className="text-sm text-slate-300">
              You&apos;re the commish. Name your league, set how many mates can
              join and share a single invite code with your group.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mt-2">
              <li>• You automatically join as League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone&apos;s streak still counts globally</li>
            </ul>
          </div>
          <div className="mt-5">
            <Link
              href="/leagues/create"
              className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm shadow-lg transition-colors"
            >
              Create league
            </Link>
          </div>
        </div>

        {/* Join league */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Join a league</h2>
            <p className="text-sm text-slate-300">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mt-2">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost – still 100% free</li>
            </ul>
          </div>
          <div className="mt-5">
            <Link
              href="/leagues/join"
              className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm shadow-lg transition-colors"
            >
              Join with a code
            </Link>
          </div>
        </div>

        {/* My leagues */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">My leagues</h2>

            {!user && (
              <p className="text-sm text-slate-300">
                Log in or create an account to see the leagues you&apos;re part
                of.
              </p>
            )}

            {user && (
              <>
                {myLeaguesLoading && (
                  <p className="text-sm text-slate-300">Loading leagues…</p>
                )}

                {myLeaguesError && (
                  <p className="text-sm text-red-400">{myLeaguesError}</p>
                )}

                {!myLeaguesLoading &&
                  !myLeaguesError &&
                  myLeagues.length === 0 && (
                    <p className="text-sm text-slate-300">
                      You&apos;re not in any leagues yet. Create one or join
                      with a code.
                    </p>
                  )}

                {!myLeaguesLoading && !myLeaguesError && myLeagues.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {myLeagues.map((league) => (
                      <li key={league.id}>
                        <Link
                          href={`/leagues/${league.id}`}
                          className="flex items-center justify-between rounded-lg bg-slate-800/80 hover:bg-slate-700/80 px-3 py-2 text-sm transition-colors"
                        >
                          <div>
                            <div className="font-medium text-white">
                              {league.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              Code:{" "}
                              <span className="font-mono">
                                {league.code || "—"}
                              </span>
                            </div>
                          </div>
                          <span className="ml-3 text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-slate-600 text-slate-200">
                            {league.role === "manager"
                              ? "Manager"
                              : "Member"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
