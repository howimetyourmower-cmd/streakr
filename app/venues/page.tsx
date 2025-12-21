// /app/venues/page.tsx
import { Suspense } from "react";
import venuesClient from "./venuesClient";

export const dynamic = "force-dynamic";

export default function VenuesPage() {
  return (
    <Suspense fallback={<venuesLoading />}>
      <VenuesClient />
    </Suspense>
  );
}

function VenuesLoading() {
  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-black/40">
        <p className="text-sm text-slate-300">Loading venue leagues…</p>
      </div>
    </div>
  );
}
