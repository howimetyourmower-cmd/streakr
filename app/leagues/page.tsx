"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueSummary = {
  id: string;
  name: string;
  code: string;
  role: "manager" | "member";
};

export default function LeaguesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  // ------------- LOAD MY LEAGUES -------------
  useEffect(() => {
    const loadLeagues = async () => {
      if (!user) return;
      setLeaguesLoading(true);
      setLeaguesError(null);

      try {
        // Find all member docs for this user across all leagues
        const membersQ = query(
          collectionGroup(db, "members"),
          where("uid", "==", user.uid),
          limit(50)
        );
        const membersSnap = await getDocs(membersQ);

        const results: LeagueSummary[] = [];

        for (const memberDoc of membersSnap.docs) {
          const data = memberDoc.data() as any;
          const leagueRef = memberDoc.ref.parent.parent;
          if (!leagueRef) continue;

          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) continue;

          const leagueData = leagueSnap.data() as any;

          results.push({
            id: leagueSnap.id,
            name: leagueData.name ?? "Unnamed league",
            code: leagueData.code ?? "",
            role: data.role === "manager" ? "manager" : "member",
          });
        }

        // Sort: manager leagues first, then name
        results.sort((a, b) => {
          if (a.role === "manager" && b.role !== "manager") return -1;
          if (b.role === "manager" && a.role !== "manager") return 1;
          return a.name.localeCompare(b.name);
        });

        setMyLeagues(results);
        // Default selected league
        if (results.length > 0) {
          setSelectedLeagueId(results[0].id);
        }
      } catch (err) {
        console.error("Failed to load leagues for user:", err);
        setLeaguesError("Failed to load your leagues. Please try again later.");
      } finally {
        setLeaguesLoading(false);
      }
    };

    if (!authLoading && user) {
      loadLeagues();
    }
  }, [authLoading, user]);

  // ------------- CREATE LEAGUE -------------
  const handleCreateLeague = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string)?.trim() || "My league";
    const description = (formData.get("description") as string)?.trim() || "";

    try {
      setCreating(true);

      // Simple 6-char code
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();

      const leagueRef = doc(collection(db, "leagues"));
      await setDoc(leagueRef, {
        name,
        description,
        code,
        managerUid: user.uid,
        memberCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add manager as member
      const memberRef = doc(collection(leagueRef, "members"), user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        displayName: user.displayName || user.email || "Player",
        role: "manager",
        joinedAt: serverTimestamp(),
      });

      router.push(`/leagues/${leagueRef.id}`);
    } catch (err) {
      console.error("Failed to create league:", err);
      alert("Sorry, we couldn’t create your league. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ------------- JOIN LEAGUE BY CODE -------------
  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth");
      return;
    }

    const trimmed = joinCode.replace(/\s+/g, "").toUpperCase();
    if (!trimmed) return;

    try {
      setJoining(true);
      setLeaguesError(null);

      // Look up league by code
      const leaguesRef = collection(db, "leagues");
      const codeQ = query(leaguesRef, where("code", "==", trimmed), limit(1));
      const codeSnap = await getDocs(codeQ);

      if (codeSnap.empty) {
        alert("No league found with that code. Double check and try again.");
        setJoining(false);
        return;
      }

      const leagueDoc = codeSnap.docs[0];
      const leagueData = leagueDoc.data() as any;

      // Add / update member doc
      const memberRef = doc(db, "leagues", leagueDoc.id, "members", user.uid);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName: user.displayName || user.email || "Player",
          role: leagueData.managerUid === user.uid ? "manager" : "member",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // (Optional) Could increment memberCount via Cloud Function later

      router.push(`/leagues/${leagueDoc.id}`);
    } catch (err) {
      console.error("Failed to join league:", err);
      alert("Sorry, we couldn’t join that league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const selectedLeague = myLeagues.find((l) => l.id === selectedLeagueId) ?? myLeagues[0];

  return (
    <div className="py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Leagues</h1>
        <p className="text-slate-300 text-sm md:text-base max-w-2xl">
          Play Streakr with your mates, work crew or fantasy league. Create a private league, invite
          friends with a code, and battle it out on your own ladder while still counting towards the
          global Streak leaderboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* CREATE LEAGUE */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-1">Create a league</h2>
          <p className="text-sm text-slate-300 mb-4">
            You’re the commish. Name your league, set how many mates can join and share a single
            invite code with your group.
          </p>
          <ul className="text-xs text-slate-400 mb-4 space-y-1">
            <li>• You automatically join as League Manager</li>
            <li>• Share one code to invite players</li>
            <li>• Everyone’s streak still counts globally</li>
          </ul>

          <form onSubmit={handleCreateLeague} className="mt-auto space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                League name
              </label>
              <input
                name="name"
                type="text"
                placeholder="E.g. Test Crew"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Description <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="E.g. Season-long office comp. Winner shouts the pub session."
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow-md hover:bg-orange-400 disabled:opacity-70"
            >
              {creating ? "Creating…" : "Create league"}
            </button>
          </form>
        </div>

        {/* JOIN LEAGUE */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-1">Join a league</h2>
          <p className="text-sm text-slate-300 mb-4">
            Got a code from a mate? Drop it in and you&apos;ll appear on that league&apos;s ladder
            as soon as you start making picks.
          </p>
          <ul className="text-xs text-slate-400 mb-4 space-y-1">
            <li>• League Manager controls who gets the code</li>
            <li>• You can join multiple private leagues</li>
            <li>• No extra cost – still 100% free</li>
          </ul>

          <form onSubmit={handleJoinByCode} className="mt-auto space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                League code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="E.g. 7FQ9LZ"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 uppercase tracking-[0.2em]"
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black shadow-md hover:bg-sky-400 disabled:opacity-70"
            >
              {joining ? "Joining…" : "Join with a code"}
            </button>
          </form>
        </div>

        {/* MY LEAGUES – DROPDOWN */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-1">My leagues</h2>
          <p className="text-sm text-slate-300 mb-4">
            Once we finish wiring everything up, this panel will show all the leagues you&apos;re
            in, your current rank and a quick link to each ladder.
          </p>

          {authLoading || leaguesLoading ? (
            <p className="text-sm text-slate-300 mt-auto">Loading your leagues…</p>
          ) : leaguesError ? (
            <p className="text-sm text-red-300 mt-auto">{leaguesError}</p>
          ) : myLeagues.length === 0 ? (
            <p className="text-sm text-slate-300 mt-auto">
              You&apos;re not in any leagues yet. Create one or join with a code to get started.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Choose a league
                </label>
                <select
                  value={selectedLeague?.id ?? ""}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                >
                  {myLeagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}{" "}
                      {league.role === "manager" ? "(Manager)" : "(Member)"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLeague && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold text-white">{selectedLeague.name}</div>
                      <div className="text-xs text-slate-400">
                        {selectedLeague.role === "manager"
                          ? "You are the league manager"
                          : "You are a member"}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">
                      Invite code
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-base tracking-[0.2em] text-slate-50">
                        {selectedLeague.code}
                      </span>
                      <button
                        type="button"
                        className="text-[11px] rounded-full border border-slate-600 px-2 py-1 text-slate-200 hover:bg-slate-800"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(selectedLeague.code)
                            .catch((err) => console.error("Copy failed", err))
                        }
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/leagues/${selectedLeague.id}`)}
                    className="w-full rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
                  >
                    Open league page
                  </button>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Private leagues are just for bragging rights. Your streak still counts towards the
                global leaderboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
