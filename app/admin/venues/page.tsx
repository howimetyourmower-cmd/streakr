// app/admin/venues/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
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
  venueName?: string;
  location?: string;
  subscriptionStatus: SubscriptionStatus;
};

export default function AdminVenueLeaguesPage() {
  const { user, isAdmin, loading } = useAuth();

  const [venues, setVenues] = useState<VenueLeague[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    setVenuesLoading(true);
    setVenuesError(null);

    const venuesRef = collection(db, "venueLeagues");
    const q = query(venuesRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: VenueLeague[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const subscriptionStatus: SubscriptionStatus =
            (data.subscriptionStatus as SubscriptionStatus) ?? "active";

          return {
            id: docSnap.id,
            name: data.name ?? "Venue League",
            code: data.code ?? "",
            venueName: data.venueName ?? data.venue ?? undefined,
            location: data.location ?? undefined,
            subscriptionStatus,
          };
        });
        setVenues(list);
        setVenuesLoading(false);
      },
      (err) => {
        console.error("Failed to load venue leagues", err);
        setVenues([]);
        setVenuesLoading(false);
        setVenuesError("Failed to load venue leagues.");
      }
    );

    return () => unsub();
  }, [isAdmin]);

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
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Admin · Venue leagues
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            Venue leagues console
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Create and manage STREAKr venue leagues for pubs, clubs and sports
            bars. Control subscription status, join codes and see which venues
            are live.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to admin
          </Link>
          <Link
            href="/admin/venues/new"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs px-4 py-2 transition"
          >
            Create venue league
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 px-5 py-5 shadow-lg shadow-black/40 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base md:text-lg font-semibold text-slate-50">
              All venue leagues
            </h2>
            <span className="text-[11px] text-slate-400">
              {venuesLoading
                ? "Loading…"
                : `${venues.length} venue${
                    venues.length === 1 ? "" : "s"
                  }`}
            </span>
          </div>

          {venuesError && (
            <p className="text-sm text-red-400">{venuesError}</p>
          )}

          {venuesLoading && !venuesError && (
            <p className="text-sm text-slate-400">Loading venue leagues…</p>
          )}

          {!venuesLoading && !venuesError && venues.length === 0 && (
            <p className="text-sm text-slate-400">
              No venue leagues found yet. Use{" "}
              <span className="text-slate-100 font-medium">
                Create venue league
              </span>{" "}
              to add the first partner venue.
            </p>
          )}

          {!venuesLoading && !venuesError && venues.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#030713]/80">
              <div className="hidden md:grid grid-cols-12 px-4 py-3 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                <div className="col-span-4">Venue / league</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-2">Code</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <ul className="divide-y divide-slate-800">
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
                      className="px-4 py-3 text-sm md:grid md:grid-cols-12 md:items-center flex flex-col gap-2"
                    >
                      {/* Venue / league */}
                      <div className="md:col-span-4 flex flex-col">
                        <span className="font-semibold text-slate-50">
                          {v.name}
                        </span>
                        {v.venueName && (
                          <span className="text-xs text-slate-400">
                            {v.venueName}
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      <div className="md:col-span-2 text-xs text-slate-400">
                        {v.location ?? "-"}
                      </div>

                      {/* Code */}
                      <div className="md:col-span-2 flex items-center gap-2 text-xs text-slate-300">
                        <span className="font-mono bg-slate-900/80 border border-slate-700 rounded-md px-2 py-1">
                          {v.code}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 md:text-right flex md:justify-end gap-2">
                        <Link
                          href={`/venues/${v.id}`}
                          className="inline-flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-[11px] px-3 py-1 transition"
                        >
                          View public
                        </Link>
                        <Link
                          href={`/venues/${v.id}/admin`}
                          className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] px-3 py-1 transition"
                        >
                          Venue admin
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
