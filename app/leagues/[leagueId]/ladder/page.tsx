// /app/leagues/[leagueId]/ladder/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
};

type MemberDoc = {
  uid: string;
  displayName?: string;
  role?: "manager" | "member";
};

type UserProfile = {
  uid: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  photoURL?: string;
  photoUrl?: string;
  bestStreak?: number;
  currentStreak?: number;
  accuracy?: number; // 0..1 or 0..100 (we’ll handle both)
};

type LadderRow = {
  uid: string;
  name: string;
  username?: string;
  avatar?: string | null;
  uiRole: "admin" | "member";
  bestStreak: number;
  currentStreak: number;
  accuracy: number | null; // 0..1
};

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAccuracy(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // support either 0..1 or 0..100
  if (n > 1.0001) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function formatAccuracy(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = !!user;

  const myRow = useMemo(() => {
    if (!user) return null;
    return rows.find((r) => r.uid === user.uid) ?? null;
  }, [rows, user]);

  useEffect(() => {
    const run = async () => {
      if (!leagueId) return;

      setLoading(true);
      setError(null);

      try {
        // 1) Load league
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setLeague(null);
          setRows([]);
          setError("League not found.");
          setLoading(false);
          return;
        }

        const ld = leagueSnap.data() as any;

        const managerId: string =
          ld.managerId ?? ld.managerUid ?? ld.managerUID ?? "";
        const inviteCode: string =
          ld.inviteCode ?? ld.code ?? ld.leagueCode ?? "";

        const leagueObj: League = {
          id: leagueSnap.id,
          name: ld.name ?? "Unnamed league",
          inviteCode,
          managerId,
        };
        setLeague(leagueObj);

        // 2) Load members
        const membersRef = collection(leagueRef, "members");
        const membersQ = query(membersRef, orderBy("joinedAt", "asc"), limit(500));
        const membersSnap = await getDocs(membersQ);

        const members: MemberDoc[] = membersSnap.docs.map((d) => {
          const m = d.data() as any;
          return {
            uid: m.uid ?? d.id,
            displayName: m.displayName,
            role: m.role,
          };
        });

        // 3) Load user profiles for those member uids (batched in chunks of 10 for Firestore)
        const uids = Array.from(new Set(members.map((m) => m.uid).filter(Boolean)));

        const profilesByUid = new Map<string, UserProfile>();

        const chunkSize = 10;
        for (let i = 0; i < uids.length; i += chunkSize) {
          const chunk = uids.slice(i, i + chunkSize);

          // Firestore “in” query (chunked)
          const usersRef = collection(db, "users");
          const qUsers = query(usersRef as any, (await import("firebase/firestore")).where("uid", "in", chunk));
          const usersSnap = await getDocs(qUsers);

          usersSnap.docs.forEach((ud) => {
            const p = ud.data() as any;
            const uid = (p.uid ?? ud.id) as string;
            profilesByUid.set(uid, {
              uid,
              displayName: p.displayName ?? p.name,
              username: p.username,
              avatarUrl: p.avatarUrl,
              photoURL: p.photoURL,
              photoUrl: p.photoUrl,
              bestStreak: p.bestStreak,
              currentStreak: p.currentStreak,
              accuracy: p.accuracy,
            });
          });

          // Fallback: if your users collection doesn’t store uid field and uses docId = uid,
          // make sure we still try to read direct doc ids for anything missing.
          const missing = chunk.filter((uid) => !profilesByUid.has(uid));
          for (const uid of missing) {
            const uRef = doc(db, "users", uid);
            const uSnap = await getDoc(uRef);
            if (uSnap.exists()) {
              const p = uSnap.data() as any;
              profilesByUid.set(uid, {
                uid,
                displayName: p.displayName ?? p.name,
                username: p.username,
                avatarUrl: p.avatarUrl,
                photoURL: p.photoURL,
                photoUrl: p.photoUrl,
                bestStreak: p.bestStreak,
                currentStreak: p.currentStreak,
                accuracy: p.accuracy,
              });
            }
          }
        }

        // 4) Build ladder rows
        const built: LadderRow[] = members.map((m) => {
          const p = profilesByUid.get(m.uid);

          const usernameRaw = (p?.username || "").trim();
          const username =
            usernameRaw.length > 0
              ? usernameRaw.startsWith("@")
                ? usernameRaw
                : `@${usernameRaw}`
              : undefined;

          const avatar =
            p?.avatarUrl ||
            p?.photoURL ||
            p?.photoUrl ||
            null;

          // ✅ UI role: managerId always wins (don’t trust stored role for display)
          const uiRole: "admin" | "member" =
            m.uid === leagueObj.managerId ? "admin" : "member";

          const name =
            (p?.displayName || m.displayName || "Player").toString();

          const bestStreak = safeNum(p?.bestStreak, 0);
          const currentStreak = safeNum(p?.currentStreak, 0);
          const acc = normalizeAccuracy(p?.accuracy);

          return {
            uid: m.uid,
            name,
            username,
            avatar,
            uiRole,
            bestStreak,
            currentStreak,
            accuracy: acc,
          };
        });

        // 5) Sort by Current desc, then Best desc, then Accuracy desc, then name
        built.sort((a, b) => {
          if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
          if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;

          const aAcc = a.accuracy ?? -1;
          const bAcc = b.accuracy ?? -1;
          if (bAcc !== aAcc) return bAcc - aAcc;

          return a.name.localeCompare(b.name);
        });

        setRows(built);
      } catch (e) {
        console.error("Failed to load league ladder", e);
        setError("Failed to load ladder. Please try again.");
        setLeague(null);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [leagueId]);

  const renderAvatar = (row: LadderRow) => {
    if (row.avatar) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={row.avatar}
          alt={row.name}
          className="h-10 w-10 rounded-full object-cover border border-white/10"
        />
      );
    }
    return (
      <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs text-white/70">
        {row.name?.slice(0, 1)?.toUpperCase() ?? "P"}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white px-4 py-6">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-sm text-white/70">Loading ladder…</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-[#050814] text-white px-4 py-6">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to leagues
          </Link>
          <p className="text-sm text-red-400">{error ?? "League not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white px-4 py-6 md:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Link href={`/leagues/${league.id}`} className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to league
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight">
              {league.name} Ladder
            </h1>
            <p className="text-sm text-white/70">
              Bragging rights only. (Your global streak still counts on the main leaderboard.)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SportBadge sport="afl" />
            <div className="flex flex-col items-end gap-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Invite</span>
                <span className="font-mono rounded-md bg-white/5 border border-white/10 px-2 py-1">
                  {league.inviteCode || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => league.inviteCode && navigator.clipboard.writeText(league.inviteCode)}
                  className="text-sky-400 hover:text-sky-300 disabled:opacity-60"
                  disabled={!league.inviteCode}
                >
                  Copy
                </button>
              </div>
              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2"
              >
                Make picks →
              </Link>
            </div>
          </div>
        </div>

        {/* Your position */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
              Your position
            </h2>
            {!isLoggedIn && (
              <span className="text-xs text-white/50">Log in to see your rank.</span>
            )}
          </div>

          {user && myRow ? (
            <div className="flex items-center gap-3 rounded-xl bg-black/25 border border-white/10 px-4 py-3">
              {renderAvatar(myRow)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold truncate">{myRow.name}</span>
                  {myRow.username && (
                    <span className="text-sm text-white/60 truncate">{myRow.username}</span>
                  )}
                  <span className="ml-auto text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-orange-500/40 text-orange-300 bg-white/5">
                    YOU
                  </span>
                </div>

                <div className="mt-1 text-xs text-white/70 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Current: <span className="text-white font-semibold">{myRow.currentStreak}</span></span>
                  <span>Best: <span className="text-white font-semibold">{myRow.bestStreak}</span></span>
                  <span>Accuracy: <span className="text-white font-semibold">{formatAccuracy(myRow.accuracy)}</span></span>
                  <span className="text-white/50">•</span>
                  <span className="text-white/70">
                    Role:{" "}
                    <span className="text-white font-semibold">
                      {myRow.uiRole === "admin" ? "Admin" : "Member"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70">
              {user ? "You’re not in this league." : "Log in to see your position."}
            </p>
          )}
        </div>

        {/* Ladder table */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">League ladder</h2>
            <span className="text-xs text-white/60">
              Ranking: Current → Best → Accuracy
            </span>
          </div>

          {error && (
            <div className="px-5 pb-4">
              <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                {error}
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/20 border-t border-white/10">
                <tr className="text-white/70">
                  <th className="text-left px-5 py-3 w-[80px]">Rank</th>
                  <th className="text-left px-5 py-3">Player</th>
                  <th className="text-center px-5 py-3 w-[110px]">Best</th>
                  <th className="text-center px-5 py-3 w-[120px]">Current</th>
                  <th className="text-center px-5 py-3 w-[140px]">Accuracy</th>
                  <th className="text-center px-5 py-3 w-[120px]">Role</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-white/60">
                      No members yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => {
                    const isMe = !!user && r.uid === user.uid;

                    return (
                      <tr
                        key={r.uid}
                        className={`border-t border-white/10 ${
                          isMe ? "bg-white/5" : "bg-transparent"
                        }`}
                      >
                        <td className="px-5 py-4 font-semibold">
                          {idx === 0 ? (
                            <span className="inline-flex items-center gap-2">
                              <span>1</span>
                              <span title="Top of the ladder" className="text-orange-300">👑</span>
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-[260px]">
                            {renderAvatar(r)}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">{r.name}</span>
                                {r.username && (
                                  <span className="text-white/60 truncate">{r.username}</span>
                                )}
                                {isMe && (
                                  <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-orange-500/40 text-orange-300 bg-white/5">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center font-semibold">
                          {r.bestStreak}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold">
                          {r.currentStreak}
                        </td>

                        <td className="px-5 py-4 text-center font-semibold">
                          {formatAccuracy(r.accuracy)}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold border ${
                              r.uiRole === "admin"
                                ? "border-orange-500/40 text-orange-300 bg-orange-500/10"
                                : "border-white/15 text-white/70 bg-white/5"
                            }`}
                          >
                            {r.uiRole === "admin" ? "ADMIN" : "MEMBER"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-white/10 text-xs text-white/50">
            Tip: If streaks look wrong, make sure you are writing <span className="font-mono text-white/70">currentStreak</span> and{" "}
            <span className="font-mono text-white/70">bestStreak</span> to <span className="font-mono text-white/70">users/{`{uid}`}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
