// app/leaderboards/page.tsx

import LeaderboardsClient from "./LeaderboardsClient";

export default function LeaderboardsPage() {
  return (
    <main className="w-full flex justify-center px-4 sm:px-6 py-6">
      {/* Let the client component handle the actual layout + headings */}
      <div className="w-full max-w-7xl">
        <LeaderboardsClient />
      </div>
    </main>
  );
}
