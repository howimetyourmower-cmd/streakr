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
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  description?: string;
  managerUid: string;
  memberCount: number;
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
  const { user, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [leaveStatus, setLeaveStatus] = useState<"idle" | "leaving">("idle");
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");

  const [error, setError] = useState<string | null>(null);

  const isManager = !!league && !!user && league.managerUid === user.uid;

  // ---------- LOAD LEAGUE + MEMBERS ----------
  useEffect(() => {
    const run = async () => {
      if (!user || !leagueId) return;
      setLoading(true);
      setError(null);

      try {
        // 1) Load league doc
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("That league doesn’t exist anymore.");
          setLeague(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed league",
          code: data.code ?? "",
          description: data.description ?? "",
          managerUid: data.managerUid,
          memberCount: data.memberCount ?? 0,
        };
        setLeague(leagueData);
        setNameInput(leagueData.name);
        setDescriptionInput(leagueData.description ?? "");

        // 2) Make sure current user is a member
        const myMemberRef = doc(db, "leagues", leagueId, "members", user.uid);
        const myMemberSnap = await getDoc(myMemberRef);
        if (!myMemberSnap.exists()) {
          setError("You’re not a member of this league.");
          setMembers([]);
          setLoading(false);
          return;
        }

        // 3) Load all members
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersSnap = await getDocs(membersRef);

        const membersList: Member[] = membersSnap.docs.map((d) => {
          const m = d.data() as any;
          return {
            id: d.id,
            uid: m.uid,
            displayName: m.displayName || "Player",
            role: m.role === "manager" ? "manager" : "member",
          };
        });

        // Sort: manager first, then alphabetically
        membersList.sort((a, b) => {
          if (a.role === "manager" && b.role !== "manager") return -1;
          if (b.role === "manager" && a.role !== "manager") return 1;
          return a.displayName.localeCompare(b.displayName);
        });

        setMembers(membersList);
      } catch (err) {
        console.error("Failed to load league:", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      if (!user) {
        router.push("/auth");
      } else {
        run();
      }
    }
  }, [authLoading, user, leagueId, router]);

  // ---------- UPDATE LEAGUE ----------
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!league || !user) return;
    if (!isManager) {
      setSaveStatus("error");
      setError("Only the league manager can edit details.");
      return;
    }

    try {
      setSaveStatus("saving");
      setError(null);

      const leagueRef = doc(db, "leagues", league.id);

      await updateDoc(leagueRef, {
        name: nameInput.trim() || "Unnamed league",
        description: descriptionInput.trim(),
        updatedAt: serverTimestamp(),
      });

      setLeague((prev) =>
        prev
          ? {
              ...prev,
              name: nameInput.trim() || "Unnamed league",
              description: descriptionInput.trim(),
            }
          : prev
      );
      setSaveStatus("success");

      // Reset back to idle after short delay
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Failed to save league:", err);
      setError("Failed to save changes. Please try again.");
      setSaveStatus("error");
    }
  };

  // ---------- LEAVE LEAGUE ----------
  const handleLeaveLeague = async () => {
    if (!user || !league) return;

    const myMember = members.find((m) => m.uid === user.uid);
    if (!myMember) return;

    if (myMember.role === "manager" && league.memberCount > 1) {
      alert(
        "You’re currently the league manager. To leave, either delete the league or transfer manager role (coming soon)."
      );
      return;
    }

    const confirmLeave = window.confirm(
      "Are you sure you want to leave this league? Your streak will still count on the global leaderboard, but you’ll drop out of this league’s ladder."
    );
    if (!confirmLeave) return;

    try {
      setLeaveStatus("leaving");
      setError(null);

      // If manager and only member, treat as delete
      if (myMember.role === "manager" && league.memberCount <= 1) {
        const leagueRef = doc(db, "leagues", league.id);
        await deleteDoc(leagueRef);
        router.push("/leagues");
        return;
      }

      // Normal member leave
      const memberRef = doc(db, "leagues", league.id, "members", user.uid);
      await deleteDoc(memberRef);

      const leagueRef = doc(db, "leagues", league.id);
      await updateDoc(leagueRef, {
        memberCount: increment(-1),
        updatedAt: serverTimestamp(),
      });

      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league:", err);
      setError("Failed to leave league. Please try again.");
      setLeaveStatus("idle");
    }
  };

  // ---------- DELETE LEAGUE (MANAGER ONLY) ----------
  const handleDeleteLeague = async () => {
    if (!league || !user || !isManager) return;

    const confirmDelete = window.confirm(
      "Delete this league for everyone? This will remove the league and all its members. Your picks and streaks still count on the global leaderboard."
    );
    if (!confirmDelete) return;

    try {
      setDeleteStatus("deleting");
      setError(null);

      const membersRef = collection(db, "leagues", league.id, "members");
      const membersSnap = await getDocs(membersRef);

      const batch = writeBatch(db);

      membersSnap.docs.forEach((memberDoc) => {
        batch.delete(memberDoc.ref);
      });

      const leagueRef = doc(db, "leagues", league.id);
      batch.delete(leagueRef);

      await batch.commit();

      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league:", err);
      setError("Failed to delete league. Please try again.");
      setDeleteStatus("idle");
    }
  };

  // ---------- UI STATES ----------
  if (authLoading || loading) {
    return (
      <div className="py-10">
        <p className="text-slate-300">Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-10">
        <Link href="/leagues" className="text-sm text-slate-300 hover:text-orange-400 mb-4 inline-flex items-center gap-1">
          ← Back to leagues
        </Link>
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-950/20 px-4 py-6">
          <h1 className="text-xl font-semibold text-red-300 mb-2">League not found</h1>
          <p className="text-slate-300">
            {error || "We couldn’t find that league. It may have been deleted."}
          </p>
        </div>
      </div>
    );
  }

  const myMember = members.find((m) => m.uid === user?.uid);
  const myRole = myMember?.role ?? "member";

  return (
    <div className="py-6 md:py-8">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400 inline-flex items-center gap-1"
        >
          ← Back to leagues
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
            {league.name}
          </h1>
          <p className="text-slate-300 text-sm md:text-base">
            Private league. Your streak still counts on the global ladder – this page is just for
            bragging rights with your mates, work crew or fantasy league.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
            {myRole === "manager" ? "League Manager" : "League Member"}
          </span>
          <span className="text-xs text-slate-400">
            {league.memberCount} member{league.memberCount === 1 ? "" : "s"} · Invite code{" "}
            <span className="font-mono text-slate-100">{league.code}</span>
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        {/* LEFT COLUMN – Details + Members */}
        <div className="space-y-6">
          {/* League settings */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">League settings</h2>
              <span className="text-xs text-slate-400">
                Invite code:{" "}
                <span className="font-mono text-slate-100 tracking-wide">{league.code}</span>
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  League name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={!isManager}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Description <span className="text-slate-500 text-xs">(optional)</span>
                </label>
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  disabled={!isManager}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                  placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
                />
              </div>

              {isManager ? (
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={saveStatus === "saving"}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow-md hover:bg-orange-400 disabled:opacity-70"
                  >
                    {saveStatus === "saving" ? "Saving…" : "Save changes"}
                  </button>

                  {saveStatus === "success" && (
                    <span className="text-xs text-emerald-300">
                      Saved. Your league details are up to date.
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-xs text-red-300">
                      Something went wrong. Please try again.
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Only the league manager can edit the name and description.
                </p>
              )}
            </form>
          </div>

          {/* Members */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <span className="text-xs text-slate-400">
                {members.length} member{members.length === 1 ? "" : "s"}
              </span>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-slate-300">
                No-one has joined this league yet. Share your invite code to get people in.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-100">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {m.displayName}
                          {m.uid === user?.uid && (
                            <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-200">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {m.role === "manager" ? "League manager" : "Member"}
                        </div>
                      </div>
                    </div>

                    {isManager && m.uid !== user?.uid && (
                      <button
                        type="button"
                        disabled={true}
                        className="text-xs rounded-full border border-slate-700 px-3 py-1 text-slate-400 opacity-60 cursor-not-allowed"
                        title="Kicking members coming soon"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-xs text-slate-400">
              Leaderboards for private leagues will be hooked up once live results are flowing.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN – Invite + Danger zone */}
        <div className="space-y-6">
          {/* Invite card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-5">
            <h2 className="text-lg font-semibold text-white mb-3">Invite friends</h2>
            <p className="text-sm text-slate-300 mb-4">
              Share this code with your mates. Once they join and start making picks, they’ll appear
              in this league’s ladder.
            </p>

            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2 flex-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Invite code
                </span>
                <div className="font-mono text-lg font-semibold text-slate-50 tracking-[0.2em]">
                  {league.code}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    .writeText(league.code)
                    .catch((err) => console.error("Failed to copy code", err));
                }}
                className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
              >
                Copy
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Coming soon: one-tap join links you can drop into group chats.
            </p>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-900/60 bg-red-950/20 px-5 py-5">
            <h2 className="text-lg font-semibold text-red-200 mb-3">Danger zone</h2>
            <p className="text-xs text-red-100 mb-4">
              These actions only affect this league. Your actual streak and prizes are still based
              on the global ladder.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={leaveStatus === "leaving" || deleteStatus === "deleting"}
                className="w-full rounded-lg border border-red-500/50 bg-transparent px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/30 disabled:opacity-60"
              >
                {leaveStatus === "leaving" ? "Leaving league…" : "Leave this league"}
              </button>

              {isManager && (
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={deleteStatus === "deleting" || leaveStatus === "leaving"}
                  className="w-full rounded-lg border border-red-700 bg-red-900/60 px-4 py-2 text-sm font-semibold text-red-50 hover:bg-red-800 disabled:opacity-60"
                >
                  {deleteStatus === "deleting" ? "Deleting league…" : "Delete league for everyone"}
                </button>
              )}
            </div>

            {isManager ? (
              <p className="mt-3 text-[11px] text-red-200/80">
                Deleting the league won’t delete any of your picks or streaks – it just removes this
                private ladder.
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-red-200/80">
                If you leave, you can rejoin later with the same invite code, as long as the manager
                keeps the league alive.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
