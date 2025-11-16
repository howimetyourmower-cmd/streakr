// app/leagues/[leagueId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  name: string;
  code: string;
  createdBy: string;
};

type MemberRow = {
  uid: string;
  displayName: string;
  team?: string;
  currentStreak: number;
  longestStreak: number;
};

export default function LeagueDetailPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;
  const { user } = useAuth();
  const router = useRouter();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // --- Load league doc ---
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() || {};
        setLeague({
          name: data.name ?? "Private league",
          code: data.code ?? "",
          createdBy: data.createdBy ?? "",
        });

        // --- Load members subcollection ---
        const membersSnap = await getDocs(
          collection(db, "leagues", leagueId, "members")
        );

        const rows: MemberRow[] = membersSnap.docs.map((d) => {
          const m = d.data() || {};
          return {
            uid: m.uid ?? d.id,
            displayName: m.displayName ?? "Player",
            team: m.team ?? "",
            currentStreak: Number(m.currentStreak ?? 0),
            longestStreak: Number(m.longestStreak ?? 0),
          };
        });

        // Sort by current streak, then longest, then name
        rows.sort((a, b) => {
          if (b.currentStreak !== a.currentStreak) {
            return b.currentStreak - a.currentStreak;
          }
          if (b.longestStreak !== a.longestStreak) {
            return b.longestStreak - a.longestStreak;
          }
          return a.displayName.localeCompare(b.displayName);
        });

        setMembers(rows);
      } catch (err) {
        console.error("Failed to load league", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leagueId]);

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard.writeText(league.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!league?.code) return;
    if (typeof window === "undefined") return;

    const origin = window.location.origin;
    const url = `${origin}/leagues/join?code=${encodeURIComponent(
      league.code
    )}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy invite link", err);
    }
  };

  const handleLeaveLeague = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to leave this league? You can rejoin later with the code."
      )
    ) {
      return;
    }

    try {
      setLeaving(true);
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league", err);
      alert("Could not leave league. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const isManager = !!user && league?.createdBy === user.uid;

  const myIndex =
    user && members.length
      ? members.findIndex((m) => m.uid === user.uid)
      : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;

  return (
    <div className="py-6 md:py-10 space-y-6">
      {/* Back link */}
      <div className="mb-2">
        <Link
          href="/leagues"
          className="text-sm text-slate-400 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {league ? league.name : "League"}
          </h1>
          {league?.code && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">Invite code:</span>
              <span className="font-mono px-2 py-1 rounded bg-slate-900 border border-slate-700">
                {league.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                {copiedCode ? "Code copied" : "Copy code"}
              </button>
              <button
                onClick={handleCopyInviteLink}
                className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                {copiedLink ? "Link copied" : "Copy invite link"}
              </button>
              {isManager && (
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-400/40">
                  You are the manager
                </span>
              )}
            </div>
          )}
          <p className="text-slate-400 text-sm mt-3 max-w-xl">
            Your streak in this league still counts towards the global
            leaderboard. This page shows how you stack up against everyone in
            this private group.
          </p>
        </div>

        {/* Right side: your rank + leave button */}
        <div className="flex flex-col items-start md:items-end gap-2">
          {myRank && (
            <div className="text-sm text-slate-300">
              You&apos;re currently{" "}
              <span className="font-semibold text-orange-400">
                {myRank}
                {myRank === 1 ? "st" : myRank === 2 ? "nd" : myRank === 3 ? "rd" : "th"}
              </span>{" "}
              in this league.
            </div>
          )}

          <button
            onClick={handleLeaveLeague}
            disabled={leaving}
            className="text-xs mt-1 px-3 py-1.5 rounded-full border border-red-500/70 text-red-400 hover:bg-red-500/10 disabled:opacity-60"
          >
            {leaving ? "Leaving…" : "Leave league"}
          </button>
        </div>
      </div>

      {/* Error / loading */}
      {loading && (
        <p className="text-slate-400 text-sm">Loading league ladder…</p>
      )}
      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/60 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Ladder table */}
      {!loading && !error && (
        <div className="mt-4 bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">League ladder</h2>
              <p className="text-xs text-slate-400">
                Sorted by current streak, then longest streak.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {members.length} player{members.length === 1 ? "" : "s"}
            </span>
          </div>

          {members.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              No members yet. Share your invite code or link to get your mates
              in.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2 w-14">Rank</th>
                    <th className="text-left px-4 py-2">Player</th>
                    <th className="text-left px-4 py-2">Team</th>
                    <th className="text-right px-4 py-2">Current streak</th>
                    <th className="text-right px-4 py-2">Longest streak</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, index) => {
                    const isYou = user && m.uid === user.uid;
                    const rank = index + 1;

                    return (
                      <tr
                        key={m.uid}
                        className={
                          "border-t border-slate-800 " +
                          (isYou
                            ? "bg-orange-500/5"
                            : index % 2 === 0
                            ? "bg-slate-900/40"
                            : "bg-slate-900/20")
                        }
                      >
                        <td className="px-4 py-2 text-xs md:text-sm text-slate-300">
                          {rank}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {m.displayName}
                            </span>
                            {isYou && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                                You
                              </span>
                            )}
                            {league?.createdBy === m.uid && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40">
                                Manager
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-300">
                          {m.team || "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-100">
                          {m.currentStreak} in a row
                        </td>
                        <td className="px-4 py-2 text-right text-slate-300">
                          {m.longestStreak} longest
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
