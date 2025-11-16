"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueSummary = {
  id: string;
  name: string;
  code: string;
  currentRank: number | null;
  memberCount: number;
};

export default function LeaguesPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get all leagues
        const allLeaguesSnap = await getDocs(collection(db, "leagues"));
        const leagues: LeagueSummary[] = [];

        for (const leagueDoc of allLeaguesSnap.docs) {
          const leagueId = leagueDoc.id;
          const leagueData = leagueDoc.data() || {};

          // Check if user is a member
          const memberRef = doc(
            db,
            "leagues",
            leagueId,
            "members",
            user.uid
          );
          const memberSnap = await getDoc(memberRef);

          if (!memberSnap.exists()) continue; // not in this league

          // Get all members to compute rank
          const membersSnap = await getDocs(
            collection(db, "leagues", leagueId, "members")
          );

          const members = membersSnap.docs.map((d) => {
            const m = d.data() || {};
            return {
              uid: m.uid ?? d.id,
              currentStreak: Number(m.currentStreak ?? 0),
              longestStreak: Number(m.longestStreak ?? 0),
              displayName: m.displayName ?? "",
            };
          });

          // Sort by streak
          members.sort((a, b) => {
            if (b.currentStreak !== a.currentStreak)
              return b.currentStreak - a.currentStreak;
            if (b.longestStreak !== a.longestStreak)
              return b.longestStreak - a.longestStreak;
            return a.displayName.localeCompare(b.displayName);
          });

          const userRank =
            members.findIndex((m) => m.uid === user.uid) + 1;

          leagues.push({
            id: leagueId,
            name: leagueData.name ?? "Private league",
            code: leagueData.code ?? "",
            currentRank: userRank,
            memberCount: members.length,
          });
        }

        setMyLeagues(leagues);
      } catch (err) {
        console.error(err);
        setError("Failed to load your leagues.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  return (
    <div className="py-6 md:py-10 space-y-10">

      <h1 className="text-3xl font-bold mb-6">Leagues</h1>

      {/* Three columns */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* ------- CREATE LEAGUE ------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-2">Create a league</h3>
          <p className="text-slate-300 text-sm mb-4">
            You’re the commish. Name your league, set how many mates
            can join, and share a single invite code.
          </p>
          <Link
            href="/leagues/create"
            className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-black rounded-lg py-2 font-semibold"
          >
            Create league
          </Link>
        </div>

        {/* ------- JOIN LEAGUE ------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-2">Join a league</h3>
          <p className="text-slate-300 text-sm mb-4">
            Got a code? Enter it and your streak will appear on that
            league’s ladder.
          </p>
          <Link
            href="/leagues/join"
            className="block w-full text-center bg-blue-500 hover:bg-blue-600 rounded-lg py-2 font-semibold"
          >
            Join with a code
          </Link>
        </div>

        {/* ------- MY LEAGUES ------- */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-3">My leagues</h3>

          {loading && (
            <p className="text-slate-400 text-sm">Loading your leagues…</p>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {!loading && myLeagues.length === 0 && (
            <p className="text-slate-400 text-sm">
              You’re not in any leagues yet. Create one or join with a code.
            </p>
          )}

          {!loading && myLeagues.length > 0 && (
            <div className="space-y-3">
              {myLeagues.map((lg) => (
                <Link
                  key={lg.id}
                  href={`/leagues/${lg.id}`}
                  className="block p-4 rounded-lg bg-slate-800/60 border border-slate-700 hover:border-orange-500 transition"
                >
                  <div className="font-semibold">{lg.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {lg.memberCount} players — you’re{" "}
                    <span className="text-orange-400 font-semibold">
                      {lg.currentRank}
                      {lg.currentRank === 1
                        ? "st"
                        : lg.currentRank === 2
                        ? "nd"
                        : lg.currentRank === 3
                        ? "rd"
                        : "th"}
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
