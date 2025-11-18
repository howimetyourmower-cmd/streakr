// app/leagues/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type LeagueSummary = {
  id: string;
  name: string;
  code: string;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  useEffect(() => {
    const loadLeagues = async () => {
      if (!user) {
        setLeagues([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Find all membership docs for this user across all leagues
        const membersQ = query(
          collectionGroup(db, "members"),
          where("uid", "==", user.uid),
          limit(20)
        );
        const membersSnap = await getDocs(membersQ);

        const leaguePromises = membersSnap.docs.map(async (memberDoc) => {
          const leagueRef = memberDoc.ref.parent.parent; // .../leagues/{leagueId}
          if (!leagueRef) return null;

          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) return null;

          const data = leagueSnap.data() as any;
          const role = (memberDoc.data().role as "manager" | "member") || "member";

          return {
            id: leagueSnap.id,
            name: data.name ?? "Unnamed league",
            code: data.code ?? "",
            role,
          } as LeagueSummary;
        });

        const results = (await Promise.all(leaguePromises)).filter(
          (x): x is LeagueSummary => x !== null
        );

        setLeagues(results);
        if (results.length > 0) {
          setSelectedLeagueId(results[0].id);
        }
      } catch (err) {
        console.error("Failed to load leagues", err);
        setError("Failed to load your leagues. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadLeagues();
  }, [user]);

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId) ?? null;

  return (
    <div className="py-6 md:py-8 space-y-6">
      {/* Header + sport badge */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">Leagues</h1>
            </div>
          <p className="mt-1 text-sm text-white/70 max-w-2xl">
            Play Streakr with your mates, work crew or fantasy league. Create a
            private league, invite friends with a code, and battle it out on your
            own ladder while still counting towards the global Streak leaderboard.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Create a league */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Create a league</h2>
            <p className="text-sm text-white/70 mb-3">
              You&apos;re the commish. Name your league, set how many mates can
              join, and share a single invite code with your group.
            </p>
            <ul className="mt-2 text-xs text-white/60 space-y-1 list-disc list-inside">
              <li>You automatically join as League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone&apos;s streak still counts globally</li>
            </ul>
          </div>
          <Link
            href="/leagues/create"
            className="mt-4 inline-flex justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
          >
            Create league
          </Link>
        </div>

        {/* Join a league */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Join a league</h2>
            <p className="text-sm text-white/70 mb-3">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="mt-2 text-xs text-white/60 space-y-1 list-disc list-inside">
              <li>League Manager controls who gets the code</li>
              <li>You can join multiple private leagues</li>
              <li>No extra cost – still 100% free</li>
            </ul>
          </div>
          <Link
            href="/leagues/join"
            className="mt-4 inline-flex justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
          >
            Join with a code
          </Link>
        </div>

        {/* My leagues – now dropdown + sport badge */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col">
          <h2 className="text-lg font-semibold mb-3">My leagues</h2>

          {!user && (
            <p className="text-sm text-white/70">
              Log in to see and manage your leagues.
            </p>
          )}

          {user && loading && (
            <p className="text-sm text-white/70">Loading your leagues…</p>
          )}

          {user && !loading && error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {user && !loading && !error && leagues.length === 0 && (
            <p className="text-sm text-white/70">
              You&apos;re not in any private leagues yet. Create one or join with
              a code to get started.
            </p>
          )}

          {user && !loading && !error && leagues.length > 0 && (
            <div className="space-y-3">
              {/* Selector */}
              <label className="block text-xs font-medium text-white/70">
                Select a league
              </label>
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                    {league.role === "manager" ? " (Manager)" : ""}
                  </option>
                ))}
              </select>

              {/* Selected league details */}
              {selectedLeague && (
                <div className="mt-2 rounded-xl bg-black/20 border border-white/10 px-3 py-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {selectedLeague.name}
                      </span>
                      <span className="text-[11px] text-white/60">
                        Invite code:{" "}
                        <span className="font-mono">{selectedLeague.code}</span>
                      </span>
                    </div>
                   
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wide">
                      {selectedLeague.role === "manager"
                        ? "League Manager"
                        : "League Member"}
                    </span>
                    <Link
                      href={`/leagues/${selectedLeague.id}`}
                      className="text-[11px] font-semibold text-sky-400 hover:text-sky-300"
                    >
                      View league & ladder →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
