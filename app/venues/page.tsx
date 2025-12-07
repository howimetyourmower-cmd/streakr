// app/venues/page.tsx
"use client";

export const dynamic = "force-dynamic";

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

type SubscriptionStatus = "active" | "paused" | "cancelled";

type VenueLeague = {
  id: string;
  name: string;
  code: string;
  venueName?: string | null;
  location?: string | null;
  subscriptionStatus: SubscriptionStatus;
};

export default function VenuesPage() {
  const { user } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const [myVenues, setMyVenues] = useState<VenueLeague[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);

  // Load venues the current user has joined
  useEffect(() => {
    const loadVenues = async () => {
      if (!user) {
        setMyVenues([]);
        return;
      }

      setVenuesLoading(true);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          setMyVenues([]);
          setVenuesLoading(false);
          return;
        }

        const data = userSnap.data() as any;
        const venueIds: string[] = Array.isArray(data.venueLeagueIds)
          ? data.venueLeagueIds
          : [];

        if (!venueIds.length) {
          setMyVenues([]);
          setVenuesLoading(false);
          return;
        }

        const loaded: VenueLeague[] = [];

        for (const venueId of venueIds) {
          try {
            const vRef = doc(db, "venueLeagues", venueId);
            const vSnap = await getDoc(vRef);
            if (!vSnap.exists()) continue;
            const v = vSnap.data() as any;
            loaded.push({
              id: vSnap.id,
              name: v.name ?? "Venue STREAKr League",
              code: v.code ?? "",
              venueName: v.venueName ?? null,
              location: v.location ?? null,
              subscriptionStatus:
                (v.subscriptionStatus as SubscriptionStatus) ?? "active",
            });
          } catch (err) {
            console.error("Failed to load venue league", err);
          }
        }

        setMyVenues(loaded);
      } catch (err) {
        console.error("Failed to load user venue leagues", err);
        setMyVenues([]);
      } finally {
        setVenuesLoading(false);
      }
    };

    loadVenues();
  }, [user]);

  const handleJoinVenue = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setJoinError("You need to log in to join a venue league.");
      setJoinSuccess(null);
      return;
    }

    const codeRaw = joinCode.trim();
    if (!codeRaw || codeRaw.length < 4) {
      setJoinError("Enter the 6-character code from your venue.");
      setJoinSuccess(null);
      return;
    }

    const code = codeRaw.toUpperCase();

    setJoinLoading(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      // Find venue by code
      const venuesRef = collection(db, "venueLeagues");
      const q = query(venuesRef, where("code", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError("No venue league found with that code.");
        setJoinLoading(false);
        return;
      }

      const venueDoc = snap.docs[0];
      const vdata = venueDoc.data() as any;

      const venue: VenueLeague = {
        id: venueDoc.id,
        name: vdata.name ?? "Venue STREAKr League",
        code: vdata.code ?? code,
        venueName: vdata.venueName ?? null,
        location: vdata.location ?? null,
        subscriptionStatus:
          (vdata.subscriptionStatus as SubscriptionStatus) ?? "active",
      };

      // 1) Add venue ID to user's venueLeagueIds array
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          venueLeagueIds: arrayUnion(venue.id),
        },
        { merge: true }
      );

      // 2) Upsert member doc under venueLeagues/{venueId}/members/{uid}
      const memberRef = doc(db, "venueLeagues", venue.id, "members", user.uid);
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
          joinedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) Update local list if not already present
      setMyVenues((prev) => {
        const already = prev.some((p) => p.id === venue.id);
        if (already) return prev;
        return [...prev, venue];
      });

      setJoinSuccess(`Joined ${venue.name}`);
      setJoinError(null);
    } catch (err) {
      console.error("Failed to join venue league", err);
      setJoinError("Could not join that venue right now. Try again.");
      setJoinSuccess(null);
    } finally {
      setJoinLoading(false);
    }
  };

  const renderVenueStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center rounded-full border border-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Active
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center rounded-full border border-amber-400/70 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            Paused
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center rounded-full border border-rose-400/70 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
            Inactive
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-8">
        {/* Page header */}
        <header className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Venue Leagues</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Run STREAKr inside pubs, clubs and sporting venues. Players build
            the same streak as general play – but each venue also gets its own
            ladder for bragging rights and promotions.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)]">
          {/* LEFT: Join section */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-black/40">
              <h2 className="text-lg font-semibold mb-1">Join a venue league</h2>
              <p className="text-xs text-slate-400 mb-3">
                Enter the 6-character code from your venue&apos;s posters or QR
                table tents. You&apos;ll appear on their live leaderboard while
                your streak still counts for the main game.
              </p>

              {!user && (
                <p className="text-xs text-amber-300 mb-3">
                  Log in or create an account first so we can track your
                  streak.
                </p>
              )}

              <form
                onSubmit={handleJoinVenue}
                className="space-y-3 mt-2"
                autoComplete="off"
              >
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    Venue code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="text"
                      maxLength={8}
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      className="flex-1 rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm tracking-[0.3em] uppercase"
                      placeholder="ABC123"
                    />
                    <button
                      type="submit"
                      disabled={joinLoading || !user}
                      className="rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-black text-sm font-semibold px-4 py-2"
                    >
                      {joinLoading ? "Joining…" : "Join venue"}
                    </button>
                  </div>
                </div>

                {joinError && (
                  <p className="text-xs text-rose-400">{joinError}</p>
                )}
                {joinSuccess && (
                  <p className="text-xs text-emerald-400">{joinSuccess}</p>
                )}
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-200">
                How venue leagues work
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Your streak is shared between general play & venues.</li>
                <li>
                  Each venue has its own leaderboard and prize, run by the
                  venue.
                </li>
                <li>
                  Join using the code or QR while you&apos;re actually at the
                  venue.
                </li>
              </ul>
            </div>
          </section>

          {/* RIGHT: Your venue leagues */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-lg shadow-black/40 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Your venue leagues</h2>
              {user && (
                <span className="text-[11px] text-slate-400 truncate">
                  Signed in as {user.email ?? "player"}
                </span>
              )}
            </div>

            {venuesLoading ? (
              <p className="text-sm text-slate-300">
                Loading your venues…
              </p>
            ) : !user ? (
              <p className="text-sm text-slate-300">
                Log in to see venue leagues you&apos;ve joined.
              </p>
            ) : myVenues.length === 0 ? (
              <p className="text-sm text-slate-300">
                You&apos;re not in any venue leagues yet. Join one using a
                venue code from posters or QR codes at the bar.
              </p>
            ) : (
              <ul className="space-y-3">
                {myVenues.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900/80 to-slate-950/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-slate-50">
                        {v.name}
                      </p>
                      {(v.venueName || v.location) && (
                        <p className="text-xs text-slate-400">
                          {v.venueName}
                          {v.venueName && v.location ? " • " : ""}
                          {v.location}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">
                          Code:{" "}
                          <span className="font-mono text-slate-200">
                            {v.code}
                          </span>
                        </span>
                        {renderVenueStatusBadge(v.subscriptionStatus)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Link
                        href={`/venues/${v.id}`}
                        className="rounded-full bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-4 py-1.5"
                      >
                        View leaderboard
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
