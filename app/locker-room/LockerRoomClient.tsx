// /app/locker-room/LockerRoomClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type Room = {
  id: string;
  name: string;
  inviteCode: string;
  managerId: string;
  description?: string;
  memberCount?: number;
  maxMembers?: number;
  sport?: string;
};

type MyRoomRow = {
  room: Room;
  uiRole: "manager" | "member";
};

function uniqById(list: MyRoomRow[]) {
  const map = new Map<string, MyRoomRow>();
  for (const item of list) map.set(item.room.id, item);
  return Array.from(map.values());
}

function normalizeCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

function safeStr(v: any, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function safeNum(v: any, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function Pill({
  children,
  tone = "orange",
}: {
  children: ReactNode;
  tone?: "orange" | "sky" | "zinc" | "emerald";
}) {
  const cls =
    tone === "orange"
      ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
      : tone === "sky"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
        : tone === "emerald"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

function Card({
  title,
  desc,
  children,
  accent = "orange",
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  accent?: "orange" | "sky" | "zinc" | "emerald";
}) {
  const top =
    accent === "orange"
      ? "from-orange-500/18"
      : accent === "sky"
        ? "from-sky-500/18"
        : accent === "emerald"
          ? "from-emerald-500/18"
          : "from-white/8";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] shadow-[0_0_40px_rgba(0,0,0,0.55)] overflow-hidden">
      <div
        className={`border-b border-white/10 bg-gradient-to-r ${top} via-transparent to-transparent px-4 py-3`}
      >
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-tight md:text-lg">
            {title}
          </h2>
          {desc ? (
            <p className="mt-0.5 text-[12px] leading-snug text-white/65">
              {desc}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function LockerRoomClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [myRooms, setMyRooms] = useState<MyRoomRow[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Join a room state
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => myRooms.find((x) => x.room.id === selectedRoomId) || null,
    [myRooms, selectedRoomId]
  );

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setMyRooms([]);
        setSelectedRoomId("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const uid = user.uid;

        // NOTE: Firestore collection remains "leagues" for now (no migration needed)
        const roomsRef = collection(db, "leagues");

        // 1) Rooms where I'm manager
        const managerQ = query(roomsRef, where("managerId", "==", uid), limit(50));
        const managerSnap = await getDocs(managerQ);

        const managerRooms: MyRoomRow[] = managerSnap.docs.map((d) => {
          const data = d.data() as any;

          const inviteCode = safeStr(
            data.inviteCode ?? data.code ?? data.leagueCode,
            ""
          );
          const managerId = safeStr(
            data.managerId ?? data.managerUid ?? data.managerUID,
            ""
          );

          const room: Room = {
            id: d.id,
            name: safeStr(data.name, "Unnamed room"),
            inviteCode,
            managerId,
            description: safeStr(data.description, ""),
            memberCount:
              typeof data.memberCount === "number"
                ? data.memberCount
                : Array.isArray(data.memberIds)
                  ? data.memberIds.length
                  : 0,
            maxMembers:
              typeof data.maxMembers === "number" ? data.maxMembers : undefined,
            sport: safeStr(data.sport, "afl").toLowerCase(),
          };

          return { room, uiRole: "manager" };
        });

        // 2) Rooms where I'm a member via collectionGroup members
        const membersCG = collectionGroup(db, "members");
        const membersQ = query(membersCG, where("uid", "==", uid), limit(150));
        const membersSnap = await getDocs(membersQ);

        const memberRows: MyRoomRow[] = await Promise.all(
          membersSnap.docs.map(async (m) => {
            const roomRef = m.ref.parent.parent;
            if (!roomRef) return null;

            const roomSnap = await getDoc(doc(db, "leagues", roomRef.id));
            if (!roomSnap.exists()) return null;

            const data = roomSnap.data() as any;

            const inviteCode = safeStr(
              data.inviteCode ?? data.code ?? data.leagueCode,
              ""
            );
            const managerId = safeStr(
              data.managerId ?? data.managerUid ?? data.managerUID,
              ""
            );

            const room: Room = {
              id: roomSnap.id,
              name: safeStr(data.name, "Unnamed room"),
              inviteCode,
              managerId,
              description: safeStr(data.description, ""),
              memberCount:
                typeof data.memberCount === "number"
                  ? data.memberCount
                  : Array.isArray(data.memberIds)
                    ? data.memberIds.length
                    : 0,
              maxMembers:
                typeof data.maxMembers === "number"
                  ? data.maxMembers
                  : undefined,
              sport: safeStr(data.sport, "afl").toLowerCase(),
            };

            const roleFromMember = (m.data() as any)?.role as
              | "manager"
              | "member"
              | undefined;

            const uiRole: "manager" | "member" =
              room.managerId === uid || roleFromMember === "manager"
                ? "manager"
                : "member";

            return { room, uiRole };
          })
        ).then((x) => x.filter(Boolean) as MyRoomRow[]);

        const merged = uniqById([...managerRooms, ...memberRows]).sort((a, b) =>
          a.room.name.localeCompare(b.room.name)
        );

        setMyRooms(merged);

        if (merged.length > 0) {
          setSelectedRoomId((prev) => {
            if (prev && merged.some((x) => x.room.id === prev)) return prev;
            return merged[0].room.id;
          });
        } else {
          setSelectedRoomId("");
        }
      } catch (e) {
        console.error(e);
        setError("Could not load your rooms. Please try again.");
        setMyRooms([]);
        setSelectedRoomId("");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid]);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    if (!user) {
      setJoinError("You need to be logged in to join a room.");
      return;
    }

    const code = normalizeCode(joinCode);
    if (!code || code.length < 4) {
      setJoinError("Enter a valid invite code.");
      return;
    }

    setJoining(true);

    try {
      // 1) Find room by inviteCode
      const roomsRef = collection(db, "leagues");
      const qRooms = query(roomsRef, where("inviteCode", "==", code), limit(1));
      const snap = await getDocs(qRooms);

      if (snap.empty) {
        setJoinError("No room found with that code.");
        return;
      }

      const roomDoc = snap.docs[0];
      const roomId = roomDoc.id;
      const data = roomDoc.data() as any;

      // AFL-only guard (you’re AFL-only right now)
      const sport = safeStr(data?.sport, "afl").toLowerCase();
      if (sport !== "afl") {
        setJoinError("That room isn’t an AFL room.");
        return;
      }

      const managerId = safeStr(
        data.managerId ?? data.managerUid ?? data.managerUID,
        ""
      );

      const memberCount = safeNum(
        data.memberCount,
        Array.isArray(data.memberIds) ? data.memberIds.length : 0
      );
      const maxMembers =
        typeof data.maxMembers === "number" ? data.maxMembers : undefined;

      if (
        typeof maxMembers === "number" &&
        maxMembers > 0 &&
        memberCount >= maxMembers
      ) {
        setJoinError("That room is full.");
        return;
      }

      // 2) Prevent double join / double increment
      const roomRef = doc(db, "leagues", roomId);
      const freshSnap = await getDoc(roomRef);
      if (!freshSnap.exists()) {
        setJoinError("That room no longer exists.");
        return;
      }

      const fresh = freshSnap.data() as any;
      const memberIds: string[] = Array.isArray(fresh.memberIds) ? fresh.memberIds : [];
      const alreadyMember = memberIds.includes(user.uid);

      // 3) Write member subdoc
      const memberRef = doc(db, "leagues", roomId, "members", user.uid);
      const displayName =
        (user as any).displayName ||
        (user as any).username ||
        (user as any).email ||
        "Player";

      await setDoc(
        memberRef,
        {
          uid: user.uid,
          displayName,
          role: user.uid === managerId ? "manager" : "member",
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Update room doc (memberIds + memberCount only if new)
      const updates: Record<string, any> = {
        memberIds: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      };
      if (!alreadyMember) updates.memberCount = increment(1);

      await updateDoc(roomRef, updates);

      // 5) Update users/{uid}.leagueIds (so “My rooms” is reliable)
      await setDoc(
        doc(db, "users", user.uid),
        { leagueIds: arrayUnion(roomId), updatedAt: serverTimestamp() },
        { merge: true }
      );

      setJoinSuccess("You’re in. Opening ladder…");
      setJoinCode("");

      router.push(`/locker-room/${roomId}/ladder`);
    } catch (err) {
      console.error(err);
      setJoinError("Failed to join room. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:py-7 space-y-4">
        {/* Compact header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:p-5 shadow-[0_0_45px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pill tone="orange">Locker Rooms live</Pill>
                <Pill tone="zinc">AFL</Pill>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
                Locker Room
              </h1>
              <p className="mt-1 text-[12px] leading-snug text-white/65 md:text-sm">
                Create a room, share a code, and battle your crew on a private ladder — while your streak still counts globally.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => router.push("/locker-room/create")}
                className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-[13px] font-extrabold text-black transition hover:bg-orange-400"
              >
                Create room
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("join");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
              >
                Join with code
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Main grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* LEFT: My rooms */}
          <Card
            title="My rooms"
            desc="Select a room, grab the code, and jump straight to the ladder."
            accent="orange"
          >
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                Loading…
              </div>
            ) : myRooms.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                No rooms yet — create one or join with a code.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    Room selector
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70"
                  >
                    {myRooms.map((x) => (
                      <option key={x.room.id} value={x.room.id}>
                        {x.room.name} {x.uiRole === "manager" ? "(Manager)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selected && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-extrabold">
                            {selected.room.name}
                          </div>
                          {selected.uiRole === "manager" ? (
                            <span className="text-[11px]">👑</span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-white/55">Invite code</span>
                          <span className="font-mono text-[12px] bg-white/5 border border-white/10 rounded-md px-2 py-1">
                            {selected.room.inviteCode || "—"}
                          </span>
                          <span className="text-[11px] text-white/45">
                            {typeof selected.room.memberCount === "number"
                              ? `${selected.room.memberCount} members`
                              : ""}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(`/locker-room/${selected.room.id}`)}
                        className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/10"
                      >
                        Open
                      </button>
                    </div>

                    {/* Primary CTA */}
                    <button
                      type="button"
                      onClick={() => router.push(`/locker-room/${selected.room.id}/ladder`)}
                      className="w-full inline-flex items-center justify-center rounded-2xl bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-[15px] px-5 py-3 transition-colors shadow-[0_10px_25px_rgba(249,115,22,0.25)]"
                    >
                      View ladder →
                    </button>

                    {/* Secondary CTAs */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/locker-room/${selected.room.id}`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[13px] px-4 py-2 transition-colors"
                      >
                        Room details
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push(`/locker-room/${selected.room.id}/manage`)}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-[13px] px-4 py-2 transition-colors"
                      >
                        Manage
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] text-white/65">
                          Share the code with your crew. Bragging rights live here.
                        </div>
                        <Pill tone={selected.uiRole === "manager" ? "emerald" : "zinc"}>
                          {selected.uiRole === "manager" ? "Manager" : "Member"}
                        </Pill>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* RIGHT: Create room */}
          <Card
            title="Create a room"
            desc="You’re the commish. One code. One ladder. Endless banter."
            accent="sky"
          >
            <div className="space-y-3">
              <ul className="text-sm text-white/70 space-y-2">
                <li className="flex gap-2">
                  <span className="mt-1 text-sky-300">•</span>
                  <span>Automatically become Room Manager</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 text-sky-300">•</span>
                  <span>Share a single invite code with the crew</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 text-sky-300">•</span>
                  <span>Your global streak still counts</span>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => router.push("/locker-room/create")}
                className="w-full inline-flex items-center justify-center rounded-2xl bg-sky-500 hover:bg-sky-400 text-black font-extrabold text-[14px] px-5 py-3 transition-colors shadow-[0_10px_25px_rgba(56,189,248,0.20)]"
              >
                Create room
              </button>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-[12px] text-white/60">
                Tip: keep the name short and savage — it looks cleaner on the ladder.
              </div>
            </div>
          </Card>
        </div>

        {/* FULL-WIDTH: Join */}
        <div id="join">
          <Card
            title="Join with a code"
            desc="Got a code from a mate? Drop it in and you’ll land straight to the ladder."
            accent="emerald"
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] items-start">
              <form onSubmit={handleJoin} className="contents">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                    Invite code
                  </label>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="E.g. TM668W"
                    className="w-full rounded-xl bg-[#050816]/80 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  {joinError && <p className="text-xs text-red-400">{joinError}</p>}
                  {joinSuccess && <p className="text-xs text-emerald-400">{joinSuccess}</p>}
                </div>

                <button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="h-[42px] md:mt-[22px] inline-flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[13px] px-6 py-2 transition-colors disabled:opacity-60"
                >
                  {joining ? "Joining…" : "Join room"}
                </button>
              </form>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="text-[12px] text-white/60">
                Rooms are private ladders. Your picks still count globally.
              </div>
              <div className="flex gap-2">
                <Pill tone="zinc">No gambling</Pill>
                <Pill tone="sky">Skill game</Pill>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
