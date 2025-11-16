export const dynamic = "force-dynamic";

"use client";

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
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from ?code=XYZ
  useEffect(() => {
    const paramCode = searchParams.get("code");
    if (paramCode) {
      setCode(paramCode.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [authLoading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a league code.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      // 1) Find league by invite code
      const leaguesRef = collection(db, "leagues");
      const q = query(leaguesRef, where("code", "==", trimmed), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Double check and try again.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;

      // 2) Pull profile info to seed member row
      let displayName = user.email?.split("@")[0] || "Player";
      let team: string | undefined;
      let avatarUrl: string | undefined;

      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        if (profileSnap.exists()) {
          const p = profileSnap.data() as any;
          if (p.username) displayName = p.username;
          else if (p.firstName && p.surname) {
            displayName = `${p.firstName} ${p.surname}`;
          }
          if (p.team) team = p.team;
          if (p.avatarUrl) avatarUrl = p.avatarUrl;
        }
      } catch {
        // ignore soft failures
      }

      // 3) Upsert member in league's members subcollection
      const membersRef = collection(leagueDoc.ref, "members");
      await setDoc(
        doc(membersRef, user.uid),
        {
          uid: user.uid,
          displayName,
          team: team || null,
          avatarUrl: avatarUrl || null,
          currentStreak: 0,
          longestStreak: 0,
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Go to league detail
      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Failed to join league. Please try again.");
      setJoining(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="py-6 md:py-8">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-300 text-sm">
            Loading your account&hellip;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Join a league</h1>
      <p className="text-slate-300 text-sm mb-3 max-w-xl">
        Enter the league code your mate or league manager sent you. If you
        clicked a invite link, we&apos;ve pre-filled it for you.
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
            placeholder="e.g. 7FQ9LZ"
            className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm tracking-[0.2em] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Your league manager can find this on their League Detail page.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={joining}
          className="inline-flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-400 text-black font-semibold text-sm px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {joining ? "Joining…" : "Join with code"}
        </button>
      </form>
    </div>
  );
}
