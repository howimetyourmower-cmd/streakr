// /app/leagues/join/JoinLeagueClient.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type JoinState = "idle" | "searching" | "joining" | "joined" | "error";

type FoundLeague = {
  id: string;
  name: string;
  inviteCode: string;
  managerId?: string;
  sport?: string;
  memberCount?: number;
  maxMembers?: number;
  isPublic?: boolean;
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function safeNum(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default function JoinLeagueClient() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const codeFromUrl = useMemo(
    () => normalizeCode(params.get("code") || ""),
    [params]
  );

  const [code, setCode] = useState<string>(codeFromUrl);
  const [state, setState] = useState<JoinState>("idle");
  const [error, setError] = useState<string>("");
  const [found, setFound] = useState<FoundLeague | null>(null);

  // keep input synced if user opens with ?code=
  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl);
  }, [codeFromUrl]);

  const canSubmit =
    !!user && code.length >= 4 && state !== "joining" && state !== "searching";

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();

    setError("");
    setFound(null);

    if (!user) {
      setError("You need to log in to join a league.");
      setState("error");
      return;
    }

    const inviteCode = normalizeCode(code);
    if (!inviteCode || inviteCode.length < 4) {
      setError("Enter your league code (usually 6 characters).");
      setState("error");
      return;
    }

    try {
      setState("searching");

      // 1) Find league by inviteCode
      const leaguesRef = collection(db, "leagues");
      const qRef = query(leaguesRef, where("inviteCode", "==", inviteCode));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        setError("No league found with that code.");
        setState("error");
        return;
      }

      // if multiple leagues share a code (shouldn't), take first
      const leagueDoc = snap.docs[0];
      const data = leagueDoc.data() as any;

      // AFL-only guard (since you're going AFL-only now)
      const sport = (data.sport || "afl").toString().toLowerCase();
      if (sport !== "afl") {
        setError("That league isn’t an AFL league.");
        setState("error");
        return;
      }

      const league: FoundLeague = {
        id: leagueDoc.id,
        name: safeStr(data.name, "Untitled league"),
        inviteCode: safeStr(data.inviteCode, inviteCode),
        managerId: data.managerId ?? data.managerUid ?? data.managerID ?? undefined,
        sport,
        memberCount: safeNum(data.memberCount, 0),
        maxMembers: typeof data.maxMembers === "number" ? data.maxMembers : undefined,
        isPublic: typeof data.isPublic === "boolean" ? data.isPublic : undefined,
      };

      // capacity guard (optional but nice)
      if (
        typeof league.maxMembers === "number" &&
        league.maxMembers > 0 &&
        league.memberCount !== undefined &&
        league.memberCount >= league.maxMembers
      ) {
        setFound(league);
        setError("That league is full.");
        setState("error");
        return;
      }

      setFound(league);

      // 2) Join (member doc + arrays)
      setState("joining");

      // IMPORTANT: prevent double-increment if user already a member
      const leagueRef = doc(db, "leagues", league.id);
      const leagueSnap = await getDoc(leagueRef);

      if (!leagueSnap.exists()) {
        setError("That league no longer exists.");
        setState("error");
        return;
      }

      const leagueData = leagueSnap.data() as any;
      const memberIds: string[] = Array.isArray(leagueData.memberIds)
        ? leagueData.memberIds
        : [];

      const alreadyMember = memberIds.includes(user.uid);

      // member subdoc
      const memberRef = doc(db, "leagues", league.id, "members", user.uid);
      const displayName =
        (user as any).displayName ||
        (user as any).username ||
        (user as any).email ||
        "Player";

      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName,
          role: "member",
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // update league doc
      // - always ensure memberIds contains uid
      // - only increment memberCount if they weren't already a member
      const updates: Record<string, any> = {
        memberIds: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      };

      if (!alreadyMember) {
        updates.memberCount = increment(1);
      }

      await updateDoc(leagueRef, updates);

      // update user doc (optional but handy)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          leagueIds: arrayUnion(league.id),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // best effort: if we had a weird state where memberCount was incremented but memberIds already had uid,
      // we do nothing. (The alreadyMember guard prevents it.)
      setState("joined");
    } catch (err) {
      console.error("Failed to join league", err);

      // best-effort rollback: if we set state to joining and had a found league,
      // we won't try to "undo" docs (too risky without txn). Keep it simple.
      setError("Could not join that league right now. Try again.");
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-6 py-10">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-xs font-bold text-orange-300 uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              Join your crew
            </div>
            <h1 className="text-3xl font-extrabold leading-tight">Join a League</h1>
            <p className="text-white/60 text-sm max-w-xl">
              Enter a code from a mate and jump straight onto the ladder. AFL-only for now.
            </p>
          </div>
          <SportBadge sport="afl" />
        </div>

        {!user && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You need to log in before you can join a league.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-5 shadow-lg">
          <form onSubmit={handleJoin} className="space-y-3" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs text-white/60">League code</label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  inputMode="text"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  placeholder="ABC123"
                  className="flex-1 rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm tracking-[0.32em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:hover:bg-orange-500 text-black text-sm font-extrabold px-6 py-3 transition"
                >
                  {state === "searching"
                    ? "Finding…"
                    : state === "joining"
                    ? "Joining…"
                    : "Join"}
                </button>
              </div>

              {codeFromUrl && (
                <p className="text-[11px] text-white/45">
                  Code prefilled from link.
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-300 border border-red-500/40 rounded-xl bg-red-500/10 px-4 py-3">
                {error}
              </p>
            )}
          </form>

          {found && state !== "error" && (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-white/50">
                League found
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-extrabold truncate">{found.name}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Code:{" "}
                    <span className="font-mono text-orange-300">
                      {found.inviteCode}
                    </span>
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Players
                  </p>
                  <p className="text-lg font-black text-zinc-200">
                    {found.memberCount ?? "—"}
                    {typeof found.maxMembers === "number" ? (
                      <span className="text-xs text-zinc-500">
                        {" "}
                        / {found.maxMembers}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>
          )}

          {state === "joined" && found && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-5 space-y-4">
              <p className="text-emerald-200 font-extrabold text-base">
                You’ve joined <span className="text-white">{found.name}</span> ✅
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/leagues/${found.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm px-5 py-3 transition"
                >
                  Go to league →
                </Link>
                <button
                  type="button"
                  onClick={() => router.push("/leagues")}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-sm px-5 py-3 transition"
                >
                  Back to leagues
                </button>
              </div>

              <p className="text-[11px] text-white/60">
                If it doesn’t show instantly, refresh once — Firestore usually catches up fast.
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-white/50">
          <Link
            href="/leagues"
            className="text-orange-300 hover:text-orange-200 font-extrabold"
          >
            ← Back to leagues
          </Link>
        </div>
      </div>
    </main>
  );
}
