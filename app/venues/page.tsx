// app/venues/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

type VenueLeague = {
  id: string;
  name: string;
  code: string;
  venueName?: string;
  location?: string;
  subscriptionStatus: SubscriptionStatus;
};

export default function VenueLeaguesPage() {
  const { user, loading } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [venues, setVenues] = useState<VenueLeague[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  const [userVenueIds, setUserVenueIds] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  // 🔹 Subscribe to all venue leagues (for search + "your venues" rendering)
  useEffect(() => {
    setVenuesLoading(true);
    setVenuesError(null);

    const venuesRef = collection(db, "venueLeagues");
    const qVenues = query(venuesRef);

    const unsub = onSnapshot(
      qVenues,
      (snap) => {
        const list: VenueLeague[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const subscriptionStatus: SubscriptionStatus =
            (data.subscriptionStatus as SubscriptionStatus) ?? "active";

          return {
            id: docSnap.id,
            name: data.name ?? "Venue League",
            code: data.code ?? "",
            venueName: data.venueName ?? data.venue ?? undefined,
            location: data.location ?? undefined,
            subscriptionStatus,
          };
        });
        setVenues(list);
        setVenuesLoading(false);
      },
      (err) => {
        console.error("Failed to load venue leagues", err);
        setVenues([]);
        setVenuesLoading(false);
        setVenuesError("Failed to load venue leagues.");
      }
    );

    return () => unsub();
  }, []);

  // 🔹 Watch current user's venueLeagueIds so "Your venue leagues" stays live
  useEffect(() => {
    if (!user) {
      setUserVenueIds([]);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setUserVenueIds([]);
          return;
        }
        const data = snap.data() as any;
        const ids: string[] = Array.isArray(data.venueLeagueIds)
          ? data.venueLeagueIds
          : [];
        setUserVenueIds(ids);
      },
      (err) => {
        console.error("Failed to watch user venueLeagueIds", err);
        setUserVenueIds([]);
      }
    );

    return () => unsub();
  }, [user]);

  const handleJoinVenue = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setJoinError("You need to be logged in to join a venue league.");
      return;
    }

    const trimmedCode = joinCode.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 4) {
      setJoinError("Please enter a valid venue code.");
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      // Find venue by code
      const venuesRef = collection(db, "venueLeagues");
      const qByCode = query(venuesRef, where("code", "==", trimmedCode));
      const snap = await getDocs(qByCode);

      if (snap.empty) {
        setJoinError("No venue found with that code. Double-check with the bar staff.");
        setJoinLoading(false);
        return;
      }

      const venueDoc = snap.docs[0];
      const venueData = venueDoc.data() as any;
      const venueId = venueDoc.id;
      const subscriptionStatus: SubscriptionStatus =
        (venueData.subscriptionStatus as SubscriptionStatus) ?? "active";

      if (subscriptionStatus !== "active") {
        setJoinError(
          "This venue league is currently inactive. Ask the venue about their STREAKr status."
        );
        setJoinLoading(false);
        return;
      }

      // Check if user already in this venue
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as any) : {};
      const existingIds: string[] = Array.isArray(userData.venueLeagueIds)
        ? userData.venueLeagueIds
        : [];

      if (existingIds.includes(venueId)) {
        // Already joined — no-op, but send them to leaderboard
        setJoinLoading(false);
        setJoinCode("");
        window.location.href = `/venues/${venueId}`;
        return;
      }

      // Add venue to user's venueLeagueIds
      await updateDoc(userRef, {
        venueLeagueIds: arrayUnion(venueId),
      });

      // Bump venue memberCount (best effort)
      try {
        await updateDoc(doc(db, "venueLeagues", venueId), {
          memberCount: increment(1),
        });
      } catch (err) {
        console.warn("Failed to increment venue memberCount", err);
      }

      setJoinLoading(false);
      setJoinCode("");
      // Go straight to the venue leaderboard
      window.location.href = `/venues/${venueId}`;
    } catch (err) {
      console.error("Failed to join venue league", err);
      setJoinError("Something went wrong joining the venue. Please try again.");
      setJoinLoading(false);
    }
  };

  // 🔹 Derive user's venues from all venues + venueLeagueIds
  const userVenues = useMemo(() => {
    if (!userVenueIds.length || !venues.length) return [];
    const idSet = new Set(userVenueIds);
    return venues.filter((v) => idSet.has(v.id));
  }, [userVenueIds, venues]);

  // 🔹 Search active venues by name or location
  const filteredVenues = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = venues.filter(
      (v) => v.subscriptionStatus === "active"
    );

    if (!term) return base;

    return base.filter((v) => {
      const name = v.name?.toLowerCase() ?? "";
      const venueName = v.venueName?.toLowerCase() ?? "";
      const location = v.location?.toLowerCase() ?? "";
      return (
        name.includes(term) ||
        venueName.includes(term) ||
        location.includes(term)
      );
    });
  }, [venues, searchTerm]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      {/* Header */}
      <div className="space-y-2 mb-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Venue Leagues</h1>
        <p className="text-sm text-white/70 max-w-2xl">
          Run STREAKr inside pubs, clubs and sporting venues. Players build the
          same streak as general play – but each venue has its own live ladder
          for bragging rights and promotions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT COLUMN: Join + Search */}
        <div className="space-y-5">
          {/* Join by code */}
          <div className="rounded-2xl bg-gradient-to-br from-[#020617] to-[#020617] border border-slate-800 px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.8)]">
            <h2 className="text-lg font-semibold mb-1">Join a venue league</h2>
            <p className="text-xs text-white/65 mb-4">
              Enter the 6-character code from table tents, posters or bar staff
              to appear on this venue&apos;s leaderboard.
            </p>

            <form onSubmit={handleJoinVenue} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/70">
                  Venue code from your pub or club
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full rounded-md bg-black/60 border border-slate-700 px-3 py-2 text-sm tracking-[0.25em] uppercase font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
                  placeholder="ABC123"
                />
              </div>

              {joinError && (
                <p className="text-xs text-red-400">{joinError}</p>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm px-4 py-2 transition disabled:opacity-60"
              >
                {joinLoading ? "Joining…" : "Join venue"}
              </button>
            </form>
          </div>

          {/* Search venues */}
          <div className="rounded-2xl bg-gradient-to-br from-[#020617] to-[#020617] border border-slate-800 px-4 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.75)]">
            <h2 className="text-lg font-semibold mb-1">Find a venue</h2>
            <p className="text-xs text-white/65 mb-3">
              Search partner venues by name or suburb. You&apos;ll still need
              the venue code (from staff or signage) to actually join.
            </p>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md bg-black/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80 mb-3"
              placeholder="E.g. Royal Hotel, Richmond"
            />

            {venuesLoading && (
              <p className="text-xs text-white/60">Loading venues…</p>
            )}
            {venuesError && (
              <p className="text-xs text-red-400">{venuesError}</p>
            )}

            {!venuesLoading && !venuesError && filteredVenues.length === 0 && (
              <p className="text-xs text-white/60">
                No partner venues match that search yet.
              </p>
            )}

            {!venuesLoading && !venuesError && filteredVenues.length > 0 && (
              <ul className="mt-2 space-y-2 max-h-64 overflow-y-auto text-xs">
                {filteredVenues.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/40 border border-slate-700 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">
                        {v.name}
                      </span>
                      {(v.venueName || v.location) && (
                        <span className="text-[11px] text-white/60">
                          {[v.venueName, v.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/venues/${v.id}`}
                      className="text-[11px] font-semibold text-orange-300 hover:text-orange-200"
                    >
                      View leaderboard →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Your venue leagues */}
        <div className="rounded-2xl bg-gradient-to-br from-[#020617] to-[#020617] border border-slate-800 px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-lg font-semibold">Your venue leagues</h2>
            {user && (
              <span className="text-[11px] text-white/60">
                Signed in as{" "}
                <span className="font-medium text-white">
                  {user.email ?? user.uid}
                </span>
              </span>
            )}
          </div>

          {!user && (
            <p className="text-sm text-white/70">
              Log in to see the venues you&apos;ve joined and view their
              leaderboards.
            </p>
          )}

          {user && userVenues.length === 0 && (
            <p className="text-sm text-white/70">
              You&apos;re not in any venue leagues yet. Join one with a code or
              ask staff if they&apos;re running a STREAKr Venue League.
            </p>
          )}

          {user && userVenues.length > 0 && (
            <ul className="mt-1 space-y-2 text-sm">
              {userVenues.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-black/40 border border-slate-700 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">
                      {v.name}
                    </span>
                    {(v.venueName || v.location) && (
                      <span className="text-xs text-white/60">
                        {[v.venueName, v.location]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/venues/${v.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-[11px] px-3 py-1 transition"
                  >
                    View leaderboard
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
