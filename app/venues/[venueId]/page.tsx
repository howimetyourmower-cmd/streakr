// app/venues/[venueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type VenueLeague = {
  id: string;
  name: string;
  code?: string;
  venueName?: string;
  location?: string;
  description?: string;
};

type VenueLeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  currentStreak: number;
  longestStreak: number;
  lifetimeWins: number;
  lifetimeLosses: number;
  lifetimePicks: number;
};

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return fallback;
}

export default function VenueLeaguePage() {
  const params = useParams();
  const venueId = params?.venueId as string;
  const { user } = useAuth();
  const currentUid = user?.uid ?? null;

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [venueError, setVenueError] = useState<string | null>(null);

  const [entries, setEntries] = useState<VenueLeaderboardEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  // Load venue league meta
  useEffect(() => {
    if (!venueId) return;

    setLoadingVenue(true);
    setVenueError(null);

    const venueRef = doc(db, "venueLeagues", venueId);
    const unsub = onSnapshot(
      venueRef,
      (snap) => {
        if (!snap.exists()) {
          setVenue(null);
          setVenueError("Venue league not found.");
          setLoadingVenue(false);
          return;
        }

        const data = snap.data() as any;
        const v: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? undefined,
          venueName: data.venueName ?? data.venue ?? undefined,
          location: data.location ?? undefined,
          description: data.description ?? undefined,
        };

        setVenue(v);
        setLoadingVenue(false);
      },
      (err) => {
        console.error("Failed to load venue league", err);
        setVenue(null);
        setVenueError("Failed to load venue league.");
        setLoadingVenue(false);
      }
    );

    return () => unsub();
  }, [venueId]);

  // Load venue leaderboard (users with this venueId in venueLeagueIds)
  useEffect(() => {
    if (!venueId) return;

    setLoadingEntries(true);
    setEntriesError(null);

    const usersRef = collection(db, "users");
    const qUsers = query(
      usersRef,
      where("venueLeagueIds", "array-contains", venueId)
    );

    const unsub = onSnapshot(
      qUsers,
      (snapshot) => {
        const list: VenueLeaderboardEntry[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const displayName: string =
            data.displayName || data.name || "Player";

          return {
            uid: docSnap.id,
            displayName,
            username: data.username || undefined,
            avatarUrl: data.avatarUrl || data.photoURL || undefined,
            currentStreak: safeNumber(
              data.currentStreak ?? data.currentStreakAFL
            ),
            longestStreak: safeNumber(
              data.longestStreak ??
                data.bestStreak ??
                data.longestStreakAFL
            ),
            lifetimeWins: safeNumber(
              data.lifetimeWins ?? data.totalWins
            ),
            lifetimeLosses: safeNumber(
              data.lifetimeLosses ?? data.totalLosses
            ),
            lifetimePicks: safeNumber(data.lifetimePicks),
          };
        });

        setEntries(list);
        setLoadingEntries(false);
      },
      (err) => {
        console.error("Failed to load venue members", err);
        setEntries([]);
        setEntriesError("Failed to load venue leaderboard.");
        setLoadingEntries(false);
      }
    );

    return () => unsub();
  }, [venueId]);

  const sortedEntries = useMemo(() => {
    const copy = [...entries];

    copy.sort((a, b) => {
      // 1) Highest current streak
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      // 2) Then highest wins
      if (b.lifetimeWins !== a.lifetimeWins) {
        return b.lifetimeWins - a.lifetimeWins;
      }
      // 3) Then highest total picks
      if (b.lifetimePicks !== a.lifetimePicks) {
        return b.lifetimePicks - a.lifetimePicks;
      }
      // 4) Stable alphabetical by name
      return a.displayName.localeCompare(b.displayName);
    });

    return copy;
  }, [entries]);

  const isLoading = loadingVenue || loadingEntries;
  const hasEntries = sortedEntries.length > 0;
  const totalMembers = sortedEntries.length;

  if (loadingVenue && !venue && !venueError) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">
        <p className="text-sm text-white/70">Loading venue league…</p>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-4">
        <Link
          href="/venues"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to venues
        </Link>
        <p className="text-sm text-red-400">
          {venueError ?? "Venue league not found or no longer available."}
        </p>
      </div>
    );
  }

  const headerTitle = venue.name ?? "Venue League";
  const headerSubtitle =
    venue.venueName ??
    venue.location ??
    venue.description ??
    "Venue league leaderboard";

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/venues"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to venues
        </Link>
        <Link
          href="/picks"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Back to picks
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            {headerTitle}
          </h1>
          {headerSubtitle && (
            <p className="mt-1 text-sm text-white/70 max-w-xl">
              {headerSubtitle}
            </p>
          )}
          <p className="mt-1 text-xs text-white/60">
            {isLoading
              ? "Loading venue and members…"
              : `${totalMembers} player${totalMembers === 1 ? "" : "s"} in this venue league`}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2 text-xs">
          {venue.code && (
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide text-[10px] text-white/60">
                League code
              </span>
              <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-1">
                {venue.code}
              </span>
            </div>
          )}
          <span className="text-white/60">
            Live venue leaderboard – streaks count towards your global record.
          </span>
        </div>
      </div>

      {/* Info strip */}
      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-xs sm:text-sm text-white/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span>
          Ranking is based on current streak, then total wins, then total
          picks.
        </span>
        <span className="text-white/60">
          Updates in real time as players join and their streaks change.
        </span>
      </div>

      {/* Errors / loading */}
      {entriesError && (
        <p className="text-sm text-red-400">{entriesError}</p>
      )}
      {isLoading && !entriesError && (
        <p className="text-sm text-white/70">Loading leaderboard…</p>
      )}

      {/* Empty state */}
      {!isLoading && !entriesError && !hasEntries && (
        <div className="rounded-2xl bg-gradient-to-b from-[#020617] to-[#020617] border border-slate-800 px-4 py-8 text-center text-sm text-white/70 shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
          No players are linked to this venue league yet.
          <br />
          Once players join using this venue code and start making picks,
          they&apos;ll appear here.
        </div>
      )}

      {/* Leaderboard */}
      {!isLoading && !entriesError && hasEntries && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-2xl bg-[#020617] border border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
            <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-white/60 border-b border-slate-800">
              <div className="col-span-1">#</div>
              <div className="col-span-4">User</div>
              <div className="col-span-1 text-right">Curr</div>
              <div className="col-span-1 text-right">Best</div>
              <div className="col-span-1 text-right">Wins</div>
              <div className="col-span-1 text-right">Losses</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-2" />
            </div>
            <ul className="divide-y divide-slate-800">
              {sortedEntries.map((entry, index) => {
                const isYou = currentUid && entry.uid === currentUid;
                const hasAvatar =
                  typeof entry.avatarUrl === "string" &&
                  entry.avatarUrl.trim().length > 0;

                return (
                  <li
                    key={entry.uid}
                    className={`grid grid-cols-12 px-4 py-3 items-center text-sm transform transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-slate-800/40 ${
                      isYou
                        ? "bg-gradient-to-r from-orange-500/10 via-sky-500/5 to-transparent"
                        : "bg-transparent"
                    }`}
                  >
                    <div className="col-span-1 font-semibold text-white/80">
                      #{index + 1}
                    </div>

                    <div className="col-span-4 flex items-center gap-2">
                      {hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.avatarUrl as string}
                          alt={entry.displayName}
                          className="h-7 w-7 rounded-full border border-white/20 object-cover"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                          {entry.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {entry.displayName}
                          {isYou && (
                            <span className="ml-1 text-[11px] text-orange-300 font-semibold">
                              (You)
                            </span>
                          )}
                        </span>
                        {entry.username && (
                          <span className="text-[11px] text-white/60">
                            @{entry.username}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-1 text-right font-semibold text-sky-300">
                      {entry.currentStreak}
                    </div>
                    <div className="col-span-1 text-right font-semibold text-emerald-300">
                      {entry.longestStreak}
                    </div>
                    <div className="col-span-1 text-right font-semibold text-emerald-300">
                      {entry.lifetimeWins}
                    </div>
                    <div className="col-span-1 text-right font-semibold text-rose-300">
                      {entry.lifetimeLosses}
                    </div>
                    <div className="col-span-1 text-right font-mono text-white/90">
                      {entry.lifetimePicks}
                    </div>
                    <div className="col-span-2" />
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {sortedEntries.map((entry, index) => {
              const isYou = currentUid && entry.uid === currentUid;
              const hasAvatar =
                typeof entry.avatarUrl === "string" &&
                entry.avatarUrl.trim().length > 0;

              return (
                <div
                  key={entry.uid}
                  className={`rounded-2xl bg-[#020617] border border-slate-800 px-3 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.9)] ${
                    isYou
                      ? "ring-1 ring-orange-400/70 bg-gradient-to-r from-orange-500/10 via-sky-500/5 to-transparent"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">
                        #{index + 1}
                      </span>
                      {hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.avatarUrl as string}
                          alt={entry.displayName}
                          className="h-8 w-8 rounded-full border border-white/20 object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                          {entry.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {entry.displayName}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.username && (
                            <span className="text-[11px] text-white/60">
                              @{entry.username}
                            </span>
                          )}
                          {isYou && (
                            <span className="rounded-full bg-orange-500/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-white/80">
                    <div className="rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/50">
                        Current
                      </p>
                      <p className="mt-1 text-base font-bold text-sky-300">
                        {entry.currentStreak}
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/50">
                        Best
                      </p>
                      <p className="mt-1 text-base font-bold text-emerald-300">
                        {entry.longestStreak}
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/50">
                        Total Picks
                      </p>
                      <p className="mt-1 text-base font-bold text-white">
                        {entry.lifetimePicks}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/80">
                    <div className="rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/50">
                        Wins
                      </p>
                      <p className="mt-1 text-base font-bold text-emerald-300">
                        {entry.lifetimeWins}
                      </p>
                    </div>
                    <div className="rounded-lg bg-black/40 border border-white/10 px-2 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-white/50">
                        Losses
                      </p>
                      <p className="mt-1 text-base font-bold text-rose-300">
                        {entry.lifetimeLosses}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
