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

type MemberRow = {
  id: string;
  uid: string;
  displayName: string;
  role: "manager" | "member";
  joinedAt?: any;
  // Ladder stats (optional / future-friendly)
  bestStreak?: number;
  currentStreak?: number;
  correctPicks?: number;
  totalPicks?: number;
};

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  description?: string;
  memberCount?: number;
};

function safeNum(v: any, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = (params?.leagueId as string) || "";
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isManager = !!user && !!league && user.uid === league.managerId;

  // --- Load league doc ---
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

        // support old+new schema
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

  // --- Live members (subcollection) ---
  useEffect(() => {
    if (!leagueId) return;

    const membersRef = collection(db, "leagues", leagueId, "members");
    const qRef = query(membersRef, orderBy("joinedAt", "asc"), limit(300));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: MemberRow[] = snap.docs.map((d) => {
          const m = d.data() as any;
          return {
            id: d.id,
            uid: m.uid ?? d.id,
            displayName: m.displayName ?? "Player",
            role: (m.role as "manager" | "member") ?? "member",
            joinedAt: m.joinedAt,
            bestStreak: safeNum(m.bestStreak, 0),
            currentStreak: safeNum(m.currentStreak, 0),
            correctPicks: safeNum(m.correctPicks, 0),
            totalPicks: safeNum(m.totalPicks, 0),
          };
        });

        setMembers(list);
      },
      (err) => {
        console.error("Failed to load members", err);
        setError("Failed to load league members.");
      }
    );

    return () => unsub();
  }, [leagueId]);

  // --- Membership gate (ladder should only be visible to members) ---
  const isMemberUser = useMemo(() => {
    if (!user) return false;
    if (!league) return false;
    if (user.uid === league.managerId) return true;
    return members.some((m) => m.uid === user.uid);
  }, [user, league, members]);

  // --- Build ladder ranking ---
  const ladder = useMemo(() => {
    // For MVP: rank by bestStreak, then currentStreak, then correctPicks
    const sorted = [...members].sort((a, b) => {
      const aBest = safeNum(a.bestStreak, 0);
      const bBest = safeNum(b.bestStreak, 0);
      if (bBest !== aBest) return bBest - aBest;

      const aCur = safeNum(a.currentStreak, 0);
      const bCur = safeNum(b.currentStreak, 0);
      if (bCur !== aCur) return bCur - aCur;

      const aCorrect = safeNum(a.correctPicks, 0);
      const bCorrect = safeNum(b.correctPicks, 0);
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;

      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    return sorted.map((m, idx) => ({
      ...m,
      rank: idx + 1,
    }));
  }, [members]);

  const myRow = useMemo(() => {
    if (!user) return null;
    return ladder.find((m) => m.uid === user.uid) ?? null;
  }, [ladder, user]);

  const formatRatio = (correct?: number, total?: number) => {
    const c = safeNum(correct, 0);
    const t = safeNum(total, 0);
    if (t <= 0) return "—";
    const pct = Math.round((c / t) * 100);
    return `${c}/${t} (${pct}%)`;
  };

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

          <div className="flex items-center gap-2">
            <SportBadge sport="afl" />
          </div>
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

          {/* Compact invite code (reduced width) */}
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/60">Invite code</span>
              <span className="font-mono text-[12px] bg-white/5 border border-white/10 rounded-md px-2 py-1 max-w-[120px] truncate">
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

            <span className="text-xs text-white/60">
              Members: {league.memberCount ?? members.length}
              {isManager ? " • You’re manager" : ""}
            </span>
          </div>
        </div>

        {/* Access gate */}
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
            {/* My row */}
            {myRow && (
              <div className="rounded-2xl border border-orange-500/35 bg-orange-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-orange-200/80">
                  Your position
                </p>
                <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">
                      #{myRow.rank}{" "}
                      <span className="text-white/80 font-semibold">{myRow.displayName}</span>
                    </p>
                    <p className="text-xs text-white/60">
                      Best streak:{" "}
                      <span className="text-white font-semibold">{safeNum(myRow.bestStreak, 0)}</span>{" "}
                      • Current:{" "}
                      <span className="text-white font-semibold">{safeNum(myRow.currentStreak, 0)}</span>{" "}
                      • Accuracy:{" "}
                      <span className="text-white font-semibold">
                        {formatRatio(myRow.correctPicks, myRow.totalPicks)}
                      </span>
                    </p>
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
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                <h2 className="text-sm font-semibold">League ladder</h2>
                <p className="text-[11px] text-white/50">
                  Ranking: Best streak → Current streak → Correct picks
                </p>
              </div>

              {error && (
                <div className="px-4 py-3">
                  <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                    {error}
                  </p>
                </div>
              )}

              {ladder.length === 0 ? (
                <div className="px-4 py-6">
                  <p className="text-sm text-white/60">
                    No members found yet. Share the invite code and get the crew in.
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-black/20 text-white/60">
                      <tr className="text-left">
                        <th className="px-4 py-2 w-[64px]">Rank</th>
                        <th className="px-4 py-2 min-w-[220px]">Player</th>
                        <th className="px-4 py-2 w-[110px]">Best</th>
                        <th className="px-4 py-2 w-[110px]">Current</th>
                        <th className="px-4 py-2 w-[160px]">Accuracy</th>
                        <th className="px-4 py-2 w-[110px]">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladder.map((m) => {
                        const isOwn = !!user && m.uid === user.uid;
                        return (
                          <tr
                            key={m.id}
                            className={`border-t border-white/10 ${
                              isOwn ? "bg-orange-500/10" : "hover:bg-white/5"
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">
                              #{m.rank}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{m.displayName}</span>
                                {isOwn && (
                                  <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-white/45 truncate max-w-[360px]">
                                {m.uid}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-bold text-orange-200">
                              {safeNum(m.bestStreak, 0)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-white/80">
                              {safeNum(m.currentStreak, 0)}
                            </td>
                            <td className="px-4 py-3 text-white/70">
                              {formatRatio(m.correctPicks, m.totalPicks)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                                {m.role === "manager" ? "Manager" : "Member"}
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
                Ladder stats are ready for your next step: write each player’s best/current streak +
                accuracy into <span className="font-mono text-white/70">leagues/{leagueId}/members/{`{uid}`}</span>.
              </div>
            </div>

            {/* Footer links */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/leagues/${leagueId}`}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2"
              >
                Back to league →
              </Link>
              <Link
                href="/leagues"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm px-4 py-2"
              >
                All leagues
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
