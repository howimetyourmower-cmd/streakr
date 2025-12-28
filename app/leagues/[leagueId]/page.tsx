// /app/leagues/[leagueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type MemberRole = "manager" | "member";

type Member = {
  id: string;
  uid: string;
  displayName: string;
  role: MemberRole;
  joinedAt?: any;
};

type League = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  tagLine?: string;
  description?: string;
  isPublic?: boolean;
  memberCount?: number;
  memberIds?: string[];
};

type Message = {
  id: string;
  uid: string;
  displayName: string;
  body: string;
  createdAt?: Date | null;
};

function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

function safeDisplayName(user: any): string {
  return (
    user?.displayName ||
    user?.username ||
    user?.name ||
    user?.email ||
    "Player"
  );
}

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = (params?.leagueId as string) || "";
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [description, setDescription] = useState("");

  // --- Chat state ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ----- Membership / manager flags -----
  const isManager = useMemo(() => {
    return !!user && !!league && user.uid === league.managerId;
  }, [user, league]);

  const isMemberUser = useMemo(() => {
    if (!user || !league) return false;
    if (user.uid === league.managerId) return true;
    // Quick path: if league has memberIds, trust that
    if (Array.isArray(league.memberIds) && league.memberIds.includes(user.uid)) return true;
    // Otherwise fallback to loaded members list
    return members.some((m) => m.uid === user.uid);
  }, [user, league, members]);

  const shareJoinLink = useMemo(() => {
    if (!league?.inviteCode) return "";
    return `/leagues/join?code=${encodeURIComponent(normalizeCode(league.inviteCode))}`;
  }, [league?.inviteCode]);

  // ----- Live league doc -----
  useEffect(() => {
    if (!leagueId) return;

    setLoading(true);
    setError(null);

    const leagueRef = doc(db, "leagues", leagueId);

    const unsub = onSnapshot(
      leagueRef,
      (snap) => {
        if (!snap.exists()) {
          setLeague(null);
          setMembers([]);
          setLoading(false);
          setError("League not found or no longer available.");
          return;
        }

        const data = snap.data() as any;

        // ✅ Support both old + new schemas
        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? data.managerID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const nextLeague: League = {
          id: snap.id,
          name: data.name ?? "Unnamed league",
          tagLine: data.tagLine ?? "",
          description: data.description ?? "",
          managerId,
          inviteCode,
          isPublic: !!data.isPublic,
          memberCount:
            typeof data.memberCount === "number"
              ? data.memberCount
              : Array.isArray(data.memberIds)
              ? data.memberIds.length
              : 0,
          memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
        };

        setLeague(nextLeague);
        setName(nextLeague.name);
        setTagLine(nextLeague.tagLine ?? "");
        setDescription(nextLeague.description ?? "");

        setLoading(false);
      },
      (err) => {
        console.error("League snapshot error", err);
        setError("Failed to load league. Please try again.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [leagueId]);

  // ----- Live members list -----
  useEffect(() => {
    if (!leagueId) return;

    const membersRef = collection(db, "leagues", leagueId, "members");
    const qRef = query(membersRef, orderBy("joinedAt", "asc"), limit(300));

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const list: Member[] = snapshot.docs.map((d) => {
          const m = d.data() as any;
          return {
            id: d.id,
            uid: m.uid ?? d.id,
            displayName: m.displayName ?? "Player",
            role: (m.role as MemberRole) ?? "member",
            joinedAt: m.joinedAt,
          };
        });
        setMembers(list);
      },
      (err) => {
        console.error("Members snapshot error", err);
        // Don’t hard-fail the page if members fail
      }
    );

    return () => unsub();
  }, [leagueId]);

  // ----- Save settings (manager only) -----
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!league) return;
    if (!isManager) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const leagueRef = doc(db, "leagues", league.id);
      await updateDoc(leagueRef, {
        name: name.trim() || league.name,
        tagLine: tagLine.trim(),
        description: description.trim(),
        updatedAt: serverTimestamp(),
      });

      setSuccess("League details updated.");
    } catch (err) {
      console.error("Failed to update league", err);
      setError("Failed to update league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ----- Delete league (manager only) -----
  const handleDeleteLeague = async () => {
    if (!league || !isManager) return;

    const confirmed = window.confirm(
      "Delete this league?\n\nThis removes the league from STREAKr. (Subcollections like messages may remain in Firestore unless you run a cleanup job.)"
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const leagueRef = doc(db, "leagues", league.id);
      await deleteDoc(leagueRef);
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to delete league", err);
      setError("Failed to delete league. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ----- Leave league (member only, not manager) -----
  const handleLeaveLeague = async () => {
    if (!leagueId || !user || !league) return;
    if (isManager) return;

    const confirmed = window.confirm(
      "Leave this league?\n\nYou’ll be removed from the ladder and won’t see the chat anymore."
    );
    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      // Best-effort: delete member subdoc and update league/user arrays if present.
      const memberRef = doc(db, "leagues", leagueId, "members", user.uid);
      await deleteDoc(memberRef);

      // If your schema keeps memberIds/memberCount updated elsewhere, great.
      // If not, we do a best-effort recalculation using current memberIds.
      const leagueRef = doc(db, "leagues", leagueId);
      const snap = await getDoc(leagueRef);
      if (snap.exists()) {
        const data = snap.data() as any;
        const memberIds: string[] = Array.isArray(data.memberIds) ? data.memberIds : [];
        const nextIds = memberIds.filter((id) => id !== user.uid);

        await updateDoc(leagueRef, {
          memberIds: nextIds,
          memberCount: nextIds.length,
          updatedAt: serverTimestamp(),
        });
      }

      const userRef = doc(db, "users", user.uid);
      // We don't have arrayRemove imported; for MVP we just leave leagueIds as-is.
      // You can clean this later with a Cloud Function / admin action.

      setSuccess("You left the league.");
      router.push("/leagues");
    } catch (err) {
      console.error("Failed to leave league", err);
      setError("Could not leave the league right now. Try again.");
    }
  };

  // ----- Load live chat messages (members only) -----
  useEffect(() => {
    if (!leagueId) return;

    if (!isMemberUser) {
      setMessages([]);
      return;
    }

    setChatLoading(true);
    setChatError(null);

    const messagesRef = collection(db, "leagues", leagueId, "messages");
    const qRef = query(messagesRef, orderBy("createdAt", "asc"), limit(250));

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const list: Message[] = snapshot.docs.map((d) => {
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
            displayName: data.displayName ?? "Player",
            body: data.body ?? "",
            createdAt: created,
          };
        });

        setMessages(list);
        setChatLoading(false);
      },
      (err) => {
        console.error("League chat error", err);
        setChatError("Failed to load chat. Please try again later.");
        setChatLoading(false);
      }
    );

    return () => unsub();
  }, [leagueId, isMemberUser]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatMessageTime = (d?: Date | null) => {
    if (!d) return "";
    try {
      return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // ----- Send message -----
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!leagueId) return;

    if (!user) {
      setChatError("You need to be logged in to chat.");
      return;
    }
    if (!isMemberUser) {
      setChatError("Only league members can send messages.");
      return;
    }

    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setSending(true);
    setChatError(null);

    try {
      const displayName = safeDisplayName(user);

      const messagesRef = collection(db, "leagues", leagueId, "messages");
      await addDoc(messagesRef, {
        uid: user.uid,
        displayName,
        body: trimmed,
        createdAt: serverTimestamp(),
      });

      // Optional: push an activity feed item for /leagues page
      if (league?.name) {
        const activityRef = collection(db, "leagueActivity");
        await addDoc(activityRef, {
          leagueId,
          createdAt: serverTimestamp(),
          message: `${displayName} posted in ${league.name}`,
        });
      }

      setChatInput("");
    } catch (err) {
      console.error("Failed to send message", err);
      setChatError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (league?.inviteCode) await navigator.clipboard.writeText(league.inviteCode);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      if (shareJoinLink) {
        const full = typeof window !== "undefined" ? `${window.location.origin}${shareJoinLink}` : shareJoinLink;
        await navigator.clipboard.writeText(full);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-sm text-zinc-300">Loading league…</p>
        </div>
      </main>
    );
  }

  if (!league) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 py-10 space-y-4">
          <Link href="/leagues" className="text-sm text-orange-300 hover:text-orange-200 font-semibold">
            ← Back to leagues
          </Link>
          <p className="text-sm text-red-300">
            {error ?? "League not found or no longer available."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-20 pt-10">
        <Link href="/leagues" className="text-sm text-orange-300 hover:text-orange-200 font-semibold">
          ← Back to leagues
        </Link>

        {/* Header */}
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-extrabold truncate">{league.name}</h1>
                <SportBadge sport="afl" />
              </div>

              {league.tagLine ? (
                <p className="mt-2 text-sm text-zinc-300">{league.tagLine}</p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">
                  Private league. Your streak still counts globally — this is for bragging rights with your crew.
                </p>
              )}

              {league.description ? (
                <p className="mt-3 text-sm text-zinc-300 max-w-3xl">{league.description}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/leagues/${league.id}/ladder`}
                  className="inline-flex items-center justify-center rounded-full bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                >
                  View ladder
                </Link>
                <Link
                  href="/picks"
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-black hover:bg-orange-400"
                >
                  Make picks
                </Link>

                {!isManager && isMemberUser && (
                  <button
                    type="button"
                    onClick={handleLeaveLeague}
                    className="inline-flex items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                  >
                    Leave league
                  </button>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 w-full md:w-[320px]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-300">Invite code</p>
                <span className="text-[11px] text-zinc-500">
                  Members: {league.memberCount ?? members.length}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                <span className="font-mono text-lg font-black tracking-[0.25em] text-orange-200">
                  {league.inviteCode || "—"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!league.inviteCode}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-white/10 disabled:opacity-60"
                >
                  Copy
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={shareJoinLink || "/leagues/join"}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  Open join link
                </Link>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!shareJoinLink}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
                >
                  Copy link
                </button>
              </div>

              <p className="mt-2 text-[11px] text-zinc-500">
                Share the link or the code — either works.
              </p>
            </div>
          </div>
        </header>

        {/* Alerts */}
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* Settings */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">League settings</h2>
              {isManager ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-200">
                  League Manager
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/40 px-3 py-1 text-[11px] font-semibold text-zinc-300">
                  Member
                </span>
              )}
            </div>

            {!user && (
              <p className="text-sm text-zinc-400">
                Log in to see member-only features.
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">League name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isManager || saving}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Tagline (optional)</label>
                <input
                  type="text"
                  value={tagLine}
                  onChange={(e) => setTagLine(e.target.value)}
                  disabled={!isManager || saving}
                  placeholder="E.g. Real STREAKrs don’t get caught."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isManager || saving}
                  rows={4}
                  placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2 disabled:opacity-60"
                />
              </div>

              {isManager ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteLeague}
                    disabled={deleteLoading}
                    className="inline-flex items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                  >
                    {deleteLoading ? "Deleting…" : "Delete league"}
                  </button>

                  <p className="text-[11px] text-zinc-500">
                    Tip: keep it short — this is what mates see on the ladder.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Only the League Manager can edit settings.
                </p>
              )}
            </form>
          </div>

          {/* Members */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Members</h2>
              <span className="text-xs text-zinc-400">
                {members.length} shown
              </span>
            </div>

            {members.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No members yet. Share your invite code to get the crew in.
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {m.displayName}
                        {user?.uid === m.uid ? (
                          <span className="ml-2 text-[11px] text-orange-300">(You)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">{m.uid}</p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${
                        m.role === "manager"
                          ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      {m.role === "manager" ? "Manager" : "Member"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Chat */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">League chat</h2>
            <span className="text-[11px] text-zinc-500">
              Members only
            </span>
          </div>

          {!user && (
            <p className="text-sm text-zinc-400">
              Log in to view and post in league chat.
            </p>
          )}

          {user && !isMemberUser && (
            <p className="text-sm text-zinc-400">
              You’re not a member of this league. Join it to access chat.
            </p>
          )}

          {user && isMemberUser && (
            <>
              <div className="h-72 max-h-[420px] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-3">
                {chatLoading ? (
                  <p className="text-xs text-zinc-400">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    No messages yet. Start the banter 😈
                  </p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => {
                      const isOwn = !!user && msg.uid === user.uid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-3 py-2 border ${
                              isOwn
                                ? "bg-orange-500 text-black border-orange-300/60"
                                : "bg-zinc-900 text-zinc-100 border-zinc-800"
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className={`text-[11px] font-semibold truncate ${isOwn ? "text-black/80" : "text-zinc-200"}`}>
                                {msg.displayName}
                              </span>
                              {msg.createdAt ? (
                                <span className={`text-[10px] ${isOwn ? "text-black/60" : "text-zinc-500"}`}>
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                              ) : null}
                            </div>
                            <p className={`text-sm whitespace-pre-wrap break-words ${isOwn ? "text-black" : "text-zinc-100"}`}>
                              {msg.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {chatError && (
                <p className="mt-2 text-xs text-red-300">{chatError}</p>
              )}

              <form onSubmit={handleSendMessage} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  rows={2}
                  placeholder="Say something to the crew…"
                  className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={sending || !chatInput.trim()}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>

              <p className="mt-2 text-[11px] text-zinc-500">
                Keep it fun. If someone’s being a flog, we’ll add moderation tools later.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
