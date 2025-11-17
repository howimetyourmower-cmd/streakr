// app/leagues/join/page.tsx
"use client";

import {
  FormEvent,
  useEffect,
  useState,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

type JoinState = {
  code: string;
  joining: boolean;
  error: string | null;
  success: string | null;
  leagueName: string | null;
};

function JoinLeagueInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [state, setState] = useState<JoinState>({
    code: "",
    joining: false,
    error: null,
    success: null,
    leagueName: null,
  });

  // Pre-fill code from URL ?code=XXXX
  useEffect(() => {
    const urlCode = searchParams.get("code");
    if (urlCode) {
      setState((prev) => ({
        ...prev,
        code: urlCode.toUpperCase(),
      }));
    }
  }, [searchParams]);

  const handleChange = (value: string) => {
    setState((prev) => ({
      ...prev,
      code: value.toUpperCase(),
      error: null,
      success: null,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmed = state.code.trim().toUpperCase();

    if (!trimmed) {
      setState((prev) => ({
        ...prev,
        error: "Please enter a league code.",
        success: null,
      }));
      return;
    }

    if (!user) {
      setState((prev) => ({
        ...prev,
        error: "You need to be logged in to join a league.",
        success: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      joining: true,
      error: null,
      success: null,
    }));

    try {
      // 1) Find the league by code
      const q = query(
        collection(db, "leagues"),
        where("code", "==", trimmed),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setState((prev) => ({
          ...prev,
          joining: false,
          error: "No league found with that code. Check the code and try again.",
        }));
        return;
      }

      const leagueDoc = snap.docs[0];
      const leagueId = leagueDoc.id;
      const leagueData = leagueDoc.data() as { name?: string };

      // 2) Check if user is already a member
      const memberRef = doc(collection(leagueDoc.ref, "members"), user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        setState((prev) => ({
          ...prev,
          joining: false,
          leagueName: leagueData.name ?? null,
          success: "You’re already in this league. Taking you to the league page…",
        }));

        setTimeout(() => {
          router.push(`/leagues/${leagueId}`);
        }, 1200);
        return;
      }

      // 3) Add user as a member
      await setDoc(memberRef, {
        uid: user.uid,
        role: "member",
        displayName: user.displayName || user.email || "Player",
        joinedAt: serverTimestamp(),
      });

      setState((prev) => ({
        ...prev,
        joining: false,
        leagueName: leagueData.name ?? null,
        success: "You’ve joined the league! Redirecting to your league page…",
      }));

      setTimeout(() => {
        router.push(`/leagues/${leagueId}`);
      }, 1200);
    } catch (err) {
      console.error("Failed to join league", err);
      setState((prev) => ({
        ...prev,
        joining: false,
        error: "Failed to join league. Please try again.",
      }));
    }
  };

  return (
    <div className="py-6 md:py-8">
      <div className="mb-4">
        <Link
          href="/leagues"
          className="text-sm text-slate-300 hover:text-orange-400"
        >
          ← Back to leagues
        </Link>
      </div>

      <div className="max-w-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-3 text-white">
          Join a league
        </h1>
        <p className="text-slate-300 mb-6 text-sm md:text-base">
          Drop in the invite code your mate sent you. Once you join, your
          streak will still count on the global leaderboard – this page is just
          for bragging rights inside your crew.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg max-w-md"
        >
          <label
            htmlFor="league-code"
            className="block text-sm font-medium text-slate-200 mb-2"
          >
            League code
          </label>
          <input
            id="league-code"
            type="text"
            value={state.code}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="E.g. 7FQ9LZ"
            maxLength={8}
            className="w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />

          {state.error && (
            <p className="mt-3 text-sm text-red-400">{state.error}</p>
          )}

          {state.success && (
            <p className="mt-3 text-sm text-emerald-400">{state.success}</p>
          )}

          {state.leagueName && (
            <p className="mt-1 text-xs text-slate-400">
              League: <span className="font-semibold">{state.leagueName}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={state.joining}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-sky-700/60 px-4 py-2.5 text-sm font-semibold text-black shadow-md transition-colors w-full md:w-auto"
          >
            {state.joining ? "Joining…" : "Join with code"}
          </button>
        </form>

        {!user && (
          <p className="mt-4 text-xs text-slate-400">
            You’ll need to{" "}
            <Link
              href="/auth"
              className="text-orange-400 hover:text-orange-300 underline"
            >
              log in or sign up
            </Link>{" "}
            before joining a league.
          </p>
        )}
      </div>
    </div>
  );
}

export default function JoinLeaguePage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-slate-300">
          Loading league join…
        </div>
      }
    >
      <JoinLeagueInner />
    </Suspense>
  );
}
