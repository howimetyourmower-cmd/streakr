"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function AdminNewVenueClient() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/");
    }
  }, [loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm text-gray-400">Checking admin access…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-orange-500">
          Create Venue League
        </h1>

        <div className="rounded-2xl bg-zinc-900 p-6 border border-zinc-800">
          <p className="text-sm text-gray-300">
            Venue creation form will live here.
          </p>

          <p className="mt-3 text-xs text-gray-500">
            Admin-only. Venue leagues power pub & club competitions.
          </p>
        </div>

        {/* Sponsor placeholder */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/20 to-orange-600/10 p-4 border border-orange-500/30 text-center text-sm">
          Sponsor banner placeholder
        </div>
      </div>
    </div>
  );
}
