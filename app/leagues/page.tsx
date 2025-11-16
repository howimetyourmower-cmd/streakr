"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
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

type LeagueSummary = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const { user } = useAuth();
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // -------------------------------
  // Load leagues the user belongs to
  // -------------------------------
  useEffect(() => {
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // FIX: user!.uid to satisfy Vercel / Typescript
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

          const data = leagueSnap.data() as any;

          results.push({
            id: leagueSnap.id,
            name: data.name ?? "Unnamed league",
            code: data.code ?? "—",
            memberCount: data.memberCount ?? 1,
            role: data.managerUid === user!.uid ? "manager" : "member",
          });
        }

        setMyLeagues(results);
      } catch (err) {
        console.error("Failed loading leagues", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  return (
    <div className="py-6 md:py-8">
      {/* Header */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-orange-400 hover:underline"
        >
          ← Back to leagues
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Leagues</h1>

      <p className="text-slate-300 max-w-2xl mb-10">
        Play Streakr with mates, work crew or fantasy leagues.
        Create a private league or join one with a code. All your
        streaks still count globally.
      </p>

      {/* Panels */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* CREATE LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-xl font-bold mb-2">Create a league</h3>
          <p className="text-slate-300 text-sm mb-4">
            You're the commish. Name your league and invite mates.
          </p>
          <Link
            href="/leagues/create"
            className="block text-center py-2 rounded-lg bg-orange-500 text-black font-semibold hover:bg-orange-600 transition"
          >
            Create league
          </Link>
        </div>

        {/* JOIN LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-xl font-bold mb-2">Join a league</h3>
          <p className="text-slate-300 text-sm mb-4">
            Got a code from a mate? Drop it in and join instantly.
          </p>
          <Link
            href="/leagues/join"
            className="block text-center py-2 rounded-lg bg-blue-500 text-black font-semibold hover:bg-blue-600 transition"
          >
            Join with a code
          </Link>
        </div>

        {/* MY LEAGUES */}
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-xl font-bold mb-2">My leagues</h3>
          {loading && (
            <p className="text-slate-400 text-sm">Loading…</p>
          )}

          {!loading && myLeagues.length === 0 && (
            <p className="text-slate-400 text-sm">
              You're not in any leagues yet.
            </p>
          )}

          {!loading && myLeagues.length > 0 && (
            <ul className="space-y-3">
              {myLeagues.map((l) => (
                <li
                  key={l.id}
                  className="p-3 bg-slate-800/60 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-slate-400">
                      {l.role === "manager" ? "Manager" : "Member"}
                    </div>
                  </div>
                  <Link
                    href={`/leagues/${l.id}`}
                    className="text-xs text-orange-400 hover:underline"
                  >
                    View →
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
