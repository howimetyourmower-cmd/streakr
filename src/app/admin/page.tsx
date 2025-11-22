// src/app/admin/page.tsx
"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboardPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lg font-semibold">Loading admin tools…</div>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-sm text-gray-300">
            You must be an admin to view this page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-semibold transition"
          >
            Go back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin console</h1>
          <p className="text-sm text-gray-300">
            Logged in as <span className="font-semibold">{user.email}</span>.{" "}
            Use these tools to manage rounds, publishing, and settlements.
          </p>
        </header>

        {/* Quick actions grid */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Rounds & publishing */}
          <Link
            href="/admin/rounds"
            className="group rounded-2xl bg-slate-900/80 border border-slate-700/60 p-5 hover:border-orange-500 hover:bg-slate-900 transition flex flex-col justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold mb-1 group-hover:text-orange-400">
                Rounds &amp; publishing
              </h2>
              <p className="text-sm text-gray-300">
                Upload all season questions and control when each round goes
                live on the Picks page.
              </p>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Path: <code>/admin/rounds</code>
            </div>
          </Link>

          {/* Season settings */}
          <Link
            href="/admin/settings"
            className="group rounded-2xl bg-slate-900/80 border border-slate-700/60 p-5 hover:border-orange-500 hover:bg-slate-900 transition flex flex-col justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold mb-1 group-hover:text-orange-400">
                Season settings (current round)
              </h2>
              <p className="text-sm text-gray-300">
                Choose which round is currently active for players on the Picks
                page. No redeploy needed – this updates live via Firestore.
              </p>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Path: <code>/admin/settings</code>
            </div>
          </Link>

          {/* Settlement console */}
          <Link
            href="/admin/settlement"
            className="group rounded-2xl bg-slate-900/80 border border-slate-700/60 p-5 hover:border-orange-500 hover:bg-slate-900 transition flex flex-col justify-between md:col-span-2"
          >
            <div>
              <h2 className="text-xl font-semibold mb-1 group-hover:text-orange-400">
                Settlement console
              </h2>
              <p className="text-sm text-gray-300">
                Lock questions at bounce, settle YES / NO / VOID, and update
                every player’s streak. Internal tool – use carefully.
              </p>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Path: <code>/admin/settlement</code>
            </div>
          </Link>
        </section>

        {/* Future admin tools placeholder */}
        <section className="mt-4 text-xs text-gray-400">
          <p>
            Future admin tools could live here – e.g. prize management, user
            moderation, data exports, etc.
          </p>
        </section>
      </div>
    </main>
  );
}
