// app/admin/page.tsx
import Link from "next/link";

const adminCards = [
  {
    href: "/admin/rounds",
    title: "Rounds & Publishing",
    description: "Publish / unpublish questions for each round and see a summary.",
  },
  {
    href: "/admin/settlement",
    title: "Settlement",
    description: "Settle questions after games finish and update streaks.",
  },
  {
    href: "/admin/settings",
    title: "Season Settings",
    description: "Update current round, season config, and other global settings.",
  },
  {
    href: "/admin/users",
    title: "User Management",
    description: "View players, basic details and activity (future feature).",
  },
];

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Admin dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">
              Quick links to the main STREAKr admin tools.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/40">
            AFL 2026 • Admin mode
          </span>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adminCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/40 transition hover:border-emerald-400/90 hover:bg-slate-900 hover:shadow-emerald-500/20"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
                  {/* Just show the first letter as a simple "number" style badge */}
                  {card.title.charAt(0)}
                </span>
                <span>{card.title}</span>
              </h2>
              <p className="mt-2 text-sm text-slate-300">{card.description}</p>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-emerald-300">
                Open tool
                <span className="ml-1 text-xs">↗</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
