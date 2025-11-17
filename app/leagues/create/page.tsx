"use client";

import { FormEvent, useState } from "react";
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
import Link from "next/link";

function generateLeagueCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateLeaguePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
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
          You need to be logged in to create a league.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please give your league a name.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const code = generateLeagueCode();

      const leaguesRef = collection(db, "leagues");
      const leagueDocRef = await addDoc(leaguesRef, {
        name: name.trim(),
        description: description.trim(),
        code,
        managerUid: user.uid,
        memberCount: 1,
        createdAt: serverTimestamp(),
      });

      const memberRef = doc(
        db,
        "leagues",
        leagueDocRef.id,
        "members",
        user.uid
      );

      await setDoc(memberRef, {
        uid: user.uid,
        role: "manager",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
      });

      router.push(`/leagues/${leagueDocRef.id}`);
    } catch (err) {
      console.error("Failed to create league", err);
      setError("Failed to create league. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="py-6 md:py-8 max-w-xl">
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
        Create a league
      </h1>
      <p className="text-slate-300 mb-6 text-sm md:text-base">
        Set up a private ladder for your mates, work crew or fantasy league.
        Everyone&apos;s streaks still count on the global leaderboard.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            League name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Thursday Night Punters"
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
            rows={3}
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold text-sm shadow-lg transition-colors"
        >
          {saving ? "Creating league…" : "Create league"}
        </button>
      </form>
    </div>
  );
}
