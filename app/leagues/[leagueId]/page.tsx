"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  name: string;
  description?: string;
  code: string;
  managerUid: string;
  memberCount?: number;
};

type Member = {
  id: string;
  uid: string;
  displayName: string;
  role: "manager" | "member";
};

export default function LeagueDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isManager = !!league && !!user && league.managerUid === user.uid;

  useEffect(() => {
    const fetchData = async () => {
      if (!leagueId || !user) {
        setLoading(false);
        return;
      }

      try {
        setError(null);

        // 1) Load league
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const leagueData = leagueSnap.data() as League;
        setLeague(leagueData);
        setName(leagueData.name);
        setDescription(leagueData.description || "");

        // 2) Load members (first 50, ordered by displayName)
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersQuery = query(
          membersRef,
          orderBy("displayName"),
          limit(50)
        );
        const membersSnap = await getDocs(membersQuery);

        const loadedMembers: Member[] = membersSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Member, "id">),
        }));

        setMembers(loadedMembers);
      } catch (err) {
        console.error("Error loading league data", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [leagueId, user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!leagueId || !league || !isManager) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("League name cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setInfo(null);

      const leagueRef = doc(db, "leagues", leagueId);
      await updateDoc(leagueRef, {
        name: trimmedName,
        description: description.trim(),
      });

      setLeague({
        ...league,
        name: trimmedName,
        description: description.trim(),
      });
      setInfo("League details saved.");
    } catch (err) {
      console.error("Error saving league", err);
      setError("Failed to save league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard?.writeText(league.code);
      setInfo("Invite code copied to clipboard.");
    } catch {
      setInfo("Invite code: " + league.code);
    }
  };

  const handleLeaveLeague = async () => {
    if (!leagueId || !user) return;

    if (
      !window.confirm(
        "Are you sure you want to leave this league? You can rejoin later with the invite code."
      )
    ) {
      return;
    }

    try {
      setLeaving(true);
      setError(null);
      setInfo(null);

      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);

      if (league && typeof league.memberCount === "number") {
        const leagueRef = doc(db, "leagues", leagueId);
        await updateDoc(leagueRef, {
          memberCount: Math.max(0, league.memberCount - 1),
        });
      }

      router.push("/leagues");
    } catch (err) {
      console.error("Error leaving league", err);
      setError("Failed to leave league. Please try again.");
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!leagueId || !league || !isManager) return;

    if (
      !window.confirm(
        "Delete this league for everyone? This will remove all members and the league itself. This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);
      setInfo(null);

      const leagueRef = doc(db, "leagues", leagueId);

      // Delete all members
      const membersRef = collection(db, "leagues", leagueId, "members");
      const membersSnap = await getDocs(membersRef);
      const batchDeletes: Promise<void>[] = [];
      membersSnap.forEach((m) => {
        batchDeletes.push(deleteDoc(m.ref));
      });
      await Promise.all(batchDeletes);

      // Delete league
      await deleteDoc(leagueRef);

      router.push("/leagues");
    } catch (err) {
      console.error("Error deleting league", err);
      setError("Failed to delete league. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-slate-300 mb-4">
          You need to be logged in to view league details.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm"
        >
          Go to login / sign up
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-8">
        <p className="text-slate-300">Loading league...</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-8">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-white mb-4 inline-flex items-center gap-1"
        >
          ← Back to leagues
        </Link>
        <p className="text-red-300">League not found.</p>
      </div>
    );
  }

  const currentUserMember = members.find((m) => m.uid === user.uid);

  return (
    <div className="py-6 md:py-8 max-w-5xl">
      <Link
        href="/leagues"
        className="text-sm text-slate-300 hover:text-white mb-4 inline-flex items-center gap-1"
      >
        ← Back to leagues
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
        {/* LEFT: League details & edit form */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">{league.name}</h1>
            {isManager && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/60 text-xs font-semibold text-orange-300">
                LEAGUE MANAGER
              </span>
            )}
          </div>

          <p className="text-slate-300 text-sm mb-4">
            Private league. Your streak still counts on the global ladder – this
            page is just for bragging rights with your mates, work crew or
            fantasy league.
          </p>

          {/* Invite code panel */}
          <div className="mb-5 rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
                Invite code
              </div>
              <div className="text-lg font-mono tracking-[0.35em] uppercase">
                {league.code}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Share this code so your mates can join.
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="self-start sm:self-auto inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-black text-xs font-semibold"
            >
              Copy code
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-3 rounded-lg bg-emerald-900/40 border border-emerald-700 px-4 py-3 text-sm text-emerald-200">
              {info}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                League name
              </label>
              <input
                type="text"
                className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isManager}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              <textarea
                className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isManager}
              />
            </div>

            {isManager && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            )}
          </form>

          {/* Danger actions */}
          <div className="mt-6 border-t border-slate-800 pt-4 flex flex-wrap gap-3">
            {currentUserMember && currentUserMember.role !== "manager" && (
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={leaving}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-red-500/60 text-red-300 text-xs font-semibold hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {leaving ? "Leaving..." : "Leave league"}
              </button>
            )}

            {isManager && (
              <button
                type="button"
                onClick={handleDeleteLeague}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-red-500/60 text-red-300 text-xs font-semibold hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete league for everyone"}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Members list */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Members</h2>
            <span className="text-xs text-slate-400">
              {league.memberCount ?? members.length}{" "}
              {league.memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-slate-400">
              No members yet. Share the invite code to get your mates in.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">
                      {m.displayName || "Player"}
                      {m.uid === user.uid && (
                        <span className="ml-2 text-xs text-slate-400">
                          (you)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {m.role === "manager" ? "League manager" : "Member"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
