"use client";

export const dynamic = "force-dynamic";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You need to be logged in to join a league.");
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError("Please enter a league code.");
      return;
    }

    try {
      setJoining(true);

      // 1) Look up the league by code
      const leaguesRef = collection(db, "leagues");
      const q = query(
        leaguesRef,
        where("code", "==", trimmedCode),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Double-check and try again.");
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as any;

      // 2) Check if user is already a member
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        // Already a member – just go to the league
        router.push(`/leagues/${leagueId}`);
        return;
      }

      // 3) Add user as member
      await setDoc(memberRef, {
        uid: user.uid,
        role: "member",
        displayName: user.displayName || user.email || "Player",
      });

      // 4) Increment memberCount (if present)
      if (typeof leagueData.memberCount === "number") {
        await updateDoc(leagueDoc.ref, {
          memberCount: leagueData.memberCount + 1,
        });
      }

      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Error joining league", err);
      setError("Failed to join league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (!user) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold mb-4">Join a league</h1>
        <p className="text-slate-300 mb-4">
          You need to be logged in to join a private league.
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm"
        >
          Go to login / sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8 max-w-lg">
      <Link
        href="/leagues"
        className="text-sm text-slate-300 hover:text-white mb-4 inline-flex items-center gap-1"
      >
        ← Back to leagues
      </Link>

      <h1 className="text-3xl font-bold mb-2">Join a league</h1>
      <p className="text-slate-300 mb-6">
        Drop in the invite code your mate sent you. Once you join, your streak
        will appear on that league’s ladder as you make picks.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            League code
          </label>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="E.g. 7F9LZQ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <p className="text-xs text-slate-400 mt-1">
            Ask your League Manager for the code on their League Detail page.
          </p>
        </div>

        <button
          type="submit"
          disabled={joining}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {joining ? "Joining league..." : "Join with code"}
        </button>
      </form>
    </div>
  );
}
