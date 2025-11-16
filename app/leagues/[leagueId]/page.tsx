// app/leagues/[leagueId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  name: string;
  code: string;
  createdBy: string;
};

type LeagueMember = {
  uid: string;
  username?: string;
  team?: string;
  currentStreak?: number;
  longestStreak?: number;
  avatarUrl?: string;
};

export default function LeagueDetailPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const leagueId = params.leagueId;

  const isManager = !!user && !!league && league.createdBy === user.uid;

  // Load league + members
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch league doc
        const leagueRef = doc(db, "leagues", leagueId);
        const snap = await getDoc(leagueRef);

        if (!snap.exists()) {
          setError("League not found.");
          setLeague(null);
          setMembers([]);
          return;
        }

        const data = snap.data() as any;
        setLeague({
          name: data.name ?? "Untitled league",
          code: data.code ?? "—",
          createdBy: data.createdBy ?? "",
        });

        // Fetch members subcollection
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersSnap = await getDocs(membersRef);

        const mapped: LeagueMember[] = membersSnap.docs.map((d) => {
          const m = d.data() as any;
          return {
            uid: d.id,
            username: m.username ?? "Player",
            team: m.team ?? "",
            currentStreak: m.currentStreak ?? 0,
            longestStreak: m.longestStreak ?? 0,
            avatarUrl: m.avatarUrl ?? "",
          };
        });

        // Sort like an AFL ladder: current streak desc, then longest streak desc, then username
        mapped.sort((a, b) => {
          const curA = a.currentStreak ?? 0;
          const curB = b.currentStreak ?? 0;
          if (curB !== curA) return curB - curA;

          const longA = a.longestStreak ?? 0;
          const longB = b.longestStreak ?? 0;
          if (longB !== longA) return longB - longA;

          return (a.username || "").localeCompare(b.username || "");
        });

        setMembers(mapped);
      } catch (err) {
        console.error(err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, user, leagueId, router]);

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard error", err);
    }
  };

  const handleLeaveLeague = async () => {
    if (!user) return;
    if (!confirm("Leave this league? You can re-join later with the code.")) {
      return;
    }

    setLeaving(true);
    setLeaveError("");

    try {
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error(err);
      setLeaveError("Failed to leave league. Please try again.");
      setLeaving(false);
    }
  };

  return (
    <div className="py-6 md:py-8">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1"
        >
          ← Back to leagues
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1">
            {league?.name || "League"}
          </h1>
          <p className="text-sm text-slate-300">
            Private ladder for your mates. Your streaks here still count towards
            the global STREAKr leaderboard.
          </p>
        </div>

        {/* League code + actions */}
        {league && (
          <div className="mt-2 md:mt-0 flex flex-col items-start md:items-end gap-2">
            <div className="text-xs uppercase text-slate-400 tracking-wide">
              League code
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-sm font-mono">
                {league.code}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 transition"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {isManager && (
              <p className="text-[11px] text-emerald-400">
                You are the League Manager.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error / loading */}
      {error && (
        <p className="text-sm text-red-400 mb-4 font-medium">{error}</p>
      )}
      {loading && <p className="text-sm text-slate-300">Loading league…</p>}

      {!loading && !error && (
        <>
          {/* Ladder card */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
            {/* Header row */}
            <div className="grid grid-cols-[40px,minmax(0,2.5fr),minmax(0,1.7fr),95px,105px] px-4 py-3 text-[11px] md:text-xs font-semibold uppercase tracking-wide text-slate-400">
              <div>#</div>
              <div>Player</div>
              <div className="hidden sm:block">Team</div>
              <div className="text-right">Current</div>
              <div className="text-right">Longest</div>
            </div>

            <div className="divide-y divide-slate-800">
              {members.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-300">
                  No members yet. Share the league code with your mates to get
                  the ladder moving.
                </div>
              ) : (
                members.map((m, index) => {
                  const isYou = user && m.uid === user.uid;
                  const rank = index + 1;

                  return (
                    <div
                      key={m.uid}
                      className={`grid grid-cols-[40px,minmax(0,2.5fr),minmax(0,1.7fr),95px,105px] px-4 py-3 items-center text-sm md:text-base ${
                        isYou
                          ? "bg-orange-500/10 border-l-2 border-l-orange-500"
                          : "bg-slate-950/80"
                      }`}
                    >
                      {/* Rank */}
                      <div className="text-sm md:text-base font-semibold text-slate-200">
                        {rank}
                      </div>

                      {/* Player cell */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex-shrink-0">
                          {/* Use img to avoid remote image config issues */}
                          <img
                            src={
                              m.avatarUrl && m.avatarUrl.length > 0
                                ? m.avatarUrl
                                : "/default-avatar.png"
                            }
                            alt={m.username || "Player avatar"}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">
                              {m.username || "Player"}
                            </span>
                            {isYou && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {m.team || "No team set"}
                          </p>
                        </div>
                      </div>

                      {/* Team column (desktop only – already shown above on mobile) */}
                      <div className="hidden sm:block text-sm text-slate-200 truncate">
                        {m.team || "—"}
                      </div>

                      {/* Current streak */}
                      <div className="text-right text-sm font-semibold">
                        <span className="inline-flex items-center justify-end gap-1">
                          <span>{m.currentStreak ?? 0}</span>
                          <span className="text-[11px] text-slate-400">
                            in a row
                          </span>
                        </span>
                      </div>

                      {/* Longest streak */}
                      <div className="text-right text-sm font-semibold">
                        <span className="inline-flex items-center justify-end gap-1">
                          <span>{m.longestStreak ?? 0}</span>
                          <span className="text-[11px] text-slate-400">
                            longest
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-slate-400">
            <p>
              Private league ladders are just for bragging rights. Your picks
              still count towards the global STREAKr leaderboard.
            </p>

            {!isManager && (
              <div className="flex items-center gap-3 md:justify-end">
                {leaveError && (
                  <span className="text-red-400 text-xs">{leaveError}</span>
                )}
                <button
                  type="button"
                  onClick={handleLeaveLeague}
                  disabled={leaving}
                  className="px-3 py-1.5 rounded-full border border-red-500/60 text-red-400 hover:bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {leaving ? "Leaving…" : "Leave league"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
