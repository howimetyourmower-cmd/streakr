// /app/leagues/create/CreateLeagueClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type CreateState = "idle" | "creating" | "success" | "error";

function generateInviteCode(length = 6): string {
  // no 0/O/1/I
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default function CreateLeagueClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState<string>(""); // keep as string for input
  const [isPublic, setIsPublic] = useState(false);

  const [state, setState] = useState<CreateState>("idle");
  const [error, setError] = useState("");

  const cleanName = useMemo(() => normalizeName(name), [name]);
  const canSubmit =
    !!user &&
    state !== "creating" &&
    cleanName.length >= 3 &&
    cleanName.length <= 40;

  useEffect(() => {
    if (state !== "success") return;
    const t = setTimeout(() => setState("idle"), 1200);
    return () => clearTimeout(t);
  }, [state]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("You need to be logged in to create a room.");
      setState("error");
      return;
    }

    const finalName = normalizeName(name);
    if (finalName.length < 3) {
      setError("Room name must be at least 3 characters.");
      setState("error");
      return;
    }
    if (finalName.length > 40) {
      setError("Room name is too long (max 40 characters).");
      setState("error");
      return;
    }

    let max = 0;
    if (maxMembers.trim()) {
      const n = Number(maxMembers);
      if (!Number.isFinite(n) || n < 2 || n > 500) {
        setError("Max members must be between 2 and 500 (or leave blank).");
        setState("error");
        return;
      }
      max = Math.floor(n);
    }

    setState("creating");

    try {
      const uid = user.uid;

      // Use a random invite code. Collisions are very unlikely; if it ever happens, you can regenerate in admin.
      const inviteCode = generateInviteCode(6);

      // display name helper
      const displayName =
        (user as any).displayName ||
        (user as any).username ||
        (user as any).email ||
        "Player";

      // Create league doc
      const leagueRef = await addDoc(collection(db, "leagues"), {
        name: finalName,
        description: description.trim(),
        sport: "afl", // AFL-only for now
        inviteCode,
        managerId: uid,

        // membership tracking
        memberCount: 1,
        memberIds: [uid],

        // optional settings
        isPublic: !!isPublic,
        ...(max > 0 ? { maxMembers: max } : {}),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create member subdoc for manager
      await setDoc(doc(db, "leagues", leagueRef.id, "members", uid), {
        uid,
        displayName,
        role: "manager",
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Ensure user doc references this league
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // create base user doc if missing
        await setDoc(
          userRef,
          {
            uid,
            displayName,
            leagueIds: [leagueRef.id],
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await updateDoc(userRef, {
          leagueIds: arrayUnion(leagueRef.id),
          updatedAt: serverTimestamp(),
        }).catch(async () => {
          // If updateDoc fails (rare), fallback to setDoc merge.
          await setDoc(
            userRef,
            { leagueIds: arrayUnion(leagueRef.id), updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
      }

      setState("success");

      // Send them straight to ladder (best “wow” moment)
      router.push(`/leagues/${leagueRef.id}/ladder`);
    } catch (err) {
      console.error("Create league failed", err);
      setError("Could not create that room right now. Please try again.");
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-4 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        {/* Compact header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-orange-200">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                Torpy Locker Rooms
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
                Create a room
              </h1>
              <p className="mt-1 text-[12px] md:text-sm text-white/60">
                You’re the commish. Create a room, get an invite code, and send it to the crew.
              </p>
            </div>

            <Link
              href="/leagues"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs px-4 py-2 transition"
            >
              ← Back
            </Link>
          </div>
        </div>

        {!user && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You need to log in before you can create a room.
          </div>
        )}

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-6 shadow-[0_0_45px_rgba(0,0,0,0.6)]">
          <form onSubmit={handleCreate} className="space-y-4" autoComplete="off">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Room name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. The Mulch Crew"
                  maxLength={40}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                />
                <div className="flex items-center justify-between text-[11px] text-white/45">
                  <span>3–40 characters. Keep it short for ladders.</span>
                  <span>{safeStr(cleanName).length}/40</span>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What’s the room about? (inside jokes welcome)"
                  rows={3}
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Max members (optional)
                </label>
                <input
                  inputMode="numeric"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Leave blank = unlimited"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                />
                <p className="text-[11px] text-white/45">Min 2, max 500.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Visibility
                </label>
                <button
                  type="button"
                  onClick={() => setIsPublic((v) => !v)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-3 text-left transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-extrabold">
                        {isPublic ? "Public (discoverable)" : "Private (code only)"}
                      </p>
                      <p className="text-[11px] text-white/55 mt-0.5">
                        {isPublic
                          ? "Anyone can find it in future lists (when enabled)."
                          : "Only people with your invite code can join."}
                      </p>
                    </div>
                    <span
                      className={`h-6 w-11 rounded-full border border-white/15 p-1 transition ${
                        isPublic ? "bg-orange-500/70" : "bg-black/30"
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white transition ${
                          isPublic ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:hover:bg-orange-500 text-black text-sm font-extrabold px-6 py-3 transition"
              >
                {state === "creating" ? "Creating…" : "Create room"}
              </button>

              <div className="text-[11px] text-white/45">
                AFL-only for now. You’ll be taken straight to the ladder.
              </div>
            </div>

            {state === "success" && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Room created ✅ Opening ladder…
              </div>
            )}
          </form>
        </div>

        {/* Tiny footer */}
        <div className="text-[11px] text-white/45">
          Prefer joining?{" "}
          <Link href="/leagues/join" className="text-orange-300 hover:text-orange-200 font-extrabold">
            Join with a code →
          </Link>
        </div>
      </div>
    </main>
  );
}
