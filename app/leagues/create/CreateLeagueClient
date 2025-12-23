// /app/leagues/create/CreateLeagueClient.tsx
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  arrayUnion,
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

export default function CreateLeagueClient() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

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

      // ✅ Create league with fields that match /app/leagues (LeaguesClient)
      const leaguesRef = collection(db, "leagues");
      const leagueDoc = await addDoc(leaguesRef, {
        name: trimmedName,
        tagLine: "", // optional (you can wire this later)
        description: description.trim(),
        managerId: user.uid, // ✅ matches LeaguesClient expectation
        inviteCode: code, // ✅ matches LeaguesClient expectation
        memberIds: [user.uid], // ✅ so "My leagues" query works
        memberCount: 1,
        isPublic: false, // private by default
        avgStreak: 0, // default
        sport: "afl", // ✅ AFL only
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ✅ Add manager as member subdoc
      const memberRef = doc(leagueDoc, "members", user.uid);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName: user.displayName || user.email || "Player",
          role: "manager",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ Also add this league to user's profile if you want (optional but handy)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          leagueIds: arrayUnion(leagueDoc.id),
        },
        { merge: true }
      );

      setInviteCode(code);
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
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto max-w-3xl px-4 py-6 md:py-10 space-y-5">
          <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to leagues
          </Link>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">League created</h1>
              <SportBadge sport="afl" />
            </div>

            <p className="text-sm text-white/70">
              Share this invite code with your mates:
            </p>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3">
              <span className="text-xs text-white/70">Invite code</span>
              <span className="font-mono text-xl font-bold tracking-[0.25em] text-orange-300">
                {inviteCode ?? "—"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/leagues/${leagueId}/ladder`}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm px-4 py-2 transition-colors"
              >
                View ladder →
              </Link>
              <Link
                href="/picks"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
              >
                Make a pick →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10 space-y-6">
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
              Name your league and we&apos;ll generate a unique invite code to share
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
    </div>
  );
}
