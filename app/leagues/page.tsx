// app/leagues/page.tsx

import Link from "next/link";

export default function LeaguesPage() {
  return (
    <div className="py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">Leagues</h1>
      <p className="text-slate-300 text-sm mb-6 max-w-2xl">
        Play Streakr with your mates, work crew or fantasy league. Create a
        private league, invite friends with a code, and battle it out on your
        own ladder while still counting towards the global Streak leaderboard.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* CREATE LEAGUE CARD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Create a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              You&apos;re the commish. Name your league, set how many mates can
              join and share a single invite code with your group.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4">
              <li>• You automatically join as League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone&apos;s streak still counts globally</li>
            </ul>
          </div>

          <Link
            href="/leagues/create"
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition"
          >
            Create league
          </Link>
        </div>

        {/* JOIN LEAGUE CARD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Join a league</h2>
            <p className="text-slate-300 text-sm mb-4">
              Got a code from a mate? Drop it in and you&apos;ll appear on that
              league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost – still 100% free</li>
            </ul>
          </div>

          <Link
            href="/leagues/join"
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-500 hover:bg-blue-400 text-black font-semibold text-sm px-4 py-2 transition"
          >
            Join with a code
          </Link>
        </div>

        {/* MY LEAGUES CARD */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">My leagues</h2>
            <p className="text-slate-300 text-sm mb-4">
              Soon you&apos;ll see all the leagues you&apos;re in, your current
              rank and a quick link to each ladder.
            </p>
            <ul className="text-slate-400 text-xs space-y-1 mb-4">
              <li>• Track streaks across mates, offices &amp; clubs</li>
              <li>• Private leagues are just for bragging rights</li>
              <li>• Global ladder still shows your best streak</li>
            </ul>
          </div>

          <button
            disabled
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 font-semibold text-sm px-4 py-2 cursor-not-allowed"
          >
            My leagues (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
