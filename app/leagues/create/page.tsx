"use client";

export const dynamic = "force-dynamic";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

function generateLeagueCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give your league a name.");
      return;
    }

    try {
      setSaving(true);

      const code = generateLeagueCode();

      // 1) Create the league
      const leaguesRef = collection(db, "leagues");
      const leagueDocRef = await addDoc(leaguesRef, {
        name: trimmedName,
        description: description.trim() || "",
        code,
        managerUid: user.uid,
        createdAt: serverTimestamp(),
        memberCount: 1,
      });

      // 2) Add the creator as manager in /leagues/{id}/members/{uid}
      const memberRef = doc(
        collection(leagueDocRef, "members"),
        user.uid
      );

      await setDoc(memberRef, {
        uid: user.uid,
        role: "manager",
        displayName: user.displayName || user.email || "Player",
      });

      // 3) Go to league detail page
      router.push(`/leagues/${leagueDocRef.id}`);
    } catch (err) {
      console.error("Error creating league", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold mb-4">Create a league</h1>
        <p className="text-slate-300 mb-4">
          You need to be logged in to create a private league.
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
    <div className="py-6 md:py-8 max-w-3xl">
      <Link
        href="/leagues"
        className="text-sm text-slate-300 hover:text-white mb-4 inline-flex items-center gap-1"
      >
        ← Back to leagues
      </Link>

      <h1 className="text-3xl font-bold mb-2">Create a league</h1>
      <p className="text-slate-300 mb-6">
        Name your league and invite your mates with a single code. Everyone’s
        streak still counts on the global ladder.
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
            League name<span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="E.g. The Shed Crew"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <textarea
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[80px]"
            placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Creating league..." : "Create league"}
        </button>
      </form>
    </div>
  );
}
