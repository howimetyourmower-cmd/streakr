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

  useEffect(() => {
    if (!user) {
      setMyLeagues([]);
      return;
    }

    async function loadMyLeagues() {
      setLoadingLeagues(true);
      setError(null);

      try {
        // Look up all membership docs where this user is a member
        const membershipsSnap = await getDocs(
          query(
            collectionGroup(db, "members"),
            where("uid", "==", user.uid),
            limit(20)
          )
        );

        const results: LeagueSummary[] = [];

        for (const membershipDoc of membershipsSnap.docs) {
          const membershipData = membershipDoc.data() as {
            role?: string;
          };

          const leagueRef = membershipDoc.ref.parent.parent;
          if (!leagueRef) continue;

          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) continue;

          const leagueData = leagueSnap.data() as {
            name?: string;
            code?: string;
            memberCount?: number;
            managerUid?: string;
          };

          results.push({
            id: leagueSnap.id,
            name: leagueData.name ?? "Unnamed league",
            code: leagueData.code ?? "—",
            memberCount: leagueData.memberCount ?? 1,
            role:
              leagueData.managerUid === user.uid
                ? "manager"
                : "member",
          });
        }

        setMyLeagues(results);
      } catch (err) {
        console.error("Failed to load leagues", err);
        setError("Couldn’t load your leagues. Please try again later.");
      } finally {
        setLoadingLeagues(false);
      }
    }

    loadMyLeagues();
  }, [user]);

  return (
    <div className="py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Leagues</h1>
        <p className="text-slate-300 max-w-3xl">
          Play Streakr with your mates, work crew or fantasy league. Create a
          private league, invite friends with a code, and battle it out on your
          own ladder while still counting towards the global Streak leaderboard.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ---------- CREATE A LEAGUE ---------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Create a league</h2>
            <p className="text-sm text-slate-300 mb-3">
              You’re the commish. Name your league, set how many mates can join,
              and share a single invite code with your group.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mb-4 list-disc list-inside">
              <li>You automatically join as League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone’s streak still counts globally</li>
            </ul>
          </div>
          <div>
            <Link
              href="/leagues/create"
              className="inline-flex items-center justify-center w-full mt-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm py-2.5 transition-colors"
            >
              Create league
            </Link>
          </div>
        </div>

        {/* ---------- JOIN A LEAGUE ---------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Join a league</h2>
            <p className="text-sm text-slate-300 mb-3">
              Got a code from a mate? Drop it in and you’ll appear on that
              league’s ladder as soon as you make picks.
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mb-4 list-disc list-inside">
              <li>League Manager controls who gets the code</li>
              <li>You can join multiple private leagues</li>
              <li>No extra cost – still 100% free</li>
            </ul>
          </div>
          <div>
            <Link
              href="/leagues/join"
              className="inline-flex items-center justify-center w-full mt-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm py-2.5 transition-colors"
            >
              Join with a code
            </Link>
          </div>
        </div>

        {/* ---------- MY LEAGUES ---------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="mb-3">
            <h2 className="text-lg font-semibold mb-1">My leagues</h2>
            <p className="text-sm text-slate-300">
              Track your leagues across mates, offices and clubs. Tap a league
              to view its ladder and members.
            </p>
          </div>

          <div className="flex-1 mt-2 space-y-2 overflow-hidden">
            {!user && !loading && (
              <p className="text-sm text-slate-400">
                Log in or create an account to see the leagues you’ve joined.
              </p>
            )}

            {loading && (
              <p className="text-sm text-slate-400">Loading your leagues…</p>
            )}

            {!loading && user && myLeagues.length === 0 && !error && (
              <p className="text-sm text-slate-400">
                You haven’t joined any leagues yet. Create one or join with a
                code to see them here.
              </p>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {!loading &&
              myLeagues.length > 0 &&
              myLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="block rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm hover:border-orange-500 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-100">
                        {league.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        Code: {league.code} • {league.memberCount}{" "}
                        {league.memberCount === 1 ? "player" : "players"}
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">
                      {league.role === "manager" ? "Manager" : "Player"}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
