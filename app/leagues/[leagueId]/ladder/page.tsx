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

// eslint-disable-next-line @next/next/no-img-element
type MemberRow = {
  id: string;
  uid: string;
  displayName: string;
  role: "manager" | "member";
  joinedAt?: any;
};

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  description?: string;
  memberCount?: number;
};

type UserProfile = {
  uid: string;
  displayName?: string;
  username?: string; // @handle
  photoURL?: string;
  avatarUrl?: string;

  currentStreak?: number;
  bestStreak?: number;
  correctPicks?: number;
  totalPicks?: number;
};

type LadderRow = {
  rank: number;
  uid: string;

  // stored role from members collection (may be wrong / stale)
  storedRole: "manager" | "member";

  // derived role for UI (managerId always wins)
  uiRole: "admin" | "member";

  name: string;
  username?: string;
  avatar?: string;

  bestStreak: number;
  currentStreak: number;
  correctPicks: number;
  totalPicks: number;
};

function safeNum(v: any, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function initials(name: string) {
  const parts = (name || "P").trim().split(/\s+/).slice(0, 2);
  const a = parts[0]?.[0] ?? "P";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function formatRatio(correct: number, total: number) {
  if (!total) return "—";
  const pct = Math.round((correct / total) * 100);
  return `${correct}/${total} (${pct}%)`;
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = (params?.leagueId as string) || "";
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // --- Live members ---
  useEffect(() => {
    if (!leagueId) return;

    const membersRef = collection(db, "leagues", leagueId, "members");
    const qRef = query(membersRef, orderBy("joinedAt", "asc"), limit(300));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: MemberRow[] = snap.docs.map((d) => {
          const m = d.data() as any;
          const uid = (m.uid ?? d.id) as string;
          return {
            id: d.id,
            uid,
            displayName: m.displayName ?? "Player",
            role: (m.role as "manager" | "member") ?? "member",
            joinedAt: m.joinedAt,
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

  // --- Membership gate ---
  const isMemberUser = useMemo(() => {
    if (!user) return false;
    if (!league) return false;
    if (user.uid === league.managerId) return true;
    return members.some((m) => m.uid === user.uid);
  }, [user, league, members]);

  // --- Load user profiles for members (avatar + username + streak stats) ---
  useEffect(() => {
    const loadProfiles = async () => {
      if (!leagueId) return;

      if (!members.length) {
        setProfiles({});
        return;
      }

      setProfilesLoading(true);
      try {
        const uids = Array.from(new Set(members.map((m) => m.uid))).filter(Boolean);

        const docs = await Promise.all(
          uids.map(async (uid) => {
            try {
              const uRef = doc(db, "users", uid);
              const uSnap = await getDoc(uRef);
              if (!uSnap.exists()) return null;
              const d = uSnap.data() as any;

              const profile: UserProfile = {
                uid,
                displayName: d.displayName ?? d.name ?? d.fullName ?? undefined,
                username: d.username ?? d.handle ?? d.userName ?? undefined,
                photoURL: d.photoURL ?? d.photoUrl ?? undefined,
                avatarUrl: d.avatarUrl ?? d.avatarURL ?? d.avatar ?? undefined,

                currentStreak: safeNum(d.currentStreak, 0),
                bestStreak: safeNum(d.bestStreak, 0),
                correctPicks: safeNum(d.correctPicks, 0),
                totalPicks: safeNum(d.totalPicks, 0),
              };

              return profile;
            } catch {
              return null;
            }
          })
        );

        const map: Record<string, UserProfile> = {};
        for (const p of docs) {
          if (p?.uid) map[p.uid] = p;
        }
        setProfiles(map);
      } finally {
        setProfilesLoading(false);
      }
    };

    loadProfiles();
  }, [leagueId, members]);

  const ladder: LadderRow[] = useMemo(() => {
    const managerId = league?.managerId || "";

    const rows: LadderRow[] = members.map((m) => {
      const p = profiles[m.uid];

      const name =
        (p?.displayName && String(p.displayName).trim()) ||
        (m.displayName && String(m.displayName).trim()) ||
        "Player";

      const usernameRaw = p?.username ? String(p.username).trim() : "";
      const username = usernameRaw
        ? usernameRaw.startsWith("@")
          ? usernameRaw
          : `@${usernameRaw}`
        : undefined;

      const avatar = p?.avatarUrl || p?.photoURL || undefined;

      // ✅ UI role: managerId always wins
      const uiRole: "admin" | "member" = m.uid === managerId ? "admin" : "member";

      return {
        rank: 9999,
        uid: m.uid,
m        storedRole: m.role,
        uiRole,
        name,
        username,
        avatar,
        bestStreak: safeNum(p?.bestStreak, 0),
        currentStreak: safeNum(p?.currentStreak, 0),
        correctPicks: safeNum(p?.correctPicks, 0),
        totalPicks: safeNum(p?.totalPicks, 0),
      };
    });

    rows.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;

      const aPct = a.totalPicks ? a.correctPicks / a.totalPicks : 0;
      const bPct = b.totalPicks ? b.correctPicks / b.totalPicks : 0;
      if (bPct !== aPct) return bPct - aPct;

      return a.name.localeCompare(b.name);
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [members, profiles, league?.managerId]);

  const myRow = useMemo(() => {
    if (!user) return null;
    return ladder.find((r) => r.uid === user.uid) ?? null;
  }, [ladder, user]);

  const title = `${league?.name || "Group"} Ladder`;

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
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to league
          </Link>
          <SportBadge sport="afl" />
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-white/70">
              Bragging rights only. (Your global streak still counts on the main leaderboard.)
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/60">Invite</span>
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
              {profilesLoading ? " • updating…" : ""}
            </span>
          </div>
        </div>

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
            {myRow && (
              <div className="rounded-2xl border border-orange-500/35 bg-orange-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-orange-200/80">
                  Your position
                </p>

                <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                      {myRow.avatar ? (
                        <img
                          src={myRow.avatar}
                          alt={myRow.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-white/80">
                          {initials(myRow.name)}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-lg font-bold">
                        #{myRow.rank}{" "}
                        <span className="text-white/90">{myRow.name}</span>
                        {myRow.username && (
                          <span className="ml-2 text-sm font-semibold text-white/50">
                            {myRow.username}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/60">
                        Best: <span className="text-white font-semibold">{myRow.bestStreak}</span> •
                        Current: <span className="text-white font-semibold">{myRow.currentStreak}</span> •
                        Accuracy:{" "}
                        <span className="text-white font-semibold">
                          {formatRatio(myRow.correctPicks, myRow.totalPicks)}
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

            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                <h2 className="text-sm font-semibold">League ladder</h2>
                <p className="text-[11px] text-white/50">
                  Ranking: Current → Best → Accuracy
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
                        <th className="px-4 py-2 min-w-[280px]">Player</th>
                        <th className="px-4 py-2 w-[110px]">Best</th>
                        <th className="px-4 py-2 w-[110px]">Current</th>
                        <th className="px-4 py-2 w-[160px]">Accuracy</th>
                        <th className="px-4 py-2 w-[110px]">Role</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ladder.map((r) => {
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
                                  {r.avatar ? (
                                    <img
                                      src={r.avatar}
                                      alt={r.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-white/80">
                                      {initials(r.name)}
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-semibold truncate">{r.name}</span>
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
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-bold text-orange-200">
                              {r.bestStreak}
                            </td>

                            <td className="px-4 py-3 font-semibold text-white/80">
                              {r.currentStreak}
                            </td>

                            <td className="px-4 py-3 text-white/70">
                              {formatRatio(r.correctPicks, r.totalPicks)}
                            </td>

                            <td className="px-4 py-3">
                              <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                                {r.uiRole === "admin" ? "Admin" : "Member"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
