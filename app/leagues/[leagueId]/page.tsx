"use client";

// app/leagues/[leagueId]/page.tsx
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
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type League = {
  id: string;
  name: string;
  code: string;
  managerUid: string;
  managerEmail?: string;
  isLocked?: boolean;
};

type LadderPlayer = {
  uid: string;
  role: "manager" | "member";
  displayName: string;
  avatarUrl: string | null;
  team: string;
  currentStreak: number;
  longestStreak: number;
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = (params?.leagueId as string) || "";

  const { user, loading: authLoading } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [leagueError, setLeagueError] = useState<string | null>(null);

  // Settings form state
  const [editName, setEditName] = useState("");
  const [editLocked, setEditLocked] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // Ladder state
  const [ladder, setLadder] = useState<LadderPlayer[]>([]);
  const [loadingLadder, setLoadingLadder] = useState(true);

  const isManager =
    !!user && !!league && league.managerUid === user.uid;

  // ---------- Load league ----------
  useEffect(() => {
    const loadLeague = async () => {
      if (!leagueId) return;
      setLoadingLeague(true);
      setLeagueError(null);

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const snap = await getDoc(leagueRef);

        if (!snap.exists()) {
          setLeagueError("League not found.");
          setLeague(null);
          return;
        }

        const data = snap.data() as any;

        const loadedLeague: League = {
          id: snap.id,
          name: data.name || "Untitled league",
          code: data.code || "",
          managerUid: data.managerUid,
          managerEmail: data.managerEmail || "",
          isLocked: !!data.isLocked,
        };

        setLeague(loadedLeague);
        setEditName(loadedLeague.name);
        setEditLocked(!!loadedLeague.isLocked);
      } catch (err) {
        console.error("Failed to load league", err);
        setLeagueError("Failed to load league. Please try again later.");
      } finally {
        setLoadingLeague(false);
      }
    };

    loadLeague();
  }, [leagueId]);

  // ---------- Load ladder ----------
  useEffect(() => {
    const loadLadder = async () => {
      if (!leagueId) return;
      setLoadingLadder(true);

      try {
        const membersRef = collection(db, `leagues/${leagueId}/members`);
        const membersSnap = await getDocs(membersRef);

        const players: LadderPlayer[] = [];

        for (const m of membersSnap.docs) {
          const uid = m.id;
          const memberData = m.data() as any;
          const userSnap = await getDoc(doc(db, "users", uid));

          if (userSnap.exists()) {
            const u = userSnap.data() as any;
            players.push({
              uid,
              role: memberData.role === "manager" ? "manager" : "member",
              displayName: u.username || u.email || "Player",
              avatarUrl: u.avatarUrl || null,
              team: u.team || "",
              currentStreak: u.currentStreak || 0,
              longestStreak: u.longestStreak || 0,
            });
          }
        }

        // Sort by current streak desc
        players.sort((a, b) => b.currentStreak - a.currentStreak);
        setLadder(players);
      } catch (err) {
        console.error("Failed to load ladder", err);
      } finally {
        setLoadingLadder(false);
      }
    };

    loadLadder();
  }, [leagueId]);

  // ---------- Handlers: Save settings ----------
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsMessage(null);

    if (!leagueId || !user || !league) return;
    if (league.managerUid !== user.uid) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setSettingsMessage("League name cannot be empty.");
      return;
    }

    setSavingSettings(true);

    try {
      const leagueRef = doc(db, "leagues", leagueId);
      await updateDoc(leagueRef, {
        name: trimmedName,
        isLocked: editLocked,
        updatedAt: serverTimestamp(),
      });

      setLeague((prev) =>
        prev
          ? { ...prev, name: trimmedName, isLocked: editLocked }
          : prev
      );
      setSettingsMessage("Settings saved.");
    } catch (err) {
      console.error("Failed to save settings", err);
      setSettingsMessage("Failed to save settings. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  // ---------- Handlers: Delete league ----------
  const handleDeleteLeague = async () => {
    if (!leagueId || !user || !league) return;
    if (league.managerUid !== user.uid) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this league? This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    setSettingsMessage(null);

    try {
      // Note: This deletes the league doc. Members subcollection
      // will be left behind unless you add a Cloud Function cleanup.
      await deleteDoc(doc(db, "leagues", leagueId));
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      setSettingsMessage("Failed to delete league. Please try again.");
      setDeleting(false);
    }
  };

  // ---------- Render ----------

  if (!leagueId) {
    return <p className="text-slate-300">Invalid league.</p>;
  }

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

      {loadingLeague ? (
        <p className="text-slate-300">Loading league…</p>
      ) : leagueError ? (
        <p className="text-red-400">{leagueError}</p>
      ) : !league ? (
        <p className="text-slate-300">League not found.</p>
      ) : (
        <>
          {/* ---------- League header ---------- */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {league.name}
            </h1>
            <p className="text-slate-300 mb-3">
              Private league. Battle it out with your mates while your streak
              still counts towards the global leaderboard.
            </p>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
                Code:{" "}
                <span className="font-mono font-semibold">
                  {league.code}
                </span>
              </div>
              <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
                Manager:{" "}
                <span className="font-semibold">
                  {league.managerEmail || "Unknown"}
                </span>
              </div>
              <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
                Members:{" "}
                <span className="font-semibold">{ladder.length}</span>
              </div>
              <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200">
                Status:{" "}
                <span className="font-semibold">
                  {league.isLocked ? "Locked (no new joins)" : "Open"}
                </span>
              </div>
            </div>
          </div>

          {/* ---------- League settings (manager only) ---------- */}
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* Settings card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
              <h2 className="text-xl font-bold mb-3">League settings</h2>

              {!user ? (
                <p className="text-slate-400 text-sm">
                  Login to manage this league.
                </p>
              ) : !isManager ? (
                <p className="text-slate-400 text-sm">
                  Only the league manager can edit settings.
                </p>
              ) : (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      League name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="lockLeague"
                      type="checkbox"
                      checked={editLocked}
                      onChange={(e) => setEditLocked(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500"
                    />
                    <label
                      htmlFor="lockLeague"
                      className="text-sm text-slate-200"
                    >
                      Lock league (stop new members joining with the code)
                    </label>
                  </div>

                  {settingsMessage && (
                    <p className="text-xs text-slate-300">{settingsMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="mt-1 inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                  >
                    {savingSettings ? "Saving…" : "Save settings"}
                  </button>

                  {/* Danger zone */}
                  <div className="mt-6 border-t border-slate-800 pt-4">
                    <p className="text-sm font-semibold text-red-400 mb-2">
                      Danger zone
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      Deleting this league will remove it from Streakr. This
                      cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={handleDeleteLeague}
                      disabled={deleting}
                      className="inline-flex items-center justify-center rounded-md border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                    >
                      {deleting ? "Deleting…" : "Delete league"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Ladder card */}
            <div>
              <h2 className="text-xl font-bold mb-3">League ladder</h2>

              {loadingLadder ? (
                <p className="text-slate-400 text-sm">Loading ladder…</p>
              ) : ladder.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  No members yet. Share your league code to get your mates in.
                </p>
              ) : (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/60 text-slate-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Current</th>
                        <th className="px-4 py-3">Longest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladder.map((p, i) => (
                        <tr
                          key={p.uid}
                          className="border-t border-slate-800 hover:bg-slate-800/40 transition"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-300">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 flex items-center gap-3">
                            <img
                              src={p.avatarUrl || "/default-avatar.png"}
                              className="w-8 h-8 rounded-full object-cover"
                              alt={p.displayName}
                            />
                            <span className="text-white font-semibold">
                              {p.displayName}
                            </span>
                            {p.role === "manager" && (
                              <span className="ml-2 text-[10px] bg-orange-500 text-black px-2 py-0.5 rounded-full">
                                Manager
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {p.team || "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">
                            {p.currentStreak}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {p.longestStreak}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
