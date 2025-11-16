"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LeaguesHomePage() {
  const { user } = useAuth();

  return (
    <div className="py-6 md:py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-3">Leagues</h1>
      <p className="text-slate-300 text-sm max-w-2xl mb-8">
        Play Streakr with your mates, work crew or fantasy league. Create a
        private league, invite friends with a code, and battle it out on your
        own ladder while your streak still counts towards the global leaderboard.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {/* CREATE LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-lg font-semibold mb-2">Create a league</h3>
          <p className="text-sm text-slate-300 mb-4">
            You&apos;re the commish. Name your league, set how many mates can
            join, and share a single code in your group chat.
          </p>
          <ul className="text-xs text-slate-400 mb-4 list-disc list-inside space-y-1">
            <li>League Manager controls settings</li>
            <li>Everyone&apos;s streak still counts globally</li>
            <li>100% free to play</li>
          </ul>
          <Link
            href="/leagues/create"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-black font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Create league
          </Link>
        </div>

        {/* JOIN LEAGUE */}
        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-lg font-semibold mb-2">Join a league</h3>
          <p className="text-sm text-slate-300 mb-4">
            Got a code from a mate? Drop it in and you&apos;ll appear on that
            league&apos;s ladder as soon as you make picks.
          </p>
          <ul className="text-xs text-slate-400 mb-4 list-disc list-inside space-y-1">
            <li>League Manager controls who gets the code</li>
            <li>You can join multiple private leagues</li>
            <li>No extra cost – still 100% free</li>
          </ul>
          <Link
            href="/leagues/join"
            className="inline-block bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Join with a code
          </Link>
        </div>

        {/* MY LEAGUES (COMING SOON) */}
        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-lg font-semibold mb-2">My leagues</h3>
          <p className="text-sm text-slate-300 mb-4">
            Soon you&apos;ll see all the leagues you&apos;re in, your current
            rank and a quick link to each ladder.
          </p>
          <ul className="text-xs text-slate-400 mb-4 list-disc list-inside space-y-1">
            <li>One view for mates, work, and fantasy leagues</li>
            <li>Quick jump into each ladder</li>
            <li>Designed for bragging rights, not extra bets</li>
          </ul>
          <p className="text-xs text-slate-500">
            For now, use the buttons on this page to create or join leagues.
            The league detail page and ladders are already in build.
          </p>
        </div>
      </div>

      {/* SMALL FOOTER LINK BACK TO PICKS */}
      <div className="mt-10 text-sm text-slate-400">
        <Link href="/picks" className="text-orange-400 hover:underline">
          Back to Picks →
        </Link>
      </div>
    </div>
  );
}
