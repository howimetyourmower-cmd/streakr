// /app/admin/marketing/page.tsx
import { Suspense } from "react";
import MarketingClient from "./MarketingClient";

export const dynamic = "force-dynamic";

export default function AdminMarketingPage() {
  return (
    <Suspense fallback={<MarketingLoading />}>
      <MarketingClient />
    </Suspense>
  );
}

function MarketingLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Loading marketing list…</p>
      </div>
    </div>
  );
}
