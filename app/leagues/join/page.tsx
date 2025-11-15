"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
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
      setError("You must be logged in to join a league.");
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Please enter a league code.");
      return;
    }

    setJoining(true);

    try:
      // Find league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmedCode)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Check it and try again.");
        setJoining(false);
        return;
      }

      // Assume one league per code (codes are unique)
      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as any;

      // Get user profile data
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

      // Add or update member doc
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          username,
          avatarUrl,
          currentStreak,
          longestStreak,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setInfo(`Joined league: ${leagueData.name}`);
      router.push(`/leagues/${leagueId}`);
    } catch (err: any) {
      console.error("Join league error:", err);
      setError(err?.message || "Failed to join league. Please try again.");
    } finally {
      setJoining(false);
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
      <h1 className="text-3xl font-bold mb-2">Join a private league</h1>
      <p className="text-sm text-gray-300 mb-6">
        Enter the league code your mate sent you to join their private ladder.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm mb-1 font-medium">
            League code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={8}
            className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm tracking-[0.2em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Codes are 6–8 characters, no spaces. Ask your league owner if
            you&apos;re not sure.
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {info && <p className="text-xs text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={joining}
          className="px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-semibold text-sm"
        >
          {joining ? "Joining league…" : "Join league"}
        </button>
      </form>
    </main>
  );
}
