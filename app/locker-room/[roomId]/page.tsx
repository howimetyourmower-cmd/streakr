// /app/locker-room/[roomId]/page.tsx
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

type Room = {
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

function buildInviteText(roomName: string, code: string) {
  const cleanName = roomName || "Locker Room";
  const cleanCode = code || "";
  return `Join my Locker Room "${cleanName}"\n\nInvite code: ${cleanCode}\n\nOpen Heata → Locker Room → Join → enter the code`;
}

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
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

  const isManager = !!user && !!room && user.uid === room.managerId;

  const isMemberUser =
    !!user &&
    !!room &&
    (user.uid === room.managerId || members.some((m) => m.uid === user.uid));

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
    if (!room?.inviteCode) return "";
    return buildInviteText(room.name, room.inviteCode);
  }, [room?.inviteCode, room?.name]);

  // auto-clear toasty success after a beat
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 2200);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) return;

      setLoading(true);
      setError(null);

      try {
        // Firestore collection stays "leagues" (room is a UI rename)
        const roomRef = doc(db, "leagues", roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          setError("Room not found.");
          setRoom(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const data = roomSnap.data() as any;

        // Support old + new schemas
        const managerId: string =
          data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCode: string =
          data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const roomData: Room = {
          id: roomSnap.id,
          name: data.name ?? "Unnamed room",
          inviteCode,
          managerId,
          description: data.description ?? "",
          memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
        };

        setRoom(roomData);
        setName(roomData.name);
        setDescription(roomData.description ?? "");

        const membersRef = collection(roomRef, "members");
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
        console.error("Failed to load room", err);
        setError("Failed to load room. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadRoom();
  }, [roomId]);

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

  // load live chat messages for this room (members only)
  useEffect(() => {
    if (!roomId) return;

    if (!isMemberUser) {
      setMessages([]);
      return;
    }

    setChatLoading(true);
    setChatError(null);

    const messagesRef = collection(db, "leagues", roomId, "messages");
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
        console.error("Room chat error", err);
        setChatError("Failed to load chat. Please try again later.");
        setChatLoading(false);
      }
    );

    return () => unsub();
  }, [roomId, isMemberUser]);

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
    if (!room?.inviteCode) return;
    const text = buildInviteText(room.name, room.inviteCode);

    try {
      if (canUseNativeShare) {
        await (navigator as any).share({
          title: `Locker Room: ${room.name}`,
          text,
        });
        return;
      }
    } catch {
      // fall back below
    }

    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Invite copied — paste it into SMS/WhatsApp.");
    } catch {
      setError("Could not share/copy. Please copy the code manually.");
    }
  };

  const handleCopyCode = async () => {
    if (!room?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setSuccess("Code copied.");
    } catch {
      setError("Could not copy code.");
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!room) return;
    if (!isManager) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const roomRef = doc(db, "leagues", room.id);

      await updateDoc(roomRef, {
        name: name.trim() || room.name,
        description: description.trim(),
        updatedAt: serverTimestamp(),
      });

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim() || prev.name,
              description: description.trim(),
            }
          : prev
      );

      setSuccess("Updated.");
    } catch (err) {
      console.error("Failed to update room", err);
      setError("Failed to update room. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room || !isManager) return;
    const confirmed = window.confirm("Delete this room? This cannot be undone.");
    if (!confirmed) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const roomRef = doc(db, "leagues", room.id);
      await deleteDoc(roomRef);
      router.push("/locker-room");
    } catch (err) {
      console.error("Failed to delete room", err);
      setError("Failed to delete room. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomId) return;

    if (!user) {
      setChatError("You need to be logged in to chat.");
      return;
    }
    if (!isMemberUser) {
      setChatError("Only room members can send messages.");
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

      const messagesRef = collection(db, "leagues", roomId, "messages");
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
      setChatError("Failed to send. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <p className="text-sm text-white/70">Loading room…</p>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[#050814] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-3">
          <Link
            href="/locker-room"
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to locker room
          </Link>
          <p className="text-sm text-red-400">
            {error ?? "Room not found or no longer available."}
          </p>
        </div>
      </main>
    );
  }

  const membersCount = room.memberCount ?? members.length;
  const roomIsYours = isManager ? "Manager" : "Member";

  return (
    <main className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:py-6 space-y-4">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/locker-room"
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => router.push(`/locker-room/${room.id}/ladder`)}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs px-4 py-2 transition"
          >
            View ladder →
          </button>
        </div>

        {/* Header card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-orange-200">
                  <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                  Locker Room
                </div>
                <SportBadge sport="afl" />
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/70">
                  {roomIsYours}
                </span>
              </div>

              <h1 className="mt-2 text-xl md:text-2xl font-extrabold tracking-tight truncate">
                {room.name}
              </h1>

              {room.description ? (
                <p className="mt-1 text-[12px] md:text-sm text-white/60 max-w-3xl">
                  {room.description}
                </p>
              ) : (
                <p className="mt-1 text-[12px] md:text-sm text-white/50 max-w-3xl">
                  Private room — bragging rights only. Your global streak still
                  counts.
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                  Members:{" "}
                  <span className="text-white/80 font-bold">{membersCount}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                  Code:{" "}
                  <span className="font-mono text-white/90">
                    {room.inviteCode || "—"}
                  </span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full md:w-auto">
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:items-end">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!room.inviteCode}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-extrabold text-xs px-4 py-2 transition disabled:opacity-60"
                >
                  Copy code
                </button>

                <button
                  type="button"
                  onClick={handleShareInvite}
                  disabled={!room.inviteCode}
                  title={headerInviteText}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs px-4 py-2 transition disabled:opacity-60"
                >
                  Share invite
                </button>

                {isManager && (
                  <button
                    type="button"
                    onClick={handleDeleteRoom}
                    disabled={deleteLoading}
                    className="col-span-2 md:col-span-1 inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 text-red-200 font-extrabold text-xs px-4 py-2 transition disabled:opacity-60"
                  >
                    {deleteLoading ? "Deleting…" : "Delete room"}
                  </button>
                )}
              </div>

              {(error || success) && (
                <div className="mt-2 space-y-2">
                  {error && (
                    <p className="text-xs text-red-200 border border-red-500/35 rounded-xl bg-red-500/10 px-3 py-2">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-xs text-emerald-200 border border-emerald-500/35 rounded-xl bg-emerald-500/10 px-3 py-2">
                      {success}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
          {/* LEFT */}
          <div className="space-y-4">
            {/* Settings */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm md:text-base font-extrabold">
                  Room settings
                </h2>
                <span className="text-[11px] text-white/50">
                  {isManager ? "Manager controls" : "Read-only"}
                </span>
              </div>

              <form onSubmit={handleSave} className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    Room name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isManager}
                    className="w-full rounded-xl bg-black/35 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isManager}
                    rows={3}
                    className="w-full rounded-xl bg-black/35 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 disabled:opacity-60"
                    placeholder="What’s this room about?"
                  />
                </div>

                {isManager && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs px-4 py-2 transition disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}
              </form>
            </div>

            {/* Chat */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm md:text-base font-extrabold">Room chat</h2>
                <span className="text-[11px] text-white/50">Members only</span>
              </div>

              {!user && (
                <p className="mt-2 text-sm text-white/60">
                  Log in to join the chat.
                </p>
              )}

              {user && !isMemberUser && (
                <p className="mt-2 text-sm text-white/60">
                  You’re not a member of this room. Join to access chat.
                </p>
              )}

              {user && isMemberUser && (
                <>
                  <div className="mt-3 h-64 md:h-72 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 px-3 py-2 space-y-2">
                    {chatLoading ? (
                      <p className="text-xs text-white/60">Loading…</p>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-white/60">
                        No messages yet. Start the banter 👇
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const isOwn = !!user && msg.uid === user.uid;
                        const displayName = getBestProfileName(
                          msg.uid,
                          msg.displayName
                        );
                        const username = getBestProfileUsername(msg.uid);

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${
                              isOwn ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl px-3 py-2 border ${
                                isOwn
                                  ? "bg-orange-500 text-black border-orange-300"
                                  : "bg-[#050816] text-white border-white/15"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-extrabold truncate">
                                    {displayName}
                                  </span>
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
                              <p className="text-xs whitespace-pre-wrap break-words">
                                {msg.body}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {chatError && (
                    <p className="mt-2 text-xs text-red-300">{chatError}</p>
                  )}

                  <form
                    onSubmit={handleSendMessage}
                    className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      rows={2}
                      className="w-full rounded-2xl bg-black/35 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                      placeholder="Message…"
                    />
                    <button
                      type="submit"
                      disabled={sending || !chatInput.trim()}
                      className="h-[44px] inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs px-5 transition disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </form>

                  <p className="mt-2 text-[11px] text-white/45">
                    Keep it clean. Banter yes. Abuse no.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Members */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 lg:sticky lg:top-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm md:text-base font-extrabold">Members</h2>
              <span className="text-[11px] text-white/50">{members.length}</span>
            </div>

            {members.length === 0 ? (
              <p className="mt-2 text-sm text-white/60">
                No members yet. Share the invite code.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((m) => {
                  const displayName = getBestProfileName(m.uid, m.displayName);
                  const username = getBestProfileUsername(m.uid);
                  const isYou = !!user && user.uid === m.uid;

                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-black/25 border border-white/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold truncate">
                            {displayName}
                          </span>
                          {username && (
                            <span className="text-xs text-white/55 truncate">
                              {username}
                            </span>
                          )}
                          {isYou && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-white/70 bg-white/5">
                              YOU
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 border ${
                          m.role === "manager"
                            ? "border-orange-500/35 bg-orange-500/10 text-orange-200"
                            : "border-white/15 bg-white/5 text-white/70"
                        }`}
                      >
                        {m.role === "manager" ? "Manager" : "Member"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/50">
              Tip: share the code, then hit{" "}
              <span className="text-white/75 font-semibold">View ladder</span>.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
