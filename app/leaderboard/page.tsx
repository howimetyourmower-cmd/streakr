export default function LeaderboardPage() {
  const scopes = ["Round", "Month", "All-Time"];
  return (
    <main className="container py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Leaderboards</h1>
        <p className="text-white/70">Track the best streaks. Tie-breaker: fastest average pick time.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {scopes.map((scope) => (
          <div key={scope} className="card">
            <div className="text-sm uppercase tracking-wide text-white/60">{scope}</div>
            <ol className="mt-4 space-y-2">
              {[1,2,3,4,5].map((i) => (
                <li key={i} className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-white/80">{i}. Player {i}</span>
                  <span className="text-white/60">Streak {10 - i}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </main>
  );
}
