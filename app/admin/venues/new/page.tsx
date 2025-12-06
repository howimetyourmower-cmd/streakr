// app/admin/venues/new/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
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
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [venueAdminEmail, setVenueAdminEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("active");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isLoadingAuth = loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      setError("You must be an admin to create a venue league.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedVenueName = venueName.trim();
    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();
    const trimmedAdminEmail = venueAdminEmail.trim().toLowerCase();

    if (!trimmedName) {
      setError("League name is required.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const venueLeaguesRef = collection(db, "venueLeagues");

      // Generate a unique 6-character code
      let code = "";
      let attempts = 0;

      while (attempts < 6) {
        attempts += 1;
        const candidate = generateCode(6);
        const q = query(venueLeaguesRef, where("code", "==", candidate));
        const snap = await getDocs(q);
        if (snap.empty) {
          code = candidate;
          break;
        }
      }

      if (!code) {
        throw new Error("Failed to generate unique code. Please try again.");
      }

      const docRef = await addDoc(venueLeaguesRef, {
        name: trimmedName,
        venueName: trimmedVenueName || null,
        location: trimmedLocation || null,
        description: trimmedDescription || null,
        code,
        createdAt: serverTimestamp(),
        createdByAdminUid: user.uid,
        subscriptionStatus,
        venueAdminEmail: trimmedAdminEmail || null,
        venueAdminUid: null,
        memberCount: 0,
      });

      setSuccess(
        `Venue league created with code ${code}. Share this with the venue and their players.`
      );

      setName("");
      setVenueName("");
      setLocation("");
      setDescription("");
      setVenueAdminEmail("");

      router.push(`/admin/venues`);
    } catch (err) {
      console.error("Failed to create venue league", err);
      setError("Failed to create venue league. Please try again.");
      setCreating(false);
      return;
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Checking admin access…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="max-w-md rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 px-6 py-8 shadow-xl border border-slate-700/70">
          <h1 className="text-2xl font-semibold mb-3">Admin access only</h1>
          <p className="text-sm text-slate-400 mb-4">
            This page is restricted to STREAKr admins. If you think you should
            have access, double-check that you&apos;re logged in with the
            correct email.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      {/* Top bar / heading */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Admin · Venue leagues
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            Create a venue league
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Set up a new STREAKr venue league for pubs, clubs, sports bars and
            breweries. This generates a unique join code that players will use
            from the Venue Leagues screen.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/venues"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to venue leagues
          </Link>
          <p className="text-xs text-slate-500">
            Logged in as{" "}
            <span className="font-medium text-slate-200">
              {user?.email ?? "Unknown"}
            </span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 px-5 py-6 shadow-lg shadow-black/40 space-y-5"
        >
          {error && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
              {success}
            </p>
          )}

          {/* Basic details */}
          <section className="space-y-3">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Venue league details
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  League name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. The Royal Hotel STREAKr League"
                />
                <p className="text-[11px] text-slate-500">
                  Shown in-app and on the venue leaderboard.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Venue name (optional)
                </label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. The Royal Hotel"
                />
                <p className="text-[11px] text-slate-500">
                  Useful if the league name is more creative or sponsor-branded.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. Richmond, VIC"
                />
                <p className="text-[11px] text-slate-500">
                  Helps players confirm they&apos;re in the right venue.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Venue admin email (optional)
                </label>
                <input
                  type="email"
                  value={venueAdminEmail}
                  onChange={(e) => setVenueAdminEmail(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="owner@venue.com.au"
                />
                <p className="text-[11px] text-slate-500">
                  The venue contact who will manage offers and see their
                  leaderboard. Their user account can be wired up to this email
                  later.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Description (internal / optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="E.g. Friday night AFL promo. Weekly $50 tab for top streak. Sponsored by Local Brewing Co."
              />
              <p className="text-[11px] text-slate-500">
                Optional notes about how this venue is running STREAKr (for
                internal use or future tooling).
              </p>
            </div>
          </section>

          {/* Subscription state */}
          <section className="space-y-3 border-t border-slate-800 pt-4">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Subscription & status
            </h2>
            <p className="text-xs text-slate-400 max-w-md">
              This controls whether players can join via the code and whether
              venue-specific vouchers should be active. Only STREAKr admin can
              change this flag.
            </p>

            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#050816]/80 px-3 py-2 cursor-pointer hover:border-emerald-400/70 hover:bg-emerald-950/30 transition">
                <input
                  type="radio"
                  name="subscriptionStatus"
                  value="active"
                  checked={subscriptionStatus === "active"}
                  onChange={() => setSubscriptionStatus("active")}
                  className="h-4 w-4 text-emerald-400"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-100">Active</span>
                  <span className="text-[11px] text-slate-400">
                    Players can join; vouchers and milestones can be issued.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#050816]/80 px-3 py-2 cursor-pointer hover:border-amber-400/70 hover:bg-amber-950/20 transition">
                <input
                  type="radio"
                  name="subscriptionStatus"
                  value="paused"
                  checked={subscriptionStatus === "paused"}
                  onChange={() => setSubscriptionStatus("paused")}
                  className="h-4 w-4 text-amber-400"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-100">Paused</span>
                  <span className="text-[11px] text-slate-400">
                    Venue remains visible but new joins are blocked and new
                    vouchers shouldn&apos;t be issued.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#050816]/80 px-3 py-2 cursor-pointer hover:border-red-400/70 hover:bg-red-950/30 transition">
                <input
                  type="radio"
                  name="subscriptionStatus"
                  value="cancelled"
                  checked={subscriptionStatus === "cancelled"}
                  onChange={() => setSubscriptionStatus("cancelled")}
                  className="h-4 w-4 text-red-400"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-100">
                    Cancelled
                  </span>
                  <span className="text-[11px] text-slate-400">
                    League is effectively off. Players shouldn&apos;t see this
                    as an active partner venue.
                  </span>
                </div>
              </label>
            </div>
          </section>

          {/* Footer actions */}
          <section className="border-t border-slate-800 pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="max-w-md space-y-1">
              <p>
                When you create this venue league, STREAKr will generate a{" "}
                <span className="text-slate-100 font-medium">
                  unique 6-character code
                </span>{" "}
                for players to join from the Venue Leagues screen.
              </p>
              <p>
                You can later wire up a venue admin account and configure
                vouchers / milestone rewards via a dedicated venue-admin panel.
              </p>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-5 py-2.5 transition disabled:opacity-60"
            >
              {creating ? "Creating venue league…" : "Create venue league"}
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}
