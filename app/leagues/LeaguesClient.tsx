// /app/leagues/LeaguesClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type LeagueDoc = {
  id: string;
  name: string;
  inviteCode: string;
  managerId?: string;
  memberCount?: number;
  sport?: string;
};

export default function LeaguesClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [myLeagues, setMyLeagues] = useState<LeagueDoc[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // --- load leagues where current user is in memberIds ---
  useEffect(() => {
    const load = async () => {
      if (!user) {
        setMyLeagues([]);
        setSelectedLeagueId("");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const leaguesRef = collection(db, "leagues");

        // memberIds includes uid (your schema)
        const qRef = query(
          leaguesRef,
          where("memberIds", "array-contains", user.uid),
          orderBy("updatedAt", "desc"),
          limit(50)
        );

        const snap = await getDocs(qRef);

        const rows: LeagueDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "Unnamed league",
            inviteCode: data.inviteCode ?? data.code ?? "",
            managerId: data.managerId ?? data.managerUid ?? data.managerID ?? "",
            memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
            sport: (data.sport || "afl").toString().toLowerCase(),
          };
        });

        setMyLeagues(rows);

        // pick default selection if none set
        setSelectedLeagueId((prev) => {
          if (prev && rows.some((l) => l.id === prev)) return prev;
          return rows[0]?.id ?? "";
        });
      } catch (e) {
        console.error("Failed to load leagues", e);
        setMyLeagues([]);
        setSelectedLeagueId("");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const selectedLeague = useMemo(() => {
    return myLeagues.find((l) => l.id === selectedLeagueId) ?? null;
  }, [myLeagues, selectedLeagueId]);

  const isManager =
    !!user && !!selectedLeague && user.uid === (selectedLeague.managerId || "");

  const goManage = () => {
    if (!selectedLeague) return;
    router.push(`/leagues/${selectedLeague.id}`);
  };

  const goLadder = () => {
    if (!selectedLeague) return;
    router.push(`/leagues/${selectedLeague.id}/ladder`);
  };

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-orange-300">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
              Private leagues are live
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Leagues</h1>
            <p className="text-sm text-white/70 max-w-3xl">
              Play STREAKr with your mates, work crew or fantasy league. Create a private league,
              invite your friends with a code, and battle it out on your own ladder while still
              counting towards the global streak leaderboard.
            </p>
          </div>

          <div className="shrink-0">
            <SportBadge sport="afl" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* ✅ 1) MY LEAGUES (LEFT) */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">My leagues</h2>
              <p className="text-sm text-white/60">
                This is your home base. Jump into a league and hit the ladder.
              </p>
            </div>

            {!user && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Log in to see your leagues.
              </div>
            )}

            {user && loading && (
              <p className="text-sm text-white/60">Loading your leagues…</p>
            )}

            {user && !loading && myLeagues.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                No leagues yet — create one or join with a code.
              </div>
            )}

            {user && !loading && myLeagues.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/60">
                    Select a league
                  </label>
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500/60"
                  >
                    {myLeagues.map((l) => {
                      const manager =
                        !!user && user.uid === (l.managerId || "");
                      return (
                        <option key={l.id} value={l.id}>
                          {l.name}
                          {manager ? " (Manager)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedLeague && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {selectedLeague.name}{" "}
                          {isManager && (
                            <span className="ml-2 text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-orange-500/40 text-orange-300 bg-orange-500/10">
                              Manager
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-white/60 mt-1">
                          Invite code{" "}
                          <span className="font-mono text-orange-300">
                            {selectedLeague.inviteCode || "—"}
                          </span>
                          {" • "}
                          Members {selectedLeague.memberCount ?? 0}
                        </p>
                      </div>
                    </div>

                    {/* ✅ BIG ORANGE VIEW LADDER */}
                    <button
                      type="button"
                      onClick={goLadder}
                      className="w-full rounded-2xl bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-base py-3 transition-colors"
                    >
                      View ladder →
                    </button>

                    {/* Secondary manage */}
                    <button
                      type="button"
                      onClick={goManage}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2 transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2) CREATE */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Create a league</h2>
              <p className="text-sm text-white/60">
                You’re the commish. Name your league and share a single invite code with the crew.
              </p>
            </div>

            <ul className="text-sm text-white/70 space-y-1">
              <li>• Automatically become League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone’s streak still counts globally</li>
            </ul>

            <Link
              href="/leagues/create"
              className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
            >
              Create league
            </Link>
          </div>

          {/* 3) JOIN */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Join a league</h2>
              <p className="text-sm text-white/60">
                Got a code from a mate? Drop it in and jump onto the ladder.
              </p>
            </div>

            <ul className="text-sm text-white/70 space-y-1">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost — still 100% free</li>
            </ul>

            <Link
              href="/leagues/join"
              className="inline-flex w-full items-center justify-center rounded-full bg-cyan-400 hover:bg-cyan-300 text-black font-semibold text-sm px-4 py-2 transition-colors"
            >
              Join with a code
            </Link>
          </div>
        </div>

        <div className="text-xs text-white/40">
          Tip: your league ladder is separate bragging rights — your global streak still lives on the
          main leaderboard.
        </div>
      </div>
    </div>
  );
}
