// app/leagues/[leagueId]/ladder/page.tsx
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

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = params?.leagueId as string;
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
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;

        const managerId: string = data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string = data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed league",
          inviteCode,
          managerId,
          description: data.description ?? "",
        };

        setLeague(leagueData);

        // Members
        const membersRef = collection(db, "leagues", leagueId, "members");
        const membersQ = query(membersRef, orderBy("joinedAt", "asc"), limit(300));
        const membersSnap = await getDocs(membersQ);

        const members: MemberDoc[] = membersSnap.docs.map((d) => d.data() as any);

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
              normalizeUsername(m.username) ||
              normalizeUsername(profile?.username);

            const avatar =
              m.avatarUrl ||
              m.photoURL ||
              profile?.avatarUrl ||
              profile?.photoURL ||
              undefined;

            const current = safeNum(profile?.currentStreak, 0);

            const uiRole: "admin" | "member" =
              leagueData.managerId && m.uid === leagueData.managerId ? "admin" : "member";

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

        // Rank by current streak desc (ties keep stable)
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

  if (loading) {
    return (
      <div className="py-4 md:py-6">
        <p className="text-sm text-white/70">Loading ladder…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-4 md:py-6 space-y-4">
        <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to leagues
        </Link>
        <p className="text-sm text-red-400">{error ?? "League not found."}</p>
      </div>
    );
  }

  return (
    <div className="py-6 md:py-8 space-y-6">
      <Link href={`/leagues/${leagueId}`} className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to league
      </Link>

      {/* Title: "GroupName Ladder" same font size as Ladder */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold">{league.name} Ladder</h1>
          <SportBadge sport="afl" />
        </div>
        <p className="text-sm text-white/70 max-w-3xl">
          Bragging rights only. (Your global streak still counts on the main leaderboard.)
        </p>
      </div>

      {/* Your position card */}
      {myRow && (
        <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 md:p-5">
          <div className="text-[11px] uppercase tracking-wide text-orange-200/80 mb-2">
            Your position
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-full bg-black/20 border border-white/10 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {myRow.avatar ? (
                  <img src={myRow.avatar} alt={myRow.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">{myRow.name}</span>
                  {myRow.username && <span className="text-xs text-white/60 truncate">{myRow.username}</span>}
                  <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                    You
                  </span>
                </div>
                <div className="text-xs text-white/70 mt-0.5">
                  Current streak: <span className="font-semibold text-white">{myRow.current}</span>
                  <span className="text-white/40"> • </span>
                  Role: <span className="font-semibold text-white">{myRow.uiRole === "admin" ? "Admin" : "Member"}</span>
                </div>
              </div>
            </div>

            <Link
              href="/picks"
              className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors shrink-0"
            >
              Make picks →
            </Link>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold">League ladder</h2>
          <div className="text-[11px] text-white/60">
            Ranking: <span className="text-white/80">Current</span>
          </div>
        </div>

        <div className="overflow-x-auto">
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
                const showCrown = r.current > 0 && rank === 1;

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
                        <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.avatar ? <img src={r.avatar} alt={r.name} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{r.name}</span>
                            {r.username && <span className="text-xs text-white/50 truncate">{r.username}</span>}
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
                      <span className="font-semibold">{r.current}</span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                        {r.uiRole === "admin" ? "Admin" : "Member"}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/60">
                    No members found for this league.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
