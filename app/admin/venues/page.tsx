import { Suspense } from "react";
import AdminNewVenueClient from "./AdminNewVenueClient";

export const dynamic = "force-dynamic";

export default function AdminNewVenuePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading admin venue tools…</div>
        </div>
      }
    >
      <AdminNewVenueClient />
    </Suspense>
  );
}
