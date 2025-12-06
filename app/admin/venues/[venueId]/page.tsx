// app/admin/venues/[venueId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
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
  subscriptionStatus: SubscriptionStatus;
  prizesHeadline?: string | null;
  prizesBody?: string | null;
  venueAdminEmail?: string | null;
  venueAdminUid?: string | null;
};

export default function AdminEditVenuePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  const venueId = params?.venueId as string | undefined;

  const [loadedVenue, setLoadedVenue] = useState<VenueLeague | null>(null);

  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("active");

  const [prizesHeadline, setPrizesHeadline] = useState("");
  const [prizesBody, setPrizesBody] = useState("");
  const [venueAdminEmail, setVenueAdminEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth guard
  if (loading) {
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
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // Load venue
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
          setLoadedVenue(null);
          setLoadingVenue(false);
          return;
        }

        const data = snap.data() as any;
        const venue: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? "",
          venueName: data.venueName ?? null,
          location: data.location ?? null,
          description: data.description ?? null,
          subscriptionStatus:
            (data.subscriptionStatus as SubscriptionStatus) ?? "active",
          prizesHeadline: data.prizesHeadline ?? null,
          prizesBody: data.prizesBody ?? null,
          venueAdminEmail: data.venueAdminEmail ?? null,
          venueAdminUid: data.venueAdminUid ?? null,
        };

        setLoadedVenue(venue);

        // hydrate form state
        setName(venue.name ?? "");
        setVenueName(venue.venueName ?? "");
        setLocation(venue.location ?? "");
        setDescription(venue.description ?? "");
        setSubscriptionStatus(venue.subscriptionStatus);
        setPrizesHeadline(venue.prizesHeadline ?? "");
        setPrizesBody(venue.prizesBody ?? "");
        setVenueAdminEmail(venue.venueAdminEmail ?? "");
      } catch (err) {
        console.error("Failed to load venue league", err);
        setError("Failed to load venue league. Please try again.");
      } finally {
        setLoadingVenue(false);
      }
    };

    loadVenue();
  }, [venueId]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!loadedVenue || !venueId) return;

    if (!name.trim()) {
      setError("League name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const ref = doc(db, "venueLeagues", venueId);

      const trimmedAdminEmail =
        venueAdminEmail.trim().length > 0
          ? venueAdminEmail.trim().toLowerCase()
          : null;

      await updateDoc(ref, {
        name: name.trim(),
        venueName: venueName.trim() || null,
        location: location.trim() || null,
        description: description.trim() || null,
        subscriptionStatus,
        prizesHeadline: prizesHeadline.trim() || null,
        prizesBody: prizesBody.trim() || null,
        venueAdminEmail: trimmedAdminEmail,
        // we do NOT auto-change venueAdminUid here; that will be set
        // when the correct user first hits /venues/[id]/admin.
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      setError(null);
      setSaving(false);
      router.push("/admin/venues");
    } catch (err) {
      console.error("Failed to update venue league", err);
      setError("Failed to update venue league. Please try again.");
      setSaving(false);
    }
  };

  if (loadingVenue) {
    return (
      <div className="min-h-[60vh] bg-[#050814] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading venue league…</p>
      </div>
    );
  }

  if (!loadedVenue) {
    return (
      <div className="min-h-[60vh] bg-[#050814] text-slate-100 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <p className="text-sm text-red-400">
            {error ?? "Venue league not found or no longer available."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/venues")}
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to venue leagues
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <button
            type="button"
            onClick={() => router.push("/admin/venues")}
            className="text-xs text-slate-400 hover:text-slate-200 mb-3"
          >
            ← Back to venue leagues
          </button>
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Admin • Venue leagues
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-2">
            Edit venue league
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Update details, prize copy and venue admin access for{" "}
            <span className="text-slate-100 font-semibold">
              {loadedVenue.name}
            </span>
            . Changes apply instantly to the live venue leaderboard.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 px-5 py-6 shadow-lg shadow-black/40 space-y-6"
        >
          {error && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}

          {/* Read-only meta */}
          <section className="space-y-2 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="uppercase tracking-[0.18em] text-slate-500">
                  Venue ID
                </span>
                <p className="font-mono text-[11px] text-slate-200 mt-0.5">
                  {loadedVenue.id}
                </p>
              </div>
              <div>
                <span className="uppercase tracking-[0.18em] text-slate-500">
                  Join code
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-sm bg-slate-900/80 border border-slate-700 rounded-md px-2 py-1">
                    {loadedVenue.code}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(loadedVenue.code)
                    }
                    className="text-[11px] text-amber-300 hover:text-amber-200"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Venue details */}
          <section className="space-y-4 border-t border-slate-800 pt-5">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Venue details
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
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Venue name
                </label>
                <input
                  type="text"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. The Royal Hotel"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. Richmond, VIC"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Status
                </label>
                <select
                  value={subscriptionStatus}
                  onChange={(e) =>
                    setSubscriptionStatus(e.target.value as SubscriptionStatus)
                  }
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                >
                  <option value="active">Active (players can join)</option>
                  <option value="paused">Paused (no new play, keep data)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="Short description of how the comp runs at this venue."
              />
            </div>
          </section>

          {/* Prize copy */}
          <section className="space-y-4 border-t border-slate-800 pt-5">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Prize spotlight
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              This copy powers the orange &quot;Venue prize spotlight&quot;
              banner on the public venue leaderboard. Keep it clear and
              venue-specific.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Prize headline
              </label>
              <input
                type="text"
                value={prizesHeadline}
                onChange={(e) => setPrizesHeadline(e.target.value)}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="E.g. Longest streak each round wins a $50 bar tab"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Prize description
              </label>
              <textarea
                value={prizesBody}
                onChange={(e) => setPrizesBody(e.target.value)}
                rows={4}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder={`Explain weekly prizes, tie-break rules and any season-long prizes…`}
              />
            </div>
          </section>

          {/* Venue admin access */}
          <section className="space-y-4 border-t border-slate-800 pt-5">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Venue admin access
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              The venue admin can log in and manage their own prizes and
              vouchers at{" "}
              <span className="font-mono text-slate-200">
                /venues/{loadedVenue.id}/admin
              </span>
              . They must use this email address to get access.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Venue admin email
                </label>
                <input
                  type="email"
                  value={venueAdminEmail}
                  onChange={(e) => setVenueAdminEmail(e.target.value)}
                  className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                  placeholder="E.g. manager@venue.com.au"
                />
                <p className="text-[11px] text-slate-500">
                  We match on this email and then lock their account to this
                  venue once they first visit the venue admin page.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Current admin UID (read-only)
                </label>
                <input
                  type="text"
                  value={loadedVenue.venueAdminUid ?? ""}
                  disabled
                  className="w-full rounded-md bg-slate-900/60 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-300"
                  placeholder="Not yet bound"
                />
                <p className="text-[11px] text-slate-500">
                  Filled automatically when the correct venue admin logs in and
                  opens their venue admin console.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <section className="border-t border-slate-800 pt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
            <div className="max-w-md space-y-1">
              <p>
                Changes here update the{" "}
                <span className="text-slate-100 font-medium">
                  public venue leaderboard
                </span>{" "}
                immediately. Use Paused/Cancelled for billing or compliance
                issues.
              </p>
              <p>
                If you change the venue admin email, tell the venue to log out
                and back in with the new address before using their admin page.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-6 py-2.5 transition disabled:opacity-60"
            >
              {saving ? "Saving changes…" : "Save changes"}
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}
