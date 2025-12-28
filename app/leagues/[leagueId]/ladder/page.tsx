"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  sport?: string;
  memberCount?: number;
};

type MemberDoc = {
  uid: string;
  displayName?: string;
  role?: "manager" | "member";
};

type ProfileDoc = {
  displayName?: string;
  username?: string;
  handle?: string;
  avatarUrl?: string;
  photoURL?: string;
  currentStreak?: number;
};

type LadderRow = {
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
  currentStreak: number;
  uiRole: "admin" | "member";
};

type CommentRow = {
  id: string;
  uid: string;
  name: string;
  username?: string;
  avatar?: string;
  body: string;
  createdAt?: Date | null;
};

function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatTime(d?: Date | null) {
  if (!d) return "";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default function LeagueLadderPage() {
  const params = useParams();
  const leagueId = params?.leagueId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LadderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // --- Comments ---
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Load league + build ladder
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

        // Support old/new schema keys
        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed league",
          inviteCode,
          managerId,
          sport: (data.sport ?? "afl").toString().toLowerCase(),
          memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
        };

        setLeague(leagueData);

        // Load members
        const membersRef = collection(leagueRef, "members");
        const membersQ = query(membersRef, orderBy("joinedAt", "asc"), limit(300));
        const membersSnap = await getDocs(membersQ);

        const members: MemberDoc[] = membersSnap.docs.map((d) => {
          const m = d.data() as any;
          return {
            uid: m.uid || d.id,
            displayName: m.displayName,
            role: m.role,
          };
        });

        // Fetch profiles for each member (users/{uid})
        const built: LadderRow[] = await Promise.all(
          members.map(async (m) => {
            let p: ProfileDoc | null = null;
            try {
              const pSnap = await getDoc(doc(db, "users", m.uid));
              if (pSnap.exists()) p = (pSnap.data() as any) as ProfileDoc;
            } catch {
              p = null;
            }

            const name =
              p?.displayName ||
              m.displayName ||
              (m.uid === user?.uid ? (user.displayName || user.email || "Player") : "Player");

            const usernameRaw =
              p?.username || p?.handle || undefined;

            const username =
              usernameRaw
                ? usernameRaw.startsWith("@")
                  ? usernameRaw
                  : `@${usernameRaw}`
                : undefined;

            const avatar = p?.avatarUrl || p?.photoURL || (user?.uid === m.uid ? (user.photoURL || undefined) : undefined);

            const currentStreak = safeNum(p?.currentStreak, 0);

            // UI role: league manager always Admin
            const uiRole: "admin" | "member" = m.uid === leagueData.managerId ? "admin" : "member";

            return {
              uid: m.uid,
              name,
              username,
              avatar,
              currentStreak,
              uiRole,
            };
          })
        );

        // Sort: Current streak desc, then name
        built.sort((a, b) => {
          if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
          return a.name.localeCompare(b.name);
        });

        setRows(built);
      } catch (e) {
        console.error(e);
        setError("Failed to load ladder. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leagueId, user?.uid, user?.displayName, user?.email, user?.photoURL]);

  const isMemberUser = useMemo(() => {
    if (!user) return false;
    if (!league) return false;
    return rows.some((r) => r.uid === user.uid) || user.uid === league.managerId;
  }, [user, league, rows]);

  const myRow = useMemo(() => {
    if (!user) return null;
    return rows.find((r) => r.uid === user.uid) || null;
  }, [rows, user]);

  // Live comments (members only)
  useEffect(() => {
    if (!leagueId) return;

    if (!isMemberUser) {
      setComments([]);
      return;
    }

    setCommentError(null);

    const ref = collection(db, "leagues", leagueId, "comments");
    const qRef = query(ref, orderBy("createdAt", "asc"), limit(200));

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        const list: CommentRow[] = snap.docs.map((d) => {
          const data = d.data() as any;
          let created: Date | null = null;
          try {
            if (data.createdAt?.toDate) created = data.createdAt.toDate();
          } catch {
            created = null;
          }

          return {
            id: d.id,
            uid: data.uid,
            name: data.name ?? "Player",
            username: data.username ?? undefined,
            avatar: data.avatar ?? undefined,
            body: data.body ?? "",
            createdAt: created,
          };
        });

        setComments(list);
      },
      (err) => {
        console.error("Comments error", err);
        setCommentError("Failed to load comments.");
      }
    );

    return () => unsub();
  }, [leagueId, isMemberUser]);

  useEffect(() => {
    if (!commentsEndRef.current) return;
    commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleSendComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!leagueId) return;

    if (!user) {
      setCommentError("Log in to comment.");
      return;
    }
    if (!isMemberUser) {
      setCommentError("Only league members can comment.");
      return;
    }

    const trimmed = commentInput.trim();
    if (!trimmed) return;

    setCommentSending(true);
    setCommentError(null);

    try {
      // Pull basic display from auth + users doc (optional)
      let username: string | undefined = undefined;
      let avatar: string | undefined = user.photoURL || undefined;

      try {
        const pSnap = await getDoc(doc(db, "users", user.uid));
        if (pSnap.exists()) {
          const p = pSnap.data() as any;
          const raw = p.username || p.handle;
          if (raw) username = raw.startsWith("@") ? raw : `@${raw}`;
          avatar = p.avatarUrl || p.photoURL || avatar;
        }
      } catch {}

      const name =
        (user as any).displayName ||
        (user as any).name ||
        (user as any).email ||
        "Player";

      const ref = collection(db, "leagues", leagueId, "comments");
      await addDoc(ref, {
        uid: user.uid,
        name,
        username: username || null,
        avatar: avatar || null,
        body: trimmed,
        createdAt: serverTimestamp(),
      });

      setCommentInput("");
    } catch (err) {
      console.error("Send comment failed", err);
      setCommentError("Could not send comment. Try again.");
    } finally {
      setCommentSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
          <p className="text-sm text-white/70">Loading ladder…</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8 space-y-4">
          <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
            ← Back to leagues
          </Link>
          <p className="text-sm text-red-400">{error ?? "League not found."}</p>
        </div>
      </div>
    );
  }

  const topRow = rows[0] || null;
  const showCrown = !!topRow && topRow.currentStreak > 0; // ✅ crown only if leader has >0

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8 space-y-6">
        <Link
          href={`/leagues/${league.id}`}
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to league
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold">
                {league.name} Ladder
              </h1>
              <SportBadge sport="afl" />
            </div>
            <p className="mt-1 text-sm text-white/65 max-w-2xl">
              Bragging rights only. (Your global streak still counts on the main leaderboard.)
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-white/60">Invite</span>
              <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-1">
                {league.inviteCode || "—"}
              </span>
              <button
                type="button"
                onClick={() =>
                  league.inviteCode && navigator.clipboard.writeText(league.inviteCode)
                }
                disabled={!league.inviteCode}
                className="text-sky-400 hover:text-sky-300 disabled:opacity-60"
              >
                Copy
              </button>
            </div>
            <span className="text-white/60">Members: {league.memberCount ?? rows.length}</span>
          </div>
        </div>

        {/* Your position */}
        {user && myRow && (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-[11px] uppercase tracking-wide text-white/60">
                Your position
              </div>

              <button
                type="button"
                onClick={() => router.push("/picks")}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors self-start md:self-auto"
              >
                Make picks →
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-10 w-10 rounded-full overflow-hidden bg-white/10 border border-white/10">
                {myRow.avatar ? (
                  <Image
                    src={myRow.avatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white/60 text-sm">
                    {myRow.name?.slice(0, 1)?.toUpperCase() || "P"}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{myRow.name}</p>
                  {myRow.username && (
                    <span className="text-white/55 text-sm">{myRow.username}</span>
                  )}
                  <span className="ml-1 text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                    {myRow.uiRole === "admin" ? "Admin" : "Member"}
                  </span>
                </div>
                <p className="text-sm text-white/65">
                  Current streak:{" "}
                  <span className="text-white font-semibold">{myRow.currentStreak}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-semibold">League ladder</h2>
            <span className="text-xs text-white/50">Ranking: Current streak</span>
          </div>

          {rows.length === 0 ? (
            <div className="p-5 text-sm text-white/70">No members yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-white/5">
                  <tr className="text-xs text-white/60">
                    <th className="text-left px-5 py-3 w-[90px]">Rank</th>
                    <th className="text-left px-5 py-3">Player</th>
                    <th className="text-center px-5 py-3 w-[140px]">Current</th>
                    <th className="text-right px-5 py-3 w-[140px]">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const rank = idx + 1;
                    const isOwn = !!user && user.uid === r.uid;
                    const isLeader = rank === 1;
                    const showLeaderCrown = isLeader && showCrown; // ✅ only if leader > 0

                    return (
                      <tr
                        key={r.uid}
                        className={`border-t border-white/10 ${
                          isOwn ? "bg-white/5" : "bg-transparent"
                        }`}
                      >
                        <td className="px-5 py-4 text-sm font-semibold">
                          <div className="flex items-center gap-2">
                            <span>#{rank}</span>
                            {showLeaderCrown && (
                              <span title="Top of the ladder">👑</span>
                            )}
                            {isOwn && (
                              <span className="text-[10px] ml-1 rounded-full px-2 py-1 border border-orange-500/40 text-orange-200 bg-orange-500/10">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-10 w-10 rounded-full overflow-hidden bg-white/10 border border-white/10 flex-shrink-0">
                              {r.avatar ? (
                                <Image
                                  src={r.avatar}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="40px"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/60 text-sm">
                                  {r.name?.slice(0, 1)?.toUpperCase() || "P"}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold truncate">
                                  {r.name}
                                </span>
                                {r.username && (
                                  <span className="text-white/55 text-sm truncate">
                                    {r.username}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-black/20 px-3 py-1 text-sm font-semibold">
                            {r.currentStreak}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
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

        {/* Comments */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Comments</h2>
            <span className="text-[11px] text-white/60">
              Members only
            </span>
          </div>

          {!user && (
            <p className="text-sm text-white/70">
              Log in to view and post comments.
            </p>
          )}

          {user && !isMemberUser && (
            <p className="text-sm text-white/70">
              You&apos;re not a member of this league.
            </p>
          )}

          {user && isMemberUser && (
            <>
              <div className="h-56 max-h-72 overflow-y-auto rounded-xl bg-black/40 border border-white/10 px-3 py-2 space-y-2 text-sm">
                {comments.length === 0 ? (
                  <p className="text-xs text-white/60">No comments yet. Start the banter!</p>
                ) : (
                  comments.map((c) => {
                    const isOwn = !!user && c.uid === user.uid;

                    return (
                      <div
                        key={c.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 border text-xs ${
                            isOwn
                              ? "bg-orange-500 text-black border-orange-300"
                              : "bg-[#050816] text-white border-white/15"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="font-semibold truncate">
                              {c.name}
                              {c.username ? (
                                <span className={isOwn ? "opacity-80" : "text-white/60"}>
                                  {" "}
                                  {c.username}
                                </span>
                              ) : null}
                            </span>
                            {c.createdAt && (
                              <span className="text-[10px] opacity-70">
                                {formatTime(c.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words">{c.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={commentsEndRef} />
              </div>

              {commentError && <p className="text-xs text-red-400">{commentError}</p>}

              <form
                onSubmit={handleSendComment}
                className="mt-2 flex flex-col sm:flex-row gap-2"
              >
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={2}
                  className="flex-1 rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  placeholder="Say something to the group…"
                />
                <button
                  type="submit"
                  disabled={commentSending || !commentInput.trim()}
                  className="sm:self-end inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
                >
                  {commentSending ? "Posting…" : "Post"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
