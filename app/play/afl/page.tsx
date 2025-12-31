// /app/play/afl/page.tsx
import { Suspense } from "react";
import AflPlayClient from "./AflPlayClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-sm opacity-70">Loading AFL…</div>
        </div>
      }
    >
      <AflPlayClient />
    </Suspense>
  );
}
