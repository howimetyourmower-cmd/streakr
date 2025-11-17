
"use client";
// app/leagues/page.tsx

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collectionGroup,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

type MyLeague = {
  id: string;
  name: string;
  code: string;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const { user } = useAuth();

  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [myLeaguesError, setMyLeaguesError] = useState<string | null>(null);
  const [loadingMyLeagues, setLoadingMyLeagues] = useState(false);

  // ---- Load "My leagues" for logged-in user ----
  const loadMyLeagues = async (uid: string) => {
    setLoadingMyLeagues(true);
    setMyLeaguesError(null);

    try {
      // 1) Find all member docs for this uid across leagues/*/members
      const membersQ = query(
        collectionGroup(db, "members"),
        where("uid", "==", uid),
        limit(20)
      );

      const membersSnap = await getDocs(membersQ);

      if (membersSnap.empty) {
        setMyLeagues([]);
        return;
      }

      // 2) For each member doc, fetch its parent league
      const leaguePromises = membersSnap.docs.map(async (memberDoc) => {
        const memberData = memberDoc.data() as DocumentData;
        const role = (memberData.role as "manager" | "member") ?? "member";

        const leagueRef = memberDoc.ref.parent.parent;
        if (!leagueRef) return null;

        const leagueSnap = await getDoc(leagueRef);
        if (!leagueSnap.exists()) return null;

        const leagueData = leagueSnap.data() as DocumentData;

        return {
          id: leagueSnap.id,
          name: (leagueData.name as string) ?? "Untitled league",
          code: (leagueData.code as string) ?? "",
          role,
        } satisfies MyLeague;
      });

      const resolved = await Promise.all(leaguePromises);
      const cleaned = resolved.filter(Boolean) as MyLeague[];

      setMyLeagues(cleaned);
    } catch (err) {
      console.error("Failed to load leagues for user", err);
      setMyLeaguesError(
        "Failed to load your leagues. Please try again later."
      );
    } finally {
      setLoadingMyLeagues(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setMyLeagues([]);
      setLoadingMyLeagues(false);
      return;
    }

    // capture uid so TS knows it's defined
    const uid = user.uid;
    if (!uid) return;

    loadMyLeagues(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4">
        <Link
          href="/"
          className="text-sm text-slate-300 hover:text-orange-400 transition-colors"
        >
          ← Back to home
        </Link>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">
        Leagues
      </h1>
      <p className="text-slate-300 mb-8 max-w-3xl">
        Play Streakr with your mates, work crew or fantasy league. Create a
        private league, invite friends with a code, and battle it out on your
        own ladder while still counting towards the global Streak leaderboard.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ----- Create League ----- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">
              Create a league
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              You’re the commish. Name your league, set how many mates can join
              and share a single invite code with your group.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4 list-disc list-inside">
              <li>You automatically join as League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone’s streak still counts globally</li>
            </ul>
          </div>
          <Link
            href="/leagues/create"
            className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm shadow-lg transition-colors"
          >
            Create league
          </Link>
        </div>

        {/* ----- Join League ----- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2 text-white">
              Join a league
            </h2>
            <p className="text-slate-300 text-sm mb-4">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4 list-disc list-inside">
              <li>League Manager controls who gets the code</li>
              <li>You can join multiple private leagues</li>
              <li>No extra cost – still 100% free</li>
            </ul>
          </div>
          <Link
            href="/leagues/join"
            className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-black font-semibold text-sm shadow-lg transition-colors"
          >
            Join with a code
          </Link>
        </div>

        {/* ----- My Leagues ----- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <h2 className="text-xl font-semibold mb-2 text-white">
            My leagues
          </h2>

          {!user && (
            <p className="text-slate-400 text-sm">
              Log in or create an account to see the leagues you&apos;re in.
            </p>
          )}

          {user && loadingMyLeagues && (
            <p className="text-slate-400 text-sm">Loading your leagues...</p>
          )}

          {user && myLeaguesError && (
            <p className="text-sm text-red-400 mb-2">{myLeaguesError}</p>
          )}

          {user && !loadingMyLeagues && !myLeaguesError && myLeagues.length === 0 && (
            <p className="text-slate-400 text-sm">
              You&apos;re not in any private leagues yet. Create one or join
              with a code to get started.
            </p>
          )}

          {user && !loadingMyLeagues && myLeagues.length > 0 && (
            <div className="mt-3 space-y-3">
              {myLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="block rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 hover:border-orange-500 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">
                      {league.name}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 uppercase tracking-wide">
                      {league.role === "manager" ? "League manager" : "Player"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Invite code: {league.code}</span>
                    <span className="text-slate-500">Tap to view ladder</span>
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
