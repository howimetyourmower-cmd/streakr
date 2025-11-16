// app/leagues/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type LeagueSummary = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const { user, loading } = useAuth();

  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load leagues this user belongs to
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setMyLeagues([]);
      return;
    }

    async function loadMyLeagues() {
      setLoadingLeagues(true);
      setError(null);

      try {
        const membershipsSnap = await getDocs(
          query(
            collectionGroup(db, "members"),
            where("uid", "==", user.uid!), // user is guaranteed here
            limit(20)
          )
        );

        const results: LeagueSummary[] = [];

        for (const membershipDoc of membershipsSnap.docs) {
          const leagueRef = membershipDoc.ref.parent.parent; // leagues/{leagueId}
          if (!leagueRef) continue;

          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) continue;

          const leagueData = leagueSnap.data() as any;

          results.push({
            id: leagueSnap.id,
            name: leagueData.name ?? "Unnamed league",
            code: leagueData.code ?? "—",
            memberCount: leagueData.memberCount ?? 1,
            role:
              leagueData.managerUid === user.uid ? "manager" : "member",
          });
        }

        setMyLeagues(results);
      } catch (err) {
        console.error("Failed to load leagues", err);
        setError("Couldn't load your leagues. Please try again later.");
      } finally {
        setLoadingLeagues(false);
      }
    }

    loadMyLeagues();
  }, [user, loading]);

  return (
    <div className="py-6 md:py-8">
      {/* Page heading + intro */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Leagues</h1>
        <p className="text-slate-300 max-w-2xl text-sm md:text-base">
          Play Streakr with your mates, work crew or fantasy league. Create a
          private league, invite friends with a code, and battle it out on your
          own ladder while still counting towards the global Streak leaderboard.
        </p>
      </div>

      {/* 3-column layout: Create / Join / My leagues */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* CREATE A LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Create a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              You’re the commish. Name your league, set how many mates can
              join, and share a single invite code with your group.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4 list-disc list-inside">
              <li>You automatically join as League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone’s streak still counts globally</li>
            </ul>
          </div>

          <Link
            href="/leagues/create"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold px-4 py-2 text-sm shadow-lg transition-colors"
          >
            Create league
          </Link>
        </div>

        {/* JOIN A LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Join a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you make picks.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4 list-disc list-inside">
              <li>League Manager controls who gets the code</li>
              <li>You can join multiple private leagues</li>
              <li>No extra cost – still 100% free</li>
            </ul>
          </div>

          <Link
            href="/leagues/join"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-600 text-black font-semibold px-4 py-2 text-sm shadow-lg transition-colors"
          >
            Join with a code
          </Link>
        </div>

        {/* MY LEAGUES */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">My leagues</h2>
          </div>

          {!user && !loading && (
            <p className="text-slate-400 text-sm">
              Log in to see any leagues you&apos;re part of.
            </p>
          )}

          {loading && (
            <p className="text-slate-400 text-sm">Checking your leagues…</p>
          )}

          {!loading && user && loadingLeagues && (
            <p className="text-slate-400 text-sm">Loading your leagues…</p>
          )}

          {!loading && user && error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {!loading &&
            user &&
            !loadingLeagues &&
            !error &&
            myLeagues.length === 0 && (
              <p className="text-slate-400 text-sm">
                You&apos;re not in any private leagues yet. Create one or join
                with a code to see them here.
              </p>
            )}

          {!loading && user && !loadingLeagues && myLeagues.length > 0 && (
            <div className="mt-3 space-y-2">
              {myLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="block rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm hover:border-orange-500 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{league.name}</div>
                      <div className="text-xs text-slate-400">
                        {league.memberCount}{" "}
                        {league.memberCount === 1 ? "player" : "players"} •{" "}
                        {league.role === "manager" ? "Manager" : "Member"}
                      </div>
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Code:{" "}
                      <span className="font-mono text-slate-200">
                        {league.code}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] text-slate-500">
            Private leagues are just for bragging rights. Your streak still
            counts on the global ladder no matter which league you&apos;re in.
          </p>
        </div>
      </div>
    </div>
  );
}
