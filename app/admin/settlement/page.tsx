// /app/admin/settlement/page.tsx
import { Suspense } from "react";
import SettlementClient from "./SettlementClient";

export const dynamic = "force-dynamic";

export default function SettlementPage() {
  return (
    <Suspense fallback={<SettlementLoading />}>
      <SettlementClient />
    </Suspense>
  );
}

function SettlementLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200 p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Loading settlement console…</p>
      </div>
    </div>
  );
}
