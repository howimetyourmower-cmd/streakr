"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  ownerUid: string;
};

type Member = {
  uid: string;
  username: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
  isOwner?: boolean;
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const leagueId = (params?.leagueId as string) || "";

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const load = async () => {
      if (!leagueId) return;

      setLoading(true);
      setError("");

      try {
        // Load league doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;
        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name || "Private League",
          code: data.code || "",
          ownerUid: data.ownerUid || "",
        };
        setLeague(leagueData);

        // Load members
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersSnap = await getDocs(membersRef);
        const list: Member[] = membersSnap.docs.map((m) => {
          const d = m.data() as any;
          return {
            uid: d.uid || m.id,
            username: d.username || "Player",
            avatarUrl: d.avatarUrl || "",
            currentStreak:
              typeof d.currentStreak === "number" ? d.currentStreak : 0,
            longestStreak:
              typeof d.longestStreak === "number" ? d.longestStreak : 0,
            isOwner: d.isOwner || false,
          };
        });

        // Sort by longest streak desc, then currentStreak desc
        list.sort((a, b) => {
          if ((b.longestStreak ?? 0) !== (a.longestStreak ?? 0)) {
            return (b.longestStreak ?? 0) - (a.longestStreak ?? 0);
          }
          return (b.currentStreak ?? 0) - (a.currentStreak ?? 0);
        });

        setMembers(list);
      } catch (err) {
        console.error("Failed to load league detail:", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      void load();
    }
  }, [leagueId, user]);

  const handleLeaveLeague = async () => {
    if (!user || !leagueId) return;

    const confirmed = window.confirm(
      "Are you sure you want to leave this league?"
    );
    if (!confirmed) return;

    setLeaving(true);
    try {
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league:", err);
      alert("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const currentUserUid = user?.uid || null;

  if (authLoading || (user && loading)) {
    return (
      <main className="max-w-4xl mx-auto p-6 text-white">
        <p>Loading league…</p>
      </main>
    );
  }

  if (!user) {
    return null; // redirect handled above
  }

  if (error || !league) {
    return (
      <main className="max-w-4xl mx-auto p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">League</h1>
        <p className="text-sm text-red-400">{error || "League not found."}</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 text-white">
      {/* League header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{league.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
              <span className="font-semibold uppercase tracking-wide">
                Code
              </span>
              <span className="font-mono tracking-[0.2em] text-orange-300">
                {league.code}
              </span>
            </span>
            <span className="text-gray-400">
              Share this code with mates to invite them into your private ladder.
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <button
            type="button"
            onClick={handleLeaveLeague}
            disabled={leaving}
            className="px-4 py-1.5 rounded-full border border-red-500 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
          >
            {leaving ? "Leaving…" : "Leave league"}
          </button>
          <p className="text-[11px] text-gray-400">
            Leaving removes you from this league’s leaderboard only.
          </p>
        </div>
      </div>

      {/* Members leaderboard */}
      <section className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-orange-300">
            League leaderboard
          </h2>
          <p className="text-[11px] text-gray-400">
            Ranked by longest streak, then current streak.
          </p>
        </div>

        {members.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-300">
            No members yet. Share your code and get your first mate to join.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Header row (desktop) */}
            <div className="hidden sm:grid grid-cols-[40px,minmax(0,2.5fr),minmax(0,1fr),minmax(0,1fr)] px-4 py-2 text-[11px] text-gray-400 uppercase tracking-wide">
              <div>#</div>
              <div>Player</div>
              <div className="text-right">Current streak</div>
              <div className="text-right">Longest streak</div>
            </div>

            {members.map((m, index) => {
              const isYou = m.uid === currentUserUid;

              return (
                <div
                  key={m.uid}
                  className={`px-4 py-3 flex flex-col gap-2 sm:grid sm:grid-cols-[40px,minmax(0,2.5fr),minmax(0,1fr),minmax(0,1fr)] sm:items-center ${
                    isYou ? "bg-white/5" : "bg-black/10"
                  } hover:bg-white/8 transition`}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-2 sm:block">
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="sm:hidden text-[11px] text-gray-400 ml-2">
                      Rank
                    </span>
                  </div>

                  {/* Player info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={m.avatarUrl || "/default-avatar.png"}
                      alt={m.username}
                      className="w-9 h-9 rounded-full border border-white/15 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {m.username}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        {m.isOwner && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-semibold">
                            Owner
                          </span>
                        )}
                        {isYou && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current streak */}
                  <div className="flex sm:block justify-between text-sm">
                    <span className="sm:hidden text-[11px] text-gray-400 mr-2">
                      Current
                    </span>
                    <span className="font-semibold">
                      {m.currentStreak ?? 0}
                      <span className="text-[11px] text-gray-400 ml-1">
                        in a row
                      </span>
                    </span>
                  </div>

                  {/* Longest streak */}
                  <div className="flex sm:block justify-between text-sm">
                    <span className="sm:hidden text-[11px] text-gray-400 mr-2">
                      Longest
                    </span>
                    <span className="font-semibold text-orange-300">
                      {m.longestStreak ?? 0}
                      <span className="text-[11px] text-gray-400 ml-1">
                        longest
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
