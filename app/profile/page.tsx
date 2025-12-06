// /app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";

type StreakBadges = Record<string, boolean>;

type UserStats = {
  displayName?: string;
  currentStreak?: number;
  longestStreak?: number;

  // Round / season stats (optional – used if present)
  roundsPlayed?: number;
  seasonWins?: number;
  seasonLosses?: number;
  seasonPicks?: number;

  // Lifetime stats
  lifetimeWins?: number;
  lifetimeLosses?: number;
  lifetimePicks?: number;

  streakBadges?: StreakBadges;
};

export default function ProfilePage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const userRef = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setStats(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        const mapped: UserStats = {
          displayName: data.displayName ?? user.displayName ?? undefined,
          currentStreak:
            typeof data.currentStreak === "number"
              ? data.currentStreak
              : 0,
          longestStreak:
            typeof data.longestStreak === "number"
              ? data.longestStreak
              : 0,
          roundsPlayed:
            typeof data.roundsPlayed === "number" ? data.roundsPlayed : 0,
          seasonWins:
            typeof data.seasonWins === "number" ? data.seasonWins : 0,
          seasonLosses:
            typeof data.seasonLosses === "number" ? data.seasonLosses : 0,
          seasonPicks:
            typeof data.seasonPicks === "number" ? data.seasonPicks : 0,
          lifetimeWins:
            typeof data.lifetimeWins === "number" ? data.lifetimeWins : 0,
          lifetimeLosses:
            typeof data.lifetimeLosses === "number"
              ? data.lifetimeLosses
              : 0,
          lifetimePicks:
            typeof data.lifetimePicks === "number"
              ? data.lifetimePicks
              : 0,
          streakBadges:
            data.streakBadges && typeof data.streakBadges === "object"
              ? (data.streakBadges as StreakBadges)
              : {},
        };

        setStats(mapped);
        setLoading(false);
      },
      (err) => {
        console.error("Profile listener error", err);
        setError("Could not load your profile.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const displayName =
    stats?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Player";

  const currentStreak = stats?.currentStreak ?? 0;
  const longestStreak = stats?.longestStreak ?? 0;
  const roundsPlayed = stats?.roundsPlayed ?? 0;

  const lifetimeWins = stats?.lifetimeWins ?? 0;
  const lifetimeLosses = stats?.lifetimeLosses ?? 0;
  const lifetimePicks =
    stats?.lifetimePicks ??
    lifetimeWins +
      lifetimeLosses; /* fallback if you only store wins/losses */

  const streakBadges = stats?.streakBadges ?? {};

  const badgeUnlocked = (level: 3 | 5 | 10 | 15 | 20) =>
    !!streakBadges[String(level)];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8 min-h-screen bg-black text-white">
      {/* PAGE TITLE */}
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Profile</h1>
        <p className="text-sm sm:text-base text-white/70">
          Welcome back,{" "}
          <span className="font-semibold text-orange-400">
            {displayName}
          </span>
          . Track your streak, lifetime record and badges here.
        </p>
      </header>

      {loading && (
        <p className="text-sm text-white/60 mb-4">Loading profile…</p>
      )}
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!user && (
        <p className="text-sm text-white/70">
          You need to be logged in to see your profile.
        </p>
      )}

      {user && (
        <div className="space-y-10">
          {/* TOP STATS GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#020617] border border-sky-500/40 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
              <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                Current streak
              </p>
              <p className="text-3xl font-extrabold text-orange-400 mb-1">
                {currentStreak}
              </p>
              <p className="text-xs text-white/70">
                How many correct picks in a row you&apos;re on right now.
              </p>
            </div>

            <div className="rounded-2xl bg-[#020617] border border-emerald-500/40 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
              <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                Best streak
              </p>
              <p className="text-3xl font-extrabold text-emerald-300 mb-1">
                {longestStreak}
              </p>
              <p className="text-xs text-white/70">
                Your all-time longest STREAKr run.
              </p>
            </div>

            <div className="rounded-2xl bg-[#020617] border border-purple-500/40 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
              <p className="text-[11px] uppercase tracking-wide text-white/60 mb-1">
                Rounds played
              </p>
              <p className="text-3xl font-extrabold text-purple-300 mb-1">
                {roundsPlayed}
              </p>
              <p className="text-xs text-white/70">
                Total rounds you&apos;ve taken part in this season.
              </p>
            </div>
          </section>

          {/* LIFETIME RECORD – NO WIN RATE ANYWHERE */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-black border border-slate-700 px-4 sm:px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold">
                  Lifetime record
                </h2>
                <p className="text-xs sm:text-sm text-white/70">
                  Every pick you&apos;ve ever made on STREAKr across all
                  rounds and seasons.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="rounded-2xl bg-black/40 border border-white/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Best streak
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-400">
                  {longestStreak}
                </p>
              </div>

              <div className="rounded-2xl bg-black/40 border border-emerald-500/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Wins
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">
                  {lifetimeWins}
                </p>
              </div>

              <div className="rounded-2xl bg-black/40 border border-red-500/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Losses
                </p>
                <p className="mt-1 text-2xl font-bold text-red-300">
                  {lifetimeLosses}
                </p>
              </div>

              <div className="rounded-2xl bg-black/40 border border-sky-500/40 px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Total picks
                </p>
                <p className="mt-1 text-2xl font-bold text-sky-300">
                  {lifetimePicks}
                </p>
              </div>
            </div>

            {/* 👇 NO WIN RATE TEXT OR CALCULATION HERE ANYMORE */}
          </section>

          {/* STREAK BADGES */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">
                Streak badges
              </h2>
              <p className="text-xs sm:text-sm text-white/70">
                Unlock footy card-style badges as your streak climbs.
                These match the big animations you see on the picks page.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 3 & 5 row */}
              <div className="space-y-4">
                <BadgeCard
                  level={3}
                  title="3 in a row"
                  subtitle="Keep building 😎"
                  unlocked={badgeUnlocked(3)}
                  imageSrc="/badges/streakr-3.png"
                />
                <BadgeCard
                  level={5}
                  title="On Fire"
                  subtitle="Bang! You're on the money! 🔥"
                  unlocked={badgeUnlocked(5)}
                  imageSrc="/badges/streakr-5.png"
                />
              </div>

              {/* 10 & 15 row */}
              <div className="space-y-4">
                <BadgeCard
                  level={10}
                  title="Elite"
                  subtitle="That's elite. 10 straight 🏅"
                  unlocked={badgeUnlocked(10)}
                  imageSrc="/badges/streakr-10.png"
                />
                <BadgeCard
                  level={15}
                  title="Dominance"
                  subtitle="This run is getting ridiculous 💪"
                  unlocked={badgeUnlocked(15)}
                  imageSrc="/badges/streakr-15.png"
                />
              </div>

              {/* 20 row */}
              <div className="space-y-4">
                <BadgeCard
                  level={20}
                  title="Legendary"
                  subtitle="20 straight. GOAT status. 🏆"
                  unlocked={badgeUnlocked(20)}
                  imageSrc="/badges/streakr-20.png"
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type BadgeCardProps = {
  level: number;
  title: string;
  subtitle: string;
  unlocked: boolean;
  imageSrc: string;
};

function BadgeCard({
  level,
  title,
  subtitle,
  unlocked,
  imageSrc,
}: BadgeCardProps) {
  const borderClass = unlocked
    ? "border-amber-400/80 shadow-[0_0_40px_rgba(245,158,11,0.7)]"
    : "border-slate-700";

  const bgClass = unlocked
    ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    : "bg-slate-900/60";

  return (
    <div
      className={`relative rounded-3xl ${bgClass} ${borderClass} px-4 py-4 flex flex-col items-center text-center`}
    >
      <div className="mb-3">
        <div className="relative w-28 h-40 mx-auto">
          <Image
            src={imageSrc}
            alt={`Streak badge level ${level}`}
            fill
            className={`object-contain ${
              unlocked ? "" : "grayscale opacity-60"
            }`}
          />
        </div>
      </div>

      <p className="text-sm font-semibold mb-1">{title}</p>
      <p className="text-xs text-white/70 mb-2">{subtitle}</p>

      <p
        className={`text-[11px] uppercase tracking-wide font-semibold ${
          unlocked ? "text-emerald-300" : "text-white/40"
        }`}
      >
        {unlocked ? "Unlocked" : "Locked"}
      </p>
    </div>
  );
}
