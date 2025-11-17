"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

type League = {
  id: string;
  name: string;
  description?: string;
  code: string;
  managerUid: string;
  memberCount: number;
};

type Member = {
  uid: string;
  displayName: string;
  role: "manager" | "member";
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const isManager = !!(
    user &&
    members.find((m) => m.uid === user.uid && m.role === "manager")
  );

  useEffect(() => {
    if (!leagueId || !user) return;

    async function loadLeague() {
      setLoading(true);
      setError(null);

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLeague(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name || "Unnamed league",
          description: data.description || "",
          code: data.code || "",
          managerUid: data.managerUid,
          memberCount: data.memberCount || 0,
        };

        setLeague(leagueData);
        setFormName(leagueData.name);
        setFormDescription(leagueData.description || "");

        const membersRef = collection(db, "leagues", leagueSnap.id, "members");
        const membersSnap = await getDocs(membersRef);

        const memberList: Member[] = membersSnap.docs.map((docSnap) => {
          const md = docSnap.data() as any;
          return {
            uid: md.uid,
            displayName: md.displayName || "Player",
            role: md.role === "manager" ? "manager" : "member",
          };
        });

        // Sort: manager first, then A–Z by name
        memberList.sort((a, b) => {
          if (a.role === "manager" && b.role !== "manager") return -1;
          if (b.role === "manager" && a.role !== "manager") return 1;
          return a.displayName.localeCompare(b.displayName);
        });

        setMembers(memberList);
      } catch (err) {
        console.error("Failed to load league", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadLeague();
  }, [leagueId, user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!league || !isManager) return;
    if (!formName.trim()) {
      setError("League name cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const leagueRef = doc(db, "leagues", league.id);
      await updateDoc(leagueRef, {
        name: formName.trim(),
        description: formDescription.trim(),
        updatedAt: serverTimestamp(),
      });

      setLeague((prev) =>
        prev
          ? {
              ...prev,
              name: formName.trim(),
              description: formDescription.trim(),
            }
          : prev
      );
    } catch (err) {
      console.error("Failed to save league", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!league || !isManager) return;

    const ok = window.confirm(
      "Delete this league? This will remove the league and all members. Your global streak is unaffected."
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);

    try {
      const leagueRef = doc(db, "leagues", league.id);
      await deleteDoc(leagueRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      setError("Failed to delete league. Please try again.");
      setDeleting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard.writeText(league.code);
      alert("Invite code copied to clipboard.");
    } catch {
      alert("Could not copy code – just share it manually.");
    }
  };

  if (!user) {
    return (
      <div className="py-6 md:py-8 space-y-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
        <p className="text-slate-200">
          You need to be logged in to view this league.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 md:py-8">
        <p className="text-slate-200">Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-6 md:py-8 space-y-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
        <p className="text-red-400">{error || "League not found."}</p>
      </div>
    );
  }

  const currentMember = members.find((m) => m.uid === user.uid);

  return (
    <div className="py-6 md:py-8 space-y-6">
      <div className="mb-2">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {league.name}
          </h1>
          <p className="text-slate-300 text-sm md:text-base max-w-xl mt-1">
            Private league. Your streak still counts on the global ladder – this
            page is just for bragging rights with your mates, work crew or
            fantasy league.
          </p>
        </div>

        {currentMember && (
          <div className="self-start md:self-center">
            <span className="inline-flex items-center rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 bg-slate-900/70">
              {currentMember.role === "manager" ? "League Manager" : "League member"}
            </span>
          </div>
        )}
      </div>

      {/* Invite code + basic info */}
      <div className="grid gap-6 md:grid-cols-[2fr,1.5fr]">
        <form
          onSubmit={handleSave}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4"
        >
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              INVITE CODE
            </label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 font-mono tracking-[0.25em] text-sm text-slate-100">
                {league.code || "—"}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Share this code so your mates can join on the Leagues page.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              League name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={!isManager}
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              disabled={!isManager}
              rows={3}
              className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {isManager && (
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold text-sm shadow-lg transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </form>

        {/* Members */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">
                League members
              </h2>
              <span className="text-xs text-slate-400">
                {league.memberCount || members.length} players
              </span>
            </div>

            {members.length === 0 && (
              <p className="text-sm text-slate-300">
                No members yet. Share the invite code to get started.
              </p>
            )}

            {members.length > 0 && (
              <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                {members.map((m) => (
                  <li
                    key={m.uid}
                    className="flex items-center justify-between rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="text-slate-100">
                        {m.displayName || "Player"}
                        {m.uid === user.uid && (
                          <span className="text-xs text-slate-400 ml-1">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {m.role === "manager" ? "League manager" : "Member"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isManager && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting league…" : "Delete league"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
