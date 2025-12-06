// /app/venues/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type VenueLeague = {
  id: string;
  name: string;
  venueName: string;
  joinCode: string;
  createdBy: string;
  createdAt?: Date | null;
  memberCount: number;
};

function generateJoinCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function VenueLeaguesPage() {
  const { user } = useAuth();

  const [myLeagues, setMyLeagues] = useState<VenueLeague[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [leaguesError, setLeaguesError] = useState("");

  const [createName, setCreateName] = useState("");
  const [createVenueName, setCreateVenueName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");

  // ────────────────────────────────────────────
  // Load leagues the current user is a member of
  // ────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setMyLeagues([]);
      return;
    }

    setLoadingLeagues(true);
    setLeaguesError("");

    const leaguesRef = collection(db, "venueLeagues");
    const qRef = query(
      leaguesRef,
      where("memberIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        const list: VenueLeague[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;

          list.push({
            id: docSnap.id,
            name: data.name || "Venue league",
            venueName: data.venueName || "",
            joinCode: data.joinCode || "",
            createdBy: data.createdBy || "",
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : null,
            memberCount:
              Array.isArray(data.memberIds) &&
              data.memberIds.filter(Boolean).length > 0
                ? data.memberIds.filter(Boolean).length
                : 1,
          });
        });

        // Sort: leagues you own first, then by name
        list.sort((a, b) => {
          if (a.createdBy === user.uid && b.createdBy !== user.uid) return -1;
          if (b.createdBy === user.uid && a.createdBy !== user.uid) return 1;
          return a.name.localeCompare(b.name);
        });

        setMyLeagues(list);
        setLoadingLeagues(false);
      },
      (err) => {
        console.error("venueLeagues listener error", err);
        setLeaguesError("Could not load your venue leagues.");
        setLoadingLeagues(false);
      }
    );

    return () => unsub();
  }, [user]);

  // ────────────────────────────────────────────
  // Create a new venue league (owner flow)
  // ────────────────────────────────────────────
  const handleCreateLeague = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setCreateMessage("You need to be logged in to create a league.");
      return;
    }

    const trimmedName = createName.trim();
    const trimmedVenue = createVenueName.trim();

    if (!trimmedName || !trimmedVenue) {
      setCreateMessage("Please add a league name and venue name.");
      return;
    }

    try {
      setIsCreating(true);
      setCreateMessage("");

      const joinCode = generateJoinCode(6);

      const leaguesRef = collection(db, "venueLeagues");
      const docRef = await addDoc(leaguesRef, {
        name: trimmedName,
        venueName: trimmedVenue,
        joinCode,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        memberIds: [user.uid],
      });

      // Also tag the league on the user document for future use
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          venueLeagueIds: arrayUnion(docRef.id),
        },
        { merge: true }
      );

      setCreateMessage(
        `League created. Your join code is ${joinCode}. Share this with players at your venue.`
      );
      setCreateName("");
      setCreateVenueName("");
    } catch (err) {
      console.error("create venue league error", err);
      setCreateMessage("Could not create league right now. Try again.");
    } finally {
      setIsCreating(false);
      // auto-clear message after a few seconds
      setTimeout(() => setCreateMessage(""), 6000);
    }
  };

  // ────────────────────────────────────────────
  // Join a venue league by code
  // ────────────────────────────────────────────
  const handleJoinLeague = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setJoinMessage("You need to be logged in to join a league.");
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinMessage("Enter a join code from your venue.");
      return;
    }

    try {
      setIsJoining(true);
      setJoinMessage("");

      const leaguesRef = collection(db, "venueLeagues");
      const qRef = query(leaguesRef, where("joinCode", "==", code));
      const snap = await new Promise<ReturnType<typeof qRef["withConverter"]>>(
        (resolve, reject) => {
          // little helper to use getDocs style without importing it
          onSnapshot(
            qRef,
            (s) => {
              resolve(s as any);
            },
            (err) => reject(err)
          );
        }
      );

      let foundDoc = null as any;

      (snap as any).forEach((docSnap: any) => {
        if (!foundDoc) foundDoc = docSnap;
      });

      if (!foundDoc) {
        setJoinMessage("No league found with that code.");
        return;
      }

      const leagueId = foundDoc.id;
      const leagueData = foundDoc.data() as any;

      // if already a member, no-op
      const memberIds: string[] = Array.isArray(leagueData.memberIds)
        ? leagueData.memberIds
        : [];
      if (memberIds.includes(user.uid)) {
        setJoinMessage("You’re already in this venue league.");
        return;
      }

      // Add user to league
      const leagueRef = doc(db, "venueLeagues", leagueId);
      await updateDoc(leagueRef, {
        memberIds: arrayUnion(user.uid),
      });

      // Also track on user document
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          venueLeagueIds: arrayUnion(leagueId),
        },
        { merge: true }
      );

      setJoinMessage(`Joined ${leagueData.name} at ${leagueData.venueName}.`);
      setJoinCode("");
    } catch (err) {
      console.error("join venue league error", err);
      setJoinMessage("Could not join league. Double-check the code.");
    } finally {
      setIsJoining(false);
      setTimeout(() => setJoinMessage(""), 6000);
    }
  };

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 text-white">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-1">
          Venue leagues
        </h1>
        <p className="text-sm sm:text-base text-white/75 max-w-2xl">
          Pubs, clubs and venues can run their own STREAKr competitions.
          Create a league for your venue, share the join code, and track who’s
          on top each round.
        </p>
      </header>

      {!user && (
        <div className="mb-6 rounded-xl border border-orange-400/60 bg-orange-500/10 px-4 py-3 text-sm">
          <p className="font-semibold mb-1">
            You&apos;re not logged in.
          </p>
          <p className="text-white/80 mb-2">
            Log in or create a free account to create or join venue leagues.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth?mode=login&returnTo=/venues"
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-orange-400"
            >
              Log in
            </Link>
            <Link
              href="/auth?mode=signup&returnTo=/venues"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-1.5 text-xs font-semibold hover:border-orange-400 hover:text-orange-200"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: leagues list */}
        <section className="rounded-2xl bg-[#020617] border border-slate-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">
              Your venue leagues
            </h2>
            {loadingLeagues && (
              <span className="text-[11px] text-white/60">
                Loading…
              </span>
            )}
          </div>

          {leaguesError && (
            <p className="text-xs text-red-400 mb-3">{leaguesError}</p>
          )}

          {user && myLeagues.length === 0 && !loadingLeagues && (
            <p className="text-sm text-white/70">
              You&apos;re not in any venue leagues yet. Create one for your
              venue, or join with a code from your local.
            </p>
          )}

          {!user && (
            <p className="text-sm text-white/70">
              Log in to see leagues you&apos;re a member of.
            </p>
          )}

          {user && myLeagues.length > 0 && (
            <ul className="space-y-3">
              {myLeagues.map((league) => {
                const isOwner = league.createdBy === user.uid;

                return (
                  <li
                    key={league.id}
                    className="rounded-xl border border-slate-600/70 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 px-4 py-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm sm:text-base font-semibold">
                          {league.name}
                        </p>
                        <p className="text-xs text-white/70">
                          {league.venueName}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-white/60">
                          Members
                        </span>
                        <span className="text-sm font-semibold">
                          {league.memberCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center rounded-full bg-slate-800/90 border border-slate-500/70 px-2 py-0.5">
                          <span className="uppercase tracking-wide text-white/70 mr-1">
                            Code
                          </span>
                          <span className="font-semibold">
                            {league.joinCode}
                          </span>
                        </span>
                        {isOwner && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/60 px-2 py-0.5 text-[10px] font-semibold text-amber-200 uppercase tracking-wide">
                            Venue owner
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/leagues/${league.id}`}
                        className="text-[11px] sm:text-xs font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      >
                        View venue leaderboard
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* RIGHT: create / join panels */}
        <section className="space-y-4">
          {/* CREATE */}
          <div className="rounded-2xl bg-[#020617] border border-emerald-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-1">
              Create a venue league
            </h2>
            <p className="text-xs sm:text-sm text-white/70 mb-4">
              For pub / club / venue managers. We&apos;ll generate a join
              code you can display on screens or posters for your customers.
            </p>

            <form
              onSubmit={handleCreateLeague}
              className="space-y-3 text-sm"
            >
              <div className="space-y-1">
                <label className="block text-[11px] uppercase tracking-wide text-white/60">
                  League name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Example: Thursday Night Tipping"
                  disabled={!user || isCreating}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] uppercase tracking-wide text-white/60">
                  Venue name
                </label>
                <input
                  type="text"
                  value={createVenueName}
                  onChange={(e) => setCreateVenueName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Example: The Railway Hotel, Richmond"
                  disabled={!user || isCreating}
                />
              </div>

              <button
                type="submit"
                disabled={!user || isCreating}
                className="mt-1 inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-semibold text-black hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-300"
              >
                {isCreating ? "Creating…" : "Create league"}
              </button>

              {createMessage && (
                <p className="text-[11px] mt-2 text-emerald-300">
                  {createMessage}
                </p>
              )}
            </form>
          </div>

          {/* JOIN */}
          <div className="rounded-2xl bg-[#020617] border border-sky-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-1">
              Join with a venue code
            </h2>
            <p className="text-xs sm:text-sm text-white/70 mb-4">
              Got a code from your local? Enter it here to join their venue
              leaderboard and compete for weekly prizes.
            </p>

            <form onSubmit={handleJoinLeague} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] uppercase tracking-wide text-white/60">
                  Join code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm tracking-[0.25em] text-center font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="ABC123"
                  maxLength={8}
                  disabled={!user || isJoining}
                />
              </div>

              <button
                type="submit"
                disabled={!user || isJoining}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-xs sm:text-sm font-semibold text-black hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-300"
              >
                {isJoining ? "Joining…" : "Join league"}
              </button>

              {joinMessage && (
                <p className="text-[11px] mt-2 text-sky-300">
                  {joinMessage}
                </p>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
