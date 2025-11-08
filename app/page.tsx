export default function HomePage() {
  return (
    <main className="container py-12">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">
          One pick. <span className="text-streakr-orange">One streak.</span> Win the round.
        </h1>
        <p className="text-lg text-white/80">
          Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a href="#" className="btn btn-primary">Make your first pick</a>
          <a href="/leaderboard" className="btn btn-ghost">Leaderboards</a>
        </div>
      </div>

      <section className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="card">
            <div className="text-sm uppercase tracking-wide text-white/60">Round {i}</div>
            <div className="mt-2 text-xl font-semibold">Sample Question</div>
            <div className="mt-4 flex gap-3">
              <button className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 py-2">Yes</button>
              <button className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 py-2">No</button>
            </div>
            <div className="mt-3 text-xs text-white/50">Stats unlock after you pick</div>
            <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
              <span className="badge">Discuss (12)</span>
              <span className="badge">YES 62% | NO 38%</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
