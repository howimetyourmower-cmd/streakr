// app/leagues/[leagueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  description?: string;
  code: string;
  managerUid: string;
  managerEmail?: string;
};

type LeagueMember = {
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
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const [origin, setOrigin] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Get window origin for invite link
  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Helper to get doc ref (don’t put this in deps)
  const getLeagueDocRef = () => {
    if (!leagueId) return null;
    return doc(collection(db, "leagues"), leagueId as string);
  };

  const isManager =
    !!league && !!user && league.managerUid === user.uid;

  const currentMember = members.find((m) => m.uid === user?.uid);

  // Load league + members
  useEffect(() => {
    const load = async () => {
      if (!user || !leagueId) return;

      const leagueDocRef = getLeagueDocRef();
      if (!leagueDocRef) return;

      setLoading(true);
      setError(null);
      try {
        // 1) League doc
        const snap = await getDoc(leagueDocRef);
        if (!snap.exists()) {
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = snap.data() as any;
        const leagueData: League = {
          id: snap.id,
          name: data.name ?? "Untitled league",
          description: data.description ?? "",
          code: data.code ?? "",
          managerUid: data.managerUid ?? "",
          managerEmail: data.managerEmail ?? "",
        };

        setLeague(leagueData);
        setForm({
          name: leagueData.name,
          description: leagueData.description ?? "",
        });

        // 2) Members subcollection
        const membersRef = collection(leagueDocRef, "members");
        const membersSnap = await getDocs(
          query(membersRef, orderBy("role"), orderBy("displayName"))
        );

        const membersData: LeagueMember[] = [];
        membersSnap.forEach((docSnap) => {
          const m = docSnap.data() as any;
          membersData.push({
            id: docSnap.id,
            uid: m.uid,
            displayName: m.displayName ?? "Player",
            role: (m.role as "manager" | "member") ?? "member",
          });
        });

        setMembers(membersData);
      } catch (err) {
        console.error(err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user && leagueId) {
      load();
    }
  }, [authLoading, user, leagueId]); // <— no doc ref here

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveLeague = async (e: FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    const leagueDocRef = getLeagueDocRef();
    if (!leagueDocRef) return;

    setSaveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(leagueDocRef, {
        name: form.name.trim() || "Untitled league",
        description: form.description.trim(),
        updatedAt: new Date(),
      });

      setLeague((prev) =>
        prev
          ? {
              ...prev,
              name: form.name.trim() || "Untitled league",
              description: form.description.trim(),
            }
          : prev
      );

      setSuccess("League details updated.");
    } catch (err) {
      console.error(err);
      setError("Failed to save league. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard.writeText(league.code);
      setCopyMessage("League code copied.");
    } catch {
      setCopyMessage("Unable to copy. You can copy it manually.");
    }
    setTimeout(() => setCopyMessage(null), 2000);
  };

  const handleCopyInviteLink = async () => {
    if (!league?.code || !origin) return;
    const url = `${origin}/leagues/join?code=${encodeURIComponent(
      league.code
    )}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Invite link copied.");
    } catch {
      setCopyMessage("Unable to copy. You can copy it manually.");
    }
    setTimeout(() => setCopyMessage(null), 2000);
  };

  const handleLeaveLeague = async () => {
    if (!user || !currentMember) return;

    const leagueDocRef = getLeagueDocRef();
    if (!leagueDocRef) return;

    if (
      isManager &&
      members.filter((m) => m.uid !== user.uid).length === 0
    ) {
      alert(
        "You are the only member and the manager. Delete the league instead, or transfer management (coming later)."
      );
      return;
    }

    if (!confirm("Are you sure you want to leave this league?")) return;

    setLeaveLoading(true);
    setError(null);
    try {
      const memberRef = doc(
        collection(leagueDocRef, "members"),
        currentMember.id
      );
      await deleteDoc(memberRef);
      router.push("/leagues");
    } catch (err) {
      console.error(err);
      setError("Failed to leave league. Please try again.");
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!isManager) return;

    const leagueDocRef = getLeagueDocRef();
    if (!leagueDocRef) return;

    const sure = confirm(
      "Delete this league for everyone? This cannot be undone."
    );
    if (!sure) return;

    setDeleteLoading(true);
    setError(null);
    try {
      // Note: this only deletes the league doc, not subcollections.
      await deleteDoc(leagueDocRef);
      router.push("/leagues");
    } catch (err) {
      console.error(err);
      setError("Failed to delete league. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="py-10 text-slate-300">
        Loading league details...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-10">
        <p className="text-slate-200 mb-4">
          You need to be logged in to view this league.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center px-4 py-2 rounded-md bg-orange-500 text-black font-semibold hover:bg-orange-400 transition-colors"
        >
          Login / Sign up
        </Link>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-10 text-red-400">
        League not found or you don&apos;t have access.
      </div>
    );
  }

  const inviteUrl =
    league.code && origin
      ? `${origin}/leagues/join?code=${encodeURIComponent(
          league.code
        )}`
      : "";

  return (
    <div className="py-6 md:py-8 space-y-8">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400 transition-colors"
        >
          ← Back to leagues
        </Link>
      </div>

      {/* Top row */}
      <div className="grid gap-6 md:grid-cols-[2fr,1.4fr]">
        {/* League details */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {league.name}
            </h1>
            <span className="inline-flex items-center rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
              {isManager ? "League Manager" : "Member"}
            </span>
          </div>

          <p className="text-sm text-slate-300">
            Private league. Your streak still counts on the global
            ladder – this page is just for bragging rights with your
            mates, work crew or fantasy league.
          </p>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-md px-3 py-2">
              {success}
            </div>
          )}

          {isManager ? (
            <form
              onSubmit={handleSaveLeague}
              className="space-y-4 mt-2"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  League name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleInputChange}
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  placeholder="E.g. Thursday Night Footy Crew"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
                />
              </div>

              <button
                type="submit"
                disabled={saveLoading}
                className="inline-flex items-center px-4 py-2 rounded-md bg-orange-500 text-black font-semibold text-sm hover:bg-orange-400 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
              >
                {saveLoading ? "Saving..." : "Save changes"}
              </button>
            </form>
          ) : (
            <div className="mt-3 space-y-2">
              {league.description && (
                <p className="text-sm text-slate-200">
                  {league.description}
                </p>
              )}
              {league.managerEmail && (
                <p className="text-xs text-slate-400">
                  League manager:{" "}
                  <span className="font-semibold">
                    {league.managerEmail}
                  </span>
                </p>
              )}
            </div>
          )}
        </section>

        {/* Invite + danger zone */}
        <section className="space-y-4">
          {/* Invite */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Invite your mates
            </h2>
            <p className="text-sm text-slate-300">
              Share this code or link so people can join. Anyone with
              the code can join your league.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                League code
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={league.code || "No code set"}
                  className="flex-1 rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Invite link
              </label>
              <div className="flex flex-col gap-2">
                <input
                  readOnly
                  value={
                    inviteUrl || "Invite link will appear here."
                  }
                  className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-xs text-slate-100"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="px-3 py-2 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-50 font-semibold transition-colors"
                  >
                    Copy link
                  </button>
                  {copyMessage && (
                    <span className="text-xs text-emerald-400">
                      {copyMessage}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Anyone who joins still plays in the global game – this
              league just gives you your own ladder for bragging rights.
            </p>
          </div>

          {/* Danger zone */}
          <div className="bg-slate-900/70 border border-red-900/70 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-red-300">
              League actions
            </h3>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={leaveLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-red-600 text-red-300 text-xs font-semibold hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {leaveLoading ? "Leaving..." : "Leave league"}
              </button>

              {isManager && (
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={deleteLoading}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading
                    ? "Deleting..."
                    : "Delete league for everyone"}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Deleting a league removes it for all members. Leaving a
              league only removes you – you can always rejoin with the
              code.
            </p>
          </div>
        </section>
      </div>

      {/* Members + ladder placeholder */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Members */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">
              League members
            </h2>
            <span className="text-xs text-slate-400">
              {members.length} player
              {members.length === 1 ? "" : "s"}
            </span>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-slate-300">
              No-one has joined yet. Share your league code to get
              things started.
            </p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">
                      {m.displayName}
                      {m.uid === user.uid && (
                        <span className="ml-2 text-[11px] text-emerald-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{" "}
                      {m.role === "manager"
                        ? "League Manager"
                        : "Member"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ladder placeholder */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            League ladder (coming soon)
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            Soon this will show each member&apos;s current streak and
            best streak for this season, ranked from top to bottom just
            like the global leaderboard.
          </p>
          <p className="text-xs text-slate-400">
            For now, streaks are still tracked globally – we&apos;ll
            plug private ladders into that same data once we wire in
            the stats.
          </p>
        </section>
      </div>
    </div>
  );
}
