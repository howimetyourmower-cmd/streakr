"use client";

import React from "react";
import Link from "next/link";

type TopLeague = {
  name: string;
  tagLine: string;
  avgStreak: number;
  players: number;
};

type ActivityItem = {
  timeAgo: string;
  message: string;
};

type HallOfFameItem = {
  label: string;
  value: string;
  note?: string;
};

const topLeagues: TopLeague[] = [
  {
    name: "The Streak Masters",
    tagLine: "Office crew that takes Fridays very seriously.",
    avgStreak: 7.2,
    players: 24,
  },
  {
    name: "Footy Fanatics",
    tagLine: "Every game. Every round. No excuses.",
    avgStreak: 6.8,
    players: 31,
  },
  {
    name: "Family Feud Cup",
    tagLine: "Siblings, partners & ultimate bragging rights.",
    avgStreak: 6.4,
    players: 12,
  },
  {
    name: "Pub Tips League",
    tagLine: "Picks made over parmas and pints.",
    avgStreak: 6.1,
    players: 18,
  },
];

const activityFeed: ActivityItem[] = [
  {
    timeAgo: "2 min ago",
    message: "Mick joined “Test Crew” and locked in his first pick.",
  },
  {
    timeAgo: "7 min ago",
    message: "Sarah hit a streak of 5 in “Office Legends”.",
  },
  {
    timeAgo: "18 min ago",
    message: "“Test Crew” league ladder just updated for tonight’s game.",
  },
  {
    timeAgo: "35 min ago",
    message: "3 new players joined private leagues using invite codes.",
  },
];

const hallOfFame: HallOfFameItem[] = [
  {
    label: "Longest streak",
    value: "14",
    note: "Global all-time",
  },
  {
    label: "Best round",
    value: "9 / 9",
    note: "Perfect picks",
  },
  {
    label: "Leagues this season",
    value: "328",
    note: "And counting",
  },
  {
    label: "Biggest league",
    value: "54",
    note: "Players in one crew",
  },
];

export default function LeaguesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-20 pt-10">
        {/* Page heading */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
            </span>
            Private leagues are live
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Leagues
          </h1>
          <p className="max-w-2xl text-sm text-zinc-300 md:text-base">
            Play STREAKr with your mates, work crew or fantasy league.
            Create a private league, invite your friends with a code, and
            battle it out on your own ladder while still counting towards
            the global Streak leaderboard.
          </p>
        </header>

        {/* Main league boxes */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Create league */}
          <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-900 p-5 shadow-lg shadow-orange-500/30">
            <h2 className="mb-2 text-lg font-semibold">Create a league</h2>
            <p className="mb-4 text-sm text-zinc-200">
              You&apos;re the commish. Name your league, set how many mates
              can join, and share a single invite code with your group.
            </p>
            <ul className="mb-4 space-y-1 text-xs text-zinc-200/90">
              <li>• Automatically become League Manager</li>
              <li>• Share one code to invite players</li>
              <li>• Everyone&apos;s streak still counts globally</li>
            </ul>
            <button className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400">
              Create league
            </button>
          </div>

          {/* Join league */}
          <div className="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/20 via-zinc-900 to-zinc-900 p-5 shadow-lg shadow-sky-500/30">
            <h2 className="mb-2 text-lg font-semibold">Join a league</h2>
            <p className="mb-4 text-sm text-zinc-200">
              Got a code from a mate? Drop it in and you&apos;ll appear on
              that league&apos;s ladder as soon as you start making picks.
            </p>
            <ul className="mb-4 space-y-1 text-xs text-zinc-200/90">
              <li>• League Manager controls who gets the code</li>
              <li>• You can join multiple private leagues</li>
              <li>• No extra cost – still 100% free</li>
            </ul>
            <button className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-400">
              Join with a code
            </button>
          </div>

          {/* My leagues */}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5">
            <h2 className="mb-2 text-lg font-semibold">My leagues</h2>
            <p className="mb-4 text-sm text-zinc-200">
              Jump back into one of your existing leagues, manage invites or
              check your ladder position.
            </p>

            {/* Example select – hook this to your real data */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400">
                Select a league
              </label>
              <select className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/50 focus:border-orange-500 focus:ring-2">
                <option>Test Crew (Manager)</option>
                <option>Test Crew</option>
              </select>

              <div className="rounded-xl bg-zinc-950/80 px-3 py-3 text-xs text-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Test Crew</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                    Invite code: <span className="font-mono">ZWDJ2</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-zinc-400">
                  You&apos;re the League Manager. Share the code, approve
                  new players and keep the banter flowing.
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-full border border-zinc-600 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:border-orange-500 hover:text-orange-300">
                    League manager
                  </button>
                  <button className="flex-1 rounded-full bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-100 hover:bg-zinc-700">
                    View ladder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NEW: Top public leagues */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold md:text-xl">
              Top public leagues this week
            </h2>
            <span className="text-xs text-zinc-400">
              Based on average active streak
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2">
            {topLeagues.map((league) => (
              <div
                key={league.name}
                className="min-w-[240px] flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 shadow-md hover:border-orange-500/60 hover:shadow-orange-500/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{league.name}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">
                      {league.tagLine}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-zinc-400">Avg streak</p>
                    <p className="text-lg font-bold text-orange-400">
                      {league.avgStreak.toFixed(1)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {league.players} players
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NEW: Activity + Hall of Fame row */}
        <section className="grid gap-6 md:grid-cols-[1.4fr,1fr]">
          {/* Activity feed */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Live league activity</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Updating in real time
              </span>
            </div>
            <p className="mb-4 text-xs text-zinc-400">
              A quick snapshot of what&apos;s happening across private leagues.
            </p>

            <ul className="space-y-3">
              {activityFeed.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-3 rounded-xl bg-zinc-950/80 px-3 py-2.5 text-xs"
                >
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                  <div className="flex-1">
                    <p className="text-zinc-100">{item.message}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {item.timeAgo}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 text-[11px] text-zinc-500">
              Want your league here?{" "}
              <Link
                href="/picks"
                className="font-semibold text-orange-400 hover:text-orange-300"
              >
                Start making picks tonight.
              </Link>
            </div>
          </div>

          {/* Hall of fame / stats */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-900 p-4">
              <h2 className="mb-2 text-sm font-semibold">
                Hall of fame snapshot
              </h2>
              <p className="mb-3 text-xs text-zinc-100/80">
                A taste of what the best Streakrs and leagues are doing right
                now.
              </p>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {hallOfFame.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl bg-zinc-950/70 px-3 py-2"
                  >
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-lg font-bold text-orange-300">
                      {item.value}
                    </dd>
                    {item.note && (
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {item.note}
                      </p>
                    )}
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-xs text-zinc-200">
              <p className="font-semibold text-sm mb-1">
                Win bragging rights (and actual rewards)
              </p>
              <p className="text-[11px] text-zinc-400">
                Coming soon: bonus prizes for leagues that finish in the
                top tier of the global ladder — merch drops, badges and
                more. Make sure your league is ready.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
