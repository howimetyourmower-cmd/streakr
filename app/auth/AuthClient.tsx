// app/leagues/create/CreateLeagueClient.tsx
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

function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function safeTrim(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

async function findUniqueInviteCode(maxAttempts = 6): Promise<string> {
  const leaguesRef = collection(db, "leagues");

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode(6);
    const qRef = query(leaguesRef, where("inviteCode", "==", code), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return code;
  }

  // last resort
  return `${generateInviteCode(4)}${Math.floor(Math.random() * 90 + 10)}`;
}

export default function CreateLeagueClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState<string>(""); // optional
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!user) return false;
    if (!safeTrim(name)) return false;
    return !submitting;
  }, [loading, user, name, submitting]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    const cleanName = safeTrim(name);
    if (!cleanName) {
      setError("Please enter a league name.");
      return;
    }

    const mm = Number(maxMembers);
    const maxMembersNum =
      maxMembers.trim() === ""
        ? undefined
        : Number.isFinite(mm) && mm >= 2
          ? Math.floor(mm)
          : NaN;

    if (maxMembers.trim() !== "" && Number.isNaN(maxMembersNum as any)) {
      setError("Max members must be a number (2 or more), or leave blank.");
      return;
    }

    setSubmitting(true);

    try {
      const inviteCode = await findUniqueInviteCode();

      // Create league doc
      const leaguesRef = collection(db, "leagues");
      const leagueDocRef = await addDoc(leaguesRef, {
        name: cleanName,
        description: safeTrim(description),
        inviteCode,
        managerId: user.uid,
        sport: "afl", // AFL-only for now
        isPublic: false,
        maxMembers: typeof maxMembersNum === "number" ? maxMembersNum : undefined,

        memberCount: 1,
        memberIds: [user.uid],

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const leagueId = leagueDocRef.id;

      // Create manager member subdoc
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      const displayName =
        (user as any).displayName || (user as any).username || (user as any).email || "Player";

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

      // Ensure users/{uid}.leagueIds contains this league (so /leagues loads reliably)
      await setDoc(
        doc(db, "users", user.uid),
        {
          leagueIds: arrayUnion(leagueId),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Belt + braces: ensure memberCount is sane (optional)
      await updateDoc(doc(db, "leagues", leagueId), {
        memberCount: 1,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      setInfo("League created. Opening…");
      router.push(`/leagues/${leagueId}`);
    } catch (err: any) {
      console.error("Create league error", err);
      setError(err?.message || "Failed to create league. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050814] text-white px-4 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs font-extrabold text-orange-300 uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              Create a private league
            </div>
            <h1 className="text-3xl font-extrabold leading-tight">Create League</h1>
            <p className="text-sm text-white/60 max-w-xl">
              You’re the commish. Create a private AFL league, get one invite code, and start the banter.
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
          <div className="text-sm text-red-300 border border-red-500/40 rounded-2xl bg-red-500/10 px-4 py-3">
            {error}
          </div>
        )}

        {info && (
          <div className="text-sm text-emerald-200 border border-emerald-500/40 rounded-2xl bg-emerald-500/10 px-4 py-3">
            {info}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
          <form onSubmit={handleCreate} className="space-y-4" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">League name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Work Crew 2026"
                className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              />
              <p className="text-[11px] text-white/45">
                This shows on the league page + ladder.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/70">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="E.g. Loser buys Friday arvo beers."
                className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70">Max members (optional)</label>
                <input
                  inputMode="numeric"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  placeholder="Leave blank = unlimited"
                  className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                />
                <p className="text-[11px] text-white/45">
                  If set, players can’t join once full.
                </p>
              </div>

              <div className="rounded-xl bg-black/20 border border-white/10 p-4">
                <div className="text-[11px] uppercase tracking-wide text-white/50">
                  What you get
                </div>
                <ul className="mt-2 text-sm text-white/70 list-disc pl-5 space-y-1">
                  <li>One invite code to share</li>
                  <li>Private ladder + league chat</li>
                  <li>Global streak still counts</li>
                </ul>
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-black font-extrabold text-sm px-6 py-3 transition"
            >
              {submitting ? "Creating…" : "Create league"}
            </button>
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
