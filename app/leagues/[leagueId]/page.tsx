// app/leagues/[leagueId]/page.tsx  (works even if folder is [[leagueId]])
export const dynamic = "force-dynamic";
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  createdByUid: string;
};

type Member = {
  id: string;
  uid: string;
  role: "manager" | "member";
  displayName: string;
};

export default function LeagueDetailPage() {
  const router = useRouter();
  const params = useParams<{ leagueId?: string }>();
  const { user } = useAuth();

  const leagueId = params?.leagueId as string | undefined;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- LOAD LEAGUE + MEMBERS ----------
  useEffect(() => {
    if (!user || !leagueId) return; // don't run until both exist

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) League doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          if (!cancelled) {
            setError("League not found.");
            setLoading(false);
          }
          return;
        }

        const leagueData = leagueSnap.data() as Omit<League, "id">;
        const leagueObj: League = { id: leagueSnap.id, ...leagueData };

        // 2) Members subcollection
        const membersRef = collection(leagueRef, "members");
        const membersSnap = await getDocs(query(membersRef));

        const memberList: Member[] = [];
        membersSnap.forEach((docSnap) => {
          const data = docSnap.data() as Omit<Member, "id">;
          memberList.push({ id: docSnap.id, ...data });
        });

        if (!cancelled) {
          setLeague(leagueObj);
          setMembers(memberList);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load league", err);
        if (!cancelled) {
          setError("Failed to load league. Please try again later.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, leagueId]);

  // ---------- GUARDS ----------
  if (!user) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold mb-2">League</h1>
        <p className="text-slate-300 mb-4">
          You need to be logged in to view this league.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 text-black font-semibold hover:bg-orange-400"
        >
          Login / Sign up
        </Link>
      </div>
    );
  }

  if (!leagueId) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold mb-2">League</h1>
        <p className="text-slate-300">No league selected.</p>
        <Link
          href="/leagues"
          className="inline-flex mt-4 items-center px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
        >
          ← Back to leagues
        </Link>
      </div>
    );
  }

  const isManager = league && league.createdByUid === user.uid;
  const currentMember = members.find((m) => m.uid === user.uid) || null;

  // ---------- ACTIONS ----------
  async function handleLeaveLeague() {
    if (!league || !currentMember) return;

    const ok = window.confirm(
      "Leave this league? Your streak still counts on the global leaderboard."
    );
    if (!ok) return;

    try {
      setLeaving(true);
      const memberRef = doc(
        db,
        "leagues",
        league.id,
        "members",
        currentMember.id
      );
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league", err);
      alert("Sorry, we couldn't leave the league. Please try again.");
    } finally {
      setLeaving(false);
    }
  }

  async function handleDeleteLeague() {
    if (!league || !isManager) return;

    const ok = window.confirm(
      "Delete this league for everyone? This cannot be undone."
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const leagueRef = doc(db, "leagues", league.id);
      await deleteDoc(leagueRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      alert("Sorry, we couldn't delete the league. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ---------- RENDER ----------
  return (
    <div className="py-6 md:py-8">
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-300">Loading league…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : !league ? (
        <p className="text-slate-300">League not found.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
          {/* LEFT: League + members */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {league.name}
            </h1>
            <p className="text-slate-300 mb-4">
              Private league. Share this code with your mates so they can join.
            </p>

            {/* League code */}
            <div className="mb-6">
              <div className="text-xs uppercase text-slate-400 mb-1">
                League code
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-2 rounded-lg bg-slate-800 font-mono text-lg tracking-[0.2em]">
                  {league.code}
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(league.code)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-sm hover:bg-slate-700"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Members list */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Members</h2>
              {members.length === 0 ? (
                <p className="text-slate-300 text-sm">
                  No one has joined this league yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {members.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2"
                    >
                      <div>
                        <div className="font-semibold">
                          {m.displayName || "Player"}
                          {m.uid === user.uid && (
                            <span className="ml-2 text-xs text-orange-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {m.role === "manager" ? "League Manager" : "Member"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-3">League actions</h2>
              <p className="text-sm text-slate-300 mb-4">
                Your streak still counts on the global leaderboard even if you
                leave this league.
              </p>

              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={leaving || deleting || !currentMember}
                className="w-full mb-3 px-4 py-2 rounded-lg bg-slate-800 text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {leaving ? "Leaving league…" : "Leave this league"}
              </button>

              {isManager && (
                <>
                  <div className="h-px bg-slate-800 my-3" />
                  <p className="text-xs text-red-400 mb-2 uppercase">
                    League manager only
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteLeague}
                    disabled={deleting}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 text-sm font-semibold hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Deleting league…" : "Delete league"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
