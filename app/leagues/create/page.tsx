"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

function generateLeagueCode(length: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default function CreateLeaguePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    if (!name.trim()) {
      setError("Please give your league a name.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create a new league doc with a random ID
      const leagueRef = doc(collection(db, "leagues"));
      const code = generateLeagueCode();

      await setDoc(leagueRef, {
        name: name.trim(),
        code,
        managerUid: user.uid,
        createdAt: serverTimestamp(),
        memberCount: 1,
      });

      // Add the creator as the first member (manager)
      const memberRef = doc(collection(leagueRef, "members"), user.uid);

      await setDoc(memberRef, {
        uid: user.uid,
        role: "manager",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
        currentStreak: 0,
        longestStreak: 0,
      });

      // Go to the league detail page
      router.push(`/leagues/${leagueRef.id}`);
    } catch (err) {
      console.error("Failed to create league", err);
      setError("Failed to create league. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="py-6 md:py-8 max-w-xl">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/leagues")}
          className="text-sm text-orange-400 hover:underline"
        >
          ← Back to leagues
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-3">Create a league</h1>
      <p className="text-slate-300 mb-8">
        Give your league a name, then share the invite code with your mates.
        Everyone’s streak still counts towards the global leaderboard.
      </p>

      {!user && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
          You’ll need to{" "}
          <span className="font-semibold">log in or sign up</span> before you
          can create a league.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-slate-900/70 border border-slate-800 rounded-xl p-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            League name
          </label>
          <input
            type="text"
            className="w-full rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
            placeholder="e.g. Thursday Night Footy Crew"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">
            You can change this later if you need to.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !user}
          className="w-full py-2.5 rounded-lg bg-orange-500 text-black font-semibold text-sm hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {saving ? "Creating league…" : "Create league"}
        </button>

        <p className="text-xs text-slate-400 mt-2">
          When your league is created, we’ll generate a 6-character invite
          code you can share with mates. They’ll join as soon as they enter
          the code on the Join League page.
        </p>
      </form>
    </div>
  );
}
