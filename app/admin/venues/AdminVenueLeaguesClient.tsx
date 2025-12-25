// app/admin/venues/new/AdminNewVenueClient.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

function generateVenueCode(length = 6): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function AdminNewVenueClient() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("active");

  const [venueAdminEmail, setVenueAdminEmail] = useState("");
  const [prizesHeadline, setPrizesHeadline] = useState("");
  const [prizesBody, setPrizesBody] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreateVenue = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("League name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const code = generateVenueCode();

      const trimmedAdminEmail =
        venueAdminEmail.trim().length > 0
          ? venueAdminEmail.trim().toLowerCase()
          : null;

      await addDoc(collection(db, "venueLeagues"), {
        name: name.trim(),
        venueName: venueName.trim() || null,
        location: location.trim() || null,
        description: description.trim() || null,
        code,
        subscriptionStatus,
        memberCount: 0,
        prizesHeadline: prizesHeadline.trim() || null,
        prizesBody: prizesBody.trim() || null,
        venueAdminEmail: trimmedAdminEmail,
        venueAdminUid: null,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      router.push("/admin/venues");
    } catch (err) {
      console.error("Failed to create venue league", err);
      setError("Failed to create venue league. Please try again.");
      setSaving(false);
    }
  };

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
            Create a new venue league
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Set up a STREAKr league for a pub, club or sports bar. Players still
            build the same streak as general play, but this venue gets its own
            leaderboard, prizes and promotions.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <form
          onSubmit={handleCreateVenue}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 px-5 py-6 shadow-lg shadow-black/40 space-y-6"
        >
          {error && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}

          {/* Basic venue details */}
          <section className="space-y-4">
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
                <p className="text-[11px] text-slate-500">
                  This is what players will see on the leaderboard.
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
                  Used with the location, e.g. &quot;The Royal Hotel •
                  Richmond&quot;.
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
                  Helps players confirm they&apos;re joining the right venue.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Initial status
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
                <p className="text-[11px] text-slate-500">
                  Use Paused/Cancelled if billing isn&apos;t set up yet.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="E.g. Friday night streak comp running all AFL season. Grab a QR from the bar to join."
              />
              <p className="text-[11px] text-slate-500">
                Short description of how the comp runs at this venue.
              </p>
            </div>
          </section>

          {/* Prize promo copy */}
          <section className="space-y-4 border-t border-slate-800 pt-5">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Prize spotlight (optional)
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              This copy shows up in the orange &quot;Venue prize spotlight&quot;
              banner on the public leaderboard. Venue admins can edit this
              later.
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
                placeholder={`E.g.\nTop streak for each AFL round wins a $50 bar tab.\nTie-breaker: earliest streak.\nSeason-long champion wins a $200 venue voucher.`}
              />
              <p className="text-[11px] text-slate-500">
                Explain weekly prizes, tie-break rules and any season-long
                prizes. Keep it venue-specific.
              </p>
            </div>
          </section>

          {/* Venue admin details */}
          <section className="space-y-4 border-t border-slate-800 pt-5">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Venue admin access
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              The venue admin can log in to STREAKr and manage their prizes and
              vouchers at{" "}
              <span className="font-mono text-slate-200">
                /venues/&lt;id&gt;/admin
              </span>
              . They can only access their own venue.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Venue admin email (recommended)
              </label>
              <input
                type="email"
                value={venueAdminEmail}
                onChange={(e) => setVenueAdminEmail(e.target.value)}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="E.g. manager@royalhotel.com.au"
              />
              <p className="text-[11px] text-slate-500">
                They must sign up or log in with this email to get venue admin
                access. You can change it later from the venue admin console.
              </p>
            </div>
          </section>

          {/* Footer / actions */}
          <section className="border-t border-slate-800 pt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
            <div className="max-w-md space-y-1">
              <p>
                A 6-character join code will be{" "}
                <span className="text-slate-100 font-medium">
                  generated automatically
                </span>{" "}
                for this venue. You can print it on table tents, posters or TV
                slides.
              </p>
              <p>
                Players join from the{" "}
                <span className="text-slate-100 font-medium">Venue Leagues</span>{" "}
                page by entering that code, and they&apos;ll appear on this
                venue&apos;s leaderboard instantly.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-6 py-2.5 transition disabled:opacity-60"
            >
              {saving ? "Creating venue…" : "Create venue league"}
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}
