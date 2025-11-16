// app/leagues/page.tsx
"use client";

import Link from "next/link";

export default function LeaguesPage() {
  return (
    <main className="min-h-[60vh] py-8 md:py-10">
      {/* Header */}
      <section className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Leagues</h1>
        <p className="text-slate-300 max-w-2xl text-sm md:text-base">
          Play Streakr with your mates, work crew or fantasy league. Create a
          private league, invite friends with a code, and battle it out on your
          own ladder while still counting towards the global streak leaderboard.
        </p>
      </section>

      {/* Main grid */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Create League */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Create a league</h2>
          <p className="text-slate-300 text-sm mb-4 flex-1">
            You&apos;re the commish. Name your league, set how many mates can
            join and share the invite code in your group chat.
          </p>
          <ul className="text-slate-400 text-xs mb-4 space-y-1">
            <li>• You automatically join as League Manager</li>
            <li>• Share a single code to invite players</li>
            <li>• Everyone&apos;s streak still counts globally</li>
          </ul>
          <Link
            href="/leagues/create"
            className="inline-flex justify-center items-center px-4 py-2 rounded-lg 
              bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm 
              transition-colors mt-auto"
          >
            Create league
          </Link>
        </div>

        {/* Join League */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Join a league</h2>
          <p className="text-slate-300 text-sm mb-4 flex-1">
            Got a code from a mate? Drop it in and you&apos;ll appear on that
            league&apos;s ladder as soon as you make picks.
          </p>
          <ul className="text-slate-400 text-xs mb-4 space-y-1">
            <li>• League Manager controls who gets the code</li>
            <li>• You can join multiple private leagues</li>
            <li>• No extra cost &ndash; still 100% free</li>
          </ul>
          <Link
            href="/leagues/join"
            className="inline-flex justify-center items-center px-4 py-2 rounded-lg 
              bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm 
              transition-colors mt-auto"
          >
            Join with a code
          </Link>
        </div>

        {/* My Leagues (coming soon wiring) */}
        <div className="bg-slate-900/60 border border-dashed border-slate-700 rounded-2xl p-5 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">My leagues</h2>
          <p className="text-slate-300 text-sm mb-4 flex-1">
            Once we finish wiring everything up, this panel will show all the
            leagues you&apos;re in, your current rank and a quick link to each
            ladder.
          </p>
          <ul className="text-slate-400 text-xs space-y-1">
            <li>• Global streak still decides prizes</li>
            <li>• Private leagues are just for bragging rights</li>
            <li>• Designed for mates, offices &amp; clubs</li>
          </ul>
          <p className="text-[11px] text-slate-500 mt-4">
            For now, use the buttons on this page to create or join leagues.
            Your league detail page and ladders are already live.
          </p>
        </div>
      </section>
    </main>
  );
}
