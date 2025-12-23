// /app/admin/page.tsx
import { Suspense } from "react";
import AdminClient from "./AdminClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050814] text-slate-200 flex items-center justify-center">
          Loading admin…
        </div>
      }
    >
      <AdminClient />
    </Suspense>
  );
}
