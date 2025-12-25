// app/admin/venues/new/page.tsx
import { Suspense } from "react";
import AdminNewVenueClient from "./AdminNewVenueClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-sm text-white/70">Loading venue creator…</div>
        </div>
      }
    >
      <AdminNewVenueClient />
    </Suspense>
  );
}
