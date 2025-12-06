// app/venues/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  arrayUnion,
  serverTimestamp,
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

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function VenuesPage() {
  const { user } = useAuth();

  // Create venue league (legacy UI – Streakr now uses admin page for creation)
  const [newName, setNewName] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Join venue league
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // User's venue leagues
  const [venues, setVenues] = useState<VenueLeague[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  // Load user's venue leagues from users/{uid}.venueLeagueIds[]
  useEffect(() => {
    if (!user) {
      setVenues([]);
      return;
    }

    setVenuesLoading(true);
    setVenuesError(null);

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        try {
          if (!snap.exists()) {
            setVenues([]);
            setVenuesLoading(false);
            return;
          }

          const data = snap.data() as any;
          const venueLeagueIds: string[] = Array.isArray(
            data.venueLeagueIds
          )
            ? data.venueLeagueIds
            : [];

          if (venueLeagueIds.length === 0) {
            setVenues([]);
            setVenuesLoading(false);
            return;
          }

          const results: VenueLeague[] = [];
          for (const id of venueLeagueIds) {
            try {
              const vSnap = await getDoc(doc(db, "venueLeagues", id));
              if (!vSnap.exists()) continue;
              const vData = vSnap.data() as any;
              const subscriptionStatus: SubscriptionStatus =
                (vData.subscriptionStatus as SubscriptionStatus) ?? "active";

              results.push({
                id: vSnap.id,
                name: vData.name ?? "Venue League",
                code: vData.code ?? "",
                venueName: vData.venueName ?? vData.venue ?? undefined,
                location: vData.location ?? undefined,
                subscriptionStatus,
              });
            } catch (err) {
              console.error("Failed to load venue league", err);
            }
          }

          setVenues(results);
          setVenuesLoading(false);
        } catch (err) {
          console.error("Failed to process user venues", err);
          setVenues([]);
          setVenuesLoading(false);
          setVenuesError("Failed to load your venue leagues.");
        }
      },
      (err) => {
        console.error("User venues snapshot error", err);
        setVenues([]);
        setVenuesLoading(false);
        setVenuesError("Failed to load your venue leagues.");
      }
    );

    return () => {
      unsub();
    };
  }, [user]);

  const handleCreateVenue = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setCreateError("You need to be logged in to create a venue league.");
      return;
    }

    const trimmedName = newName.trim();
    const trimmedVenueName = newVenueName.trim();
    const trimmedLocation = newLocation.trim();

    if (!trimmedName) {
      setCreateError("Give your venue league a name.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const code = generateCode(6);

      const venuesRef = collection(db, "venueLeagues");
      const venueDoc = await addDoc(venuesRef, {
        name: trimmedName,
        venueName: trimmedVenueName || null,
        location: trimmedLocation || null,
        code,
        managerUid: user.uid,
        createdAt: serverTimestamp(),
        subscriptionStatus: "active" as SubscriptionStatus,
      });

      // Attach venue to user
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        venueLeagueIds: arrayUnion(venueDoc.id),
      });

      setCreateSuccess(
        `Venue league created. Code: ${code} – share it with players at your venue.`
      );
      setNewName("");
      setNewVenueName("");
      setNewLocation("");
    } catch (err) {
      console.error("Failed to create venue league", err);
      setCreateError("Failed to create venue league. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinVenue = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setJoinError("You need to be logged in to join a venue league.");
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setJoinError("Enter a valid venue code.");
      return;
    }

    setJoining(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      const venuesRef = collection(db, "venueLeagues");
      const q = query(venuesRef, where("code", "==", code), limit(1));
      const snap = await getDocs(q);

      if (snap.empty) {
        setJoinError("No venue league found with that code.");
        setJoining(false);
        return;
      }

      const venueDoc = snap.docs[0];
      const vData = venueDoc.data() as any;
      const subscriptionStatus: SubscriptionStatus =
        (vData.subscriptionStatus as SubscriptionStatus) ?? "active";

      if (subscriptionStatus !== "active") {
        setJoinError(
          "This venue league is currently inactive. Please speak to the venue about reactivating it."
        );
        setJoining(false);
        return;
      }

      const venueId = venueDoc.id;

      // Attach venue to user
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        venueLeagueIds: arrayUnion(venueId),
      });

      // --- First-time join voucher (if configured on venue) ---
      let issuedJoinVoucher = false;
      let issuedJoinVoucherDescription = "";

      if (vData.joinOfferEnabled && vData.joinOfferDescription) {
        try {
          const vouchersRef = collection(
            db,
            "users",
            user.uid,
            "vouchers"
          );
          const existingQ = query(
            vouchersRef,
            where("venueId", "==", venueId),
            where("type", "==", "join"),
            limit(1)
          );
          const existingSnap = await getDocs(existingQ);

          if (existingSnap.empty) {
            await addDoc(vouchersRef, {
              venueId,
              venueName: vData.venueName ?? vData.name ?? null,
              type: "join",
              status: "active",
              description: vData.joinOfferDescription,
              createdAt: serverTimestamp(),
              source: "venue-join",
            });

            issuedJoinVoucher = true;
            issuedJoinVoucherDescription = vData.joinOfferDescription;
          }
        } catch (voucherErr) {
          console.error("Failed to issue join voucher", voucherErr);
          // Do not block joining on voucher errors.
        }
      }

      let successMessage = `Joined ${
        vData.name ?? "Venue League"
      }. You’ll now appear on their venue leaderboard.`;

      if (issuedJoinVoucher && issuedJoinVoucherDescription) {
        successMessage += ` You also unlocked: ${issuedJoinVoucherDescription}. Show your voucher in the app at the bar to redeem.`;
      }

      setJoinSuccess(successMessage);
      setJoinCode("");
    } catch (err) {
      console.error("Failed to join venue league", err);
      setJoinError("Failed to join venue league. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Venue Leagues</h1>
        <Link
          href="/picks"
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Back to picks
        </Link>
      </div>

      <p className="text-sm text-white/70 max-w-2xl">
        Run STREAKr inside pubs, clubs and sporting venues. Players build the
        same streak as general play – but each venue also gets its own ladder
        for bragging rights and promotions.
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
        {/* Create / Join column */}
        <div className="space-y-4">
          {/* Create venue league */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Create a venue league</h2>
            <p className="text-xs text-white/70">
              In production, venue leagues are created by Streakr staff via the
              admin console. This in-app creator is primarily for testing and
              early rollout.
            </p>

            {!user && (
              <p className="text-xs text-white/70">
                Log in to create a venue league for your pub or club.
              </p>
            )}

            {user && (
              <>
                {createError && (
                  <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                    {createError}
                  </p>
                )}
                {createSuccess && (
                  <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
                    {createSuccess}
                  </p>
                )}

                <form
                  onSubmit={handleCreateVenue}
                  className="space-y-3 text-sm"
                >
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/70">
                      League name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                      placeholder="E.g. The Royal Hotel STREAKr"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/70">
                      Venue name (optional)
                    </label>
                    <input
                      type="text"
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                      placeholder="E.g. The Royal Hotel"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-white/70">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                      placeholder="E.g. Richmond, VIC"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
                  >
                    {creating ? "Creating…" : "Create venue league"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Join venue league */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Join a venue league</h2>
            <p className="text-xs text-white/70">
              Enter the 6-character code from your venue to appear on their
              leaderboard. If the league is inactive, you won&apos;t be able to
              join until it&apos;s reactivated.
            </p>

            {joinError && (
              <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                {joinError}
              </p>
            )}
            {joinSuccess && (
              <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
                {joinSuccess}
              </p>
            )}

            <form
              onSubmit={handleJoinVenue}
              className="flex flex-col sm:flex-row gap-2 text-sm"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase())
                }
                className="flex-1 rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm tracking-[0.3em] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="VENUEC"
                maxLength={8}
              />
              <button
                type="submit"
                disabled={joining}
                className="inline-flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 text-black font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-60"
              >
                {joining ? "Joining…" : "Join venue"}
              </button>
            </form>
          </div>
        </div>

        {/* Venues list column */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your venue leagues</h2>
            <span className="text-[11px] text-white/60">
              Each venue has its own live leaderboard.
            </span>
          </div>

          {venuesError && (
            <p className="text-sm text-red-400">{venuesError}</p>
          )}

          {venuesLoading && !venuesError && (
            <p className="text-sm text-white/70">Loading venues…</p>
          )}

          {!venuesLoading && venues.length === 0 && (
            <p className="text-sm text-white/70">
              You&apos;re not in any venue leagues yet. Create one for your
              venue (during testing) or join using a code at a participating
              venue.
            </p>
          )}

          {!venuesLoading && venues.length > 0 && (
            <ul className="space-y-3 text-sm">
              {venues.map((v) => {
                const statusLabel =
                  v.subscriptionStatus === "active"
                    ? "Active"
                    : v.subscriptionStatus === "paused"
                    ? "Paused"
                    : "Cancelled";

                const statusClass =
                  v.subscriptionStatus === "active"
                    ? "text-emerald-300 border-emerald-400/60 bg-emerald-500/10"
                    : v.subscriptionStatus === "paused"
                    ? "text-amber-300 border-amber-400/60 bg-amber-500/10"
                    : "text-red-300 border-red-400/60 bg-red-500/10";

                return (
                  <li
                    key={v.id}
                    className="rounded-2xl bg-black/20 border border-white/10 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{v.name}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      {v.venueName && (
                        <span className="text-xs text-white/70">
                          {v.venueName}
                          {v.location ? ` • ${v.location}` : ""}
                        </span>
                      )}
                      {!v.venueName && v.location && (
                        <span className="text-xs text-white/70">
                          {v.location}
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                        <span className="uppercase tracking-wide text-[10px]">
                          Code
                        </span>
                        <span className="font-mono bg-white/5 border border-white/10 rounded-md px-2 py-1">
                          {v.code}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(v.code)
                          }
                          className="text-sky-400 hover:text-sky-300"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                      <Link
                        href={`/venues/${v.id}`}
                        className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs px-4 py-1.5 transition-colors"
                      >
                        View leaderboard
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
