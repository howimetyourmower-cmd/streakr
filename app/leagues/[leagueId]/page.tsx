"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  createdBy: string;
};

type Member = {
  id: string;
  uid: string;
  displayName: string;
  role: "manager" | "member" | string;
};

export default function LeagueDetailPage() {
  const router = useRouter();
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;
  const { user } = useAuth() as any;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Redirect to auth if somehow no user
  useEffect(() => {
    if (user === null || user === undefined) return;
    if (!user) {
      router.push("/auth?redirect=/leagues");
    }
  }, [user, router]);

  // Subscribe to league + members
  useEffect(() => {
    if (!user || !leagueId) return;

    const leagueRef = doc(db, "leagues", leagueId);
    const membersRef = collection(db, "leagues", leagueId, "members");
    const membersQuery = query(
      membersRef,
      orderBy("joinedAt", "asc"),
      limit(100)
    );

    const unsubLeague = onSnapshot(
      leagueRef,
      (snap) => {
        if (!snap.exists()) {
          setError("League not found.");
          setLeague(null);
          setLoading(false);
          return;
        }
        const data = snap.data() as any;
        setLeague({
          id: snap.id,
          name: data.name ?? "Untitled League",
          code: data.code ?? "",
          createdBy: data.createdBy ?? "",
        });
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load league", err);
        setError("Failed to load league.");
        setLoading(false);
      }
    );

    const unsubMembers = onSnapshot(
      membersQuery,
      (snap) => {
        const list: Member[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            uid: d.uid,
            displayName: d.displayName ?? "Player",
            role: d.role ?? "member",
          });
        });
        setMembers(list);
      },
      (err) => {
        console.error("Failed to load members", err);
      }
    );

    return () => {
      unsubLeague();
      unsubMembers();
    };
  }, [leagueId, user]);

  const isManager = !!members.find(
    (m) => m.uid === user?.uid && m.role === "manager"
  );

  const handleLeaveLeague = async () => {
    if (!user || !leagueId) return;
    const confirmLeave = window.confirm("Leave this league?");
    if (!confirmLeave) return;

    try {
      setLeaving(true);
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league", err);
      setError("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!user || !leagueId || !isManager) return;
    const confirmDelete = window.confirm(
      "Delete this league for everyone? This cannot be undone."
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      const leagueRef = doc(db, "leagues", leagueId);
      await deleteDoc(leagueRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      setError("Failed to delete league. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 md:py-8">
        <p className="text-slate-300 text-sm">Loading league…</p>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="py-6 md:py-8">
        <Link
          href="/leagues"
          className="inline-flex items-center text-sm text-slate-300 hover:text-orange-400 mb-4"
        >
          ← Back to leagues
        </Link>
        <p className="text-red-400 text-sm">{error ?? "League not found."}</p>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/leagues"
            className="inline-flex items-center text-sm text-slate-300 hover:text-orange-400 mb-2"
          >
            ← Back to leagues
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {league.name}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Private league · invite mates with this code:
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700 px-4 py-1.5">
            <span className="font-mono text-sm tracking-[0.25em] uppercase text-orange-400">
              {league.code}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs md:text-sm">
          {isManager && (
            <button
              onClick={handleDeleteLeague}
              disabled={deleting}
              className="px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold"
            >
              {deleting ? "Deleting…" : "Delete league"}
            </button>
          )}
          <button
            onClick={handleLeaveLeague}
            disabled={leaving}
            className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-100 font-semibold"
          >
            {leaving ? "Leaving…" : "Leave league"}
          </button>
        </div>
      </div>

      {/* Members list */}
      <section className="mt-6">
        <h2 className="text-lg md:text-xl font-semibold mb-3 text-white">
          Members
        </h2>
        {members.length === 0 ? (
          <p className="text-slate-300 text-sm">
            No members yet. Share the code <span className="font-mono">{league.code}</span>{" "}
            with your mates so they can join.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr className="text-left text-slate-300">
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-slate-800/80 hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3 text-white">
                      {m.displayName}
                      {m.uid === user?.uid && (
                        <span className="ml-2 text-xs text-orange-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 capitalize text-xs">
                      {m.role === "manager" ? "League Manager" : "Member"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Future: ladder summary here */}
      <section className="mt-8">
        <h2 className="text-lg md:text-xl font-semibold mb-2 text-white">
          League ladder (coming soon)
        </h2>
        <p className="text-slate-300 text-sm max-w-xl">
          Once we hook this up, you&apos;ll see your private league ladder here,
          based on everyone&apos;s streaks from the global game.
        </p>
      </section>
    </div>
  );
}
