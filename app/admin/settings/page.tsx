// /app/admin/settings/page.tsx
import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsAdminPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsClient />
    </Suspense>
  );
}

function SettingsLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200 p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Loading season settings…</p>
      </div>
    </div>
  );
}
