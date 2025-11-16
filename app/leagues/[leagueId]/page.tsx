"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt?: { seconds: number; nanoseconds: number };
};

type MemberRow = {
  id: string;
  uid: string;
  displayName: string;
  team?: string;
  currentStreak: number;
  longestStreak: number;
  avatarUrl?: string;
};

export default function LeagueDetailPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      if (!leagueId) return;

      setLoading(true);
      setError(null);

      try {
        // 1) Fetch league doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const leagueData = leagueSnap.data() as any;
        const leagueDoc: LeagueDoc = {
          id: leagueSnap.id,
          name: leagueData.name ?? "Untitled league",
          code: leagueData.code ?? "",
          createdBy: leagueData.createdBy ?? "",
          createdAt: leagueData.createdAt,
        };

        setLeague(leagueDoc);

        // 2) Fetch members subcollection ordered for ladder
        const membersRef = collection(leagueRef, "members");
        const membersQuery = query(
          membersRef,
          orderBy("currentStreak", "desc"),
          orderBy("longestStreak", "desc"),
          orderBy("joinedAt", "asc")
        );

        const membersSnap = await getDocs(membersQuery);
        const rows: MemberRow[] = [];

        membersSnap.forEach((m) => {
          const d = m.data() as any;
          rows.push({
            id: m.id,
            uid: d.uid ?? m.id,
            displayName: d.displayName ?? "Player",
            team: d.team,
            currentStreak: typeof d.currentStreak === "number" ? d.currentStreak : 0,
            longestStreak: typeof d.longestStreak === "number" ? d.longestStreak : 0,
            avatarUrl: d.avatarUrl,
          });
        });

        setMembers(rows);
      } catch (err) {
        console.error("Failed to load league", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  async function handleCopyCode() {
    if (!league?.code) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;

    try {
      setCopying(true);
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    } finally {
      setCopying(false);
    }
  }

  const isManager = !!user && !!league && user.uid === league.createdBy;

  return (
    <div className="py-6 md:py-8">
      {/* Back link */}
      <button
        onClick={() => router.push("/leagues")}
        className="text-sm text-slate-400 hover:text-orange-400 mb-4 inline-flex items-center gap-1"
      >
        <span className="text-lg">←</span> Back to leagues
      </button>

      {loading && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-300 text-sm">Loading league...</p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-900/40 border border-red-500/60 rounded-2xl p-6">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && league && (
        <>
          {/* League header */}
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 mb-6 flex flex-col md:flex-row gap-5 md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {league.name}
              </h1>
              <p className="text-slate-300 text-sm mb-2">
                Private league · Invite friends with the code below and battle
                it out on your own ladder. All streaks still count globally.
              </p>
              {isManager && (
                <p className="text-xs text-emerald-400 font-medium">
                  You&apos;re the League Manager.
                </p>
              )}
            </div>

            {/* Invite code card */}
            <div className="bg-slate-950/70 border border-slate-700 rounded-xl px-4 py-3 w-full md:w-auto">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Invite code
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-lg font-semibold tracking-[0.2em] bg-slate-900 px-3 py-1.5 rounded-lg">
                  {league.code || "-----"}
                </div>
                <button
                  onClick={handleCopyCode}
                  disabled={copying || !league.code}
                  className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-100 hover:border-orange-400 hover:text-orange-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Share this in your group chat. Players join via{" "}
                <span className="font-semibold text-slate-300">
                  Leagues → Join with a code
                </span>
                .
              </p>
            </div>
          </div>

          {/* Ladder */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">League ladder</h2>
                <p className="text-xs text-slate-400">
                  Based on current streak, then longest streak.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Showing {members.length || 0} player
                {members.length === 1 ? "" : "s"}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-300">
                No players in this league yet. Share your invite code and get
                your mates to join.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2 pl-5 pr-2">#</th>
                    <th className="text-left py-2 px-2">Player</th>
                    <th className="text-left py-2 px-2 hidden sm:table-cell">
                      Team
                    </th>
                    <th className="text-right py-2 px-2">Current streak</th>
                    <th className="text-right py-2 pr-5 pl-2">
                      Longest streak
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, index) => {
                    const isYou = user && m.uid === user.uid;

                    return (
                      <tr
                        key={m.id}
                        className="border-t border-slate-800/60 hover:bg-slate-800/40"
                      >
                        <td className="py-3 pl-5 pr-2 text-slate-300 text-xs sm:text-sm">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-[11px] font-semibold text-slate-200">
                              {m.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={m.avatarUrl}
                                  alt={m.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                (m.displayName || "P")
                                  .split(" ")
                                  .map((part) => part.charAt(0).toUpperCase())
                                  .slice(0, 2)
                                  .join("")
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">
                                {m.displayName || "Player"}
                                {isYou && (
                                  <span className="ml-2 text-xs text-emerald-400 font-medium">
                                    (You)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 sm:hidden">
                                {m.team || "No team set"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-slate-300 text-xs sm:text-sm hidden sm:table-cell">
                          {m.team || "—"}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-100 text-xs sm:text-sm">
                          {m.currentStreak} in a row
                        </td>
                        <td className="py-3 pr-5 pl-2 text-right text-slate-300 text-xs sm:text-sm">
                          {m.longestStreak} longest
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Tiny note under table */}
          <p className="mt-3 text-[11px] text-slate-500">
            League ladders are for bragging rights only. All streaks still feed
            into the global leaderboard and prize calculations.
          </p>
        </>
      )}
    </div>
  );
}
