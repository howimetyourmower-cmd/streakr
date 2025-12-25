// app/admin/venues/page.tsx
import { Suspense } from "react";
import AdminVenueLeaguesClient from "./AdminVenueLeaguesClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-sm text-white/70">Loading venue leagues…</div>
        </div>
      }
    >
      <AdminVenueLeaguesClient />
    </Suspense>
  );
}
