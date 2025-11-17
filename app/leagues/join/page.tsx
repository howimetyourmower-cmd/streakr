"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="py-6 md:py-8 space-y-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
        <p className="text-slate-200">
          You need to be logged in to join a league.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setError("Enter a league code to join.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // 1) Find the league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Double-check and try again.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];

      // 2) Check if the user is already a member
      const memberRef = doc(
        db,
        "leagues",
        leagueDoc.id,
        "members",
        user.uid
      );
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        // Already in this league – just send them there
        router.push(`/leagues/${leagueDoc.id}`);
        return;
      }

      // 3) Add user as a member
      await setDoc(memberRef, {
        uid: user.uid,
        role: "member",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
      });

      // 4) Increment member count on league
      await updateDoc(leagueDoc.ref, {
        memberCount: increment(1),
      });

      router.push(`/leagues/${leagueDoc.id}`);
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Failed to join league. Please try again.");
      setJoining(false);
    }
  };

  return (
    <div className="py-6 md:py-8 max-w-md">
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      <h1 className="text-2xl md:3xl font-bold text-white mb-2">
        Join a league
      </h1>
      <p className="text-slate-300 mb-6 text-sm md:text-base">
        Drop in the invite code your mate sent you. Once you join, your streak
        will appear on that league&apos;s ladder as soon as you make picks.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            League code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="E.g. 7FQ9LZ"
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono tracking-[0.25em]"
          />
          <p className="mt-1 text-xs text-slate-400">
            Your league manager can find this on their League Detail page.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={joining}
          className="inline-flex items-center justify-center w-full px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold text-sm shadow-lg transition-colors"
        >
          {joining ? "Joining league…" : "Join with code"}
        </button>
      </form>
    </div>
  );
}
