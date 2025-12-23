// /app/leagues/create/page.tsx
import { Suspense } from "react";
import CreateLeagueClient from "./CreateLeagueClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white p-6">
          Loading create league…
        </div>
      }
    >
      <CreateLeagueClient />
    </Suspense>
  );
}
