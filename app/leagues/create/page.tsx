"use client";

export const dynamic = "force-dynamic";

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

type Status = "idle" | "submitting" | "success" | "error";

function generateLeagueCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a league name.");
      return;
    }

    setStatus("submitting");
    setError("");

    const code = generateLeagueCode();

    try {
      // 1) Create the league document
      const leaguesCol = collection(db, "leagues");
      const leagueRef = await addDoc(leaguesCol, {
        name: name.trim(),
        description: description.trim() || "",
        code,
        managerUid: user.uid,
        managerEmail: user.email ?? "",
        memberCount: 1,
        createdAt: serverTimestamp(),
      });

      // 2) Add the manager as the first member (subcollection)
      const memberRef = doc(leagueRef, "members", user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        displayName: user.displayName || user.email || "Player",
        role: "manager",
        joinedAt: serverTimestamp(),
      });

      setStatus("success");
      router.push(`/leagues/${leagueRef.id}`);
    } catch (err) {
      console.error("Failed to create league:", err);
      setStatus("error");
      setError("Failed to create league. Please try again.");
    }
  };

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4">
        <a href="/leagues" className="text-sm text-slate-300 hover:text-orange-400">
          ← Back to leagues
        </a>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold mb-2">Create a league</h1>
      <p className="text-slate-300 mb-6 max-w-xl">
        Name your league, invite your mates with a simple code, and battle it out
        on your own ladder while everyone&apos;s streak still counts on the global board.
      </p>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-7 max-w-xl">
        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-800/60 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              League name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="E.g. Thursday Night Footy Crew"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="description"
            >
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="E.g. Season-long pub comp. Winner shouts the first round in September."
            />
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full md:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-black font-semibold text-sm shadow-md disabled:opacity-60"
          >
            {status === "submitting" ? "Creating league..." : "Create league"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          You&apos;ll automatically be the League Manager. We&apos;ll generate an invite
          code you can share with your mates.
        </p>
      </div>
    </div>
  );
}
