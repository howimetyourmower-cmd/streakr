"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type Scope = "overall" | (typeof ROUND_OPTIONS)[number]["key"];

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  streak: number; // meaning depends on scope (overall vs round)
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
};

function getScopeLabel(scope: Scope): string {
  if (scope === "overall") return "Season (overall)";
  const match = ROUND_OPTIONS.find((r) => r.key === scope);
  return match ? match.label : "Round";
}

export default function LeaderboardsClient() {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard whenever scope changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          season: String(CURRENT_SEASON),
          scope,
        });

        const res = await fetch(`/api/leaderboard?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load leaderboard");
        }

        const data: LeaderboardApiResponse = await res.json();

        // Ensure entries are sorted by rank
        const sorted = [...(data.entries ?? [])].sort(
          (a, b) => a.rank - b.rank
        );

        setEntries(sorted);
        setUserEntry(data.userEntry ?? null);
      } catch (err) {
        console.error("Leaderboard load error", err);
        setError("Failed to load leaderboard. Please try again later.");
        setEntries([]);
        setUserEntry(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [scope]);

  const topTen = useMemo(() => entries.slice(0, 10), [entries]);

  const extraUserRow: LeaderboardEntry | null = useMemo(() => {
    if (!user || !userEntry) return null;
    const inTopTen = topTen.some((e) => e.uid === userEntry.uid);
    return inTopTen ? null : userEntry;
  }, [user, userEntry, topTen]);

  const scopeLabel = getScopeLabel(scope);
  const isOverall = scope === "overall";

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Leaderboards
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              See who&apos;s on a heater. Live streaks pulled from player
              profiles. Only your active streak counts – one wrong pick and
              it&apos;s back to zero.
            </p>
          </div>

          {/* Scope selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Showing
            </span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              <option value="overall">Season (overall)</option>
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Meta strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              AFL Season {CURRENT_SEASON}
            </span>
            <span className="text-white/80">
              Leaderboard scope:{" "}
              <span className="font-semibold text-white">
                {scopeLabel}
              </span>
            </span>
          </div>
          <div className="text-white/60">
            Top 10 players shown. If you&apos;re outside the top 10, we&apos;ll
            still show your position below.
          </div>
        </div>

        {/* Table / content */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wide text-white/60 bg-black/80">
            <div className="flex items-center gap-8">
              <span className="w-8 text-left">#</span>
              <span>Player</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="hidden sm:inline">
                {isOverall ? "Longest streak" : "Streak this round"}
              </span>
              <span className="sm:hidden">Streak</span>
            </div>
          </div>

          {/* Loading / error / empty states */}
          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading leaderboard…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && topTen.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No streaks recorded yet for this scope. Once players start
              hitting picks, they&apos;ll appear here.
            </div>
          )}

          {!loading && !error && topTen.length > 0 && (
            <>
              {/* Top 10 rows */}
              <ol className="divide-y divide-white/8">
                {topTen.map((entry) => {
                  const isYou = user && entry.uid === user.uid;
                  return (
                    <li
                      key={entry.uid}
                      className={`px-4 py-3 flex items-center justify-between gap-3 text-sm transition-colors ${
                        isYou
                          ? "bg-orange-500/15 border-l-4 border-l-orange-500"
                          : "bg-black/40"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-6 text-left font-semibold text-white/80">
                          {entry.rank}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-white/25 bg-slate-900">
                            {entry.avatarUrl ? (
                              <Image
                                src={entry.avatarUrl}
                                alt={entry.displayName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-white/60">
                                {entry.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {entry.displayName}
                              {isYou && (
                                <span className="ml-1 text-[11px] text-emerald-400">
                                  (You)
                                </span>
                              )}
                            </span>
                            {entry.username && (
                              <span className="text-xs text-white/60">
                                @{entry.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-base font-bold text-white">
                          {entry.streak}
                        </span>
                        <span className="hidden sm:inline text-[11px] uppercase tracking-wide text-white/60">
                          {isOverall ? "Longest" : "This round"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Logged-in player's own row if not in top 10 */}
              {extraUserRow && (
                <div className="border-t border-dashed border-white/15 bg-black/70 px-4 py-3 mt-1">
                  <p className="text-xs text-white/60 mb-2">
                    Your position (outside top 10):
                  </p>
                  <div className="flex items-center justify-between gap-3 text-sm bg-orange-500/12 border border-orange-500/40 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-4">
                      <span className="w-6 text-left font-semibold text-orange-300">
                        {extraUserRow.rank}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/30 bg-slate-900">
                          {extraUserRow.avatarUrl ? (
                            <Image
                              src={extraUserRow.avatarUrl}
                              alt={extraUserRow.displayName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white/70">
                              {extraUserRow.displayName
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {extraUserRow.displayName}
                            <span className="ml-1 text-[11px] text-emerald-400">
                              (You)
                            </span>
                          </span>
                          {extraUserRow.username && (
                            <span className="text-xs text-white/70">
                              @{extraUserRow.username}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-white">
                        {extraUserRow.streak}
                      </span>
                      <span className="hidden sm:inline text-[11px] uppercase tracking-wide text-white/70">
                        {isOverall ? "Longest" : "This round"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Helper text */}
        <p className="text-xs text-white/60">
          Streaks update automatically as questions are settled. If you think
          something doesn&apos;t look right, check your{" "}
          <a
            href="/profile"
            className="underline underline-offset-2 decoration-white/60 hover:decoration-white"
          >
            profile
          </a>{" "}
          or contact us via the Rewards page.
        </p>
      </section>
    </main>
  );
}
