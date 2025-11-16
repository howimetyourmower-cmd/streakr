// app/leagues/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type MyLeague = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  isManager: boolean;
};

export default function LeaguesPage() {
  const { user } = useAuth();

  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);

        // Find leagues that include this user in /members
        const leaguesSnap = await getDocs(collection(db, "leagues"));

        const rows: MyLeague[] = [];

        for (const leagueDoc of leaguesSnap.docs) {
          const leagueData = leagueDoc.data() || {};
          const leagueId = leagueDoc.id;

          // Check if this user has a member doc
          const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
          const memberSnap = await getDoc(memberRef);

          if (!memberSnap.exists()) continue;

          // Count members
          const membersSnap = await getDocs(
            collection(db, "leagues", leagueId, "members")
          );

          rows.push({
            id: leagueId,
            name: leagueData.name ?? "League",
            code: leagueData.code ?? "—",
            memberCount: membersSnap.size,
            isManager: leagueData.createdBy === user.uid,
          });
        }

        setMyLeagues(rows);
      } catch (err) {
        console.error("Failed to load leagues", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  return (
    <div className="py-6 md:py-10">
      <h1 className="text-3xl font-bold mb-6">Leagues</h1>

      <p className="text-slate-300 max-w-2xl mb-8">
        Play Streakr with your mates, work crew or fantasy league. Create a private league,
        invite friends with a code, and battle it out on your own ladder while still
        counting towards the global leaderboard.
      </p>

      {/* ---------- ACTION CARDS ---------- */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {/* Create league */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-xl mb-2">Create a league</h3>
          <ul className="text-slate-400 text-sm mb-4 list-disc ml-4">
            <li>You automatically join as League Manager</li>
            <li>Share a single code to invite players</li>
            <li>Everyone’s streak still counts globally</li>
          </ul>
          <Link
            href="/leagues/create"
            className="block bg-orange-500 hover:bg-orange-600 text-black text-center py-2 rounded-lg font-semibold"
          >
            Create league
          </Link>
        </div>

        {/* Join league */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-xl mb-2">Join a league</h3>
          <ul className="text-slate-400 text-sm mb-4 list-disc ml-4">
            <li>League Manager controls who gets the code</li>
            <li>Join multiple private leagues</li>
            <li>Still 100% free</li>
          </ul>
          <Link
            href="/leagues/join"
            className="block bg-blue-500/80 hover:bg-blue-500 text-white text-center py-2 rounded-lg font-semibold"
          >
            Join with a code
          </Link>
        </div>

        {/* My leagues */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <h3 className="font-semibold text-xl mb-2">My leagues</h3>

          {loading ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : myLeagues.length === 0 ? (
            <p className="text-slate-400 text-sm">You're not in any leagues yet.</p>
          ) : (
            <ul className="text-slate-300 text-sm space-y-3">
              {myLeagues.map((lg) => (
                <li key={lg.id}>
                  <Link
                    href={`/leagues/${lg.id}`}
                    className="flex justify-between items-center bg-slate-800/40 hover:bg-slate-700/40 px-3 py-2 rounded-lg transition"
                  >
                    <div>
                      <div className="font-semibold">{lg.name}</div>
                      <div className="text-xs text-slate-400">
                        {lg.memberCount} members
                      </div>
                    </div>

                    {lg.isManager && (
                      <span className="text-orange-400 text-xs font-semibold">
                        Manager
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
