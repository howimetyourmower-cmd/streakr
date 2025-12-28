// /app/leagues/create/CreateLeagueClient.tsx
"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

function generateLeagueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default function CreateLeagueClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const shareLink = useMemo(() => {
    if (!inviteCode) return "";
    return `/leagues/join?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  async function generateUniqueCode(maxAttempts = 8): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const code = generateLeagueCode();
      const leaguesRef = collection(db, "leagues");
      const qRef = query(leaguesRef, where("inviteCode", "==", code));
      const snap = await getDocs(qRef);
      if (snap.empty) return code;
    }
    // fallback (extremely unlikely)
    return generateLeagueCode() + "X";
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You need to be logged in to create a league.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please give your league a name.");
      return;
    }

    const trimmedTagLine = tagLine.trim();
    const trimmedDesc = description.trim();

    setSaving(true);
    setError(null);

    try {
      const code = await generateUniqueCode();

      // ✅ Create league with fields that match /app/leagues (LeaguesClient)
      const leaguesRef = collection(db, "leagues");
      const leagueDoc = await addDoc(leaguesRef, {
        name: trimmedName,
        tagLine: trimmedTagLine || "",

        description: trimmedDesc || "",
        sport: "afl", // AFL-only

        isPublic: !!isPublic, // allow public toggle (default false)
        managerId: user.uid,

        inviteCode: code,

        // membership fields used by LeaguesClient
        memberIds: [user.uid],
        memberCount: 1,

        // stats / ranking
        avgStreak: 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ✅ Add manager as member subdoc
      const memberRef = doc(db, "leagues", leagueDoc.id, "members", user.uid);
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
          role: "manager",
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ Add this league to user's profile (optional but handy)
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          leagueIds: arrayUnion(leagueDoc.id),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setInviteCode(code);
      setLeagueId(leagueDoc.id);
    } catch (err) {
      console.error("Failed to create league", err);
      setError("Failed to create league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (leagueId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-6 py-10">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/leagues"
            className="text-xs font-extrabold text-orange-300 hover:text-orange-200"
          >
            ← Back to leagues
          </Link>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-extrabold text-emerald-200 uppercase tracking-wide">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  League created
                </div>
                <h1 className="mt-3 text-2xl font-extrabold">Nice one, Commish.</h1>
                <p className="mt-1 text-sm text-white/60">
                  Share this code with the crew. One code = one league.
                </p>
              </div>
              <SportBadge sport="afl" />
            </div>

            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-orange-200/80 font-extrabold">
                Invite code
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-2xl font-black tracking-[0.35em] text-orange-200">
                  {inviteCode ?? "—"}
                </span>

                {/* Clipboard API is best-effort (no extra imports) */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (inviteCode) await navigator.clipboard.writeText(inviteCode);
                    } catch {}
                  }}
                  className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-extrabold text-white"
                >
                  Copy code
                </button>
              </div>

              {shareLink && (
                <p className="mt-3 text-[11px] text-white/60">
                  Share link:{" "}
                  <Link
                    href={shareLink}
                    className="font-extrabold text-orange-300 hover:text-orange-200"
                  >
                    {shareLink}
                  </Link>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/leagues/${leagueId}`}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm px-5 py-3 transition"
              >
                Go to league →
              </Link>

              <Link
                href={`/leagues/${leagueId}/ladder`}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-sm px-5 py-3 transition"
              >
                View ladder
              </Link>

              <Link
                href="/picks"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-sm px-5 py-3 transition"
              >
                Make picks
              </Link>
            </div>

            <p className="text-[11px] text-white/55">
              If your mates are already logged in, tell them to paste the code in the Join page.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href="/leagues"
          className="text-xs font-extrabold text-orange-300 hover:text-orange-200"
        >
          ← Back to leagues
        </Link>

        <div className="max-w-xl rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-500/30 px-3 py-1 text-[11px] font-extrabold text-orange-200 uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                Private leagues
              </div>
              <h1 className="mt-3 text-2xl font-extrabold">Create a league</h1>
              <p className="mt-1 text-sm text-white/60">
                Name it, add a tagline if you want, and we’ll generate a unique invite code.
              </p>
            </div>
            <SportBadge sport="afl" />
          </div>

          {error && (
            <p className="text-sm text-red-300 border border-red-500/40 rounded-xl bg-red-500/10 px-4 py-3">
              {error}
            </p>
          )}

          {!user && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Log in first — then you can create your league.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-white/70">
                League name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. Thursday Night Punters"
                disabled={saving}
              />
              <p className="text-[11px] text-white/45">
                Keep it short — this shows up on the ladder.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-white/70">
                Tagline (optional)
              </label>
              <input
                type="text"
                value={tagLine}
                onChange={(e) => setTagLine(e.target.value)}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. Real STREAKrs don’t get caught."
                disabled={saving}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-white/70">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. Season-long office comp. Loser buys the first round."
                disabled={saving}
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">Public league</p>
                  <p className="text-[11px] text-white/55 mt-1">
                    Public leagues can appear in “Top public leagues this week”.
                    (You can keep private by default.)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublic((v) => !v)}
                  disabled={saving}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition ${
                    isPublic
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {isPublic ? "Public" : "Private"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !user}
              className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm px-5 py-3 transition disabled:opacity-60 disabled:hover:bg-orange-500"
            >
              {saving ? "Creating league…" : "Create league"}
            </button>
          </form>

          <p className="text-[11px] text-white/45">
            AFL-only right now. Your league ladder is separate, but your streak still counts globally.
          </p>
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
