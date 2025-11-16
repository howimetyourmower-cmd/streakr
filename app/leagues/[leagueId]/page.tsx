// app/leagues/[id]/page.tsx
export const dynamic = "force-dynamic";

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
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LeagueDoc = {
  name: string;
  code: string;
  description?: string;
  managerUid: string;
  createdAt?: { seconds: number; nanoseconds: number };
  isLocked?: boolean;
};

type MemberDoc = {
  id: string;
  uid: string;
  displayName: string;
  role: "manager" | "member" | "co-manager";
  team?: string;
  avatarUrl?: string;
};

function RoleBadge({ role }: { role: MemberDoc["role"] }) {
  const text =
    role === "manager" ? "Manager" : role === "co-manager" ? "Co-manager" : "Member";
  const color =
    role === "manager"
      ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
      : role === "co-manager"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : "bg-slate-700/60 text-slate-200 border-slate-500/40";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${color}`}
    >
      {text}
    </span>
  );
}

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const leagueId = typeof params?.id === "string" ? params.id : "";

  const [league, setLeague] = useState<LeagueDoc | null>(null);
  const [members, setMembers] = useState<MemberDoc[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manager-edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocked, setEditLocked] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    if (!user && !authLoading) {
      // not signed in – push to leagues page or auth
      router.push("/leagues");
      return;
    }

    const loadLeague = async () => {
      try {
        setLoadingLeague(true);
        setError(null);

        const ref = doc(db, "leagues", leagueId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("League not found.");
          setLeague(null);
          return;
        }

        const data = snap.data() as LeagueDoc;
        setLeague(data);

        // seed edit form
        setEditName(data.name || "");
        setEditDescription(data.description || "");
        setEditLocked(Boolean(data.isLocked));
      } catch (err) {
        console.error("Failed to load league", err);
        setError("Failed to load league. Please try again later.");
      } finally {
        setLoadingLeague(false);
      }
    };

    loadLeague();
  }, [leagueId, user, authLoading, router]);

  useEffect(() => {
    if (!leagueId) return;

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);

        const leagueRef = doc(db, "leagues", leagueId);
        const membersCol = collection(leagueRef, "members");
        const q = query(membersCol, orderBy("joinedAt", "asc"));
        const snap = await getDocs(q);

        const list: MemberDoc[] = [];
        snap.forEach((m) => {
          const data = m.data() as Omit<MemberDoc, "id">;
          list.push({
            id: m.id,
            uid: data.uid,
            displayName: data.displayName || "Player",
            role: (data.role as MemberDoc["role"]) || "member",
            team: data.team,
            avatarUrl: data.avatarUrl,
          });
        });

        setMembers(list);
      } catch (err) {
        console.error("Failed to load members", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [leagueId]);

  if (authLoading || loadingLeague) {
    return (
      <div className="py-10 text-center text-slate-300">
        Loading league…
      </div>
    );
  }

  if (!league || !user) {
    return (
      <div className="py-10 text-center text-slate-300">
        {error ?? "League not found."}
      </div>
    );
  }

  const isManager = league.managerUid === user.uid;

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    try {
      setSavingSettings(true);
      const ref = doc(db, "leagues", leagueId);

      const updates: Partial<LeagueDoc> = {
        name: editName.trim() || league.name,
        description: editDescription.trim(),
        isLocked: editLocked,
      };

      await updateDoc(ref, updates);

      setLeague((prev) =>
        prev ? { ...prev, ...updates } : prev
      );
    } catch (err) {
      console.error("Failed to update league", err);
      alert("Failed to save league settings. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleKickMember = async (member: MemberDoc) => {
    if (!isManager) return;
    if (member.role === "manager") {
      alert("You can’t remove the league manager.");
      return;
    }

    const ok = window.confirm(
      `Remove ${member.displayName} from this league?`
    );
    if (!ok) return;

    try {
      setKickingId(member.id);
      const leagueRef = doc(db, "leagues", leagueId);
      const memberRef = doc(leagueRef, "members", member.id);
      await deleteDoc(memberRef);

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      console.error("Failed to remove member", err);
      alert("Failed to remove member. Please try again.");
    } finally {
      setKickingId(null);
    }
  };

  const handleTogglePromote = async (member: MemberDoc) => {
    if (!isManager) return;
    if (member.role === "manager") return;

    const newRole: MemberDoc["role"] =
      member.role === "co-manager" ? "member" : "co-manager";

    try {
      setPromotingId(member.id);
      const leagueRef = doc(db, "leagues", leagueId);
      const memberRef = doc(leagueRef, "members", member.id);
      await updateDoc(memberRef, { role: newRole });

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, role: newRole } : m
        )
      );
    } catch (err) {
      console.error("Failed to update role", err);
      alert("Failed to update member role. Please try again.");
    } finally {
      setPromotingId(null);
    }
  };

  const handleDeleteLeague = async () => {
    if (!isManager) return;

    const text = window.prompt(
      "Type DELETE to permanently delete this league (this cannot be undone)."
    );
    if (text !== "DELETE") return;

    try {
      setDeleting(true);

      const leagueRef = doc(db, "leagues", leagueId);
      const membersCol = collection(leagueRef, "members");
      const snap = await getDocs(membersCol);

      const deletions: Promise<void>[] = [];
      snap.forEach((m) => {
        deletions.push(deleteDoc(m.ref));
      });
      await Promise.all(deletions);

      await deleteDoc(leagueRef);

      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      alert("Failed to delete league. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

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

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">
            {league.name}
          </h1>
          <p className="text-sm text-slate-300">
            Private league • Code:{" "}
            <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded-md text-orange-400">
              {league.code}
            </span>
          </p>
          {league.isLocked && (
            <p className="mt-1 text-xs text-red-300">
              League is locked – new members can&apos;t join.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs md:text-sm">
          <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
            Manager:{" "}
            <span className="font-semibold">
              {
                members.find((m) => m.uid === league.managerUid)
                  ?.displayName ?? "You"
              }
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
            Members:{" "}
            <span className="font-semibold">{members.length}</span>
          </span>
        </div>
      </div>

      {/* DESCRIPTION + LAYOUT */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        {/* LEFT: members + overview */}
        <div className="space-y-6">
          {/* Description */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">About this league</h2>
            <p className="text-sm text-slate-300">
              {league.description?.trim()
                ? league.description
                : "Your manager hasn’t added a description yet. For now, it’s just bragging rights and leaderboard glory."}
            </p>
          </section>

          {/* Members table */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Members</h2>
              <p className="text-xs text-slate-400">
                Your picks in this league still count towards the global ladder.
              </p>
            </div>

            {loadingMembers ? (
              <p className="text-sm text-slate-300">Loading members…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-300">
                No members yet. Share your code to get the league started.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 md:mx-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-3">Player</th>
                      <th className="py-2 px-3 hidden md:table-cell">
                        Team
                      </th>
                      <th className="py-2 px-3">Role</th>
                      {isManager && (
                        <th className="py-2 px-3 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-800/70 last:border-none"
                      >
                        <td className="py-2.5 px-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center text-xs font-semibold">
                            {m.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.avatarUrl}
                                alt={m.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                {m.displayName
                                  .split(" ")
                                  .map((x) => x[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {m.displayName}
                              {m.uid === user.uid && (
                                <span className="ml-1 text-[11px] text-slate-400">
                                  (you)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell text-slate-300">
                          {m.team ?? "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <RoleBadge role={m.role} />
                        </td>
                        {isManager && (
                          <td className="py-2.5 px-3">
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => handleTogglePromote(m)}
                                disabled={promotingId === m.id}
                                className="px-2 py-1 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-60"
                              >
                                {m.role === "co-manager"
                                  ? "Remove co-manager"
                                  : "Make co-manager"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleKickMember(m)}
                                disabled={kickingId === m.id}
                                className="px-2 py-1 rounded-md border border-red-500/70 text-red-300 hover:bg-red-600/10 disabled:opacity-60"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: MANAGER CONTROLS */}
        <div className="space-y-6">
          {/* Invite card – everyone sees */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">Invite friends</h2>
            <p className="text-sm text-slate-300 mb-3">
              Share your league code so mates can join. Their streaks still
              count on the global ladder.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2">
                <span className="font-mono text-sm text-orange-400">
                  {league.code}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(league.code)
                    .then(() => alert("League code copied!"))
                    .catch(() =>
                      alert(
                        "Could not copy code. You can copy it manually instead."
                      )
                    );
                }}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-black font-semibold text-sm"
              >
                Copy code
              </button>
            </div>
          </section>

          {/* Manager-only controls */}
          {isManager && (
            <section className="bg-slate-900/60 border border-orange-500/40 rounded-2xl p-5">
              <h2 className="text-lg font-semibold mb-2">
                League manager controls
              </h2>
              <p className="text-xs text-slate-300 mb-4">
                These settings only show for you. Players just see the league
                details and ladder.
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    League name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    maxLength={60}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-orange-500 min-h-[80px]"
                    maxLength={500}
                    placeholder="E.g. Mates from local footy club – winner buys the end-of-season pub feed."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="lock-league"
                    type="checkbox"
                    checked={editLocked}
                    onChange={(e) => setEditLocked(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                  />
                  <label
                    htmlFor="lock-league"
                    className="text-xs text-slate-200"
                  >
                    Lock league (stop new members from joining)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full mt-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm disabled:opacity-60"
                >
                  {savingSettings ? "Saving…" : "Save settings"}
                </button>
              </form>

              {/* Danger zone */}
              <div className="mt-6 border-t border-red-500/30 pt-4">
                <h3 className="text-sm font-semibold text-red-300 mb-2">
                  Danger zone
                </h3>
                <p className="text-xs text-slate-300 mb-3">
                  Deleting this league will remove all members and this ladder
                  only. Players keep their global streaks and picks.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={deleting}
                  className="w-full px-4 py-2 rounded-lg border border-red-500/80 text-red-300 hover:bg-red-600/10 text-sm font-semibold disabled:opacity-60"
                >
                  {deleting ? "Deleting league…" : "Delete league"}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
