// app/leagues/[leagueId]/ladder/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  description?: string;
};

type MemberDoc = {
  uid: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  photoURL?: string;
  role?: "manager" | "member";
};

type UserProfile = {
  displayName?: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  photoURL?: string;
  currentStreak?: number;
};

type Row = {
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
  current: number;
  uiRole: "admin" | "member";
};

function safeTrim(s: any): string {
  return typeof s === "string" ? s.trim() : "";
}
function normalizeUsername(raw: any): string | undefined {
  const t = safeTrim(raw);
  if (!t) return undefined;
  return t.startsWith("@") ? t : `@${t}`;
}
function safeNum(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function initialLetter(name: string) {
  const t = safeTrim(name);
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = params?.leagueId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const myUid = user?.uid;

  useEffect(() => {
    const load = async () => {
      if (!leagueId) return;

      setLoading(true);
      setError(null);

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setLeague(null);
          setRows([]);
          setError("Locker Room not found.");
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;

        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed room",
          inviteCode,
          managerId,
          description: data.description ?? "",
        };

        setLeague(leagueData);

        // Members
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersQ = query(
          membersRef,
          orderBy("joinedAt", "asc"),
          limit(300)
        );
        const membersSnap = await getDocs(membersQ);

        const members: MemberDoc[] = membersSnap.docs
          .map((d) => d.data() as any)
          .filter((m) => !!m?.uid);

        // Ensure manager row exists even if not in subcollection
        if (
          leagueData.managerId &&
          !members.some((m) => m.uid === leagueData.managerId)
        ) {
          members.unshift({
            uid: leagueData.managerId,
            role: "manager",
          });
        }

        // Build rows by enriching from users/{uid} for display + current streak
        const built: Row[] = await Promise.all(
          members.map(async (m) => {
            let profile: UserProfile | null = null;
            try {
              const uSnap = await getDoc(doc(db, "users", m.uid));
              profile = uSnap.exists() ? (uSnap.data() as any) : null;
            } catch {
              profile = null;
            }

            const name =
              safeTrim(m.displayName) ||
              safeTrim(profile?.displayName) ||
              safeTrim(profile?.name) ||
              "Player";

            const username =
              normalizeUsername(m.username) || normalizeUsername(profile?.username);

            const avatar =
              safeTrim(m.avatarUrl) ||
              safeTrim(m.photoURL) ||
              safeTrim(profile?.avatarUrl) ||
              safeTrim(profile?.photoURL) ||
              undefined;

            const current = safeNum(profile?.currentStreak, 0);

            // UI role: managerId always wins
            const uiRole: "admin" | "member" =
              leagueData.managerId && m.uid === leagueData.managerId
                ? "admin"
                : "member";

            return {
              uid: m.uid,
              name,
              username,
              avatar,
              current,
              uiRole,
            };
          })
        );

        // Rank by current streak desc (ties stable)
        const sorted = [...built].sort((a, b) => {
          if (b.current !== a.current) return b.current - a.current;
          return a.name.localeCompare(b.name);
        });

        setRows(sorted);
      } catch (e) {
        console.error(e);
        setError("Failed to load ladder.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leagueId]);

  const myRow = useMemo(() => {
    if (!myUid) return null;
    return rows.find((r) => r.uid === myUid) ?? null;
  }, [rows, myUid]);

  const leaderHasStreak = rows.length ? rows[0].current > 0 : false;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
          <p className="text-sm text-white/70">Loading ladder…</p>
        </div>
      </main>
    );
  }

  if (!league) {
    return (
      <main className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8 space-y-4">
          <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to locker rooms
          </Link>
          <p className="text-sm text-red-400">{error ?? "Room not found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to room
          </Link>

          <button
            type="button"
            onClick={() => router.push("/picks")}
            className="hidden sm:inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm px-4 py-2 transition-colors shrink-0"
          >
            Make picks →
          </button>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold truncate">
                {league.name} Ladder
              </h1>
              <SportBadge sport="afl" />
            </div>
            <p className="mt-2 text-sm text-white/70 max-w-3xl">
              Locker Room ladder — bragging rights only. Your global streak still counts on
              the main leaderboard.
            </p>
          </div>

          <Link
            href="/picks"
            className="sm:hidden inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-sm px-4 py-2 transition-colors shrink-0"
          >
            Make picks →
          </Link>
        </div>

        {/* Your position */}
        {myRow && (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 md:p-5">
            <div className="text-[11px] uppercase tracking-wide text-orange-200/80 mb-2">
              Your position
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-full bg-black/20 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {myRow.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={myRow.avatar}
                      alt={myRow.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-white/70 font-semibold">
                      {initialLetter(myRow.name)}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-semibold truncate">{myRow.name}</span>
                    {myRow.username && (
                      <span className="text-xs text-white/60 truncate">
                        {myRow.username}
                      </span>
                    )}
                    <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                      You
                    </span>
                    <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-white/15 text-white/75 bg-white/5">
                      {myRow.uiRole === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>

                  <div className="text-xs text-white/70 mt-1">
                    Current streak:{" "}
                    <span className="font-semibold text-white">{myRow.current}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ladder */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Room ladder</h2>
            <div className="text-[11px] text-white/60">
              Ranking: <span className="text-white/80">Current</span>
            </div>
          </div>

          {/* Desktop/tablet */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/20">
                <tr className="text-left text-xs text-white/60">
                  <th className="px-4 py-3 w-[90px]">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 w-[160px] text-right">Current</th>
                  <th className="px-4 py-3 w-[140px] text-right">Role</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const rank = idx + 1;
                  const isMe = !!myUid && r.uid === myUid;
                  const showCrown = leaderHasStreak && rank === 1;

                  return (
                    <tr
                      key={r.uid}
                      className={`border-t border-white/10 ${
                        isMe ? "bg-white/5" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{rank}</span>
                          {showCrown && <span title="Leader">👑</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {r.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.avatar}
                                alt={r.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-white/60 text-xs font-semibold">
                                {initialLetter(r.name)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="font-medium truncate">{r.name}</span>
                              {r.username && (
                                <span className="text-xs text-white/50 truncate">
                                  {r.username}
                                </span>
                              )}
                              {isMe && (
                                <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-center rounded-full bg-orange-500/15 border border-orange-500/35 text-orange-200 px-3 py-1 text-xs font-semibold">
                          {r.current}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70 bg-white/5">
                          {r.uiRole === "admin" ? "Admin" : "Member"}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/60">
                      No members found for this room.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden p-3 space-y-2">
            {rows.map((r, idx) => {
              const rank = idx + 1;
              const isMe = !!myUid && r.uid === myUid;
              const showCrown = leaderHasStreak && rank === 1;

              return (
                <div
                  key={r.uid}
                  className={`rounded-xl border border-white/10 bg-black/20 p-3 ${
                    isMe ? "ring-1 ring-orange-500/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 text-white/80 font-semibold">
                        #{rank} {showCrown ? "👑" : ""}
                      </div>

                      <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {r.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.avatar}
                            alt={r.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-white/60 text-sm font-semibold">
                            {initialLetter(r.name)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold truncate">{r.name}</div>
                          {r.username && (
                            <div className="text-xs text-white/60 truncate">
                              {r.username}
                            </div>
                          )}
                          {isMe && (
                            <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70 bg-white/5">
                            {r.uiRole === "admin" ? "Admin" : "Member"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-white/60">Current</div>
                      <div className="inline-flex items-center justify-center rounded-full bg-orange-500/15 border border-orange-500/35 text-orange-200 px-3 py-1 text-xs font-semibold">
                        {r.current}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="text-center text-sm text-white/60 py-6">
                No members found for this room.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
