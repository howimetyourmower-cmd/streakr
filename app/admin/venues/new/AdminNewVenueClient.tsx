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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/70">Checking admin access…</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold mb-2">Access denied</h1>
          <p className="text-sm text-white/70">
            You must be a STREAKr admin to create venue leagues.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const code = generateVenueCode(6);

      const payload = {
        name: name.trim() || venueName.trim() || "Venue League",
        code,
        venueName: venueName.trim() || null,
        location: location.trim() || null,
        description: description.trim() || null,
        subscriptionStatus,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        memberCount: 0,

        // Defaults
        prizesHeadline: null,
        prizesBody: null,
        voucherJoinEnabled: false,
        voucherJoinTitle: null,
        voucherJoinDescription: null,
        voucherMilestoneEnabled: false,
        voucherMilestoneTitle: null,
        voucherMilestoneDescription: null,
        venueAdminEmail: null,
        venueAdminUid: null,
      };

      const created = await addDoc(collection(db, "venueLeagues"), payload);
      router.push(`/venues/${created.id}`);
    } catch (err) {
      console.error("Failed to create venue league", err);
      setError("Could not create venue. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            Create Venue League{" "}
            <span className="text-orange-500">Admin</span>
          </h1>
          <button
            type="button"
            onClick={() => router.push("/admin/venues")}
            className="text-xs text-white/70 hover:text-white"
          >
            ← Back to venues
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-black/30 p-6 space-y-4"
        >
          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              League name (public)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Eg. The Royal Hotel – Friday Night Footy"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              Venue name
            </label>
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Eg. The Royal Hotel"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Eg. Richmond, VIC"
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={4}
              placeholder="Optional venue blurb shown to users."
            />
          </div>

          <div>
            <label className="block text-[11px] text-white/60 mb-1">
              Subscription status
            </label>
            <select
              value={subscriptionStatus}
              onChange={(e) =>
                setSubscriptionStatus(e.target.value as SubscriptionStatus)
              }
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create venue league"}
            </button>
          </div>
        </form>

        knowing sponsors like:
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/20 to-orange-600/10 p-4 border border-orange-500/30 text-center text-sm">
          Sponsor banner placeholder
        </div>
      </div>
    </div>
  );
}
