"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

function generateLeagueCode(length = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-white">
        <p className="text-sm text-gray-300">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-3">Create a private league</h1>
        <p className="text-gray-300 mb-6 text-sm">
          You need to be logged in to create a league.
        </p>
        <button
          onClick={() => router.push("/auth")}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm transition"
        >
          Login / Sign up
        </button>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please give your league a name.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const code = generateLeagueCode();

      const docRef = await addDoc(collection(db, "leagues"), {
        name: name.trim(),
        code,
        ownerUid: user.uid,
        memberIds: [user.uid], // 👈 creator is automatically a member
        createdAt: serverTimestamp(),
      });

      router.push(`/leagues/${docRef.id}`);
    } catch (err) {
      console.error("Failed to create league:", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-3">Create a private league</h1>
      <p className="text-sm text-gray-300 mb-6">
        Make a league for your mates. Everyone plays the same global game, but
        this ladder is just for you.
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
            placeholder="e.g. Bentleigh Footy Club Punters"
            className="w-full rounded-lg bg-slate-950/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            You’ll get an invite code to share once the league is created.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold text-sm transition"
        >
          {creating ? "Creating league…" : "Create league"}
        </button>
      </form>
    </main>
  );
}
