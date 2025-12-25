// app/venues/[venueId]/admin/page.tsx
import { Suspense } from "react";
import VenueAdminClient from "./VenueAdminClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-slate-200">
          <div className="space-y-2 text-sm">
            <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin mx-auto" />
            Loading venue admin…
          </div>
        </div>
      }
    >
      <VenueAdminClient />
    </Suspense>
  );
}
tsx
Copy code
// app/venues/[venueId]/admin/VenueAdminClient.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  venueAdminEmail?: string | null;
  venueAdminUid?: string | null;
  subscriptionStatus: SubscriptionStatus;

  // Voucher config
  voucherJoinEnabled?: boolean;
  voucherJoinTitle?: string | null;
  voucherJoinDescription?: string | null;
  voucherMilestoneEnabled?: boolean;
  voucherMilestoneTitle?: string | null;
  voucherMilestoneDescription?: string | null;
};

export default function VenueAdminConsole() {
  const router = useRouter();
  const params = useParams();
  const venueId = params?.venueId as string;

  const { user, loading, isAdmin } = useAuth();

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  // Prize fields
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");

  // Voucher config state
  const [voucherJoinEnabled, setVoucherJoinEnabled] = useState(false);
  const [voucherJoinTitle, setVoucherJoinTitle] = useState("");
  const [voucherJoinDescription, setVoucherJoinDescription] = useState("");

  const [voucherMilestoneEnabled, setVoucherMilestoneEnabled] = useState(false);
  const [voucherMilestoneTitle, setVoucherMilestoneTitle] = useState("");
  const [voucherMilestoneDescription, setVoucherMilestoneDescription] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load venue details & hydrate form
  useEffect(() => {
    if (!venueId) return;

    const loadVenue = async () => {
      try {
        const ref = doc(db, "venueLeagues", venueId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Venue not found.");
          setLoadingVenue(false);
          return;
        }

        const data = snap.data() as any;
        const v: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? "",
          venueName: data.venueName ?? null,
          location: data.location ?? null,
          description: data.description ?? null,
          prizesHeadline: data.prizesHeadline ?? "",
          prizesBody: data.prizesBody ?? "",
          venueAdminEmail: data.venueAdminEmail ?? null,
          venueAdminUid: data.venueAdminUid ?? null,
          subscriptionStatus:
            (data.subscriptionStatus as SubscriptionStatus) ?? "active",

          voucherJoinEnabled: data.voucherJoinEnabled ?? false,
          voucherJoinTitle: data.voucherJoinTitle ?? "",
          voucherJoinDescription: data.voucherJoinDescription ?? "",
          voucherMilestoneEnabled: data.voucherMilestoneEnabled ?? false,
          voucherMilestoneTitle: data.voucherMilestoneTitle ?? "",
          voucherMilestoneDescription: data.voucherMilestoneDescription ?? "",
        };

        setVenue(v);

        // hydrate prize fields
        setHeadline(v.prizesHeadline ?? "");
        setBody(v.prizesBody ?? "");

        // hydrate voucher fields
        setVoucherJoinEnabled(!!v.voucherJoinEnabled);
        setVoucherJoinTitle(v.voucherJoinTitle ?? "");
        setVoucherJoinDescription(v.voucherJoinDescription ?? "");
        setVoucherMilestoneEnabled(!!v.voucherMilestoneEnabled);
        setVoucherMilestoneTitle(v.voucherMilestoneTitle ?? "");
        setVoucherMilestoneDescription(v.voucherMilestoneDescription ?? "");
      } catch (err) {
        console.error("Failed to load venue", err);
        setError("Failed to load venue.");
      } finally {
        setLoadingVenue(false);
      }
    };

    loadVenue();
  }, [venueId]);

  // Auth logic — venue admin or STREAKr admin only
  const authorized =
    isAdmin ||
    (user &&
      venue &&
      (user.uid === venue.venueAdminUid ||
        user.email?.toLowerCase() === venue.venueAdminEmail?.toLowerCase()));

  // First-time login → bind UID permanently
  useEffect(() => {
    if (!venue || !user) return;
    if (isAdmin) return; // STREAKr admin bypass

    if (
      venue.venueAdminEmail &&
      user.email?.toLowerCase() === venue.venueAdminEmail.toLowerCase() &&
      !venue.venueAdminUid
    ) {
      const bind = async () => {
        try {
          const ref = doc(db, "venueLeagues", venue.id);
          await updateDoc(ref, { venueAdminUid: user.uid });
        } catch (err) {
          console.error("Failed to bind venue admin UID", err);
        }
      };
      bind();
    }
  }, [venue, user, isAdmin]);

  // Handle save
  const saveChanges = async (e: FormEvent) => {
    e.preventDefault();
    if (!venue || !authorized) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const ref = doc(db, "venueLeagues", venue.id);
      await updateDoc(ref, {
        // prizes
        prizesHeadline: headline.trim() || null,
        prizesBody: body.trim() || null,

        // voucher config
        voucherJoinEnabled,
        voucherJoinTitle: voucherJoinTitle.trim() || null,
        voucherJoinDescription: voucherJoinDescription.trim() || null,
        voucherMilestoneEnabled,
        voucherMilestoneTitle: voucherMilestoneTitle.trim() || null,
        voucherMilestoneDescription:
          voucherMilestoneDescription.trim() || null,

        updatedAt: serverTimestamp(),
      });

      setSuccess("Venue settings updated ✔");
    } catch (err) {
      console.error("Failed to update venue settings", err);
      setError("Failed to update. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Loading states
  if (loading || loadingVenue) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-200">
        <div className="space-y-2 text-sm">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin mx-auto" />
          Checking venue access…
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-200 px-4 text-center">
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-sm text-slate-400 max-w-xs">
          You are not the registered venue admin for this league.
        </p>

        <button
          onClick={() => router.push("/venues")}
          className="mt-6 bg-amber-500 px-5 py-2 rounded-full text-black font-semibold text-sm hover:bg-amber-400"
        >
          Back to venue leagues
        </button>
      </div>
    );
  }

  // MAIN PANEL — Venue Admin Console
  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <button
            onClick={() => router.push(`/venues/${venueId}`)}
            className="text-xs text-slate-400 hover:text-slate-200 mb-3"
          >
            ← Back to venue leaderboard
          </button>

          <h1 className="text-3xl font-bold">
            {venue?.name ?? "Venue league"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Venue admin console — manage prizes and in-venue offers
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form
          onSubmit={saveChanges}
          className="bg-slate-900/60 border border-slate-700 rounded-xl p-6 space-y-8 shadow-xl"
        >
          {/* Prize spotlight */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                Prize spotlight
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                This is what players see inside the orange banner on your venue
                leaderboard.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Headline</label>
              <input
                type="text"
                className="w-full rounded-md bg-black/30 border border-slate-600 px-3 py-2 text-sm"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Eg. Longest streak wins $50 bar tab weekly"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">Description</label>
              <textarea
                rows={4}
                className="w-full rounded-md bg-black/30 border border-slate-600 px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Explain weekly prizes, tie-breaks, season prize etc."
              />
            </div>
          </section>

          {/* Vouchers & offers */}
          <section className="space-y-5 border-t border-slate-800 pt-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                Vouchers & in-venue offers
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure how STREAKr ties into your bar tabs, drink chips or
                food offers. These settings will power in-app vouchers later.
              </p>
            </div>

            {/* Join offer */}
            <div className="rounded-lg border border-slate-700 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-50">
                    Join offer
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Reward players the first time they join your venue league.
                    Great for 2-for-1 first drink offers.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Enabled</span>
                  <input
                    type="checkbox"
                    checked={voucherJoinEnabled}
                    onChange={(e) => setVoucherJoinEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-black"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  Join offer title
                </label>
                <input
                  type="text"
                  value={voucherJoinTitle}
                  onChange={(e) => setVoucherJoinTitle(e.target.value)}
                  className="w-full rounded-md bg-black/40 border border-slate-600 px-3 py-2 text-sm"
                  placeholder='Eg. "2-for-1 first drink when you join"'
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  Join offer details
                </label>
                <textarea
                  rows={3}
                  value={voucherJoinDescription}
                  onChange={(e) => setVoucherJoinDescription(e.target.value)}
                  className="w-full rounded-md bg-black/40 border border-slate-600 px-3 py-2 text-sm"
                  placeholder="Describe how and when the 2-for-1 or welcome voucher can be used."
                />
              </div>
            </div>

            {/* Milestone offer */}
            <div className="rounded-lg border border-slate-700 bg-black/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-50">
                    Streak milestone offer
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Reward players who hit a streak while they&apos;re at your
                    venue. Eg. &quot;Hit a streak of 5+ and get a bonus pot&quot;.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Enabled</span>
                  <input
                    type="checkbox"
                    checked={voucherMilestoneEnabled}
                    onChange={(e) =>
                      setVoucherMilestoneEnabled(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-black"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  Milestone offer title
                </label>
                <input
                  type="text"
                  value={voucherMilestoneTitle}
                  onChange={(e) => setVoucherMilestoneTitle(e.target.value)}
                  className="w-full rounded-md bg-black/40 border border-slate-600 px-3 py-2 text-sm"
                  placeholder='Eg. "Hit a streak of 5+ & get a bonus pot"'
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  Milestone offer details
                </label>
                <textarea
                  rows={3}
                  value={voucherMilestoneDescription}
                  onChange={(e) =>
                    setVoucherMilestoneDescription(e.target.value)
                  }
                  className="w-full rounded-md bg-black/40 border border-slate-600 px-3 py-2 text-sm"
                  placeholder="Explain streak requirements, limits per night, and any extra rules."
                />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-500 px-6 py-2 rounded-full text-black font-semibold text-sm hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
