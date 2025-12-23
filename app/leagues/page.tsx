// /app/leagues/page.tsx
import { Suspense } from "react";
import LeaguesClient from "./LeaguesClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white p-6">
          Loading leagues…
        </div>
      }
    >
      <LeaguesClient />
    </Suspense>
  );
}
