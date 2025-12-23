// app/admin/venues/page.tsx
import { Suspense } from "react";
import AdminVenueLeaguesClient from "./AdminVenueLeaguesClient";

export const dynamic = "force-dynamic";

export default function AdminVenuesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminVenueLeaguesClient />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      Loading admin venues…
    </div>
  );
}
