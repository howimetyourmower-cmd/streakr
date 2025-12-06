// app/venues/[venueId]/admin/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
  venueAdminEmail?: string | null;
  venueAdminUid?: string | null;
  prizesHeadline?: string;
  prizesBody?: string;
};

export default function VenueAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  const venueId = params?.venueId as string | undefined;

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prizesHeadline, setPrizesHeadline] = useState("");
  const [prizesBody, setPrizesBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
        const subscriptionStatus: SubscriptionStatus =
          (data.subscriptionStatus as SubscriptionStatus) ?? "active";

        const v: VenueLeague = {
          id: snap.id,
          name: data.name ?? "Venue League",
          code: data.code ?? "",
          venueName: data.venueName ?? data.venue ?? undefined,
          location: data.location ?? undefined,
          description: data.description ?? undefined,
          subscriptionStatus,
          venueAdminEmail: data.venueAdminEmail ?? null,
          venueAdminUid: data.venueAdminUid ?? null,
          prizesHeadline: data.prizesHeadline ?? undefined,
          prizesBody: data.prizesBody ?? undefined,
        };

        setVenue(v);
        setPrizesHeadline(v.prizesHeadline ?? "");
        setPrizesBody(v.prizesBody ?? "");
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

  // who can edit: STREAKr admin OR venue admin (uid match OR email match)
  const canEdit = (() => {
    if (!user || !venue) return false;
    if (isAdmin) return true;

    const email = (user.email ?? "").toLowerCase();
    const venueEmail = (venue.venueAdminEmail ?? "").toLowerCase();

    if (venue.venueAdminUid && venue.venueAdminUid === user.uid) return true;
    if (email && venueEmail && email === venueEmail) return true;

    return false;
  })();

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!venue) return;
    if (!canEdit) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const ref = doc(db, "venueLeagues", venue.id);
      await updateDoc(ref, {
        prizesHeadline: prizesHeadline.trim() || null,
        prizesBody: prizesBody.trim() || null,
      });

      setSaveSuccess("Prizes updated for this venue.");
    } catch (err) {
      console.error("Failed to update venue prizes", err);
      setError("Failed to save prizes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingVenue) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Loading venue admin…</p>
        </div>
      </div>
    );
  }

  if (!venueId || !venue) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="max-w-md rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 px-6 py-8 shadow-xl border border-slate-700/70">
          <h1 className="text-2xl font-semibold mb-3">Venue not found</h1>
          <p className="text-sm text-slate-400 mb-4">
            We couldn&apos;t find that venue league. Try opening it again from
            the admin console.
          </p>
          <Link
            href="/admin/venues"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to venue list
          </Link>
        </div>
      </div>
    );
  }

  if (!user || (!canEdit && !isAdmin)) {
    // they are logged in but not venue admin; show read-only info & link back
    return (
      <div className="min-h-[60vh] bg-[#050814] text-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <Link
            href="/admin/venues"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to venue list
          </Link>

          <div className="rounded-2xl bg-gradient-to-br from-slate-950/80 to-slate-900/80 border border-slate-800 px-5 py-6 shadow-lg shadow-black/40 space-y-3">
            <h1 className="text-2xl font-semibold">
              {venue.name}
            </h1>
            {(venue.venueName || venue.location) && (
              <p className="text-sm text-slate-300">
                {[venue.venueName, venue.location].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-sm text-slate-400">
              This page is for venue admins only. Ask STREAKr or your account
              manager if you need access to edit prizes and promotions.
            </p>
            <div className="text-xs text-slate-500 space-y-1">
              <p>
                Venue code:{" "}
                <span className="font-mono bg-slate-900/90 border border-slate-700 rounded px-2 py-[2px]">
                  {venue.code}
                </span>
              </p>
              {venue.venueAdminEmail && (
                <p>Registered venue admin email: {venue.venueAdminEmail}</p>
              )}
            </div>
            <Link
              href={`/venues/${venue.id}`}
              className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 mt-2 transition"
            >
              View public leaderboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Venue admin
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-2">
            {venue.name}
          </h1>
          {(venue.venueName || venue.location) && (
            <p className="text-sm text-slate-300 mb-2">
              {[venue.venueName, venue.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="text-xs text-slate-400">
            Manage prizes and promotions for this STREAKr venue league. Any
            changes you make here update the public venue leaderboard instantly.
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
            ← Back to venue list
          </Link>
          <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
            <span>
              Signed in as{" "}
              <span className="font-medium text-slate-100">
                {user.email ?? user.uid}
              </span>
            </span>
            <span className="text-slate-500">
              Venue code:{" "}
              <span className="font-mono bg-slate-900/80 border border-slate-700 rounded px-2 py-[2px]">
                {venue.code}
              </span>
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 px-5 py-6 shadow-lg shadow-black/40 space-y-5"
        >
          {error && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}
          {saveSuccess && (
            <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
              {saveSuccess}
            </p>
          )}

          <section className="space-y-3">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              Prizes & promotions
            </h2>
            <p className="text-xs text-slate-400 max-w-md">
              Tell players what they&apos;re playing for in your venue. This
              copy appears on your public venue leaderboard under the
              &quot;Venue prizes&quot; section.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Prizes headline
              </label>
              <input
                type="text"
                value={prizesHeadline}
                onChange={(e) => setPrizesHeadline(e.target.value)}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder="E.g. Win a $50 bar tab every Friday"
              />
              <p className="text-[11px] text-slate-500">
                Short, punchy line that grabs attention on the leaderboard.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Prizes description
              </label>
              <textarea
                value={prizesBody}
                onChange={(e) => setPrizesBody(e.target.value)}
                rows={4}
                className="w-full rounded-md bg-[#050816]/70 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/80 focus:border-amber-500/80"
                placeholder={`E.g.\nTop streak for each round wins a $50 bar tab.\nTie-breaker: earliest streak.\nSeason-long champ gets a $200 voucher.`}
              />
              <p className="text-[11px] text-slate-500">
                Explain how players win, tie-break rules, and any season-long
                prizes. You can update this anytime.
              </p>
            </div>
          </section>

          <section className="border-t border-slate-800 pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="max-w-md space-y-1">
              <p>
                Everything you write here is{" "}
                <span className="text-slate-100 font-medium">
                  visible to players
                </span>{" "}
                on your venue leaderboard.
              </p>
              <p>
                Keep it clear and honest. If you have detailed T&amp;Cs, mention
                where players can find them (e.g. at the bar or on your
                website).
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-5 py-2.5 transition disabled:opacity-60"
            >
              {saving ? "Saving prizes…" : "Save prizes"}
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}
