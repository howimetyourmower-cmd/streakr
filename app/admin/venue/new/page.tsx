// app/admin/venues/new/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function AdminCreateVenueLeaguePage() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [venueAdminUid, setVenueAdminUid] = useState("");
  const [code, setCode] = useState<string>(() => generateCode(6));
  const [subscriptionStatus] = useState<SubscriptionStatus>("active");
  const [notes, setNotes] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdVenueId, setCreatedVenueId] = useState<string | null>(null);

  const handleRegenerateCode = () => {
    setCode(generateCode(6));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedVenueId(null);

    const trimmedName = name.trim();
    const trimmedVenueName = venueName.trim();
    const trimmedLocation = location.trim();
    const trimmedAdminUid = venueAdminUid.trim();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedNotes = notes.trim();

    if (!user) {
      setError("You must be logged in as a Streakr admin to create a venue league.");
      return;
    }

    if (!trimmedName) {
      setError("Venue league name is required.");
      return;
    }

    if (!trimmedAdminUid) {
      setError("Venue admin UID is required.");
      return;
    }

    if (!trimmedCode || trimmedCode.length < 4) {
      setError("Please provide a valid code (at least 4 characters).");
      return;
    }

    setCreating(true);

    try {
      const venueLeaguesRef = collection(db, "venueLeagues");
      const docRef = await addDoc(venueLeaguesRef, {
        name: trimmedName,
        venueName: trimmedVenueName || null,
        location: trimmedLocation || null,
        code: trimmedCode,
        venueAdminUid: trimmedAdminUid,
        subscriptionStatus,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        notes: trimmedNotes || null,
      });

      setCreatedVenueId(docRef.id);
      setSuccess("Venue league created successfully.");
      setName("");
      setVenueName("");
      setLocation("");
      setVenueAdminUid("");
      setNotes("");
      setCode(generateCode(6));
    } catch (err) {
      console.error("Failed to create venue league", err);
      setError("Failed to create venue league. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const isAdmin = !!user; // Actual admin check should be enforced in Firestore rules / higher-level guard.

  if (!isAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-4">
        <Link
          href="/admin"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          ← Back to admin
        </Link>
        <div className="rounded-2xl bg-red-500/10 border border-red-500/50 px-4 py-3">
          <p className="text-sm text-red-200">
            You don&apos;t have access to this page. Venue leagues can only be created by Streakr admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin"
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to admin
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Create Venue League
          </h1>
          <p className="text-sm text-white/70 max-w-2xl">
            This screen is for Streakr staff only. You control which venues run
            a league, who their venue admin is, and when their subscription is
            active.
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end text-xs text-white/60">
          <span className="uppercase tracking-wide text-[10px]">
            Subscription control
          </span>
          <span>Created venue leagues start as &quot;active&quot;.</span>
          <span>Use Firestore / admin tools to pause or cancel later.</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4 shadow-[0_24px_60px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Venue details</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-orange-500/40 text-orange-300 px-2 py-1 text-[11px] uppercase tracking-wide">
            Streakr Admin
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-300 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <div className="space-y-2">
            <p className="text-sm text-emerald-300 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
              {success}
            </p>
            {createdVenueId && (
              <div className="text-xs text-white/70 border border-white/10 rounded-md bg-black/30 px-3 py-2 space-y-1">
                <p>
                  <span className="font-semibold text-white/80">
                    Venue ID:
                  </span>{" "}
                  <span className="font-mono">{createdVenueId}</span>
                </p>
                <p>
                  <span className="font-semibold text-white/80">
                    Code:
                  </span>{" "}
                  <span className="font-mono">{code}</span>
                </p>
                <p>
                  Share the code with the venue so patrons can join. You can
                  open the public venue leaderboard at{" "}
                  <span className="font-mono">
                    /venues/{createdVenueId}
                  </span>{" "}
                  once configured.
                </p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                League name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. The Royal Hotel STREAKr League"
              />
              <p className="text-[11px] text-white/50">
                Public-facing league name shown inside the app and on leaderboards.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Venue name (optional)
              </label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. The Royal Hotel"
              />
              <p className="text-[11px] text-white/50">
                Used in admin tools and on some venue-facing screens.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. Richmond, VIC"
              />
              <p className="text-[11px] text-white/50">
                Helps you identify venues internally (suburb, city, state).
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70 flex items-center justify-between">
                <span>Venue admin UID</span>
              </label>
              <input
                type="text"
                value={venueAdminUid}
                onChange={(e) => setVenueAdminUid(e.target.value)}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="Firebase auth UID for venue admin"
              />
              <p className="text-[11px] text-white/50">
                This user will get access to the venue admin portal for this league.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70 flex items-center justify-between">
                <span>Venue code</span>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-[11px] text-sky-400 hover:text-sky-300"
                >
                  Regenerate
                </button>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase())
                }
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm font-mono tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                maxLength={10}
              />
              <p className="text-[11px] text-white/50">
                4–10 characters. Shown on posters / table tents. Players use
                this to join the venue league.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Internal notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="Contract terms, sponsorship details, billing notes, etc."
              />
              <p className="text-[11px] text-white/50">
                Visible only to Streakr admins inside your tools.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-white/60 space-y-1">
              <p>
                <span className="font-semibold text-white/80">
                  Subscription status:
                </span>{" "}
                <span className="uppercase tracking-wide text-[11px] text-emerald-300">
                  {subscriptionStatus}
                </span>
              </p>
              <p>
                Use your admin tooling / Firestore to pause or cancel this
                venue if payment stops. When paused, venue vouchers and new
                joins should be disabled while the leaderboard remains read-only.
              </p>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-5 py-2.5 transition-colors disabled:opacity-60"
            >
              {creating ? "Creating venue league…" : "Create venue league"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
