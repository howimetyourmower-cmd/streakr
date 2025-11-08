export default function RewardsPage() {
  return (
    <main className="container py-12 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Rewards & Prizes</h1>
        <p className="text-white/70">Win the round. Unlock milestone merch. Sponsored prizes each week.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm uppercase tracking-wide text-white/60">Round Prize</div>
          <h3 className="mt-2 text-xl font-semibold">Round 1: $500 Gift Card</h3>
          <p className="mt-2 text-white/70 text-sm">Longest streak this round wins. T&Cs apply.</p>
        </div>

        <div className="card">
          <div className="text-sm uppercase tracking-wide text-white/60">Milestones</div>
          <ul className="mt-2 text-sm text-white/80 space-y-1">
            <li>🔥 3-streak — Badge: Warm Up</li>
            <li>🔥 5-streak — Badge: On a Roll</li>
            <li>🔥 10-streak — Badge: Untouchable</li>
            <li>🔥 20-streak — Badge: Legend</li>
          </ul>
        </div>

        <div className="card">
          <div className="text-sm uppercase tracking-wide text-white/60">Merch</div>
          <ul className="mt-2 text-sm text-white/80 space-y-1">
            <li>Streakr Tee (unlocked at 10-streak)</li>
            <li>Cap (unlocked at 5-streak)</li>
            <li>Sticker Pack (free for all participants)</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
