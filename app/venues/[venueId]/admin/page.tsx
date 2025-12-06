// app/venues/[venueId]/admin/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

type VenueLeague = {
  id: string;
  name: string;
  code?: string;
  venueName?: string;
  location?: string;
  description?: string;
  subscriptionStatus: SubscriptionStatus;
  venueAdminUid: string;
  promoHeadline?: string;
  joinOfferEnabled?: boolean;
  joinOfferDescription?: string;
  milestone3Enabled?: boolean;
  milestone3Reward?: string;
  milestone5Enabled?: boolean;
  milestone5Reward?: string;
  milestone10Enabled?: boolean;
  milestone10Reward?: string;
};

export default function VenueAdminPage() {
  const params = useParams();
  const venueId = params?.venueId as string;
  const { user } = useAuth();
  const currentUid = user?.uid ?? null;

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [venueError, setVenueError] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [promoHeadline, setPromoHeadline] = useState("");
  const [joinOfferEnabled, setJoinOfferEnabled] = useState(false);
  const [joinOfferDescription, setJoinOfferDescription] = useState("");
  const [milestone3Enabled, setMilestone3Enabled] = useState(false);
  const [milestone3Reward, setMilestone3Reward] = useState("");
  const [milestone5Enabled, setMilestone5Enabled] = useState(false);
  const [milestone5Reward, setMilestone5Reward] = useState("");
  const [milestone10Enabled, setMilestone10Enabled] = useState(false);
  const [milestone10Reward, setMilestone10Reward] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load venue league
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
        const subscriptionStatus: SubscriptionStatus =
          (data.subscriptionStatus as SubscriptionStatus) ?? "active";

        const v: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? undefined,
          venueName: data.venueName ?? data.venue ?? undefined,
          location: data.location ?? undefined,
          description: data.description ?? undefined,
          subscriptionStatus,
          venueAdminUid: data.venueAdminUid ?? data.managerUid ?? "",
          promoHeadline: data.promoHeadline ?? undefined,
          joinOfferEnabled: data.joinOfferEnabled ?? false,
          joinOfferDescription: data.joinOfferDescription ?? undefined,
          milestone3Enabled: data.milestone3Enabled ?? false,
          milestone3Reward: data.milestone3Reward ?? undefined,
          milestone5Enabled: data.milestone5Enabled ?? false,
          milestone5Reward: data.milestone5Reward ?? undefined,
          milestone10Enabled: data.milestone10Enabled ?? false,
          milestone10Reward: data.milestone10Reward ?? undefined,
        };

        setVenue(v);

        // Seed form fields
        setName(v.name ?? "");
        setVenueName(v.venueName ?? "");
        setLocation(v.location ?? "");
        setDescription(v.description ?? "");
        setPromoHeadline(v.promoHeadline ?? "");
        setJoinOfferEnabled(!!v.joinOfferEnabled);
        setJoinOfferDescription(v.joinOfferDescription ?? "");
        setMilestone3Enabled(!!v.milestone3Enabled);
        setMilestone3Reward(v.milestone3Reward ?? "");
        setMilestone5Enabled(!!v.milestone5Enabled);
        setMilestone5Reward(v.milestone5Reward ?? "");
        setMilestone10Enabled(!!v.milestone10Enabled);
        setMilestone10Reward(v.milestone10Reward ?? "");

        setLoadingVenue(false);
      },
      (err) => {
        console.error("Failed to load venue league (admin)", err);
        setVenue(null);
        setVenueError("Failed to load venue league.");
        setLoadingVenue(false);
      }
    );

    return () => unsub();
  }, [venueId]);

  const isVenueAdmin =
    !!venue && !!currentUid && currentUid === venue.venueAdminUid;
  const subscriptionStatus: SubscriptionStatus =
    venue?.subscriptionStatus ?? "active";

  const statusLabel =
    subscriptionStatus === "active"
      ? "Active"
      : subscriptionStatus === "paused"
      ? "Paused"
      : "Cancelled";

  const statusClass =
    subscriptionStatus === "active"
      ? "text-emerald-300 border-emerald-400/60 bg-emerald-500/10"
      : subscriptionStatus === "paused"
      ? "text-amber-300 border-amber-400/60 bg-amber-500/10"
      : "text-red-300 border-red-400/60 bg-red-500/10";

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!venue) {
      setSaveError("Venue not loaded.");
      return;
    }
    if (!isVenueAdmin) {
      setSaveError("You do not have permission to update this venue.");
      return;
    }

    const trimmedName = name.trim();
    const trimmedVenueName = venueName.trim();
    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();
    const trimmedPromo = promoHeadline.trim();
    const trimmedJoinOfferDescription = joinOfferDescription.trim();
    const trimmedM3 = milestone3Reward.trim();
    const trimmedM5 = milestone5Reward.trim();
    const trimmedM10 = milestone10Reward.trim();

    if (!trimmedName) {
      setSaveError("League name is required.");
      return;
    }

    setSaving(true);

    try {
      const venueRef = doc(db, "venueLeagues", venue.id);
      await updateDoc(venueRef, {
        name: trimmedName,
        venueName: trimmedVenueName || null,
        location: trimmedLocation || null,
        description: trimmedDescription || null,
        promoHeadline: trimmedPromo || null,
        joinOfferEnabled: joinOfferEnabled,
        joinOfferDescription:
          joinOfferEnabled && trimmedJoinOfferDescription
            ? trimmedJoinOfferDescription
            : null,
        milestone3Enabled: milestone3Enabled,
        milestone3Reward:
          milestone3Enabled && trimmedM3 ? trimmedM3 : null,
        milestone5Enabled: milestone5Enabled,
        milestone5Reward:
          milestone5Enabled && trimmedM5 ? trimmedM5 : null,
        milestone10Enabled: milestone10Enabled,
        milestone10Reward:
          milestone10Enabled && trimmedM10 ? trimmedM10 : null,
      });

      setSaveSuccess("Venue settings updated.");
    } catch (err) {
      console.error("Failed to update venue league (admin)", err);
      setSaveError("Failed to update venue. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingVenue && !venue && !venueError) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen">
        <p className="text-sm text-white/70">Loading venue…</p>
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

  if (!currentUid || !isVenueAdmin) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/venues/${venue.id}`}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to venue leaderboard
          </Link>
          <Link
            href="/venues"
            className="text-sm text-orange-400 hover:text-orange-300"
          >
            Venue list
          </Link>
        </div>
        <div className="rounded-2xl bg-red-500/10 border border-red-500/60 px-4 py-3">
          <h1 className="text-lg font-semibold mb-1">
            No access to venue admin
          </h1>
          <p className="text-sm text-red-100">
            You are not the assigned venue admin for this league. Please contact
            Streakr or the venue owner if you believe this is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const headerTitle = venue.name ?? "Venue League";

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen space-y-6">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link
            href={`/venues/${venue.id}`}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            ← Back to venue leaderboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Venue Admin – {headerTitle}
          </h1>
          <p className="text-sm text-white/70 max-w-2xl">
            Configure how STREAKr runs at your venue. Update your branding,
            promo headline and voucher offers. Subscription status is controlled
            by Streakr.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wide text-[10px]">
              Venue status
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass}`}
            >
              {statusLabel}
            </span>
          </div>
          <span className="text-[11px]">
            Subscription controlled by Streakr HQ.
          </span>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-5 shadow-[0_24px_60px_rgba(0,0,0,0.8)] text-sm"
      >
        {/* Errors / success */}
        {saveError && (
          <p className="text-sm text-red-300 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
            {saveError}
          </p>
        )}
        {saveSuccess && (
          <p className="text-sm text-emerald-300 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
            {saveSuccess}
          </p>
        )}

        {/* Basic venue details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold">
              Venue details
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-orange-500/40 text-orange-300 px-2 py-1 text-[11px] uppercase tracking-wide">
              Venue Admin
            </span>
          </div>

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
                Shown to players in the app and on your leaderboard.
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
                Appears in some venue-facing screens and internal tools.
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
                Helps players recognise they&apos;re in the right venue.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Short description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder="E.g. Weekly STREAKr comp during every AFL round. Venue prizes announced on the chalkboard."
              />
            </div>
          </div>
        </div>

        {/* Promo & voucher configuration */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h2 className="text-base sm:text-lg font-semibold">
            Promo headline & vouchers
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-white/70">
              Promo headline (optional)
            </label>
            <input
              type="text"
              value={promoHeadline}
              onChange={(e) => setPromoHeadline(e.target.value)}
              className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
              placeholder='E.g. "Win a $50 bar tab every round"'
            />
            <p className="text-[11px] text-white/50">
              This line can be surfaced on your Streakr screens and marketing
              assets.
            </p>
          </div>

          {/* Join offer */}
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">First-time join offer</p>
                <p className="text-[11px] text-white/60">
                  Reward players the first time they join your venue league
                  (e.g. 2-for-1 drink).
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <span className="text-white/70">Enabled</span>
                <button
                  type="button"
                  onClick={() =>
                    setJoinOfferEnabled((prev) => !prev)
                  }
                  className={`w-10 h-6 flex items-center rounded-full px-1 transition-colors ${
                    joinOfferEnabled
                      ? "bg-emerald-500"
                      : "bg-slate-600"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      joinOfferEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Join offer description
              </label>
              <input
                type="text"
                value={joinOfferDescription}
                onChange={(e) =>
                  setJoinOfferDescription(e.target.value)
                }
                disabled={!joinOfferEnabled}
                className="w-full rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                placeholder='E.g. "2-for-1 house beer when you join STREAKr at this venue"'
              />
              <p className="text-[11px] text-white/50">
                What the staff will honour when a new player shows their
                first-time voucher.
              </p>
            </div>
          </div>

          {/* Milestone rewards */}
          <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Streak milestone rewards</p>
              <p className="text-[11px] text-white/60">
                Choose simple rewards for big streak moments while playing at
                your venue.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-[11px]">
              {/* 3 streak */}
              <div className="rounded-lg bg-[#050816]/80 border border-white/10 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-white/60">
                    Streak 3
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMilestone3Enabled((prev) => !prev)
                    }
                    className={`w-10 h-6 flex items-center rounded-full px-1 transition-colors ${
                      milestone3Enabled
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                        milestone3Enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
                <input
                  type="text"
                  value={milestone3Reward}
                  onChange={(e) =>
                    setMilestone3Reward(e.target.value)
                  }
                  disabled={!milestone3Enabled}
                  className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-xs disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-orange-500/70 focus:border-orange-500/70"
                  placeholder="E.g. Free chips"
                />
              </div>

              {/* 5 streak */}
              <div className="rounded-lg bg-[#050816]/80 border border-white/10 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-white/60">
                    Streak 5
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMilestone5Enabled((prev) => !prev)
                    }
                    className={`w-10 h-6 flex items-center rounded-full px-1 transition-colors ${
                      milestone5Enabled
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                        milestone5Enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
                <input
                  type="text"
                  value={milestone5Reward}
                  onChange={(e) =>
                    setMilestone5Reward(e.target.value)
                  }
                  disabled={!milestone5Enabled}
                  className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-xs disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-orange-500/70 focus:border-orange-500/70"
                  placeholder="E.g. 2-for-1 drink"
                />
              </div>

              {/* 10 streak */}
              <div className="rounded-lg bg-[#050816]/80 border border-white/10 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-white/60">
                    Streak 10
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMilestone10Enabled((prev) => !prev)
                    }
                    className={`w-10 h-6 flex items-center rounded-full px-1 transition-colors ${
                      milestone10Enabled
                        ? "bg-emerald-500"
                        : "bg-slate-600"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                        milestone10Enabled ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>
                <input
                  type="text"
                  value={milestone10Reward}
                  onChange={(e) =>
                    setMilestone10Reward(e.target.value)
                  }
                  disabled={!milestone10Enabled}
                  className="w-full rounded-md bg-black/40 border border-white/15 px-2 py-1.5 text-xs disabled:opacity-60 focus:outline-none focus:ring-1 focus:ring-orange-500/70 focus:border-orange-500/70"
                  placeholder="E.g. Free jug or $20 food credit"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/60">
          <div className="space-y-1 max-w-md">
            <p>
              <span className="font-semibold text-white/80">
                Reminder:
              </span>{" "}
              You&apos;re configuring what your staff will honour when players
              show vouchers in venue. Make sure staff are briefed on each
              reward.
            </p>
            {subscriptionStatus !== "active" && (
              <p className="text-red-300">
                This venue league is not currently active. Offers won&apos;t be
                issued until Streakr reactivates your subscription.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-5 py-2.5 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving settings…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
