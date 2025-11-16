"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
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

type League = {
  name: string;
  description?: string;
  code: string;
  managerUid: string;
  managerEmail?: string;
  memberCount?: number;
};

type Member = {
  uid: string;
  displayName: string;
  role: "manager" | "member";
};

type LoadState = "loading" | "ready" | "error";

export default function LeagueDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ leagueId: string }>();
  const router = useRouter();

  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loadingState, setLoadingState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isManager = !!user && !!league && user.uid === league.managerUid;

  // ---------- LOAD LEAGUE + MEMBERS ----------
  useEffect(() => {
    if (!leagueId) return;

    const load = async () => {
      setLoadingState("loading");
      setError("");

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const snap = await getDoc(leagueRef);

        if (!snap.exists()) {
          throw new Error("League not found");
        }

        const data = snap.data() as League;
        const leagueData: League = {
          name: data.name ?? "",
          description: data.description ?? "",
          code: data.code,
          managerUid: data.managerUid,
          managerEmail: data.managerEmail ?? "",
          memberCount: data.memberCount ?? 0,
        };

        setLeague(leagueData);
        setName(leagueData.name);
        setDescription(leagueData.description ?? "");

        // Try to load members, but don't crash detail page if this fails
        try {
          const membersCol = collection(leagueRef, "members");
          const membersSnap = await getDocs(membersCol);
          const list: Member[] = membersSnap.docs.map((d) => {
            const m = d.data() as any;
            return {
              uid: m.uid,
              displayName: m.displayName ?? "Player",
              role: (m.role as Member["role"]) || "member",
            };
          });
          setMembers(list);
        } catch (innerErr) {
          console.warn("Failed to load members (non-fatal):", innerErr);
          setMembers([]);
        }

        setLoadingState("ready");
      } catch (err) {
        console.error("Failed to load league:", err);
        setError("Failed to load league. Please try again.");
        setLoadingState("error");
      }
    };

    load();
  }, [leagueId]);

  // ---------- SAVE BASIC SETTINGS ----------
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!leagueId || !isManager) return;

    setSaving(true);
    setError("");

    try {
      const leagueRef = doc(db, "leagues", leagueId);
      await updateDoc(leagueRef, {
        name: name.trim(),
        description: description.trim(),
        updatedAt: serverTimestamp(),
      });

      setLeague((prev) =>
        prev
          ? { ...prev, name: name.trim(), description: description.trim() }
          : prev,
      );
    } catch (err) {
      console.error("Failed to save league:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- LEAVE LEAGUE ----------
  const handleLeaveLeague = async () => {
    if (!user || !leagueId) return;

    setSaving(true);
    setError("");

    try {
      const leagueRef = doc(db, "leagues", leagueId);
      const myMemberRef = doc(leagueRef, "members", user.uid);
      await deleteDoc(myMemberRef);

      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league:", err);
      setError("Failed to leave league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- DELETE LEAGUE (MANAGER ONLY) ----------
  const handleDeleteLeague = async () => {
    if (!user || !isManager || !leagueId) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this league for everyone?",
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const leagueRef = doc(db, "leagues", leagueId);

      // delete members subcollection docs (simple fan-out delete)
      const membersSnap = await getDocs(collection(leagueRef, "members"));
      await Promise.all(membersSnap.docs.map((d) => deleteDoc(d.ref)));

      await deleteDoc(leagueRef);

      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league:", err);
      setError("Failed to delete league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- UI ----------
  if (loadingState === "loading") {
    return (
      <div className="py-8">
        <p className="text-slate-300 text-sm">Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-8">
        <p className="text-red-400 text-sm">
          {error || "League not found or failed to load."}
        </p>
        <div className="mt-4">
          <Link href="/leagues" className="text-sm text-orange-400 hover:underline">
            ← Back to leagues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/leagues" className="text-sm text-slate-300 hover:text-orange-400">
          ← Back to leagues
        </Link>

        <div className="text-xs rounded-full bg-slate-900/80 border border-slate-700 px-3 py-1">
          <span className="uppercase tracking-wide text-slate-300">
            League manager:
          </span>{" "}
          <span className="font-semibold text-orange-400">
            {isManager ? "You" : league.managerEmail || "Unknown"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        {/* Left – settings */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-7">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{league.name}</h1>
          <p className="text-slate-300 text-sm mb-4">
            Private league. Your streak still counts on the global ladder – this
            page is just for bragging rights with your mates, work crew or fantasy
            league.
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase mb-1">
              Invite code
            </div>
            <div className="inline-flex items-center gap-3 bg-slate-950/70 border border-slate-700 rounded-full px-4 py-1.5 text-sm">
              <span className="font-mono tracking-[0.25em] uppercase">
                {league.code}
              </span>
              <button
                type="button"
                className="text-xs text-orange-400 hover:text-orange-300"
                onClick={() => navigator.clipboard.writeText(league.code)}
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Share this code so your mates can join.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="name">
                League name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isManager}
                className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="description"
              >
                Description (optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!isManager}
                className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              />
            </div>

            {isManager && (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm shadow-md disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </form>
        </div>

        {/* Right – members & danger zone */}
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">League members</h2>
              <span className="text-xs text-slate-400">
                {members.length} member{members.length === 1 ? "" : "s"}
              </span>
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-slate-400">
                No members found yet. Once people join with your invite code,
                they&apos;ll show up here.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {members.map((m) => (
                  <li
                    key={m.uid}
                    className="flex items-center justify-between rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2"
                  >
                    <span>{m.displayName}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {m.role === "manager" ? "Manager" : "Player"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-slate-950/80 border border-red-900/60 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red-300 mb-2">
              Danger zone
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              You can leave the league any time. Only the League Manager can
              delete the league for everyone.
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={saving}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-60"
              >
                Leave league
              </button>

              {isManager && (
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Delete league for everyone
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
