"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }

    setJoining(true);
    setError("");

    try {
      // Look up league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", code.toUpperCase())
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;

      // Add user as member
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        username: user.displayName || user.email?.split("@")[0] || "Player",
        avatarUrl: "",
        currentStreak: 0,
        longestStreak: 0,
        isOwner: false,
      });

      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error("Failed to join league:", err);
      setError("Something went wrong joining the league.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Join a League</h1>

      <p className="text-gray-300 mb-6 text-sm">
        Enter the league code your mate shared with you.
      </p>

      <div className="mb-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code (e.g. X7Q9F3)"
          className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/20 focus:border-orange-400 outline-none"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3">{error}</p>
      )}

      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold py-2 rounded-lg transition disabled:opacity-50"
      >
        {joining ? "Joining…" : "Join League"}
      </button>
    </main>
  );
}
