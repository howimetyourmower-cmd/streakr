// /app/leagues/create/CreateLeagueClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

function safeTrim(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function generateInviteCode(length = 6): string {
  // no 0/O/1/I
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function findUniqueInviteCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode(6);
    const leaguesRef = collection(db, "leagues");
    const qRef = query(leaguesRef, where("inviteCode", "==", code), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return code;
  }
  // worst-case fallback (still very unlikely)
  return `${generateInviteCode(6)}${Math.floor(Math.random() * 9)}`;
}

export default function CreateLeagueClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (loading) return false;
    if (submitting) return false;
    return safeTrim(name).length >= 3;
  }, [user, loading, submitting, name]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!user) {
      setError("You need to log in to create a league.");
      return;
    }

    const cleanName = safeTrim(name);
    if (cleanName.length < 3) {
      setError("League name must be at least 3 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const inviteCode = await findUniqueInviteCode();

      const displayName =
        (user as any)?.displayName ||
        (user as any)?.username ||
        (user as any)?.email ||
        "Player";

      // 1) Create league doc
      const leagueRef = await addDoc(collection(db, "leagues"), {
        name: cleanName,
        description: safeTrim(description),
        inviteCode: normalizeCode(inviteCode),
        managerId: user.uid,
        sport: "afl",

        // optional but handy (keeps things consistent + can prevent double-count)
        memberIds: [user.uid],
        memberCount: 1,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2) Create manager member subdoc
      const memberRef = doc(db, "leagues", leagueRef.id, "members", user.uid);
      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName,
          role: "manager",
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) Update user doc to include leagueId (so /leagues loads fast)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          leagueIds: arrayUnion(leagueRef.id),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setInfo("League created. Opening ladder…");
      router.push(`/leagues/${leagueRef.id}/ladder`);
    } catch (err) {
      console.error("Create league failed", err);
      setError("Could not create league right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs font-bold text-orange-300 uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              Create a league
            </div>
            <h1 className="text-3xl font-extrabold leading-tight">New League</h1>
            <p className="text-sm text-white/60 max-w-xl">
              Name your league, get an invite code, and bring the crew in. AFL-only for now.
            </p>
          </div>
          <SportBadge sport="afl" />
        </div>

        {!user && !loading && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You need to log in before you can create a league.
          </div>
        )}

        {error && (
          <div className="text-sm text-red-300 border border-red-500/40 rounded-xl bg-red-500/10 px-4 py-3">
            {error}
          </div>
        )}

        {info && (
          <div className="text-sm text-emerald-200 border border-emerald-500/40 rounded-xl bg-emerald-500/10 px-4 py-3">
            {info}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-6 space-y-5">
          <form onSubmit={handleCreate} className="space-y-4" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs text-white/60">League name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Work Crew Legends"
                className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              />
              <p className="text-[11px] text-white/45">
                This shows on your league page and ladder.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-white/60">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="E.g. Loser shouts the pub lunch."
                className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:hover:bg-orange-500 text-black font-extrabold text-sm px-6 py-3 transition"
              >
                {submitting ? "Creating…" : "Create league"}
              </button>

              <Link
                href="/leagues"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-sm px-6 py-3 transition"
              >
                Cancel
              </Link>
            </div>

            <div className="text-[11px] text-white/50 pt-2">
              Creating a league generates a single invite code you can share with mates.
              Your global streak still counts on the main leaderboard.
            </div>
          </form>
        </div>

        <div className="text-xs text-white/50">
          <Link href="/leagues" className="text-orange-300 hover:text-orange-200 font-extrabold">
            ← Back to leagues
          </Link>
        </div>
      </div>
    </main>
  );
}
