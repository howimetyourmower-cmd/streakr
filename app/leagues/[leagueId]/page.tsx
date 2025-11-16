// app/leagues/[leagueId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  name: string;
  code: string;
  createdBy?: string;
};

type MemberRow = {
  uid: string;
  username: string;
  team?: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
};

type PageProps = {
  params: { leagueId: string };
};

export default function LeagueDetailPage({ params }: PageProps) {
  const { leagueId } = params;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load league + members
  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        setLoading(true);

        // 1) League doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() || {};
        const leagueData: LeagueDoc = {
          name: data.name ?? "My league",
          code: data.code ?? "—",
          createdBy: data.createdBy,
        };
        setLeague(leagueData);

        // 2) Members subcollection
        const membersRef = collection(leagueRef, "members");
        const membersQuery = query(membersRef, orderBy("joinedAt", "asc"));
        const membersSnap = await getDocs(membersQuery);

        const rows: MemberRow[] = [];

        for (const m of membersSnap.docs) {
          const memberData = m.data() || {};
          const uid = m.id;

          // Look up profile in /users/{uid}
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          const profile = userSnap.data() || {};

          rows.push({
            uid,
            username:
              profile.username ||
              profile.name ||
              profile.email ||
              "Player",
            team: profile.team || profile.favouriteTeam || "",
            avatarUrl:
              profile.avatarUrl || "/default-avatar.png",
            currentStreak: profile.currentStreak ?? 0,
            longestStreak: profile.longestStreak ?? 0,
          });
        }

        setMembers(rows);
      } catch (err) {
        console.error("Failed to load league detail", err);
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
      alert("League code copied to clipboard.");
    } catch (err) {
      console.error("Copy failed", err);
      alert("Could not copy code. Please copy it manually.");
    }
  };

  const handleLeaveLeague = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    const confirmLeave = window.confirm(
      "Leave this league? You can re-join later with the invite code."
    );
    if (!confirmLeave) return;

    try {
      setLeaving(true);
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league", err);
      alert("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const isManager = league?.createdBy && user?.uid === league.createdBy;

  return (
    <div className="py-6 md:py-8">
      {/* Breadcrumb back link */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-xs text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      {/* Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            {league?.name || "League"}
          </h1>
          <p className="text-slate-300 text-sm">
            Private league. Your streak still counts towards the global ladder.
          </p>
          {isManager && (
            <p className="text-xs text-emerald-400 mt-1">
              You are the League Manager.
            </p>
          )}
        </div>

        {/* League code + actions */}
        {league && (
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-wide">
                League code
              </div>
              <div className="font-mono text-lg">
                {league.code || "—"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-4">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-full border border-slate-600 text-xs font-semibold hover:border-orange-400 hover:text-orange-400 transition-colors"
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={leaving}
                className="px-3 py-1.5 rounded-full border border-red-500/70 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60 transition-colors"
              >
                {leaving ? "Leaving…" : "Leave league"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error / loading */}
      {loading && (
        <div className="text-slate-300 text-sm">Loading league…</div>
      )}
      {error && !loading && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Members table */}
      {!loading && !error && (
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-semibold">
              League ladder
            </h2>
            <p className="text-xs text-slate-400">
              Showing {members.length}{" "}
              {members.length === 1 ? "player" : "players"}
            </p>
          </div>

          {members.length === 0 ? (
            <p className="text-slate-300 text-sm">
              No members yet. Share the league code with your mates to get
              them in.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
                    <th className="py-2 pr-4 text-left">Player</th>
                    <th className="py-2 px-4 text-left hidden sm:table-cell">
                      Team
                    </th>
                    <th className="py-2 px-4 text-right">
                      Current streak
                    </th>
                    <th className="py-2 pl-4 text-right">
                      Longest streak
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, index) => (
                    <tr
                      key={m.uid}
                      className="border-b border-slate-800/70 last:border-0"
                    >
                      <td className="py-3 pr-4 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-xs font-semibold">
                          <img
                            src={m.avatarUrl || "/default-avatar.png"}
                            alt={m.username}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-semibold">
                            {index + 1}. {m.username}
                          </div>
                          <div className="text-xs text-slate-400 sm:hidden">
                            {m.team || "No team set"}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 hidden sm:table-cell">
                        {m.team || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {m.currentStreak}{" "}
                        <span className="text-xs text-slate-400">
                          in a row
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right">
                        {m.longestStreak}{" "}
                        <span className="text-xs text-slate-400">
                          longest
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
