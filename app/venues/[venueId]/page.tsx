// app/venues/[venueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
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
  description?: string;
  subscriptionStatus: SubscriptionStatus;
};

type MemberRow = {
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

export default function VenueLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const venueId = params?.venueId as string | undefined;

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load venue details once
  useEffect(() => {
    if (!venueId) return;

    const loadVenue = async () => {
      setLoadingVenue(true);
      setError(null);

      try {
        const ref = doc(db, "venueLeagues", venueId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("This venue league could not be found.");
          setVenue(null);
          setLoadingVenue(false);
          return;
        }

        const data = snap.data() as any;
        const subscriptionStatus: SubscriptionStatus =
          (data.subscriptionStatus as SubscriptionStatus) ?? "active";

        setVenue({
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? "",
          venueName: data.venueName ?? data.venue ?? undefined,
          location: data.location ?? undefined,
          description: data.description ?? undefined,
          subscriptionStatus,
        });
      } catch (err) {
        console.error("Failed to load venue league", err);
        setError("Failed to load venue league.");
        setVenue(null);
      } finally {
        setLoadingVenue(false);
      }
    };

    loadVenue();
  }, [venueId]);

  // Live members / players in this venue league
  useEffect(() => {
    if (!venueId) return;

    setLoadingMembers(true);
    setError((prev) => prev); // keep any venue error

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("venueLeagueIds", "array-contains", venueId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: MemberRow[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          const displayName: string =
            data.displayName ||
            data.username ||
            data.name ||
            data.email ||
            "Player";

          return {
            uid: docSnap.id,
            displayName,
            username: data.username || undefined,
            avatarUrl: data.avatarUrl || undefined,
            currentStreak: Number(data.currentStreak ?? 0),
            longestStreak: Number(data.longestStreak ?? 0),
            lifetimeWins: Number(data.lifetimeWins ?? data.totalWins ?? 0),
            lifetimeLosses: Number(
              data.lifetimeLosses ?? data.totalLosses ?? 0
            ),
            lifetimePicks: Number(
              data.lifetimePicks ?? data.totalPicks ?? 0
            ),
          };
        });

        setMembers(rows);
        setLoadingMembers(false);
      },
      (err) => {
        console.error("Failed to load venue members", err);
        setMembers([]);
        setLoadingMembers(false);
        setError("Failed to load venue leaderboard.");
      }
    );

    return () => unsub();
  }, [venueId]);

  // Derived sorted leaderboard with ranks
  const sortedMembers = useMemo(() => {
    if (!members.length) return [];

    const copy = [...members];

    copy.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      if (b.lifetimeWins !== a.lifetimeWins) {
        return b.lifetimeWins - a.lifetimeWins;
      }
      return b.lifetimePicks - a.lifetimePicks;
    });

    return copy;
  }, [members]);

  const memberCount = members.length;

  if (!venueId) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">
        <p className="text-sm text-white/70">
          No venue id provided. Try navigating from the Venue Leagues page.
        </p>
      </div>
    );
  }

  const isInactive =
    venue && venue.subscriptionStatus !== "active";

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/picks")}
          className="text-xs sm:text-sm text-orange-400 hover:text-orange-300"
        >
          ← Back to Picks
        </button>
        <span className="text-[11px] text-white/50 uppercase tracking-wide">
          Venue league
        </span>
      </div>

      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-r from-[#020617] via-[#020617] to-black border border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.8)] px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {loadingVenue
              ? "Loading venue…"
              : venue?.name ?? "Venue league"}
          </h1>
          {venue?.venueName && (
            <p className="text-sm text-white/70">
              {venue.venueName}
              {venue.location ? ` • ${venue.location}` : ""}
            </p>
          )}
          {!venue?.venueName && venue?.location && (
            <p className="text-sm text-white/70">{venue.location}</p>
          )}
          {venue?.description && (
            <p className="text-xs text-white/60 max-w-xl">
              {venue.description}
            </p>
          )}
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[11px] uppercase tracking-wide text-white/60">
                Players checked in
              </span>
              <span className="text-xl font-semibold">
                {loadingMembers ? "…" : memberCount}
              </span>
            </div>
          </div>
          {venue && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide ${
                venue.subscriptionStatus === "active"
                  ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10"
                  : venue.subscriptionStatus === "paused"
                  ? "border-amber-400/60 text-amber-300 bg-amber-500/10"
                  : "border-red-400/60 text-red-300 bg-red-500/10"
              }`}
            >
              {venue.subscriptionStatus === "active"
                ? "Active venue"
                : venue.subscriptionStatus === "paused"
                ? "Paused"
                : "Inactive"}
            </span>
          )}
        </div>
      </div>

      {isInactive && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-xs sm:text-sm text-red-200">
          This venue league is currently inactive. Players can&apos;t join or
          earn venue-specific rewards until it&apos;s reactivated by STREAKr.
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-2">{error}</p>
      )}

      {/* Leaderboard */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Venue leaderboard</h2>
          <p className="text-[11px] text-white/60">
            Sorted by current streak, then wins, then total picks.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#020617] border border-slate-800 shadow-[0_18px_50px_rgba(0,0,0,0.85)]">
          {/* Desktop header */}
          <div className="hidden sm:grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-white/60 border-b border-slate-800">
            <div className="col-span-4">Player</div>
            <div className="col-span-2 text-right">Current</div>
            <div className="col-span-2 text-right">Best</div>
            <div className="col-span-1 text-right">Wins</div>
            <div className="col-span-1 text-right">Losses</div>
            <div className="col-span-2 text-right">Total picks</div>
          </div>

          {loadingMembers ? (
            <div className="px-4 py-5 text-sm text-white/70">
              Loading venue leaderboard…
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="px-4 py-5 text-sm text-white/70">
              No players in this venue league yet. Join from the Venue Leagues
              page using this venue’s code to appear here.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {sortedMembers.map((m, index) => {
                const isYou = user && m.uid === user.uid;
                const rank = index + 1;
                const hasAvatar =
                  typeof m.avatarUrl === "string" &&
                  m.avatarUrl.trim().length > 0;

                return (
                  <li
                    key={m.uid}
                    className={`px-4 py-3 text-sm sm:grid sm:grid-cols-12 sm:items-center flex flex-col gap-2 ${
                      isYou
                        ? "bg-gradient-to-r from-orange-500/15 via-sky-500/10 to-transparent"
                        : "bg-transparent"
                    }`}
                  >
                    {/* Player + rank */}
                    <div className="sm:col-span-4 flex items-center gap-3">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-800 border border-slate-600 text-[11px] font-semibold text-white/80">
                        #{rank}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatarUrl as string}
                            alt={m.displayName}
                            className="h-7 w-7 rounded-full border border-white/20 object-cover"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold">
                            {m.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {m.displayName}
                            {isYou && (
                              <span className="ml-1 text-[11px] text-orange-300 font-semibold">
                                (You)
                              </span>
                            )}
                          </span>
                          {m.username && (
                            <span className="text-[11px] text-white/60">
                              @{m.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats (desktop layout) */}
                    <div className="hidden sm:block sm:col-span-2 text-right font-semibold text-sky-300">
                      {m.currentStreak}
                    </div>
                    <div className="hidden sm:block sm:col-span-2 text-right font-semibold text-emerald-300">
                      {m.longestStreak}
                    </div>
                    <div className="hidden sm:block sm:col-span-1 text-right">
                      {m.lifetimeWins}
                    </div>
                    <div className="hidden sm:block sm:col-span-1 text-right">
                      {m.lifetimeLosses}
                    </div>
                    <div className="hidden sm:block sm:col-span-2 text-right">
                      {m.lifetimePicks}
                    </div>

                    {/* Mobile stats layout */}
                    <div className="sm:hidden grid grid-cols-3 gap-2 text-xs text-white/75 mt-1">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-white/50">
                          Current
                        </span>
                        <span className="font-semibold text-sky-300">
                          {m.currentStreak}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-white/50">
                          Best
                        </span>
                        <span className="font-semibold text-emerald-300">
                          {m.longestStreak}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wide text-white/50">
                          W / L / Picks
                        </span>
                        <span>
                          {m.lifetimeWins}–{m.lifetimeLosses} ·{" "}
                          {m.lifetimePicks}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
