// /app/leagues/join/page.tsx

export const dynamic = "force-dynamic"
import { Suspense } from "react";
import JoinLeagueClient from "./JoinLeagueClient";

export default function JoinLeaguePage() {
  return (
    <Suspense fallback={<JoinLeagueLoading />}>
      <JoinLeagueClient />
    </Suspense>
  );
}

function JoinLeagueLoading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#050816] p-6">
        <p className="text-sm text-white/70">Loading join page…</p>
      </div>
    </div>
  );
}
