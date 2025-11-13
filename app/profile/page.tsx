"use client";

import { useEffect, useState } from "react";

type ProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb?: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number; // 0-100
  roundsPlayed: number;
};

type RecentPick = {
  id: string;
  round: number;
  match: string;
  question: string;
  userPick: "Yes" | "No";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string;
};

type ProfileData = {
  stats: ProfileStats;
  recentPicks: RecentPick[];
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Replace this with a real API call like `/api/profile`
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        // --- MOCK DATA FOR NOW ---
        const mock: ProfileData = {
          stats: {
            displayName: "Glenn M",
            username: "glennmadds",
            favouriteTeam: "Carlton",
            suburb: "Bentleigh",
            state: "VIC",
            currentStreak: 5,
            bestStreak: 12,
            correctPercentage: 68,
            roundsPlayed: 14,
          },
          recentPicks: [
            {
              id: "1",
              round: 8,
              match: "Carlton v Brisbane",
              question:
                "Will Patrick Cripps get 6 or more disposals in the 1st quarter?",
              userPick: "Yes",
              result: "correct",
              settledAt: "2026-04-12T10:30:00Z",
            },
            {
              id: "2",
              round: 8,
              match: "Carlton v Brisbane",
              question:
                "Will Charlie Curnow kick a goal in the 2nd quarter?",
              userPick: "Yes",
              result: "wrong",
              settledAt: "2026-04-12T11:00:00Z",
            },
            {
              id: "3",
              round: 7,
              match: "Richmond v Collingwood",
              question:
                "Will Collingwood win or draw against Richmond?",
              userPick: "No",
              result: "correct",
              settledAt: "2026-04-05T09:50:00Z",
            },
            {
              id: "4",
              round: 7,
              match: "Richmond v Collingwood",
              question:
                "Will Nick Daicos have 7 or more disposals in the 3rd quarter?",
              userPick: "Yes",
              result: "pending",
            },
            {
              id: "5",
              round: 6,
              match: "Hawthorn v Essendon",
              question:
                "Will Hawthorn beat Essendon by 22 points or more?",
              userPick: "No",
              result: "void",
            },
          ],
        };

        // Simulate async
        await new Promise((res) => setTimeout(res, 300));
        setProfile(mock);

        // When wired up for real:
        // const res = await fetch("/api/profile");
        // if (!res.ok) throw new Error("Failed to load profile");
        // const data = await res.json();
        // setProfile(data);
      } catch (err: any) {
        setError(err.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-lg font-medium">Loading your profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="bg-slate-900/70 border border-red-500/40 rounded-2xl px-6 py-4 max-w-md text-center">
          <p className="text-red-400 font-semibold mb-2">
            Couldn&apos;t load profile
          </p>
          <p className="text-sm text-slate-300 mb-4">
            {error ?? "Something went wrong. Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const { stats, recentPicks } = profile;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* PAGE HEADER */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Profile
            </h1>
            <p className="text-sm md:text-base text-slate-400">
              Your streak, your stats, your story.
            </p>
          </div>
          <button className="hidden md:inline-flex text-sm border border-slate-700 hover:border-slate-500 rounded-full px-4 py-1.5 transition">
            Edit profile (coming soon)
          </button>
        </div>

        {/* TOP CARD: PLAYER HEADER + KEY STATS */}
        <div className="bg-slate-900/60 border border-slate-700/70 rounded-3xl p-4 md:p-6 mb-6 md:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left: Avatar + basic info */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-2xl font-bold">
              {getInitials(stats.displayName)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-semibold">
                  {stats.displayName}
                </h2>
                <span className="text-xs md:text-sm text-slate-400">
                  @{stats.username}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1 text-xs md:text-sm text-slate-300">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80">
                  Favourite team: {stats.favouriteTeam}
                </span>
                {(stats.suburb || stats.state) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80">
                    {stats.suburb && `${stats.suburb},`} {stats.state}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: headline streak summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full md:w-auto">
            <StatPill
              label="Current streak"
              value={stats.currentStreak}
              suffix="in a row"
              highlight
            />
            <StatPill
              label="Best streak"
              value={stats.bestStreak}
              suffix="max"
            />
            <StatPill
              label="Correct picks"
              value={`${stats.correctPercentage}%`}
              suffix={`${stats.roundsPlayed} rounds`}
            />
          </div>
        </div>

        {/* BOTTOM GRID: STAT CARDS + RECENT PICKS + BADGES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: extra stats + badges */}
          <div className="space-y-6">
            {/* Extra stats card (placeholder for future stuff) */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Streak snapshot
              </h3>
              <ul className="space-y-2 text-xs md:text-sm text-slate-300">
                <li className="flex justify-between">
                  <span>Total rounds played</span>
                  <span className="font-medium">{stats.roundsPlayed}</span>
                </li>
                <li className="flex justify-between">
                  <span>Current hot streak</span>
                  <span className="font-medium">
                    {stats.currentStreak >= 3
                      ? "🔥 Running hot"
                      : "🧊 Warming up"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Accuracy</span>
                  <span className="font-medium">
                    {stats.correctPercentage}% picks correct
                  </span>
                </li>
              </ul>
            </div>

            {/* Badges card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Badges (coming soon)
              </h3>
              <div className="flex flex-wrap gap-2">
                <BadgePlaceholder label="First Streak" />
                <BadgePlaceholder label="Perfect Round" />
                <BadgePlaceholder label="Underdog Hero" />
                <BadgePlaceholder label="Iron Streak" />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Badges will unlock as you play. Keep streaking to earn them.
              </p>
            </div>
          </div>

          {/* Right: recent picks (takes 2 columns on large screens) */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-sm font-semibold text-slate-200">
                Recent picks
              </h3>
              <span className="text-xs text-slate-400">
                Last {recentPicks.length} questions
              </span>
            </div>

            {recentPicks.length === 0 ? (
              <p className="text-sm text-slate-400">
                You haven&apos;t made any picks yet. Jump into a round to start
                your streak.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {recentPicks.map((pick) => (
                  <RecentPickRow key={pick.id} pick={pick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function StatPill(props: {
  label: string;
  value: string | number;
  suffix?: string;
  highlight?: boolean;
}) {
  const { label, value, suffix, highlight } = props;
  return (
    <div
      className={`rounded-2xl px-3 py-2 border text-xs md:text-sm ${
        highlight
          ? "bg-orange-500/10 border-orange-500/60"
          : "bg-slate-900 border-slate-700/80"
      }`}
    >
      <div className="text-[10px] md:text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-base md:text-lg font-semibold">{value}</span>
        {suffix && (
          <span className="text-[10px] md:text-[11px] text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function BadgePlaceholder({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/80 text-[11px] md:text-xs text-slate-300">
      {label}
    </div>
  );
}

function RecentPickRow({ pick }: { pick: RecentPick }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs md:text-sm flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-100 truncate">
          Round {pick.round} · {pick.match}
        </div>
        <ResultPill result={pick.result} />
      </div>
      <div className="text-slate-300 line-clamp-2">{pick.question}</div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Your pick:{" "}
          <span className="font-semibold text-slate-100">
            {pick.userPick}
          </span>
        </span>
        {pick.settledAt && (
          <span>{new Date(pick.settledAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

function ResultPill({ result }: { result: RecentPick["result"] }) {
  const labelMap: Record<RecentPick["result"], string> = {
    correct: "Correct",
    wrong: "Wrong",
    pending: "Pending",
    void: "Void",
  };

  const base =
    "px-2 py-0.5 rounded-full text-[10px] md:text-[11px] border";

  if (result === "correct") {
    return (
      <span className={`${base} border-emerald-500/60 bg-emerald-500/10`}>
        ✅ {labelMap[result]}
      </span>
    );
  }
  if (result === "wrong") {
    return (
      <span className={`${base} border-red-500/60 bg-red-500/10`}>
        ❌ {labelMap[result]}
      </span>
    );
  }
  if (result === "pending") {
    return (
      <span className={`${base} border-yellow-400/60 bg-yellow-400/10`}>
        ⏳ {labelMap[result]}
      </span>
    );
  }
  return (
    <span className={`${base} border-slate-500/60 bg-slate-500/10`}>
      ⚪ {labelMap[result]}
    </span>
  );
}
