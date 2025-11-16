"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

function generateLeagueCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function CreateLeaguePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || creating) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please give your league a name.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const code = generateLeagueCode();

      // Create league doc with a known id
      const leaguesCol = collection(db, "leagues");
      const newLeagueRef = doc(leaguesCol); // auto id

      await setDoc(newLeagueRef, {
        name: trimmed,
        code,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Add creator as first member (League Manager)
      const memberRef = doc(
        collection(db, "leagues", newLeagueRef.id, "members"),
        user.uid
      );

      await setDoc(memberRef, {
        uid: user.uid,
        username: user.displayName || "Player",
        team: "",
        currentStreak: 0,
        longestStreak: 0,
        avatarUrl: "",
        joinedAt: serverTimestamp(),
      });

      // Go straight to league detail page
      router.push(`/leagues/${newLeagueRef.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create league. Please try again.");
      setCreating(false);
    }
  };

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-xs text-slate-300 hover:text-white inline-flex items-center gap-1"
        >
          ← Back to leagues
        </Link>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-2">Create a league</h1>
      <p className="text-sm text-slate-300 mb-6 max-w-xl">
        Set up a private league for your mates, work crew or fantasy comp.
        Everyone’s streak still counts on the global STREAKr ladder.
      </p>

      <form
        onSubmit={handleSubmit}
        className="max-w-lg rounded-2xl border border-slate-800 bg-slate-950/80 p-6 space-y-5"
      >
        <div>
          <label className="block text-sm font-medium mb-1">
            League name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maddo’s Mates League"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            You’ll get a unique league code to share with your mates.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={creating || authLoading || !user}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {creating ? "Creating league…" : "Create league"}
        </button>
      </form>
    </div>
  );
}
