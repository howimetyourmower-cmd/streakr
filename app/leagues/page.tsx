"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

// Types
interface LeagueSummary {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  role: "manager" | "member";
}

export default function LeaguesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------------
  // LOAD MY LEAGUES
  // -----------------------------------
  useEffect(() => {
    if (loading) return;

    // If not logged in, show empty leagues list
    if (!user) {
      setMyLeagues([]);
      setLoadingLeagues(false);
      return;
    }

    async function loadMyLeagues() {
      setLoadingLeagues(true);
      setError(null);

      try {
        // user is guaranteed here
        const membershipsSnap = await getDocs(
          query(
            collectionGroup(db, "members"),
            where("uid", "==", user!.uid),
            limit(20)
          )
        );

        const results: LeagueSummary[] = [];

        for (const membershipDoc of membershipsSnap.docs) {
          const leagueRef = membershipDoc.ref.parent.parent;
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
    <div className="py-6 md:py-10">
      {/* Page title */}
      <h1 className="text-3xl font-bold mb-2">Leagues</h1>
      <p className="text-slate-300 mb-8 max-w-2xl">
        Play Streakr with your mates, work crew or fantasy league. Create a private league,
        invite friends with a code, and compete while still counting towards the global leaderboard.
      </p>

      {/* 3-column layout */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* CREATE LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-3">Create a league</h2>
          <p className="text-slate-400 text-sm mb-4">
            You’re the commish. Name your league, set how many mates can join and share a single invite code.
          </p>

          <ul className="text-slate-400 text-sm mb-6 space-y-1">
            <li>• You join as League Manager automatically</li>
            <li>• Share one code to invite players</li>
            <li>• All streaks still count globally</li>
          </ul>

          <Link
            href="/leagues/create"
            className="mt-auto bg-orange-500 hover:bg-orange-600 transition text-black font-semibold text-center py-2 rounded-lg"
          >
            Create league
          </Link>
        </div>

        {/* JOIN LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-3">Join a league</h2>
          <p className="text-slate-400 text-sm mb-4">
            Got a code from a mate? Enter it and you’ll appear on that league’s ladder.
          </p>

          <ul className="text-slate-400 text-sm mb-6 space-y-1">
            <li>• League Manager decides who gets the code</li>
            <li>• Join as many private leagues as you like</li>
            <li>• Still 100% free</li>
          </ul>

          <Link
            href="/leagues/join"
            className="mt-auto bg-blue-500 hover:bg-blue-600 transition text-white font-semibold text-center py-2 rounded-lg"
          >
            Join with a code
          </Link>
        </div>

        {/* MY LEAGUES */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-3">My leagues</h2>

          {loadingLeagues ? (
            <p className="text-slate-400 text-sm">Loading your leagues…</p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : myLeagues.length === 0 ? (
            <p className="text-slate-400 text-sm">You haven't joined any leagues yet.</p>
          ) : (
            <div className="space-y-4">
              {myLeagues.map((lg) => (
                <Link
                  key={lg.id}
                  href={`/leagues/${lg.id}`}
                  className="block bg-slate-800/60 hover:bg-slate-800 transition rounded-lg p-4"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{lg.name}</div>
                      <div className="text-slate-400 text-xs">
                        Code: {lg.code} • {lg.memberCount} members
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-slate-700">
                      {lg.role === "manager" ? "Manager" : "Member"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
