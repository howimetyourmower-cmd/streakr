// app/venues/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import VenuesClient from "./VenuesClient";

export default function VenuesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-sm text-white/70">Loading venues…</div>
        </div>
      }
    >
      <VenuesClient />
    </Suspense>
  );
}
