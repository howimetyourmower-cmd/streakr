import { Suspense } from "react";
import BblHubClient from "./BblHubClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-4xl px-6 py-12">
            <div className="rounded-2xl border border-white/10 bg-[#020617] p-5 text-white/70">
              Loading…
            </div>
          </div>
        </main>
      }
    >
      <BblHubClient />
    </Suspense>
  );
}
