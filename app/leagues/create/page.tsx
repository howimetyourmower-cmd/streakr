"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

function generateLeagueCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0 or I/1
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [leagueName, setLeagueName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // If not logged in, send to auth
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!user) {
      setError("You must be logged in to create a league.");
      return;
    }

    if (!leagueName.trim()) {
      setError("Please enter a league name.");
      return;
    }

    setCreating(true);

    try {
      const code = generateLeagueCode(6);

      // Get user details from /users/{uid}
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      const userData = userSnap.exists() ? userSnap.data() : {};

      const username =
        (userData as any).username || user.displayName || "Player";
      const avatarUrl = (userData as any).avatarUrl || "";
      const currentStreak =
        typeof (userData as any).currentStreak === "number"
          ? (userData as any).currentStreak
          : 0;
      const longestStreak =
        typeof (userData as any).longestStreak === "number"
          ? (userData as any).longestStreak
          : 0;

      // Create league doc
      const leaguesRef = collection(db, "leagues");
      const leagueDoc = await addDoc(leaguesRef, {
        name: leagueName.trim(),
        code,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
      });

      // Add creator as first member
      const memberRef = doc(
        db,
        "leagues",
        leagueDoc.id,
        "members",
        user.uid
      );
      await setDoc(memberRef, {
        uid: user.uid,
        username,
        avatarUrl,
        currentStreak,
        longestStreak,
        joinedAt: serverTimestamp(),
        isOwner: true,
      });

      setInfo(`League created! Code: ${code}`);
      // Redirect to league page
      router.push(`/leagues/${leagueDoc.id}`);
    } catch (err: any) {
      console.error("Create league error:", err);
      setError(err?.message || "Failed to create league. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  if (!user && loading) {
    return (
      <main className="max-w-3xl mx-auto p-6 text-white">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-2">Create a private league</h1>
      <p className="text-sm text-gray-300 mb-6">
        Make your own league, invite mates with a join code, and see who can
        keep their streak alive the longest.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm mb-1 font-medium">
            League name
          </label>
          <input
            type="text"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="e.g. Thursday Night Footy Crew"
            className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            You can create multiple leagues for different groups of mates.
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {info && <p className="text-xs text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2 rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-black font-semibold text-sm"
        >
          {creating ? "Creating league…" : "Create league"}
        </button>
      </form>
    </main>
  );
}
