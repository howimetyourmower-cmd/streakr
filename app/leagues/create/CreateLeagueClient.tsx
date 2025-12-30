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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

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
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

async function findUniqueInviteCode(maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode(6);
    const leaguesRef = collection(db, "leagues");
    const qRef = query(leaguesRef, where("inviteCode", "==", code), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return code;
  }
  return `${generateInviteCode(6)}${Math.floor(Math.random() * 9)}`;
}

function Pill({
  children,
  tone = "orange",
}: {
  children: React.ReactNode;
  tone?: "orange" | "sky" | "zinc" | "emerald";
}) {
  const cls =
    tone === "orange"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
      : tone === "sky"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : tone === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
  accent = "orange",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  accent?: "orange" | "sky" | "zinc" | "emerald";
}) {
  const top =
    accent === "orange"
      ? "from-orange-500/18"
      : accent === "sky"
        ? "from-sky-500/18"
        : accent === "emerald"
          ? "from-emerald-500/18"
          : "from-white/8";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_0_40px_rgba(0,0,0,0.55)] overflow-hidden">
      <div
        className={`border-b border-white/10 bg-gradient-to-r ${top} via-transparent to-transparent px-4 py-3`}
      >
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight md:text-lg">
            {title}
          </h2>
          {desc ? (
            <p className="mt-0.5 text-[12px] leading-snug text-white/65">{desc}</p>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function CreateLeagueClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // defaults (you said “defaults then we can update”)
  const [maxMembers, setMaxMembers] = useState<number>(50);

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
      setError("You need to log in to create a room.");
      return;
    }

    const cleanName = safeTrim(name);
    if (cleanName.length < 3) {
      setError("Room name must be at least 3 characters.");
      return;
    }

    const cleanMax = Number.isFinite(maxMembers) ? Math.max(2, Math.min(500, maxMembers)) : 50;

    setSubmitting(true);

    try {
      const inviteCode = normalizeCode(await findUniqueInviteCode());

      const displayName =
        (user as any)?.displayName ||
        (user as any)?.username ||
        (user as any)?.email ||
        "Player";

      // 1) Create league (room) doc
      const leagueRef = await addDoc(collection(db, "leagues"), {
        name: cleanName,
        description: safeTrim(description),
        inviteCode,
        managerId: user.uid,
        sport: "afl",

        // For fast membership lookups + safe join increments
        memberIds: [user.uid],
        memberCount: 1,

        // Defaults (editable later)
        maxMembers: cleanMax,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2) Create manager member subdoc
      await setDoc(
        doc(db, "leagues", leagueRef.id, "members", user.uid),
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
      await setDoc(
        doc(db, "users", user.uid),
        { leagueIds: arrayUnion(leagueRef.id), updatedAt: serverTimestamp() },
        { merge: true }
      );

      setInfo("Room created. Opening ladder…");
      router.push(`/leagues/${leagueRef.id}/ladder`);
    } catch (err) {
      console.error("Create room failed", err);
      setError("Could not create a room right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:py-7 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pill tone="orange">Create a Locker Room</Pill>
                <Pill tone="zinc">AFL</Pill>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
                New Room
              </h1>
              <p className="mt-1 text-[12px] leading-snug text-white/65 md:text-sm">
                Name your room, get an invite code, and bring the crew in. AFL-only for now.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link
                href="/leagues"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
              >
                Back to Locker Room
              </Link>
            </div>
          </div>

          {!user && !loading && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              You need to log in before you can create a room.
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {info && (
            <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {info}
            </div>
          )}
        </div>

        {/* Form card */}
        <Card
          title="Room details"
          desc="Short and savage names look best on the ladder."
          accent="orange"
        >
          <form onSubmit={handleCreate} className="space-y-4" autoComplete="off">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                Room name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Work Crew Legends"
                className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              />
              <p className="text-[11px] text-white/45">
                This shows on the room page and ladder.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="E.g. Loser shouts the pub lunch."
                className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              />
            </div>

            {/* Default settings (keep simple) */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Max members
                </label>
                <input
                  type="number"
                  min={2}
                  max={500}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                />
                <p className="text-[11px] text-white/45">
                  Default 50. We can hide this later if you want.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-[12px] text-white/65">
                <div className="font-semibold text-white/80 mb-1">Defaults</div>
                <ul className="space-y-1">
                  <li>• Sport: AFL</li>
                  <li>• Private room + invite code</li>
                  <li>• You become Room Manager</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:hover:bg-orange-500 text-black font-extrabold text-sm px-6 py-3 transition"
              >
                {submitting ? "Creating…" : "Create room"}
              </button>

              <Link
                href="/leagues"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-sm px-6 py-3 transition"
              >
                Cancel
              </Link>
            </div>

            <div className="text-[11px] text-white/50 pt-2">
              Creating a room generates a single invite code you can share with mates.
              Your global streak still counts on the main leaderboard.
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
