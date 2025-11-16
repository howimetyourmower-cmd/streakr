// app/leagues/join/page.tsx
"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

/**
 * Wrapper needed so we can use useSearchParams inside Suspense.
 */
export default function JoinLeaguePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-slate-300">Loading…</div>
      }
    >
      <JoinLeaguePage />
    </Suspense>
  );
}

function JoinLeaguePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Prefill code from ?code=ABCDEFG in URL if present
  useEffect(() => {
    const initial = searchParams.get("code");
    if (initial) {
      setCode(initial.toUpperCase());
    }
  }, [searchParams]);

  // If not logged in, send them to auth
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth?next=/leagues/join");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="py-10 text-center text-slate-300">
        Loading your account…
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setJoining(true);

    try {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        setError("Enter a league code to join.");
        return;
      }

      // 1) Find league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("We couldn’t find a league with that code.");
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as { name?: string };

      // 2) Check if already a member
      const uid = user.uid;
      const memberRef = doc(db, "leagues", leagueId, "members", uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        setError("You’re already in this league.");
        return;
      }

      // 3) Add user as member
      await setDoc(memberRef, {
        uid,
        role: "member",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
        currentStreak: 0,
        longestStreak: 0,
      });

      setSuccess(`Joined ${leagueData.name || "this league"} successfully.`);

      // Small delay so they see success message
      setTimeout(() => {
        router.push(`/leagues/${leagueId}`);
      }, 800);
    } catch (err) {
      console.error("Failed to join league", err);
      setError(
        "Something went wrong joining this league. Please try again in a moment."
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="py-6 md:py-8">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push("/leagues")}
        className="mb-4 text-sm text-slate-300 hover:text-orange-400"
      >
        ← Back to leagues
      </button>

      <h1 className="text-3xl md:text-4xl font-bold mb-2">Join a league</h1>
      <p className="text-slate-300 mb-6 max-w-2xl">
        Drop in the invite code your mate sent you. Once you join, your streak
        will appear on that league’s ladder as you make picks.
      </p>

      <div className="max-w-md">
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="leagueCode"
              className="block text-sm font-medium text-slate-200 mb-1"
            >
              League code
            </label>
            <input
              id="leagueCode"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="E.g. 7F09LZ"
              maxLength={8}
              className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              Your league manager can find this on their League Detail page.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={joining}
            className="w-full flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/60 disabled:cursor-not-allowed text-black font-semibold py-2.5 text-sm transition-colors"
          >
            {joining ? "Joining…" : "Join with code"}
          </button>
        </form>
      </div>
    </div>
  );
}
