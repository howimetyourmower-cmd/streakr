"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to auth if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [authLoading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give your league a name.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Generate a simple 6-char invite code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 1) Create league doc
      const leaguesRef = collection(db, "leagues");
      const leagueRef = await addDoc(leaguesRef, {
        name: trimmedName,
        code,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // 2) Try to pull profile info to seed member row
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
        // soft-fail, we'll just use the fallback values
      }

      // 3) Create manager as first member
      const membersRef = collection(leagueRef, "members");
      await setDoc(doc(membersRef, user.uid), {
        uid: user.uid,
        displayName,
        team: team || null,
        avatarUrl: avatarUrl || null,
        currentStreak: 0,
        longestStreak: 0,
        joinedAt: serverTimestamp(),
      });

      // 4) Go to league detail
      router.push(`/leagues/${leagueRef.id}`);
    } catch (err) {
      console.error("Failed to create league", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setCreating(false);
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
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Create a league</h1>
      <p className="text-slate-300 text-sm mb-6 max-w-xl">
        Name your league, share the invite code with your mates and battle it
        out on your own ladder. All streaks still count towards the global
        leaderboard.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 max-w-xl space-y-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            League name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mates from the outer wing"
            className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            You&apos;ll be set as League Manager. You can join other leagues as
            well.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/30 border border-red-500/50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating ? "Creating…" : "Create league"}
        </button>
      </form>
    </div>
  );
}
