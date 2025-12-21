// /app/leagues/join/JoinLeagueClient.tsx
"use client";

import { useSearchParams } from "next/navigation";

export default function JoinLeagueClient() {
  const params = useSearchParams();

  // Example: ?code=ABC123
  const code = (params.get("code") || "").trim();

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">Join League</h1>

        {code ? (
          <p className="text-white/70 text-sm">
            League code detected: <span className="text-orange-400 font-semibold">{code}</span>
          </p>
        ) : (
          <p className="text-white/70 text-sm">Enter a league code to join.</p>
        )}

        {/* ✅ Move your existing join UI + logic here */}
      </div>
    </div>
  );
}
