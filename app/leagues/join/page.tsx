"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) {
      setError("You need to be logged in to join a league.");
      return;
    }

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a league code.");
      return;
    }

    try {
      setJoining(true);

      // 1) Look up league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("We couldn’t find a league with that code. Double-check it.");
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as {
        name?: string;
        season?: number;
        round?: number;
      };

      // 2) Add / update membership in subcollection
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);

      await setDoc(
        memberRef,
        {
          uid: user.uid,
          email: user.email ?? "",
          displayName: leagueData?.name ?? user.email ?? "Player",
          joinedAt: serverTimestamp(),
          currentStreak: 0,
          longestStreak: 0,
        },
        { merge: true }
      );

      setSuccess(`You’ve joined “${leagueData?.name ?? "this league"}”!`);
      // Optional: send them straight to the league page once it exists
      // router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Something went wrong trying to join that league. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Join a league</h1>
        <p className="text-slate-300 max-w-2xl">
          Got a code from a mate, your office, or your fantasy league? Drop it
          in here and you’ll appear on that league’s ladder as soon as you start
          making picks.
        </p>
      </div>

      <div className="max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="space-y-2">
            <label
              htmlFor="league-code"
              className="block text-sm font-medium text-slate-200"
            >
              League code
            </label>
            <input
              id="league-code"
              type="text"
              autoComplete="off"
              placeholder="E.g. 7FQ9LZ"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="text-xs text-slate-400">
              Your League Manager can find this on their League Detail page.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={joining || loading}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-900/60 disabled:cursor-not-allowed text-sm font-semibold text-white shadow-md transition-colors"
          >
            {joining ? "Joining..." : "Join with code"}
          </button>
        </form>
      </div>
    </div>
  );
}
