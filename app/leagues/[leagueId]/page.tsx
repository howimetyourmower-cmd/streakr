// app/leagues/[leagueId]/page.tsx
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
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import SportBadge from "@/components/SportBadge";

type Member = {
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

type Message = {
  id: string;
  uid: string;
  displayName: string;
  body: string;
  createdAt?: Date | null;
};

type UserProfile = {
  uid: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  avatarUrl?: string;
};

function safeTrim(s: any) {
  if (typeof s !== "string") return "";
  return s.trim();
}

function buildInviteText(leagueName: string, code: string) {
  const cleanName = leagueName || "STREAKr league";
  const cleanCode = code || "";
  return `Join my STREAKr league "${cleanName}"\n\nInvite code: ${cleanCode}\n\nOpen STREAKr → Leagues → Join a league → enter the code`;
}

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = params?.leagueId as string;
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
  const [description, setDescription] = useState("");

  // profiles cache so we show displayName / username (not email, not uid)
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  const isManager = !!user && !!league && user.uid === league.managerId;

  const isMemberUser =
    !!user &&
    !!league &&
    (user.uid === league.managerId || members.some((m) => m.uid === user.uid));

  const getBestProfileName = (uid: string, fallback?: string) => {
    const p = profiles[uid];
    const dn = safeTrim(p?.displayName);
    const un = safeTrim(p?.username);
    if (dn) return dn;
    if (un) return un.startsWith("@") ? un.slice(1) : un;
    const fb = safeTrim(fallback);
    if (fb) return fb;
    return "Player";
  };

  const getBestProfileUsername = (uid: string) => {
    const p = profiles[uid];
    const un = safeTrim(p?.username);
    if (!un) return "";
    return un.startsWith("@") ? un : `@${un}`;
  };

  // chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canUseNativeShare =
    typeof navigator !== "undefined" && !!(navigator as any).share;

  const headerInviteText = useMemo(() => {
    if (!league?.inviteCode) return "";
    return buildInviteText(league.name, league.inviteCode);
  }, [league?.inviteCode, league?.name]);

  useEffect(() => {
    const loadLeague = async () => {
      if (!leagueId) return;

      setLoading(true);
      setError(null);

      try {
        const leagueRef = doc(db, "leagues", leagueId);
        const leagueSnap = await getDoc(leagueRef);

        if (!leagueSnap.exists()) {
          setError("League not found.");
          setLeague(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const data = leagueSnap.data() as any;

        // Support old + new schemas
        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed league",
          inviteCode,
          managerId,
          description: data.description ?? "",
          memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
        };

        setLeague(leagueData);
        setName(leagueData.name);
        setDescription(leagueData.description ?? "");

        const membersRef = collection(leagueRef, "members");
        const membersQ = query(
          membersRef,
          orderBy("joinedAt", "asc"),
          limit(200)
        );
        const membersSnap = await getDocs(membersQ);

        const loadedMembers: Member[] = membersSnap.docs.map((docSnap) => {
          const m = docSnap.data() as any;
          return {
            id: docSnap.id,
            uid: m.uid,
            displayName: m.displayName ?? "Player",
            role: (m.role as "manager" | "member") ?? "member",
            joinedAt: m.joinedAt,
          };
        });

        setMembers(loadedMembers);
      } catch (err) {
        console.error("Failed to load league", err);
        setError("Failed to load league. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadLeague();
  }, [leagueId]);

  // fetch profiles for members (display name / username)
  useEffect(() => {
    if (!members.length) return;

    const uids = Array.from(new Set(members.map((m) => m.uid).filter(Boolean)));
    const missing = uids.filter((uid) => !profiles[uid]);
    if (!missing.length) return;

    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              if (!snap.exists()) return null;
              const d = snap.data() as any;
              const p: UserProfile = {
                uid,
                displayName: d.displayName ?? d.name ?? "",
                username: d.username ?? d.handle ?? "",
                photoURL: d.photoURL ?? d.photoUrl ?? "",
                avatarUrl: d.avatarUrl ?? d.avatarURL ?? "",
              };
              return p;
            } catch {
              return null;
            }
          })
        );

        const next: Record<string, UserProfile> = {};
        for (const p of results) {
          if (p?.uid) next[p.uid] = p;
        }
        if (Object.keys(next).length) {
          setProfiles((prev) => ({ ...prev, ...next }));
        }
      } catch (e) {
        console.warn("Failed fetching member profiles", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  // load live chat messages for this league (members only)
  useEffect(() => {
    if (!leagueId) return;

    if (!isMemberUser) {
      setMessages([]);
      return;
    }

    setChatLoading(true);
    setChatError(null);

    const messagesRef = collection(db, "leagues", leagueId, "messages");
    const messagesQ = query(messagesRef, orderBy("createdAt", "asc"), limit(200));

    const unsub = onSnapshot(
      messagesQ,
      (snapshot) => {
        const list: Message[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          let created: Date | null = null;
          try {
            if (data.createdAt?.toDate) created = data.createdAt.toDate();
          } catch {
            created = null;
          }
          return {
            id: docSnap.id,
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

  // fetch profiles for message senders too (so old messages render as display name)
  useEffect(() => {
    if (!messages.length) return;

    const uids = Array.from(new Set(messages.map((m) => m.uid).filter(Boolean)));
    const missing = uids.filter((uid) => !profiles[uid]);
    if (!missing.length) return;

    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              if (!snap.exists()) return null;
              const d = snap.data() as any;
              const p: UserProfile = {
                uid,
                displayName: d.displayName ?? d.name ?? "",
                username: d.username ?? d.handle ?? "",
                photoURL: d.photoURL ?? d.photoUrl ?? "",
                avatarUrl: d.avatarUrl ?? d.avatarURL ?? "",
              };
              return p;
            } catch {
              return null;
            }
          })
        );

        const next: Record<string, UserProfile> = {};
        for (const p of results) {
          if (p?.uid) next[p.uid] = p;
        }
        if (Object.keys(next).length) {
          setProfiles((prev) => ({ ...prev, ...next }));
        }
      } catch (e) {
        console.warn("Failed fetching chat profiles", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // auto scroll to latest message
  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatMessageTime = (d?: Date | null) => {
    if (!d) return "";
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  };

  const handleShareInvite = async () => {
    if (!league?.inviteCode) return;
    const text = buildInviteText(league.name, league.inviteCode);

    try {
      if (canUseNativeShare) {
        await (navigator as any).share({
          title: `STREAKr League: ${league.name}`,
          text,
        });
        return;
      }
    } catch {
      // fall back below
    }

    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Invite copied. Paste it into SMS / WhatsApp / email.");
    } catch {
      setError("Could not share/copy. Please copy the code manually.");
    }
  };

  const handleCopyCode = async () => {
    if (!league?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(league.inviteCode);
      setSuccess("Invite code copied.");
    } catch {
      setError("Could not copy code.");
    }
  };

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
        description: description.trim(),
        updatedAt: serverTimestamp(),
      });

      setLeague((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim() || prev.name,
              description: description.trim(),
            }
          : prev
      );

      setSuccess("League details updated.");
    } catch (err) {
      console.error("Failed to update league", err);
      setError("Failed to update league. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!league || !isManager) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this league? This cannot be undone."
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
      const selfName = getBestProfileName(
        user.uid,
        (user as any)?.displayName || (user as any)?.name
      );
      const selfUsername = getBestProfileUsername(user.uid);

      const messagesRef = collection(db, "leagues", leagueId, "messages");
      await addDoc(messagesRef, {
        uid: user.uid,
        displayName: selfName,
        username: selfUsername,
        body: trimmed,
        createdAt: serverTimestamp(),
      });

      setChatInput("");
    } catch (err) {
      console.error("Failed to send message", err);
      setChatError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <p className="text-sm text-white/70">Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8 space-y-4">
        <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to leagues
        </Link>
        <p className="text-sm text-red-400">
          {error ?? "League not found or no longer available."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8 space-y-6">
      {/* Top breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to leagues
        </Link>

        {/* quick action */}
        <Link
          href={`/leagues/${league.id}/ladder`}
          className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
        >
          View ladder →
        </Link>
      </div>

      {/* Header block */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold truncate">
                {league.name}
              </h1>
              <SportBadge sport="afl" />
              {isManager && (
                <span className="hidden sm:inline-flex items-center rounded-full bg-white/5 border border-orange-500/40 text-orange-300 px-2 py-1 text-[11px] uppercase tracking-wide">
                  League Manager
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-white/70 max-w-3xl">
              Private league — bragging rights only. Your global streak still counts on
              the main leaderboard.
            </p>
          </div>

          {/* Invite actions (compact) */}
          <div className="w-full md:w-auto">
            <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
              <span className="font-mono text-xs bg-black/30 border border-white/15 rounded-md px-2 py-1">
                {league.inviteCode || "—"}
              </span>

              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-60"
                disabled={!league.inviteCode}
              >
                Copy code
              </button>

              <button
                type="button"
                onClick={handleShareInvite}
                className="rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-[12px] px-3 py-1.5 transition-colors disabled:opacity-60"
                disabled={!league.inviteCode}
                title={headerInviteText}
              >
                Share invite
              </button>
            </div>

            <div className="mt-2 flex items-center justify-start md:justify-end gap-3 text-xs text-white/60">
              <span>Members: {league.memberCount ?? members.length}</span>
              {isManager && (
                <button
                  type="button"
                  onClick={handleDeleteLeague}
                  disabled={deleteLoading}
                  className="text-red-400 hover:text-red-300"
                >
                  {deleteLoading ? "Deleting…" : "Delete league"}
                </button>
              )}
            </div>

            {(error || success) && (
              <div className="mt-3 space-y-2">
                {error && (
                  <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
                    {success}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content: Left column (settings+chat), Right column (members sticky-ish) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Settings */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold">League settings</h2>
              {!isManager && (
                <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 text-white/70 px-2 py-1 text-[11px] uppercase tracking-wide">
                  Member
                </span>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">League name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isManager}
                  className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-white/70">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isManager}
                  rows={3}
                  className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 disabled:opacity-60"
                  placeholder="E.g. Round-by-round comp. Loser shouts the pub lunch."
                />
              </div>

              {isManager && (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              )}
            </form>
          </div>

          {/* Chat */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-lg font-semibold">League chat</h2>
              <span className="text-[11px] text-white/60">
                Members only
              </span>
            </div>

            {!user && (
              <p className="text-sm text-white/70">
                Log in to join the conversation in this league.
              </p>
            )}

            {user && !isMemberUser && (
              <p className="text-sm text-white/70">
                You&apos;re not a member of this league. Join the league to access chat.
              </p>
            )}

            {user && isMemberUser && (
              <>
                <div className="h-72 md:h-80 overflow-y-auto rounded-xl bg-black/40 border border-white/10 px-3 py-2 space-y-2 text-sm">
                  {chatLoading ? (
                    <p className="text-xs text-white/60">Loading messages…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-xs text-white/60">
                      No messages yet. Start the banter!
                    </p>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = !!user && msg.uid === user.uid;
                      const displayName = getBestProfileName(msg.uid, msg.displayName);
                      const username = getBestProfileUsername(msg.uid);

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[86%] rounded-2xl px-3 py-2 border text-xs ${
                              isOwn
                                ? "bg-orange-500 text-black border-orange-300"
                                : "bg-[#050816] text-white border-white/15"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold truncate">{displayName}</span>
                                {username && (
                                  <span className="text-[10px] opacity-70 truncate">
                                    {username}
                                  </span>
                                )}
                              </div>
                              {msg.createdAt && (
                                <span className="text-[10px] opacity-70">
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {chatError && <p className="mt-2 text-xs text-red-400">{chatError}</p>}

                <form onSubmit={handleSendMessage} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    rows={2}
                    className="flex-1 rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                    placeholder="Type a message for your league…"
                  />
                  <button
                    type="submit"
                    disabled={sending || !chatInput.trim()}
                    className="sm:self-end inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-5 py-2 transition-colors disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Members */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">League members</h2>
            <span className="text-xs text-white/60">
              {members.length} total
            </span>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-white/70">
              No members yet. Share your invite code to get the crew in.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => {
                const displayName = getBestProfileName(m.uid, m.displayName);
                const username = getBestProfileUsername(m.uid);
                const isYou = !!user && user.uid === m.uid;

                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/20 border border-white/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{displayName}</span>
                        {username && (
                          <span className="text-xs text-white/60 truncate">{username}</span>
                        )}
                        {isYou && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/70 bg-white/5">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                      {m.role === "manager" ? "Manager" : "Member"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* small footer tip */}
          <div className="mt-4 text-xs text-white/60 border-t border-white/10 pt-3">
            Tip: keep the banter flowing — share the code, then hit{" "}
            <span className="text-white/80">View ladder</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
