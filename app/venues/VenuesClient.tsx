// /app/locker-rooms/LockerRoomsClient.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type LockerRoomType = "private" | "venue";

type LockerRoom = {
  id: string;
  type: LockerRoomType;
  name: string;
  code?: string | null;
  suburb?: string | null;
  isActive: boolean;
};

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function LockerRoomsClient() {
  const { user } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const [myRooms, setMyRooms] = useState<LockerRoom[]>([]);
  const [loading, setLoading] = useState(false);

  // Load locker rooms the current user has joined
  useEffect(() => {
    const load = async () => {
      if (!user) {
        setMyRooms([]);
        return;
      }

      setLoading(true);
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        const data = userSnap.exists() ? (userSnap.data() as any) : {};
        const roomIds: string[] = Array.isArray(data?.lockerRoomIds) ? data.lockerRoomIds : [];

        if (!roomIds.length) {
          setMyRooms([]);
          setLoading(false);
          return;
        }

        const loaded: LockerRoom[] = [];
        for (const id of roomIds) {
          try {
            const rRef = doc(db, "lockerRooms", id);
            const rSnap = await getDoc(rRef);
            if (!rSnap.exists()) continue;
            const r = rSnap.data() as any;

            loaded.push({
              id: rSnap.id,
              type: (r.type as LockerRoomType) ?? "private",
              name: r.name ?? "Locker Room",
              code: r.code ?? null,
              suburb: r.suburb ?? null,
              isActive: typeof r.isActive === "boolean" ? r.isActive : true,
            });
          } catch (e) {
            console.error("Failed to load locker room", e);
          }
        }

        setMyRooms(loaded);
      } catch (e) {
        console.error("Failed to load my locker rooms", e);
        setMyRooms([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setJoinError("You need to log in to join a locker room.");
      setJoinSuccess(null);
      return;
    }

    const raw = joinCode.trim();
    if (!raw || raw.length < 4) {
      setJoinError("Enter the code from the locker room invite or venue.");
      setJoinSuccess(null);
      return;
    }

    const code = raw.toUpperCase();
    setJoinLoading(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      const roomsRef = collection(db, "lockerRooms");
      const qRef = query(roomsRef, where("code", "==", code));
      const snap = await getDocs(qRef);

      if (snap.empty) {
        setJoinError("No locker room found with that code.");
        setJoinLoading(false);
        return;
      }

      const roomDoc = snap.docs[0];
      const r = roomDoc.data() as any;

      const room: LockerRoom = {
        id: roomDoc.id,
        type: (r.type as LockerRoomType) ?? "private",
        name: r.name ?? "Locker Room",
        code: r.code ?? code,
        suburb: r.suburb ?? null,
        isActive: typeof r.isActive === "boolean" ? r.isActive : true,
      };

      // Add to user lockerRoomIds
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          lockerRoomIds: arrayUnion(room.id),
        },
        { merge: true }
      );

      // Upsert member doc
      const memberRef = doc(db, "lockerRooms", room.id, "members", user.uid);
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
          role: "member",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMyRooms((prev) => {
        const already = prev.some((p) => p.id === room.id);
        if (already) return prev;
        return [...prev, room];
      });

      setJoinSuccess(`Joined ${room.name}`);
      setJoinError(null);
    } catch (err) {
      console.error("Failed to join locker room", err);
      setJoinError("Could not join right now. Try again.");
      setJoinSuccess(null);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreatePrivate = async () => {
    if (!user) {
      setJoinError("Log in to create a private locker room.");
      setJoinSuccess(null);
      return;
    }

    setJoinError(null);
    setJoinSuccess(null);
    setJoinLoading(true);

    try {
      const code = randomCode(6);
      const roomRef = doc(collection(db, "lockerRooms"));
      const roomId = roomRef.id;

      const name = "My Private Locker Room";

      await setDoc(
        roomRef,
        {
          type: "private",
          name,
          code,
          isActive: true,
          visibility: "invite_only",
          createdByUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Owner membership
      const memberRef = doc(db, "lockerRooms", roomId, "members", user.uid);
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
          role: "owner",
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Add to user doc
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          lockerRoomIds: arrayUnion(roomId),
        },
        { merge: true }
      );

      setMyRooms((prev) => [
        ...prev,
        { id: roomId, type: "private", name, code, isActive: true, suburb: null },
      ]);

      setJoinSuccess(`Created ${name} (code: ${code})`);
    } catch (e) {
      console.error("Create private locker room failed", e);
      setJoinError("Could not create locker room. Try again.");
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-[#050814] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Locker Rooms</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Private locker rooms (mates, work, group chats) are free forever. Venue locker rooms can unlock deals after you make picks.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-black/40">
              <h2 className="text-lg font-semibold mb-1">Join a locker room</h2>
              <p className="text-xs text-slate-400 mb-3">
                Enter a code from a private invite or a venue poster/QR.
              </p>

              {!user && (
                <p className="text-xs text-amber-300 mb-3">
                  Log in first so we can link membership to your streak profile.
                </p>
              )}

              <form onSubmit={handleJoin} className="space-y-3 mt-2" autoComplete="off">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="text"
                      maxLength={10}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="flex-1 rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm tracking-[0.3em] uppercase"
                      placeholder="ABC123"
                    />
                    <button
                      type="submit"
                      disabled={joinLoading || !user}
                      className="rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-black text-sm font-semibold px-4 py-2"
                    >
                      {joinLoading ? "Joining…" : "Join"}
                    </button>
                  </div>
                </div>

                {joinError && <p className="text-xs text-rose-400">{joinError}</p>}
                {joinSuccess && <p className="text-xs text-emerald-400">{joinSuccess}</p>}
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-black/40">
              <h2 className="text-lg font-semibold mb-1">Create a private locker room</h2>
              <p className="text-xs text-slate-400 mb-3">
                Free forever. Invite your mates or work crew with a code.
              </p>

              <button
                type="button"
                disabled={joinLoading || !user}
                onClick={handleCreatePrivate}
                className="rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-black px-5 py-2"
              >
                {joinLoading ? "Creating…" : "Create private locker room"}
              </button>

              {!user ? (
                <div className="mt-3 text-xs text-white/45">
                  Log in to create one.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-black/40 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Your locker rooms</h2>
              {user && (
                <span className="text-[11px] text-slate-400 truncate">
                  Signed in as {user.email ?? "player"}
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-slate-300">Loading…</p>
            ) : !user ? (
              <p className="text-sm text-slate-300">Log in to see your locker rooms.</p>
            ) : myRooms.length === 0 ? (
              <p className="text-sm text-slate-300">
                You’re not in any locker rooms yet. Join with a code or create one for your mates.
              </p>
            ) : (
              <ul className="space-y-3">
                {myRooms.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900/80 to-slate-950/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-slate-50">{r.name}</p>
                      <p className="text-xs text-slate-400">
                        {r.type === "venue" ? "Venue locker room" : "Private locker room"}
                        {r.suburb ? ` • ${r.suburb}` : ""}
                      </p>
                      {r.code ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Code: <span className="font-mono text-slate-200">{r.code}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Link
                        href={`/locker-rooms/${r.id}`}
                        className="rounded-full bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-4 py-1.5"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/55">
              <div className="font-black tracking-wide text-white/70">How it works</div>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                <li>You still pick from the normal Picks pages.</li>
                <li>Locker rooms show the same streak, filtered to members.</li>
                <li>Venues can run one active “after pick” offer at a time.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
