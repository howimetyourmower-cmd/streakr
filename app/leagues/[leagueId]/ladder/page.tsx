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
  limit,
  onSnapshot,
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
  memberCount?: number;
};

type MemberRow = {
  uid: string;
  displayName: string;
  role: "manager" | "member";
  joinedAt?: any;
};

type Scope =
  | "overall"
  | "opening-round"
  | "round-1"
  | "round-2"
  | "round-3"
  | "round-4"
  | "round-5"
  | "round-6"
  | "round-7"
  | "round-8"
  | "round-9"
  | "round-10"
  | "round-11"
  | "round-12"
  | "round-13"
  | "round-14"
  | "round-15"
  | "round-16"
  | "round-17"
  | "round-18"
  | "round-19"
  | "round-20"
  | "round-21"
  | "round-22"
  | "round-23"
  | "finals";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: any | null;
};

type LadderRow = {
  rank: number;
  uid: string;
  role: "manager" | "member";
  displayName: string;
  username?: string;
  avatarUrl?: string;

  currentStreak: number;
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

function initials(name: string) {
  const parts = (name || "P").trim().split(/\s+/).slice(0, 2);
  const a = parts[0]?.[0] ?? "P";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function formatWinPct(p: number): string {
  if (!p || p <= 0) return ".000";
  return p.toFixed(3).replace(/^0/, "");
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = (params?.leagueId as string) || "";
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [lbEntries, setLbEntries] = useState<LeaderboardEntry[]>([]);

  // Load league doc
  useEffect(() => {
    const load = async () => {
      if (!leagueId) return;

      setLoading(true);
      setError(null);

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const snap = await getDoc(leagueRef);

        if (!snap.exists()) {
          setLeague(null);
          setError("League not found.");
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        setLeague({
          id: snap.id,
          name: data.name ?? "Unnamed league",
          inviteCode,
          managerId,
          description: data.description ?? "",
          memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
        });
      } catch (e) {
        console.error("Failed to load league", e);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leagueId]);

  // Live members list
  useEffect(() => {
    if (!leagueId) return;

    setMembersLoading(true);

    const membersRef = collection(db, "leagues", leagueId, "members");
    const qRef = query(membersRef, orderBy("joinedAt", "asc"), limit(300));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: MemberRow[] = snap.docs.map((d) => {
          const m = d.data() as any;
          const uid = (m.uid ?? d.id) as string;
          return {
            uid,
            displayName: m.displayName ?? "Player",
            role: (m.role as "manager" | "member") ?? "member",
            joinedAt: m.joinedAt,
          };
        });
        setMembers(list);
        setMembersLoading(false);
      },
      (err) => {
        console.error("Failed to load members", err);
        setMembersLoading(false);
        setError("Failed to load league members.");
      }
    );

    return () => unsub();
  }, [leagueId]);

  // Membership gate
  const isMemberUser = useMemo(() => {
    if (!user) return false;
    if (!league) return false;
    if (user.uid === league.managerId) return true;
    return members.some((m) => m.uid === user.uid);
  }, [user, league, members]);

  // Load global leaderboard entries (same API as /app/leaderboards)
  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!user) {
        // If not logged in, still try without auth (API might allow public)
        // but the ladder itself is gated anyway.
      }

      // Only bother fetching if the user can actually view it
      if (!isMemberUser) return;

      setLbLoading(true);
      setLbError(null);

      try {
        let authHeader: Record<string, string> = {};

        if (user) {
          try {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          } catch (err) {
            console.error("Failed to get ID token for league ladder", err);
          }
        }

        const res = await fetch(`/api/leaderboard?scope=overall` as any, {
          headers: {
            ...authHeader,
          },
        });

        if (!res.ok) {
          console.error("Leaderboard API error:", await res.text());
          throw new Error("Failed to load leaderboard");
        }

        const data: LeaderboardApiResponse = await res.json();
        setLbEntries(data.entries || []);
      } catch (e) {
        console.error(e);
        setLbError("Could not load league ladder stats right now.");
        setLbEntries([]);
      } finally {
        setLbLoading(false);
      }
    };

    loadLeaderboard();
  }, [user, isMemberUser]);

  const inviteJoinLink = useMemo(() => {
    if (!league?.inviteCode) return "";
    // your join page supports ?code=
    return `${typeof window !== "undefined" ? window.location.origin : ""}/leagues/join?code=${league.inviteCode}`;
  }, [league?.inviteCode]);

  // Build ladder rows by intersecting league members with global leaderboard API results
  const ladderRows: LadderRow[] = useMemo(() => {
    const memberUidSet = new Set(members.map((m) => m.uid));

    const byUid = new Map<string, LeaderboardEntry>();
    lbEntries.forEach((e) => byUid.set(e.uid, e));

    const rows: LadderRow[] = members.map((m) => {
      const e = byUid.get(m.uid);

      const usernameRaw = e?.username ? String(e.username).trim() : "";
      const username = usernameRaw
        ? usernameRaw.startsWith("@")
          ? usernameRaw
          : `@${usernameRaw}`
        : undefined;

      return {
        rank: 9999,
        uid: m.uid,
        role: m.role,
        displayName: e?.displayName ?? m.displayName ?? "Player",
        username,
        avatarUrl: e?.avatarUrl,

        currentStreak: e?.currentStreak ?? 0,
        totalWins: e?.totalWins ?? 0,
        totalLosses: e?.totalLosses ?? 0,
        winPct: e?.winPct ?? 0,
      };
    });

    // Sort like the leaderboard: currentStreak desc, then winPct desc, then wins desc
    rows.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return a.displayName.localeCompare(b.displayName);
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [members, lbEntries]);

  const myRow = useMemo(() => {
    if (!user) return null;
    return ladderRows.find((r) => r.uid === user.uid) ?? null;
  }, [ladderRows, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
          <p className="text-sm text-white/70">Loading ladder…</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10 space-y-4">
          <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to leagues
          </Link>
          <p className="text-sm text-red-400">
            {error ?? "League not found or no longer available."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/leagues/${leagueId}`} className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to league
          </Link>
          <SportBadge sport="afl" />
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Ladder</h1>
            <p className="mt-1 text-sm text-white/70">
              <span className="font-semibold text-white">{league.name}</span> — bragging rights only.
              (Your global streak still counts on the main leaderboard.)
            </p>
          </div>

          {/* Invite / share area (compact) */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/60">Code</span>
              <span className="font-mono text-[12px] bg-white/5 border border-white/10 rounded-md px-2 py-1 max-w-[110px] truncate">
                {league.inviteCode || "—"}
              </span>
              <button
                type="button"
                onClick={() => league.inviteCode && navigator.clipboard.writeText(league.inviteCode)}
                className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-60"
                disabled={!league.inviteCode}
              >
                Copy
              </button>
            </div>

            {league.inviteCode && (
              <a
                href={inviteJoinLink}
                className="text-[11px] text-white/50 hover:text-white/70 truncate max-w-[320px]"
              >
                Join link: <span className="text-orange-300">{inviteJoinLink}</span>
              </a>
            )}

            <span className="text-xs text-white/60">
              Members: {league.memberCount ?? members.length}
              {membersLoading ? " • loading…" : ""}
              {lbLoading ? " • updating streaks…" : ""}
            </span>
          </div>
        </div>

        {/* Gates */}
        {!user && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Log in to view this ladder.
          </div>
        )}

        {user && !isMemberUser && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
            <p className="text-sm text-white/80 font-semibold">Private ladder</p>
            <p className="text-sm text-white/60">
              You’re not a member of this league, so you can’t view the ladder.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/leagues/join"
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2"
              >
                Join a league →
              </Link>
              <Link
                href="/leagues"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2"
              >
                Back to leagues
              </Link>
            </div>
          </div>
        )}

        {user && isMemberUser && (
          <>
            {(error || lbError) && (
              <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                {error ?? lbError}
              </p>
            )}

            {/* My position */}
            {myRow && (
              <div className="rounded-2xl border border-orange-500/35 bg-orange-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-orange-200/80">
                  Your position
                </p>

                <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                      {myRow.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={myRow.avatarUrl}
                          alt={myRow.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-white/80">
                          {initials(myRow.displayName)}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-lg font-bold">
                        #{myRow.rank}{" "}
                        <span className="text-white/90">{myRow.displayName}</span>
                        {myRow.username && (
                          <span className="ml-2 text-sm font-semibold text-white/50">
                            {myRow.username}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/60">
                        Current streak:{" "}
                        <span className="text-white font-semibold">{myRow.currentStreak}</span>{" "}
                        • W/L:{" "}
                        <span className="text-white font-semibold">
                          {myRow.totalWins}/{myRow.totalLosses}
                        </span>{" "}
                        • Win %:{" "}
                        <span className="text-white font-semibold font-mono">
                          {formatWinPct(myRow.winPct)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/picks"
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2"
                  >
                    Make picks →
                  </Link>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="rounded-2xl bg-[#020617] border border-slate-800 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
                <h2 className="text-sm font-semibold">League ladder</h2>
                <p className="text-[11px] text-white/50">
                  Sorted by current streak (same as main leaderboard)
                </p>
              </div>

              {ladderRows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-white/70">
                  No members found yet. Share the invite code and get the crew in.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/20 text-white/60">
                      <tr className="text-left">
                        <th className="px-4 py-2 w-[70px]">Rank</th>
                        <th className="px-4 py-2 min-w-[280px]">Player</th>
                        <th className="px-4 py-2 w-[140px]">Current</th>
                        <th className="px-4 py-2 w-[120px]">Wins</th>
                        <th className="px-4 py-2 w-[120px]">Losses</th>
                        <th className="px-4 py-2 w-[120px]">Win %</th>
                        <th className="px-4 py-2 w-[120px]">Role</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ladderRows.map((r) => {
                        const isOwn = !!user && r.uid === user.uid;

                        return (
                          <tr
                            key={r.uid}
                            className={`border-t border-white/10 ${
                              isOwn ? "bg-orange-500/10" : "hover:bg-white/5"
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">#{r.rank}</td>

                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                  {r.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={r.avatarUrl}
                                      alt={r.displayName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-white/80">
                                      {initials(r.displayName)}
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-semibold truncate">{r.displayName}</span>
                                    {r.username && (
                                      <span className="text-xs text-white/45 font-semibold truncate">
                                        {r.username}
                                      </span>
                                    )}
                                    {isOwn && (
                                      <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                                        You
                                      </span>
                                    )}
                                  </div>

                                  {/* UID line (small + muted) */}
                                  <p className="text-[11px] text-white/35 truncate max-w-[420px]">
                                    {r.uid}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-bold text-orange-200">
                              {r.currentStreak}
                            </td>

                            <td className="px-4 py-3 text-white/80 font-semibold">
                              {r.totalWins}
                            </td>

                            <td className="px-4 py-3 text-white/80 font-semibold">
                              {r.totalLosses}
                            </td>

                            <td className="px-4 py-3 text-emerald-300 font-mono font-semibold">
                              {formatWinPct(r.winPct)}
                            </td>

                            <td className="px-4 py-3">
                              <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                                {r.role === "manager" ? "Manager" : "Member"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/50">
                League ladder uses the same source as{" "}
                <span className="font-mono text-white/70">/app/leaderboards</span>{" "}
                (via <span className="font-mono text-white/70">/api/leaderboard</span>),
                then filters to league members — so streaks will always match.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
