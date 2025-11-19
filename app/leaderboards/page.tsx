// app/leaderboards/page.tsx

import LeaderboardClient from "./LeaderboardClient";

export default function LeaderboardsPage() {
  return (
    <main className="w-full flex justify-center px-4 sm:px-6 py-6">
      <div className="w-full max-w-7xl">
        <LeaderboardClient />
      </div>
    </main>
  );
}
