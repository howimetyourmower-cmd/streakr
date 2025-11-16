"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from ?code=XXXX in URL if present
  useEffect(() => {
    const fromUrl = searchParams.get("code");
    if (fromUrl) {
      setCode(fromUrl.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

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
      setError(null);

      // 1) Find league with this code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("No league found with that code. Double-check and try again.");
        setJoining(false);
        return;
      }

      const leagueDoc = snapshot.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as {
        name?: string;
        managerUid?: string;
      };

      // 2) Check if already a member
      const memberRef = doc(collection(leagueDoc.ref, "members"), user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        // Already in – just send to league detail
        router.push(`/leagues/${leagueId}`);
        return;
      }

      // 3) Add user as a member
      await setDoc(memberRef, {
        uid: user.uid,
        role: "member",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
        currentStreak: 0,
        longestStreak: 0,
      });

      // 4) Optionally bump memberCount (simple client-side increment)
      try {
        const currentCount = (leagueData as any).memberCount ?? 0;
        await setDoc(
          leagueDoc.ref,
          {
            memberCount: currentCount + 1,
          },
          { merge: true }
        );
      } catch {
        // non-critical – ignore errors here
      }

      // 5) Go to league detail page
      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Failed to join league. Please try again.");
      setJoining(false);
    }
  };

  return (
    <div className="py-6 md:py-8 max-w-xl">
      {/* Back link */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/leagues")}
          className="text-sm text-orange-400 hover:underline"
        >
          ← Back to leagues
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-3">Join a league</h1>
      <p className="text-slate-300 mb-8">
        Drop in the invite code your mate sent you. Once you join, your streak
        will appear on that league&apos;s ladder as you make picks.
      </p>

      {!user && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
          You’ll need to{" "}
          <span className="font-semibold">log in or sign up</span> before you
          can join a league.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            League code
          </label>
          <input
            type="text"
            inputMode="text"
            maxLength={8}
            className="w-full rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm tracking-[0.25em] uppercase text-center font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/70"
            placeholder="E.G. 7F9LZQ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <p className="text-xs text-slate-400 mt-1">
            Your League Manager can find this on their{" "}
            <span className="font-semibold">League Detail</span> page.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={joining || !user}
          className="w-full py-2.5 rounded-lg bg-sky-500 text-black font-semibold text-sm hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {joining ? "Joining league…" : "Join with code"}
        </button>

        <ul className="text-xs text-slate-400 mt-2 space-y-1">
          <li>• You can join multiple private leagues.</li>
          <li>• Private leagues are just for bragging rights.</li>
          <li>• Your streak still counts towards the global ladder.</li>
        </ul>
      </form>
    </div>
  );
}
