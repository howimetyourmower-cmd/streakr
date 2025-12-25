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
              Awarded to the p
