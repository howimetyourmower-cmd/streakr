// app/leagues/join/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type FoundLeague = {
  id: string;
  name: string;
  code: string;
  managerUid: string;
};

export default function JoinLeaguePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [foundLeague, setFoundLeague] = useState<FoundLeague | null>(null);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // If ?code=XYZ in URL, prefill
  useEffect(() => {
    const initial = searchParams?.get("code");
    if (initial) {
      setCode(initial.toUpperCase());
    }
  }, [searchParams]);

  const handleFindLeague = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter an invite code to join a league.");
      return;
    }

    setSearching(true);
    setJoining(false);
    setError(null);
    setSuccess(null);
    setFoundLeague(null);

    try {
      const leaguesQ = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );
      const snap = await getDocs(leaguesQ);

      if (snap.empty) {
        setError("No league found with that code. Double-check with your mate.");
        return;
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data() as any;

      setFoundLeague({
        id: docSnap.id,
        name: data.name ?? "Unnamed league",
        code: data.code ?? trimmed,
        managerUid: data.managerUid,
      });
    } catch (err) {
      console.error("Failed to find league", err);
      setError("Failed to look up that code. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      setError("You need to be logged in to join a league.");
      return;
    }
    if (!foundLeague) return;

    setJoining(true);
    setError(null);
    setSuccess(null);

    try {
      const leagueRef = doc(db, "leagues", foundLeague.id);
      const memberRef = doc(collection(leagueRef, "members"), user.uid);

      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName: user.displayName || user.email || "Player",
          role: "member",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccess("You’ve joined the league! Redirecting…");
      setTimeout(() => {
        router.push(`/leagues/${foundLeague.id}`);
      }, 1200);
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Failed to join league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="py-6 md:py-8 space-y-6">
      <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to leagues
      </Link>

      <div className="max-w-xl rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Join a league</h1>
            <SportBadge sport="afl" />
          </div>
          <p className="mt-1 text-sm text-white/70">
            Drop in the invite code your mate sent you. Once you join, your streak
            will appear on that league&apos;s ladder as soon as you make picks.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
            {success}
          </p>
        )}

        <form onSubmit={handleFindLeague} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">
              League code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm font-mono tracking-[0.18em] uppercase focus:outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/70"
              placeholder="E.g. 7F9LZK"
            />
            <p className="text-[11px] text-white/60">
              Your league manager can find this on their League Detail page.
            </p>
          </div>

          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
          >
            {searching ? "Looking up code…" : "Join with code"}
          </button>
        </form>

        {foundLeague && (
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-3 space-y-2 text-sm mt-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{foundLeague.name}</span>
                  <SportBadge sport="afl" />
                </div>
                <p className="text-xs text-white/60">
                  Invite code:{" "}
                  <span className="font-mono">{foundLeague.code}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs px-3 py-1.5 transition-colors disabled:opacity-60"
              >
                {joining ? "Joining…" : "Confirm join"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
