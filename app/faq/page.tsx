export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="mb-8 text-4xl font-extrabold">FAQ</h1>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-lg font-semibold">What is STREAKr?</h2>
            <p className="text-white/80">
              A free-to-play AFL prediction game. Make one pick at a time, build the longest streak in a round, and win.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-lg font-semibold">How does a streak work?</h2>
            <p className="text-white/80">
              Each correct Yes/No answer adds 1 to your streak. A wrong answer ends it. You can start a new streak anytime.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-lg font-semibold">How are winners decided?</h2>
            <p className="text-white/80">
              The player(s) with the longest streak for the round win. If there’s a tie, prize is shared. If one streak is unbroken and the other has a loss, the unbroken streak wins.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-lg font-semibold">When are questions settled?</h2>
            <p className="text-white/80">
              Shortly after each quarter finishes. Questions may be marked <em>OPEN</em>, <em>PENDING</em>, or <em>FINAL</em> while being verified.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-2 text-lg font-semibold">Can I restart after a loss?</h2>
            <p className="text-white/80">
              Yes. A new streak can start immediately with your next pick.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
