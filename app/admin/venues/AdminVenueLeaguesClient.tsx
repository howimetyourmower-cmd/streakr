// app/admin/venues/AdminVenueLeaguesClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

type VenueLeague = {
  id: string;
  name: string;
  venueName?: string | null;
  location?: string | null;
  code: string;
  subscriptionStatus: SubscriptionStatus;
  memberCount?: number;
};

export default function AdminVenueLeaguesClient() {
  const router = useRouter();
  const { user, loading, isAdmin } = useAuth();

  const [venues, setVenues] = useState<VenueLeague[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      try {
        const q = query(
          collection(db, "venueLeagues"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        const rows: VenueLeague[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "Venue League",
            venueName: data.venueName ?? null,
            location: data.location ?? null,
            code: data.code ?? "",
            subscriptionStatus:
              (data.subscriptionStatus as SubscriptionStatus) ?? "active",
            memberCount: data.memberCount ?? 0,
          };
        });

        setVenues(rows);
      } catch (err) {
        console.error("Failed to load venue leagues", err);
      } finally {
        setLoadingVenues(false);
      }
    };

    load();
  }, [isAdmin]);

  if (loading || loadingVenues) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/70 text-sm">
        Loading venue leagues…
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white text-sm">
        Access denied
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Venue Leagues</h1>
          <button
            onClick={() => router.push("/admin/venues/new")}
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
          >
            + Create venue
          </button>
        </div>

        <div className="grid gap-4">
          {venues.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
              No venue leagues yet.
            </div>
          )}

          {venues.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-white/10 bg-black/30 p-5 flex items-center justify-between gap-4"
            >
              <div>
                <h2 className="font-semibold">{v.name}</h2>
                <p className="text-xs text-white/60">
                  {v.venueName}
                  {v.location ? ` • ${v.location}` : ""}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  Code: <span className="font-mono">{v.code}</span> • Members:{" "}
                  {v.memberCount ?? 0}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    v.subscriptionStatus === "active"
                      ? "bg-green-500/20 text-green-300"
                      : v.subscriptionStatus === "paused"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-red-500/20 text-red-300"
                  }`}
                >
                  {v.subscriptionStatus}
                </span>

                <button
                  onClick={() => router.push(`/venues/${v.id}`)}
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  View
                </button>

                <button
                  onClick={() =>
                    router.push(`/venues/${v.id}/admin`)
                  }
                  className="text-xs text-white/70 hover:text-white"
                >
                  Admin
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Sponsor banner placeholder */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/20 to-orange-600/10 p-4 border border-orange-500/30 text-center text-sm">
          Sponsor banner placeholder
        </div>
      </div>
    </div>
  );
}
