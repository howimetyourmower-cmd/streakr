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
};

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export default function JoinLeagueClient() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const codeFromUrl = useMemo(() => normalizeCode(params.get("code") || ""), [params]);

  const [code, setCode] = useState<string>(codeFromUrl);
  const [state, setState] = useState<JoinState>("idle");
  const [error, setError] = useState<string>("");
  const [found, setFound] = useState<FoundLeague | null>(null);

  // keep input synced if user opens with ?code=
  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl);
  }, [codeFromUrl]);

  const canSubmit = !!user && code.length >= 4 && state !== "joining" && state !== "searching";

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
      // NOTE: requires leagues docs to store inviteCode field (not "code")
      const leaguesRef = collection(db, "leagues");
      const qRef = query(leaguesRef, where("inviteCode", "==", inviteCode));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        setError("No league found with that code.");
        setState("error");
        return;
      }

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
        name: data.name ?? "Untitled league",
        inviteCode: data.inviteCode ?? inviteCode,
        managerId: data.managerId ?? data.managerUid ?? data.managerID ?? undefined,
        sport,
      };

      setFound(league);

      // 2) Join (member doc + arrays)
      setState("joining");

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
        },
        { merge: true }
      );

      // update league doc
      const leagueRef = doc(db, "leagues", league.id);

      // We increment memberCount blindly; it’s okay for MVP.
      // If you want strict "don’t increment if already a member", we can add a check later.
      await updateDoc(leagueRef, {
        memberIds: arrayUnion(user.uid),
        memberCount: increment(1),
      });

      // update user doc (optional but handy)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          leagueIds: arrayUnion(league.id),
        },
        { merge: true }
      );

      setState("joined");
    } catch (err) {
      console.error("Failed to join league", err);
      setError("Could not join that league right now. Try again.");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold mb-1">Join League</h1>
            <p className="text-white/60 text-sm">
              Enter a code from a mate and jump onto the league ladder.
            </p>
          </div>
          <SportBadge sport="afl" />
        </div>

        {!user && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You need to log in before you can join a league.
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#050816] p-5 space-y-4">
          <form onSubmit={handleJoin} className="space-y-3" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs text-white/60">League code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  placeholder="ABC123"
                  className="flex-1 rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                />
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-black text-sm font-semibold px-4 py-2"
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
              <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                {error}
              </p>
            )}
          </form>

          {found && state !== "error" && (
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-white/50">
                League found
              </p>
              <p className="text-lg font-semibold">{found.name}</p>
              <p className="text-xs text-white/60 mt-1">
                Code: <span className="font-mono text-orange-300">{found.inviteCode}</span>
              </p>
            </div>
          )}

          {state === "joined" && found && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 space-y-3">
              <p className="text-emerald-200 font-semibold">
                You’ve joined <span className="text-white">{found.name}</span> ✅
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/leagues/${found.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2"
                >
                  Go to league →
                </Link>
                <button
                  type="button"
                  onClick={() => router.push("/leagues")}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2"
                >
                  Back to leagues
                </button>
              </div>
              <p className="text-[11px] text-white/60">
                If you don’t see it immediately, refresh once — Firestore usually catches up fast.
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-white/50">
          <Link href="/leagues" className="text-orange-300 hover:text-orange-200 font-semibold">
            ← Back to leagues
          </Link>
        </div>
      </div>
    </div>
  );
}
