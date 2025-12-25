// app/rewards/page.tsx
export const dynamic = "force-dynamic";

export default function RewardsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-50">
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        {/* Page header */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
            </span>
            Rewards & prizes
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            Rewards
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">
            Every round we give away prizes and STREAK
            <span className="text-orange-500">r</span>{" "}
            gear. Keep your streak alive and stack up rewards.
          </p>
        </header>

        {/* Prizes summary */}
        <section className="grid gap-4 md:grid-cols-2 mb-10">
          {/* $1000 major prize */}
          <div className="rounded-2xl border border-orange-500/50 bg-gradient-to-br from-orange-500/20 via-orange-500/5 to-transparent px-5 py-5 shadow-[0_0_40px_rgba(248,113,22,0.18)]">
            <p className="text-xs font-semibold uppercase text-orange-300 mb-1">
              Round major prize
            </p>

            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
              $1000{" "}
              <span className="text-base md:text-lg font-semibold text-orange-100/90">
                gift card
              </span>
            </h2>

            <p className="text-sm text-zinc-200 mb-4">
              Awarded to the player with the{" "}
              <span className="font-semibold text-orange-200">
                longest streak
              </span>{" "}
              for that round.
            </p>

            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
              <li>
                You must have a{" "}
                <span className="font-semibold">verified account</span>.
              </li>
              <li>
                <span className="font-semibold">Void</span> questions don&apos;t
                count.
              </li>
              <li>
                If there&apos;s a tie, we&apos;ll apply tie-break rules (published
                in the final T&amp;Cs).
              </li>
            </ul>
          </div>

          {/* Sponsor question prize */}
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-black/20 to-black/10 px-5 py-5 shadow-[0_0_40px_rgba(245,158,11,0.12)]">
            <p className="text-xs font-semibold uppercase text-amber-300 mb-1">
              Sponsor prize (each round)
            </p>

            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
              $100{" "}
              <span className="text-base md:text-lg font-semibold text-amber-100/90">
                gift card draw
              </span>
            </h2>

            <p className="text-sm text-zinc-200 mb-4">
              Get the{" "}
              <span className="font-semibold text-amber-200">
                Sponsor Question
              </span>{" "}
              right and you go into the draw for the round&apos;s sponsor prize.
            </p>

            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc list-inside">
              <li>
                Only questions tagged{" "}
                <span className="font-semibold">Sponsor Question</span> count.
              </li>
              <li>You must have made a pick on the sponsor question.</li>
              <li>Winners are drawn after the round settles.</li>
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold mb-2">How rewards work</h3>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-sm text-zinc-200 space-y-3">
            <p>
              Each round, prizes are awarded based on your{" "}
              <span className="font-semibold text-orange-300">longest streak</span>.
              The longer you survive, the closer you get to the big one.
            </p>

            <ul className="list-disc list-inside space-y-1.5">
              <li>All prizes are in AUD.</li>
              <li>You must have a verified account and follow the rules to be eligible.</li>
              <li>Full Terms &amp; Conditions will be published before prizes go live.</li>
            </ul>

            <p className="text-xs text-zinc-400 pt-1">
              This page is a preview of the reward structure while we finish the live scoring engine.
            </p>
          </div>
        </section>

        {/* Merch section */}
        <section>
          <h3 className="text-lg font-semibold mb-2">STREAKr merch</h3>
          <p className="text-sm text-zinc-300 mb-4">
            Rep your streak in the stands. We&apos;re launching limited STREAKr merch for players.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* T-shirt card */}
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Coming soon
                </p>
                <h4 className="text-xl font-bold mb-1">
                  STREAK<span className="lowercase">r</span> T-shirt
                </h4>
                <p className="text-sm text-zinc-200 mb-2">
                  Classic black tee with the STREAK<span className="lowercase">r</span> mark.
                  Perfect for game day or cashing in your prize.
                </p>
                <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
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
                <p className="text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Coming soon
                </p>
                <h4 className="text-xl font-bold mb-1">STREAKr Cap</h4>
                <p className="text-sm text-zinc-200 mb-2">
                  Low-profile cap with the STREAKr icon – for sunny days at the
                  footy or late-night multi watching.
                </p>
                <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                  <li>Adjustable strap for a comfy fit.</li>
                  <li>Subtle logo so only real STREAKrs know.</li>
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

          <p className="text-xs text-zinc-400 mt-4">
            Want first access? Make sure your email is verified in your profile – we&apos;ll announce
            merch drops and special rewards in-app first.
          </p>
        </section>
      </section>
    </main>
  );
}
