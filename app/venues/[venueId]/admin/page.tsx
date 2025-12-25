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
