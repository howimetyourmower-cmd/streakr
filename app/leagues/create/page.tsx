// app/leagues/create/page.tsx

export const dynamic = "force-dynamic"
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

function generateLeagueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CreateLeaguePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give your league a name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const code = generateLeagueCode();

      // Create league
      const leaguesRef = collection(db, "leagues");
      const leagueDoc = await addDoc(leaguesRef, {
        name: trimmedName,
        description: description.trim(),
        managerUid: user.uid,
        code,
        memberCount: 1,
        createdAt: serverTimestamp(),
        sport: "afl", // default for now
      });

      // Add manager as member
      const memberRef = doc(leagueDoc, "members", user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        displayName: user.displayName || user.email || "Player",
        role: "manager",
        joinedAt: serverTimestamp(),
      });

      setLeagueId(leagueDoc.id);
    } catch (err) {
      console.error("Failed to create league", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (leagueId) {
    return (
      <div className="py-6 md:py-8 space-y-4">
        <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to leagues
        </Link>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">League created</h1>
            <SportBadge sport="afl" />
          </div>
          <p className="text-sm text-white/70">
            Share your invite code with your mates and start building that streak.
          </p>
          <Link
            href={`/leagues/${leagueId}`}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
          >
            Go to league page →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8 space-y-6">
      <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to leagues
      </Link>

      <div className="max-w-xl rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Create a league</h1>
            <SportBadge sport="afl" />
          </div>
          <p className="mt-1 text-sm text-white/70">
            Name your league and we&apos;ll give you a unique invite code to share
            with the crew.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">
              League name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              placeholder="E.g. Thursday Night Punters"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
          >
            {saving ? "Creating league…" : "Create league"}
          </button>
        </form>
      </div>
    </div>
  );
}
