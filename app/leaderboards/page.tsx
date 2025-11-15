// app/leaderboards/page.tsx

import LeaderboardClient from "./LeaderboardClient";

export default function LeaderboardsPage() {
  return (
    <main className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-2">Leaderboards</h1>
      <p className="text-sm text-gray-300 mb-6">
        See who&apos;s on a heater. Live data from player profiles.
      </p>

      <LeaderboardClient />
    </main>
  );
}
