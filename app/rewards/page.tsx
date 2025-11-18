// app/rewards/page.tsx

"use client";

export default function RewardsPage() {
  return (
    <main className="p-6 max-w-5xl mx-auto text-white">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Rewards</h1>
        <p className="text-sm text-gray-300">
          Every round we give away cash, gift Cards and Streakr gear. Keep your streak alive
          and stack up prizes.
        </p>
      </header>

      {/* Prizes summary */}
      <section className="grid gap-4 md:grid-cols-2 mb-8">
        {/* $750 main prize */}
        <div className="rounded-2xl border border-orange-500/50 bg-gradient-to-br from-orange-500/20 via-orange-500/5 to-transparent px-5 py-4">
          <p className="text-xs font-semibold uppercase text-orange-300 mb-1">
            Round major prize
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight mb-1">
            $7500 <span className="text-base font-semibold">cash or gift cards</span>
          </h2>
          <p className="text-sm text-gray-200 mb-3">
            Awarded to the player with the{" "}
            <span className="font-semibold">longest correct streak</span> for
            that round.
          </p>
          <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
            <li>Streak must be active for that round&apos;s questions.</li>
            <li>If there&apos;s a tie, we&apos;ll use tie-break rules in the
              final T&amp;Cs.</li>
          </ul>
        </div>

        {/* $250 most correct prize */}
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
          <p className="text-xs font-semibold uppercase text-blue-300 mb-1">
            Round side prize
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight mb-1">
            $250 <span className="text-base font-semibold">gift card</span>
          </h2>
          <p className="text-sm text-gray-200 mb-3">
            Awarded to the player with the{" "}
            <span className="font-semibold">most correct picks</span> in the
            round – even if they don&apos;t have the longest streak.
          </p>
          <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
            <li>Based on total correct answers across that round.</li>
            <li>
              If there&apos;s a tie, we&apos;ll share or tie-break as set out in
              the T&amp;Cs.
            </li>
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold mb-2">How rewards work</h3>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-sm text-gray-200 space-y-2">
          <p>
            Streakr tracks your picks every round. Your{" "}
            <span className="font-semibold text-orange-300">
              longest correct streak
            </span>{" "}
            and{" "}
            <span className="font-semibold text-orange-300">
              total correct picks
            </span>{" "}
            are used to decide winners.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>All cash prizes are in AUD.</li>
            <li>
              You must have a verified account and follow the game rules to be
              eligible.
            </li>
            <li>
              Full terms and conditions will be published before prizes go live.
            </li>
          </ul>
          <p className="text-xs text-gray-400 pt-1">
            This page is a preview of the reward structure while we finish the
            live scoring engine.
          </p>
        </div>
      </section>

      {/* Merch section */}
      <section>
        <h3 className="text-lg font-semibold mb-2">Streakr merch</h3>
        <p className="text-sm text-gray-300 mb-4">
          Rep your streak in the stands. We&apos;re launching limited Streakr
          merch for players.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* T-shirt card */}
          <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">
                Coming soon
              </p>
              <h4 className="text-xl font-bold mb-1">Streakr T-shirt</h4>
              <p className="text-sm text-gray-200 mb-2">
                Classic black tee with the STREAK<span className="lowercase">r</span> mark.
                Perfect for game day or cashing in your prize.
              </p>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li>Unisex fit, multiple sizes.</li>
                <li>High-quality print, built for many seasons.</li>
              </ul>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-full bg-orange-500 text-black text-sm font-semibold disabled:opacity-70"
              disabled
            >
              T-shirts launching soon
            </button>
          </div>

          {/* Cap card */}
          <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400 mb-1">
                Coming soon
              </p>
              <h4 className="text-xl font-bold mb-1">Streakr Cap</h4>
              <p className="text-sm text-gray-200 mb-2">
                Low-profile cap with the Streakr icon – for sunny days at the
                footy or late-night multi watching.
              </p>
              <ul className="text-xs text-gray-300 space-y-1 list-disc list-inside">
                <li>Adjustable strap for a comfy fit.</li>
                <li>Subtle logo so only real Streakrs know.</li>
              </ul>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-full bg-orange-500 text-black text-sm font-semibold disabled:opacity-70"
              disabled
            >
              Caps launching soon
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Want first access? Make sure your email is verified in your profile –
          we&apos;ll announce merch drops and special rewards in-app first.
        </p>
      </section>
    </main>
  );
}
