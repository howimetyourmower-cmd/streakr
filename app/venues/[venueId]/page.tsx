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
  limit,
  onSnapshot,
  orderBy,
  query,
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
  description?: string | null;
  prizesHeadline?: string | null;
  prizesBody?: string | null;
  subscriptionStatus: SubscriptionStatus;
  activePlayerCount?: number | null;

  // vouchers
  voucherJoinEnabled?: boolean;
  voucherJoinTitle?: string | null;
  voucherJoinDescription?: string | null;
  voucherMilestoneEnabled?: boolean;
  voucherMilestoneTitle?: string | null;
  voucherMilestoneDescription?: string | null;
};

type VenueMember = {
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
  const venueId = params?.venueId as string;

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [members, setMembers] = useState<VenueMember[]>([]);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load venue shell (name, location, prize, vouchers etc.)
  useEffect(() => {
    if (!venueId) return;

    const loadVenue = async () => {
      setLoadingVenue(true);
      setError(null);

      try {
        const ref = doc(db, "venueLeagues", venueId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Venue league not found.");
          setVenue(null);
          setLoadingVenue(false);
          return;
        }

        const data = snap.data() as any;

        const v: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue STREAKr League",
          code: data.code ?? "",
          venueName: data.venueName ?? null,
          location: data.location ?? null,
          description: data.description ?? null,
          prizesHeadline: data.prizesHeadline ?? null,
          prizesBody: data.prizesBody ?? null,
          subscriptionStatus:
            (data.subscriptionStatus as SubscriptionStatus) ?? "active",
          activePlayerCount: data.activePlayerCount ?? null,
          voucherJoinEnabled: data.voucherJoinEnabled ?? false,
          voucherJoinTitle: data.voucherJoinTitle ?? null,
          voucherJoinDescription: data.voucherJoinDescription ?? null,
          voucherMilestoneEnabled: data.voucherMilestoneEnabled ?? false,
          voucherMilestoneTitle: data.voucherMilestoneTitle ?? null,
          voucherMilestoneDescription: data.voucherMilestoneDescription ?? null,
        };

        setVenue(v);
      } catch (err) {
        console.error("Failed to load venue league", err);
        setError("Failed to load venue league.");
      } finally {
        setLoadingVenue(false);
      }
    };

    loadVenue();
  }, [venueId]);

  // Live members + stats
  useEffect(() => {
    if (!venueId) return;

    const membersRef = collection(db, "venueLeagues", venueId, "members");
    const membersQuery = query(
      membersRef,
      orderBy("joinedAt", "asc"),
      limit(200)
    );

    setLoadingMembers(true);

    const unsub = onSnapshot(
      membersQuery,
      async (snapshot) => {
        try {
          const rows: VenueMember[] = [];

          for (const docSnap of snapshot.docs) {
            const m = docSnap.data() as any;
            const uid = m.uid as string;

            // pull stats from users collection
            let displayName = m.displayName || "Player";
            let username: string | undefined;
            let avatarUrl: string | undefined;
            let currentStreak = 0;
            let longestStreak = 0;
            let lifetimeWins = 0;
            let lifetimeLosses = 0;
            let lifetimePicks = 0;

            try {
              const userRef = doc(db, "users", uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const u = userSnap.data() as any;
                displayName =
                  u.displayName ||
                  u.username ||
                  u.name ||
                  m.displayName ||
                  "Player";
                username = u.username ?? undefined;
                avatarUrl = u.avatarUrl ?? undefined;
                currentStreak = u.currentStreak ?? 0;
                longestStreak = u.longestStreak ?? 0;
                lifetimeWins = u.lifetimeWins ?? 0;
                lifetimeLosses = u.lifetimeLosses ?? 0;
                lifetimePicks = u.lifetimePicks ?? 0;
              }
            } catch (err) {
              console.error("Failed to load user stats for venue member", err);
            }

            rows.push({
              uid,
              displayName,
              username,
              avatarUrl,
              currentStreak,
              longestStreak,
              lifetimeWins,
              lifetimeLosses,
              lifetimePicks,
            });
          }

          // sort: current streak desc, then wins desc, then total picks desc
          rows.sort((a, b) => {
            if (b.currentStreak !== a.currentStreak) {
              return b.currentStreak - a.currentStreak;
            }
            if (b.lifetimeWins !== a.lifetimeWins) {
              return b.lifetimeWins - a.lifetimeWins;
            }
            return b.lifetimePicks - a.lifetimePicks;
          });

          setMembers(rows);
          setLoadingMembers(false);
        } catch (err) {
          console.error("Failed to process venue members snapshot", err);
          setLoadingMembers(false);
        }
      },
      (err) => {
        console.error("Venue members listener error", err);
        setLoadingMembers(false);
      }
    );

    return () => unsub();
  }, [venueId]);

  const sortedMembers = members;
  const playerCount = sortedMembers.length;
  const currentUserUid = user?.uid;

  const statusLabel = useMemo(() => {
    if (!venue) return "";
    switch (venue.subscriptionStatus) {
      case "active":
        return "Active venue";
      case "paused":
        return "Paused";
      case "cancelled":
        return "Inactive";
      default:
        return "";
    }
  }, [venue]);

  const statusClasses = useMemo(() => {
    if (!venue) return "border-slate-600 text-slate-200";
    switch (venue.subscriptionStatus) {
      case "active":
        return "border-emerald-400 text-emerald-300 bg-emerald-400/10";
      case "paused":
        return "border-amber-400 text-amber-300 bg-amber-400/10";
      case "cancelled":
        return "border-rose-400 text-rose-300 bg-rose-400/10";
      default:
        return "border-slate-600 text-slate-200";
    }
  }, [venue]);

  if (loadingVenue) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-100">
        <div className="space-y-2 text-sm text-slate-400">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin mx-auto" />
          Loading venue league…
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-100 px-4 text-center">
        <p className="text-sm text-red-400 mb-4">
          {error ?? "Venue league not found."}
        </p>
        <Link
          href="/venues"
          className="bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm rounded-full px-5 py-2"
        >
          Back to venue leagues
        </Link>
      </div>
    );
  }

  const showPrizeBanner = !!venue.prizesHeadline || !!venue.prizesBody;
  const showOffers =
    venue.voucherJoinEnabled ||
    venue.voucherMilestoneEnabled;

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-6">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push("/picks")}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
        >
          <span>←</span>
          <span>Back to Picks</span>
        </button>

        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {venue.name}
            </h1>
            {(venue.venueName || venue.location) && (
              <p className="mt-1 text-sm text-slate-300">
                {venue.venueName}
                {venue.venueName && venue.location ? " • " : ""}
                {venue.location}
              </p>
            )}
            {venue.description && (
              <p className="mt-1 text-xs text-slate-400 max-w-xl">
                {venue.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Players checked in
                </p>
                <p className="text-lg font-semibold">
                  {playerCount}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClasses}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Prize spotlight banner */}
        {showPrizeBanner && (
          <div className="mt-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 text-black px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide font-semibold opacity-90">
                Venue prize spotlight
              </span>
              {venue.prizesHeadline && (
                <p className="text-sm font-semibold">
                  {venue.prizesHeadline}
                </p>
              )}
              {venue.prizesBody && (
                <p className="text-xs mt-0.5 opacity-90">
                  {venue.prizesBody}
                </p>
              )}
            </div>
            <div className="text-[11px] text-black/70 sm:text-right">
              Powered by STREAKr — venue-only competition
            </div>
          </div>
        )}

        {/* In-venue offers (from voucher config) */}
        {showOffers && (
          <div className="mt-2 rounded-xl border border-slate-700 bg-black/40 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                In-venue offers
              </h2>
              <span className="text-[11px] text-slate-400">
                Ask staff how to redeem
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {venue.voucherJoinEnabled && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300">
                    Join offer
                  </p>
                  {venue.voucherJoinTitle && (
                    <p className="text-sm font-semibold">
                      {venue.voucherJoinTitle}
                    </p>
                  )}
                  {venue.voucherJoinDescription && (
                    <p className="text-xs text-slate-300">
                      {venue.voucherJoinDescription}
                    </p>
                  )}
                </div>
              )}

              {venue.voucherMilestoneEnabled && (
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                    Streak milestone offer
                  </p>
                  {venue.voucherMilestoneTitle && (
                    <p className="text-sm font-semibold">
                      {venue.voucherMilestoneTitle}
                    </p>
                  )}
                  {venue.voucherMilestoneDescription && (
                    <p className="text-xs text-slate-300">
                      {venue.voucherMilestoneDescription}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sorting note */}
        <p className="mt-4 text-[11px] text-slate-400">
          Sorted by current streak, then wins, then total picks.
        </p>

        {/* Leaderboard table */}
        <section className="mt-2 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/90 border border-slate-800 shadow-[0_24px_60px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
            <div className="col-span-4 sm:col-span-4">Player</div>
            <div className="col-span-2 text-right sm:text-center">Current</div>
            <div className="col-span-2 text-right sm:text-center">Best</div>
            <div className="col-span-2 text-right sm:text-center">Wins</div>
            <div className="col-span-1 text-right sm:text-center hidden sm:block">
              Losses
            </div>
            <div className="col-span-2 sm:col-span-1 text-right">
              Total picks
            </div>
          </div>

          {loadingMembers ? (
            <div className="px-4 py-6 text-sm text-slate-300">
              Loading venue leaderboard…
            </div>
          ) : sortedMembers.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-300">
              No one has joined this venue league yet. Enter the venue code or
              scan the QR at the bar to be the first.
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {sortedMembers.map((m, index) => {
                const isYou = currentUserUid === m.uid;

                return (
                  <li
                    key={m.uid}
                    className={`grid grid-cols-12 px-4 py-3 items-center text-sm transition-colors ${
                      isYou
                        ? "bg-slate-800/60"
                        : index === 0
                        ? "bg-slate-900/80"
                        : "bg-transparent hover:bg-slate-900/60"
                    }`}
                  >
                    {/* Player */}
                    <div className="col-span-4 flex items-center gap-2">
                      {/* Avatar */}
                      <div className="h-7 w-7 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-xs font-semibold">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatarUrl}
                            alt={m.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>
                            {m.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {index + 1}. {m.displayName}
                          {isYou && (
                            <span className="ml-1 text-[11px] text-orange-300">
                              (You)
                            </span>
                          )}
                        </span>
                        {m.username && (
                          <span className="text-[11px] text-slate-400">
                            @{m.username}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current */}
                    <div className="col-span-2 text-right sm:text-center font-semibold text-sky-300">
                      {m.currentStreak}
                    </div>

                    {/* Best */}
                    <div className="col-span-2 text-right sm:text-center font-semibold text-emerald-300">
                      {m.longestStreak}
                    </div>

                    {/* Wins */}
                    <div className="col-span-2 text-right sm:text-center text-slate-100">
                      {m.lifetimeWins}
                    </div>

                    {/* Losses (hidden on very small view) */}
                    <div className="hidden sm:block col-span-1 text-right sm:text-center text-slate-300">
                      {m.lifetimeLosses}
                    </div>

                    {/* Total picks */}
                    <div className="col-span-2 sm:col-span-1 text-right text-slate-300">
                      {m.lifetimePicks}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
