"use client";

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {/* HEADER */}
      <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Frequently Asked Questions</h1>
          <p className="text-slate-300 max-w-2xl text-sm md:text-base">
            Everything you need to know about playing Streakr, making picks, your streak,
            prizes, and account setup.
          </p>
        </div>
      </section>

      {/* FAQ CONTENT */}
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-14 space-y-10">

        {/* --- GENERAL --- */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">General</h2>

          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">What is Streakr?</h3>
              <p className="text-slate-300 text-sm">
                Streakr is a free AFL prediction streak game. Answer Yes/No questions
                about live AFL moments, build your streak, and try to top the leaderboard.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">Is Streakr gambling?</h3>
              <p className="text-slate-300 text-sm">
                No. Streakr has no odds, no betting, no deposits, no wagers, and no 
                real-money risk. It’s purely a free prediction game of skill.
              </p>
            </div>
          </div>
        </div>

        {/* --- PICKS & STREAKS --- */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Picks & Streaks</h2>

          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">How do picks work?</h3>
              <p className="text-slate-300 text-sm">
                Each question is a Yes/No prediction about a specific AFL moment. Pick one
                option before the question locks.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">What is a streak?</h3>
              <p className="text-slate-300 text-sm">
                Every correct pick adds +1 to your streak. One incorrect pick resets it
                back to zero.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">
                Why can I only select one streak pick at a time?
              </h3>
              <p className="text-slate-300 text-sm">
                Your streak only progresses through one active question at a time. You
                can change your streak pick anytime before that question locks.
              </p>
            </div>
          </div>
        </div>

        {/* --- PRIZES --- */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Prizes</h2>

          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">How do I win prizes?</h3>
              <p className="text-slate-300 text-sm">
                Finish the round with the longest active streak and you’ll share in the
                $1,000 round prize pool.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">What is a sponsor question?</h3>
              <p className="text-slate-300 text-sm">
                Some rounds include a bonus sponsor question. If you select it as your
                streak pick and get it correct, you enter the draw for a sponsor prize.
              </p>
            </div>
          </div>
        </div>

        {/* --- ACCOUNT --- */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Account</h2>

          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">Why didn’t I get my verification email?</h3>
              <p className="text-slate-300 text-sm">
                Check your spam or promotions folder. Mark the email as “Not spam” to fix
                it for future emails. You can also resend verification from your profile.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-lg font-semibold mb-2">I forgot my password</h3>
              <p className="text-slate-300 text-sm">
                Use the “Forgot password” link on the login page to reset it instantly.
              </p>
            </div>
          </div>
        </div>

        {/* --- CONTACT US (FIXED STYLING) --- */}
        <div className="border-t border-slate-800 pt-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Contact us</h2>

          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 md:p-8 space-y-4">
            <p className="text-slate-300 text-sm md:text-base">
              Need help with your streak, picks, account, or prizes?
              Reach out and we’ll get back to you.
            </p>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                <p className="text-slate-200">support@streakr.app</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">What to include</p>
                <ul className="list-disc list-inside text-slate-300 space-y-1">
                  <li>Your Streakr username</li>
                  <li>The round or question you’re asking about</li>
                  <li>A short description of the issue</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              We typically respond within 24–48 hours.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
