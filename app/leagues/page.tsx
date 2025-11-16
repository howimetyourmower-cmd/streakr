"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

export default function JoinLeaguePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || joining) return;

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a league code to join.");
      return;
    }

    try {
      setJoining(true);
      setError("");

      // Find league by code
      const leaguesCol = collection(db, "leagues");
      const q = query(leaguesCol, where("code", "==", trimmed));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError("No league found with that code. Check with your mate.");
        setJoining(false);
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;

      // Optional: check if already a member (via collectionGroup)
      const membersCg = collectionGroup(db, "members");
      const existingQ = query(
        membersCg,
        where("uid", "==", user.uid),
        where("leagueId", "==", leagueId)
      );
      const existingSnap = await getDocs(existingQ);
      const alreadyMember = !existingSnap.empty;

      // Upsert membership doc
      const memberRef = doc(
        collection(db, "leagues", leagueId, "members"),
        user.uid
      );

      await setDoc(
        memberRef,
        {
          uid: user.uid,
          leagueId,
          username: user.displayName || "Player",
          team: "",
          currentStreak: 0,
          longestStreak: 0,
          avatarUrl: "",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Go to league detail
      router.push(`/leagues/${leagueId}`);
    } catch (err) {
      console.error(err);
      setError("Failed to join league. Please try again.");
      setJoining(false);
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

      <h1 className="text-3xl md:text-4xl font-bold mb-2">Join a league</h1>
      <p className="text-sm text-slate-300 mb-6 max-w-xl">
        Drop in the league code from your mate, office comp or fantasy group.
        You’ll appear on their ladder as soon as you start making picks.
      </p>

      <
