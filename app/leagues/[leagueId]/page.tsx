// app/leagues/[leagueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, FormEvent, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
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

function normalizeCode(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
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

  const isManager = !!user && !!league && user.uid === league.managerId;

  // --- Chat state ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ✅ Mobile detection (so we only show SMS on phones)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    try {
      const ua = (navigator.userAgent || "").toLowerCase();
      const mobile =
        /iphone|ipad|ipod|android|mobile|windows phone/.test(ua) ||
        (navigator as any).userAgentData?.mobile === true;
      setIsMobile(!!mobile);
    } catch {
      setIsMobile(false);
    }
  }, []);

  // ✅ Share helpers
  const inviteCode = useMemo(() => normalizeCode(league?.inviteCode || ""), [league?.inviteCode]);

  const joinPath = useMemo(() => {
    if (!inviteCode) return "";
    return `/leagues/join?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  const shareLink = useMemo(() => {
    if (!joinPath) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin ? `${origin}${joinPath}` : joinPath;
  }, [joinPath]);

  const inviteText = useMemo(() => {
    if (!league || !inviteCode) return "";
    return `Join my STREAKr league "${league.name}" 🟧\n\nCode: ${inviteCode}\nLink: ${shareLink}`;
  }, [league, inviteCode, shareLink]);

  const smsHref = useMemo(() => {
    if (!inviteText) return "#";
    return `sms:?&body=${encodeURIComponent(inviteText)}`;
  }, [inviteText]);

  const mailHref = useMemo(() => {
    if (!inviteText) return "#";
    const subject = "STREAKr League Invite";
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(inviteText)}`;
  }, [inviteText]);

  const whatsappHref = useMemo(() => {
    if (!inviteText) return "#";
    // wa.me works for mobile and WhatsApp Web on desktop
    return `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
  }, [inviteText]);

  const handleShareInvite = async () => {
    if (!inviteText) return;

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "STREAKr League Invite",
          text: inviteText,
          url: shareLink || undefined,
        });
        return;
      }
    } catch {
      // ignore and fall back
    }

    try {
      await navigator.clipboard.writeText(inviteText);
      alert("Invite copied to clipboard ✅");
    } catch {
      alert("Couldn’t copy invite. You can still share the code shown.");
    }
  };

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

        const managerId: string = data.managerId ?? data.managerUid ?? data.managerUID ?? "";
        const inviteCodeRaw: string = data.inviteCode ?? data.code ?? data.leagueCode ?? "";

        const leagueData: League = {
          id: leagueSnap.id,
          name: data.name ?? "Unnamed league",
          inviteCode: inviteCodeRaw,
          managerId,
          description: data.description ?? "",
          memberCount: data.memberCount ?? (data.memberIds?.length ?? 0) ?? 0,
        };

        setLeague(leagueData);
        setName(leagueData.name);
        setDescription(leagueData.description ?? "");

        const membersRef = collection(leagueRef, "members");
        const membersQ = query(membersRef, orderBy("joinedAt", "asc"), limit(200));
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

  const isMemberUser =
    !!user &&
    !!league &&
    (user.uid === league.managerId || members.some((m) => m.uid === user.uid));

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

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatMessageTime = (d?: Date | null) => {
    if (!d) return "";
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
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
      const messagesRef = collection(db, "leagues", leagueId, "messages");
      await addDoc(messagesRef, {
        uid: user.uid,
        displayName:
          (user as any).displayName ||
          (user as any).name ||
          (user as any).email ||
          "Player",
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
      <div className="py-6 md:py-8">
        <p className="text-sm text-white/70">Loading league…</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-3 py-5 md:py-6 space-y-4">
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
    <div className="py-6 md:py-8 space-y-6">
      <Link href="/leagues" className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to leagues
      </Link>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">{league.name}</h1>
            <SportBadge sport="afl" />
          </div>
          <p className="mt-1 text-sm text-white/70 max-w-2xl">
            Private league. Your streak still counts on the global ladder – this
            page is just for bragging rights with your mates, work crew or fantasy
            league.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-1">
              {inviteCode || "—"}
            </span>

            <button
              type="button"
              onClick={() => inviteCode && navigator.clipboard.writeText(inviteCode)}
              className="text-sky-400 hover:text-sky-300 disabled:opacity-60"
              disabled={!inviteCode}
            >
              Copy code
            </button>

            <button
              type="button"
              onClick={handleShareInvite}
              className="rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-[11px] px-3 py-1.5 transition-colors disabled:opacity-60"
              disabled={!inviteCode}
            >
              Share invite
            </button>
          </div>

          {inviteCode && (
            <div className="flex flex-wrap gap-2">
              {/* ✅ Only show SMS on mobile to avoid desktop “Pick an app” prompt */}
              {isMobile && (
                <a
                  href={smsHref}
                  className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] px-3 py-1.5 transition-colors"
                >
                  Text (SMS)
                </a>
              )}

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] px-3 py-1.5 transition-colors"
              >
                WhatsApp
              </a>

              <a
                href={mailHref}
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] px-3 py-1.5 transition-colors"
              >
                Email
              </a>

              {/* ✅ Desktop-friendly: always available */}
              <button
                type="button"
                onClick={handleShareInvite}
                className="rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] px-3 py-1.5 transition-colors"
              >
                Copy invite text
              </button>
            </div>
          )}

          <span className="text-white/60">
            Members: {league.memberCount ?? members.length}
          </span>

          {inviteCode && shareLink && (
            <div className="text-[10px] text-white/45 max-w-[420px] break-all">
              Join link:{" "}
              <Link href={joinPath} className="text-orange-300 hover:text-orange-200 font-semibold">
                {shareLink}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">League settings</h2>
            {isManager ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-orange-500/40 text-orange-300 px-2 py-1 text-[11px] uppercase tracking-wide">
                League Manager
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 text-white/70 px-2 py-1 text-[11px] uppercase tracking-wide">
                Member
              </span>
            )}
          </div>

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
                placeholder="E.g. Season-long office comp. Winner shouts the end-of-year pub session."
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

        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">League members</h2>
            {isManager && (
              <button
                type="button"
                onClick={handleDeleteLeague}
                disabled={deleteLoading}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {deleteLoading ? "Deleting…" : "Delete league"}
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-white/70">
              No members yet. Share your invite code to get the crew in.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-black/20 border border-white/10 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{m.displayName}</span>
                    <span className="text-xs text-white/60">{m.uid}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 border border-white/15 text-white/70">
                    {m.role === "manager" ? "Manager" : "Member"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold">League chat</h2>
          <span className="text-[11px] text-white/60">
            Only members of this league can view and send messages.
          </span>
        </div>

        {!user && (
          <p className="text-sm text-white/70">Log in to join the conversation in this league.</p>
        )}

        {user && !isMemberUser && (
          <p className="text-sm text-white/70">
            You&apos;re not a member of this league. Join the league to access chat.
          </p>
        )}

        {user && isMemberUser && (
          <>
            <div className="h-64 max-h-80 overflow-y-auto rounded-xl bg-black/40 border border-white/10 px-3 py-2 space-y-2 text-sm">
              {chatLoading ? (
                <p className="text-xs text-white/60">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-white/60">No messages yet. Start the banter!</p>
              ) : (
                messages.map((msg) => {
                  const isOwn = !!user && msg.uid === user.uid;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 border text-xs ${
                          isOwn
                            ? "bg-orange-500 text-black border-orange-300"
                            : "bg-[#050816] text-white border-white/15"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold truncate">{msg.displayName}</span>
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

            {chatError && <p className="text-xs text-red-400">{chatError}</p>}

            <form onSubmit={handleSendMessage} className="mt-2 flex flex-col sm:flex-row gap-2">
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
                className="sm:self-end inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
