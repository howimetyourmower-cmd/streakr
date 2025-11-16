"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-white">
        <p className="text-sm text-gray-300">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-3">Join a private league</h1>
        <p className="text-gray-300 mb-6 text-sm">
          Log in to join a league using an invite code.
        </p>
        <button
          onClick={() => router.push("/auth")}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm transition"
        >
          Login / Sign up
        </button>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the code your mate sent you.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Double check and try again.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as any;

      const memberIds: string[] = leagueData.memberIds ?? [];

      if (memberIds.includes(user.uid)) {
        // Already in league, just send them there
        router.push(`/leagues/${leagueId}`);
        return;
      }

      await updateDoc(leagueDoc.ref, {
        memberIds: arrayUnion(user.uid),
      });

      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Failed to join league:", err);
      setError("Failed to join league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-3">Join a private league</h1>
      <p className="text-sm text-gray-300 mb-6">
        Enter the league code your mate sent you. You’ll join their private
        ladder using your existing Streakr streak.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 max-w-md space-y-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="code">
            League code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. BNTL26"
            className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm tracking-[0.25em] uppercase font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Case-insensitive – just type the letters and numbers.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={joining}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold text-sm transition"
        >
          {joining ? "Joining…" : "Join league"}
        </button>
      </form>
    </main>
  );
}
