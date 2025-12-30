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
  increment,
  getDoc,
  limit,
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
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function Pill({
  children,
  tone = "orange",
}: {
  children: React.ReactNode;
  tone?: "orange" | "sky" | "zinc" | "emerald" | "red" | "amber";
}) {
  const cls =
    tone === "orange"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
      : tone === "sky"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : tone === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : tone === "red"
            ? "border-red-500/30 bg-red-500/10 text-red-200"
            : tone === "amber"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
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
      setError("You need to log in to join a room.");
      setState("error");
      return;
    }

    const inviteCode = normalizeCode(code);
    if (!inviteCode || inviteCode.length < 4) {
      setError("Enter your room code (usually 6 characters).");
      setState("error");
      return;
    }

    try {
      setState("searching");

      // 1) Find room by inviteCode (limit 1)
      const leaguesRef = collection(db, "leagues");
      const qRef = query(leaguesRef, where("inviteCode", "==", inviteCode), limit(1));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        setError("No room found with that code.");
        setState("error");
        return;
      }

      const leagueDoc = snap.docs[0];
      const data = leagueDoc.data() as any;

      // AFL-only guard (default to afl)
      const sport = (data.sport || "afl").toString().toLowerCase();
      if (sport !== "afl") {
        setError("That room isn’t an AFL room.");
        setState("error");
        return;
      }

      const league: FoundLeague = {
        id: leagueDoc.id,
        name: safeStr(data.name, "Untitled room"),
        inviteCode: safeStr(data.inviteCode, inviteCode),
        managerId: data.managerId ?? data.managerUid ?? data.managerID ?? undefined,
        sport,
        memberCount: safeNum(data.memberCount, 0),
        maxMembers: typeof data.maxMembers === "number" ? data.maxMembers : undefined,
        isPublic: typeof data.isPublic === "boolean" ? data.isPublic : undefined,
      };

      // Capacity guard (best-effort)
      if (
        typeof league.maxMembers === "number" &&
        league.maxMembers > 0 &&
        (league.memberCount ?? 0) >= league.maxMembers
      ) {
        setFound(league);
        setError("That room is full.");
        setState("error");
        return;
      }

      setFound(league);
      setState("joining");

      const leagueRef = doc(db, "leagues", league.id);

      // 2) Check membership using members subdoc (more reliable than memberIds array)
      const memberRef = doc(db, "leagues", league.id, "members", user.uid);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        // Already a member — just ensure user doc is linked then redirect
        await setDoc(
          doc(db, "users", user.uid),
          { leagueIds: arrayUnion(league.id), updatedAt: serverTimestamp() },
          { merge: true }
        );

        setState("joined");
        router.push(`/leagues/${league.id}/ladder`);
        return;
      }

      // Re-check league exists
      const leagueSnap = await getDoc(leagueRef);
      if (!leagueSnap.exists()) {
        setError("That room no longer exists.");
        setState("error");
        return;
      }

      const displayName =
        (user as any).displayName ||
        (user as any).username ||
        (user as any).email ||
        "Player";

      // 3) Create member doc
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

      // 4) Update league counts + ids
      await updateDoc(leagueRef, {
        memberIds: arrayUnion(user.uid),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // 5) Update user for quick lookup
      await setDoc(
        doc(db, "users", user.uid),
        { leagueIds: arrayUnion(league.id), updatedAt: serverTimestamp() },
        { merge: true }
      );

      setState("joined");
      router.push(`/leagues/${league.id}/ladder`);
    } catch (err) {
      console.error("Failed to join room", err);
      setError("Could not join that room right now. Try again.");
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8 space-y-4">
        {/* Header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="orange">Join your crew</Pill>
                <Pill tone="zinc">Torpy</Pill>
                <Pill tone="sky">AFL only</Pill>
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight">
                Join a Locker Room
              </h1>
              <p className="mt-1 text-[12px] leading-snug text-white/65 md:text-sm max-w-xl">
                Paste a code from a mate and jump straight onto the ladder.
              </p>
            </div>

            <div className="shrink-0">
              <SportBadge sport="afl" />
            </div>
          </div>

          {!user && (
            <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              You need to log in before you can join a room.
            </div>
          )}
        </div>

        {/* Join panel */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_0_40px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="border-b border-white/10 bg-gradient-to-r from-orange-500/18 via-transparent to-transparent px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold tracking-tight md:text-lg">
                  Enter room code
                </h2>
                <p className="mt-0.5 text-[12px] leading-snug text-white/65">
                  Codes are usually 6 characters. Links can prefill via{" "}
                  <span className="font-mono">?code=</span>.
                </p>
              </div>

              {codeFromUrl ? <Pill tone="zinc">Prefilled</Pill> : null}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <form onSubmit={handleJoin} className="space-y-3" autoComplete="off">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                  Room code
                </label>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(normalizeCode(e.target.value))}
                    placeholder="ABC123"
                    className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-4 py-3 text-sm tracking-[0.32em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                  />

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="h-[46px] w-full sm:w-auto rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:hover:bg-orange-500 text-black text-sm font-extrabold px-6 transition"
                  >
                    {state === "searching"
                      ? "Finding…"
                      : state === "joining"
                        ? "Joining…"
                        : "Join"}
                  </button>
                </div>

                {codeFromUrl && (
                  <p className="text-[11px] text-white/45">Code prefilled from link.</p>
                )}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}
            </form>

            {/* Found room preview */}
            {found && state !== "error" && state !== "joined" && (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Pill tone="sky">Room found</Pill>
                      <Pill tone="zinc">{(found.sport || "afl").toUpperCase()}</Pill>
                    </div>
                    <p className="mt-2 text-lg font-extrabold truncate">{found.name}</p>
                    <p className="mt-1 text-[12px] text-white/60">
                      Code:{" "}
                      <span className="font-mono text-orange-300">{found.inviteCode}</span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      Players
                    </p>
                    <p className="text-lg font-black text-zinc-200 leading-none">
                      {found.memberCount ?? "—"}
                      {typeof found.maxMembers === "number" ? (
                        <span className="text-xs text-zinc-500"> / {found.maxMembers}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div className="text-xs text-white/55">
          <Link href="/leagues" className="text-orange-300 hover:text-orange-200 font-extrabold">
            ← Back to Locker Room
          </Link>
        </div>
      </div>
    </main>
  );
}
