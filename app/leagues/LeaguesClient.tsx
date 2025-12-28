// /app/leagues/LeaguesClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  description?: string;
  memberCount?: number;
};

type MyLeagueRow = {
  league: League;
  uiRole: "manager" | "member";
};

function uniqById(list: MyLeagueRow[]) {
  const map = new Map<string, MyLeagueRow>();
  for (const item of list) map.set(item.league.id, item);
  return Array.from(map.values());
}

function normalizeCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export default function LeaguesClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [myLeagues, setMyLeagues] = useState<MyLeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Join a league state
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => myLeagues.find((x) => x.league.id === selectedLeagueId) || null,
    [myLeagues, selectedLeagueId]
  );

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setMyLeagues([]);
        setSelectedLeagueId("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const uid = user.uid;

        // 1) Leagues where I'm manager
        const leaguesRef = collection(db, "leagues");
        const managerQ = query(leaguesRef, where("managerId", "==", uid), limit(50));
        const managerSnap = await getDocs(managerQ);

        const managerLeagues: MyLeagueRow[] = managerSnap.docs.map((d) => {
          const data = d.data() as any;

          const inviteCode =
            data.inviteCode ?? data.code ?? data.leagueCode ?? "";

          const managerId =
            data.managerId ?? data.managerUid ?? data.managerUID ?? "";

          const league: League = {
            id: d.id,
            name: data.name ?? "Unnamed league",
            inviteCode,
            managerId,
            description: data.description ?? "",
            memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
          };

          return { league, uiRole: "manager" };
        });

        // 2) Leagues where I'm a member via collectionGroup members
        const membersCG = collectionGroup(db, "members");
        const membersQ = query(membersCG, where("uid", "==", uid), limit(100));
        const membersSnap = await getDocs(membersQ);

        const memberRows: MyLeagueRow[] = await Promise.all(
          membersSnap.docs.map(async (m) => {
            const leagueRef = m.ref.parent.parent;
            if (!leagueRef) return null;

            const leagueSnap = await getDoc(doc(db, "leagues", leagueRef.id));
            if (!leagueSnap.exists()) return null;

            const data = leagueSnap.data() as any;

            const inviteCode =
              data.inviteCode ?? data.code ?? data.leagueCode ?? "";

            const managerId =
              data.managerId ?? data.managerUid ?? data.managerUID ?? "";

            const league: League = {
              id: leagueSnap.id,
              name: data.name ?? "Unnamed league",
              inviteCode,
              managerId,
              description: data.description ?? "",
              memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
            };

            const roleFromMember = (m.data() as any)?.role as
              | "manager"
              | "member"
              | undefined;

            const uiRole: "manager" | "member" =
              league.managerId === uid || roleFromMember === "manager"
                ? "manager"
                : "member";

            return { league, uiRole };
          })
        ).then((x) => x.filter(Boolean) as MyLeagueRow[]);

        const merged = uniqById([...managerLeagues, ...memberRows]).sort((a, b) =>
          a.league.name.localeCompare(b.league.name)
        );

        setMyLeagues(merged);

        if (merged.length > 0) {
          setSelectedLeagueId((prev) => {
            if (prev && merged.some((x) => x.league.id === prev)) return prev;
            return merged[0].league.id;
          });
        } else {
          setSelectedLeagueId("");
        }
      } catch (e) {
        console.error(e);
        setError("Could not load your leagues. Please try again.");
        setMyLeagues([]);
        setSelectedLeagueId("");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid]);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    if (!user) {
      setJoinError("You need to be logged in to join a league.");
      return;
    }

    const code = normalizeCode(joinCode);
    if (!code || code.length < 4) {
      setJoinError("Enter a valid invite code.");
      return;
    }

    setJoining(true);

    try {
      // Find league by inviteCode
      const leaguesRef = collection(db, "leagues");
      const qLeagues = query(leaguesRef, where("inviteCode", "==", code), limit(1));
      const snap = await getDocs(qLeagues);

      if (snap.empty) {
        setJoinError("No league found with that code.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;

      const leagueData = leagueDoc.data() as any;
      const managerId = leagueData.managerId ?? "";
      const memberCount = Number(leagueData.memberCount ?? 0);

      // Create/merge member doc
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName: (user as any).displayName || (user as any).email || "Player",
          role: user.uid === managerId ? "manager" : "member",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Bump memberCount (best-effort; won’t be perfect without transaction but OK for now)
      await updateDoc(doc(db, "leagues", leagueId), {
        memberCount: memberCount > 0 ? memberCount : 1,
      }).catch(() => {});

      setJoinSuccess("You’re in. Opening league…");
      setJoinCode("");

      // Navigate straight into ladder (or league page if you prefer)
      router.push(`/leagues/${leagueId}/ladder`);
    } catch (err) {
      console.error(err);
      setJoinError("Failed to join league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-orange-300">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
            Private leagues are live
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold">Leagues</h1>
          <p className="mt-2 text-sm text-white/70 max-w-3xl">
            Play STREAKr with your mates, work crew or fantasy league. Create a private league,
            invite your friends with a code, and battle it out on your own ladder while still
            counting towards the global streak leaderboard.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}

        {/* Top row: My leagues (left) + Create league (right) */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT: My leagues */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-xl font-bold">My leagues</h2>
            <p className="text-sm text-white/70">
              This is your home base. Jump into a league and hit the ladder.
            </p>

            {loading ? (
              <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-sm text-white/70">
                Loading…
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-sm text-white/70">
                No leagues yet — create one or join with a code.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Select a league</label>
                  <select
                    value={selectedLeagueId}
                    onChange={(e) => setSelectedLeagueId(e.target.value)}
                    className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  >
                    {myLeagues.map((x) => (
                      <option key={x.league.id} value={x.league.id}>
                        {x.league.name} {x.uiRole === "manager" ? "(Manager)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {selected.league.name} {selected.uiRole === "manager" ? "👑" : ""}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          Invite code:{" "}
                          <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-0.5">
                            {selected.league.inviteCode || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BIG ORANGE VIEW LADDER */}
                    <button
                      type="button"
                      onClick={() => router.push(`/leagues/${selected.league.id}/ladder`)}
                      className="w-full inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-base px-5 py-3 transition-colors"
                    >
                      View ladder →
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/leagues/${selected.league.id}`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2 transition-colors"
                      >
                        Open league
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push(`/leagues/${selected.league.id}/manage`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2 transition-colors"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT: Create a league */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-xl font-bold">Create a league</h2>
            <p className="text-sm text-white/70">
              You&apos;re the commish. Name your league, and share a single invite code with the crew.
            </p>

            <ul className="text-sm text-white/70 list-disc pl-5 space-y-1">
              <li>Automatically become League Manager</li>
              <li>Share one code to invite players</li>
              <li>Everyone&apos;s streak still counts globally</li>
            </ul>

            <button
              type="button"
              onClick={() => router.push("/leagues/new")}
              className="w-full inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
            >
              Create league
            </button>

            <p className="text-xs text-white/50">
              Tip: your league ladder is separate bragging rights — your global streak still lives on the main leaderboard.
            </p>
          </div>
        </div>

        {/* FULL-WIDTH: Join a league */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Join a league</h2>
              <p className="text-sm text-white/70">
                Got a code from a mate? Drop it in and you’ll appear on that league’s ladder.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] items-start">
            <form onSubmit={handleJoin} className="contents">
              <div className="space-y-2">
                <label className="text-xs text-white/60">Invite code</label>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="E.g. TM668W"
                  className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                />
                {joinError && <p className="text-xs text-red-400">{joinError}</p>}
                {joinSuccess && <p className="text-xs text-emerald-400">{joinSuccess}</p>}
              </div>

              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                className="h-[42px] md:mt-[22px] inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm px-6 py-2 transition-colors disabled:opacity-60"
              >
                {joining ? "Joining…" : "Join with a code"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
