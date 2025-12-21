// /app/venues/page.tsx
import { Suspense } from "react";
import VenuesClient from "./VenuesClient";

export default function VenuesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-6">Loading venues…</div>}>
      <VenuesClient />
    </Suspense>
  );
}
