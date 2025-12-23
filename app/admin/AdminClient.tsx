// /app/admin/AdminClient.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export const dynamic = "force-dynamic";

type AdminTool = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const ADMIN_TOOLS: AdminTool[] = [
  {
    title: "Rounds & publishing",
    description:
      "Upload questions for each round and control when they go live on the Picks page.",
    href: "/admin/rounds",
    badge: "Primary",
  },
  {
    title: "Season settings",
    description:
      "Set which round is currently active for AFL 2026. Updates live via Firestore.",
    href: "/admin/settings",
  },
  {
    title: "Settlement console",
    description:
      "Lock questions and settle results (YES / NO / VOID). Updates player streaks and picks.",
    href: "/admin/settlement",
  },
  {
    title: "Marketing list",
    description:
      "View and export players who have opted in to marketing communications.",
    href: "/admin/marketing",
    badge: "New",
  },
  {
    title: "Venue leagues",
    description:
      "Create and manage venue leagues for pubs, clubs and sports bars. Controls subscription status and join codes.",
    href: "/admin/venues",
    badge: "Venues",
  },
];

export default function AdminClient() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Checking admin access…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#050814] text-slate-200">
        <div className="max-w-md rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 px-6 py-8 shadow-xl border border-slate-700/70">
          <h1 className="text-2xl font-semibold mb-3">Admin access only</h1>
          <p className="text-sm text-slate-400 mb-4">
            This page is restricted to STREAKr admins. If you think you should
            have access, double-check that you&apos;re logged in with the
            correct email.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-[#050814] text-slate-100">
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900/80 to-slate-950/80">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-2">
            Admin
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3">
            STREAKr control centre
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl">
            Manage rounds, publishing, settlements and marketing from one
            place. Changes here update the live game in real time, so use with
            care.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Quick actions
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ADMIN_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-4 shadow-lg shadow-black/40 hover:border-amber-500/70 hover:shadow-amber-500/20 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-semibold text-slate-50">
                    {tool.title}
                  </h3>
                  {tool.badge && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 border border-amber-400/30">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  {tool.description}
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-amber-300 group-hover:text-amber-200 font-medium">
                    Open console
                  </span>
                  <span className="text-slate-500 group-hover:text-slate-300">
                    &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
