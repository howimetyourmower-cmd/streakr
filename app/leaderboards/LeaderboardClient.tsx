// /app/leaderboards/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type Scope =
  | "overall"
  | "opening-round"
  | "round-1"
  | "round-2"
  | "round-3"
  | "round-4"
  | "round-5"
  | "round-6"
  | "round-7"
  | "round-8"
  | "round-9"
  | "round-10"
  | "round-11"
  | "round-12"
  | "round-13"
  | "round-14"
  | "round-15"
  | "round-16"
  | "round-17"
  | "round-18"
  | "round-19"
  | "round-20"
  | "round-21"
  | "round-22"
  | "round-23"
  | "finals";

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
  rankDelta?: number; // client-side only
};

type UserLifetimeStats = {
  totalWins: number;
  totalLosses: number;
  winPct: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime: UserLifetimeStats | null;
  roundComplete?: boolean;
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "opening-round", label: "Opening Round" },
  { value: "round-1", label: "Round 1" },
  { value: "round-2", label: "Round 2" },
  { value: "round-3", label: "Round 3" },
  { value: "round-4", label: "Round 4" },
  { value: "round-5", label: "Round 5" },
  { value: "round-6", label: "Round 6" },
  { value: "round-7", label: "Round 7" },
  { value: "round-8", label: "Round 8" },
  { value: "round-9", label: "Round 9" },
  { value: "round-10", label: "Round 10" },
  { value: "round-11", label: "Round 11" },
  { value: "round-12", label: "Round 12" },
  { value: "round-13", label: "Round 13" },
  { value: "round-14", label: "Round 14" },
  { value: "round-15", label: "Round 15" },
  { value: "round-16", label: "Round 16" },
  { value: "round-17", label: "Round 17" },
  { value: "round-18", label: "Round 18" },
  { value: "round-19", label: "Round 19" },
  { value: "round-20", label: "Round 20" },
  { value: "round-21", label: "Round 21" },
  { value: "round-22", label: "Round 22" },
  { value: "round-23", label: "Round 23" },
  { value: "finals", label: "Finals" },
];

const TORPIE_RED = "#FF2E4D";
const TORPIE_RED_RGB = "255,46,77";

function safeName(s?: string) {
  const t = (s ?? "").trim();
  return t.length ? t : "Player";
}

function streakTag(s: number): { label: string; tone: "hot" | "warm" | "cold" } {
  if (s >= 10) return { label: "ON FIRE", tone: "hot" };
  if (s >= 5) return { label: "HEATING UP", tone: "warm" };
  return { label: "ALIVE", tone: "cold" };
}

function describeStreakBand(entries: LeaderboardEntry[]): string | null {
  if (!entries.length) return null;

  const bands: { label: string; min: number; max: number | null }[] = [
    { label: "0", min: 0, max: 0 },
    { label: "1–2", min: 1, max: 2 },
    { label: "3–4", min: 3, max: 4 },
    { label: "5–7", min: 5, max: 7 },
    { label: "8+", min: 8, max: null },
  ];

  const counts = new Map<string, number>();
  for (const e of entries) {
    const s = e.currentStreak ?? 0;
    const band = bands.find((b) => s >= b.min && (b.max === null || s <= b.max));
    const label = band?.label ?? "0";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let topLabel: string | null = null;
  let topCount = 0;
  for (const [label, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topLabel = label;
    }
  }

  if (!topLabel) return null;
  if (topLabel === "0") return "Most players have already busted back to 0.";
  return `Most players are sitting on a ${topLabel} streak.`;
}

function formatAgo(msAgo: number): string {
  const s = Math.max(0, Math.floor(msAgo / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function LeaderboardsPage() {
  const { user } = useAuth();

  const [scope, setScope] = useState<Scope>("overall");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const hasLoadedRef = useRef(false);
  const previousEntriesRef = useRef<LeaderboardEntry[]>([]);
  const lastUpdatedAtRef = useRef<number>(0);

  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>("");

  const loadLeaderboard = useCallback(
    async (selectedScope: Scope, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setLoading(true);
          setError("");
        }

        let authHeader: Record<string, string> = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          } catch (err) {
            console.error("Failed to get ID token for leaderboard", err);
          }
        }

        const res = await fetch(`/api/leaderboard?scope=${selectedScope}`, {
          headers: { ...authHeader },
          cache: "no-store",
        });

        if (!res.ok) {
          console.error("Leaderboard API error:", await res.text());
          throw new Error("Failed to load leaderboard");
        }

        const data: LeaderboardApiResponse = await res.json();
        const incoming = data.entries || [];

        // rankDelta vs previous snapshot
        const prevByUid = new Map<string, LeaderboardEntry>();
        previousEntriesRef.current.forEach((e) => prevByUid.set(e.uid, e));

        const withDelta: LeaderboardEntry[] = incoming.map((e) => {
          const prev = prevByUid.get(e.uid);
          if (!prev) return { ...e };
          const delta = prev.rank - e.rank;
          return { ...e, rankDelta: delta };
        });

        previousEntriesRef.current = withDelta;
        setEntries(withDelta);
        setUserEntry(data.userEntry || null);

        lastUpdatedAtRef.current = Date.now();
        setLastUpdatedLabel("just now");

        hasLoadedRef.current = true;
      } catch (err) {
        console.error(err);
        if (!silent) setError("Could not load leaderboard right now.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadLeaderboard(scope);
  }, [scope, loadLeaderboard]);

  // silent refresh every 15s
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const id = setInterval(() => loadLeaderboard(scope, { silent: true }), 15000);
    return () => clearInterval(id);
  }, [scope, loadLeaderboard]);

  // update "last updated" label
  useEffect(() => {
    const id = setInterval(() => {
      if (!lastUpdatedAtRef.current) return;
      setLastUpdatedLabel(formatAgo(Date.now() - lastUpdatedAtRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleScopeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setScope(event.target.value as Scope);
  };

  const top10 = useMemo(() => entries.slice(0, 10), [entries]);
  const top3 = useMemo(() => top10.slice(0, 3), [top10]);

  const leader = top10[0] || null;
  const leaderStreak = leader?.currentStreak ?? 0;
  const totalPlayers = entries.length;
  const streakBandDescription = describeStreakBand(entries);

  const yourStreak = userEntry?.currentStreak ?? 0;
  const yourDistance = userEntry ? Math.max(0, leaderStreak - yourStreak) : null;
  const userOutsideTop10 = userEntry && top10.every((e) => e.uid !== userEntry.uid);

  const renderRankDelta = (delta?: number) => {
    if (!delta || delta === 0) return <span className="text-[10px] text-white/35">•</span>;
    if (delta > 0) return <span className="text-[10px] text-emerald-300">▲ {delta}</span>;
    return <span className="text-[10px] text-rose-300">▼ {Math.abs(delta)}</span>;
  };

  const renderAvatar = (e: LeaderboardEntry, size = 36) => {
    const hasAvatar = typeof e.avatarUrl === "string" && e.avatarUrl.trim().length > 0;
    if (hasAvatar) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={e.avatarUrl as string}
          alt={safeName(e.displayName)}
          className="rounded-full object-cover border border-white/20"
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <div
        className="rounded-full bg-white/10 border border-white/10 flex items-center justify-center font-black"
        style={{ width: size, height: size, fontSize: 12 }}
      >
        {safeName(e.displayName).charAt(0).toUpperCase()}
      </div>
    );
  };

  const tonePill = (text: string, tone: "hot" | "warm" | "cold" | "dark" = "dark") => {
    const base = "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border";
    if (tone === "hot") {
      return (
        <span
          className={`${base} text-black`}
          style={{ background: TORPIE_RED, borderColor: "rgba(0,0,0,0.10)" }}
        >
          {text}
        </span>
      );
    }
    if (tone === "warm") {
      return (
        <span
          className={`${base} text-white`}
          style={{
            background: `rgba(${TORPIE_RED_RGB},0.16)`,
            borderColor: `rgba(${TORPIE_RED_RGB},0.55)`,
          }}
        >
          {text}
        </span>
      );
    }
    if (tone === "cold") {
      return <span className={`${base} bg-white/5 text-white border-white/10`}>{text}</span>;
    }
    return <span className={`${base} bg-black text-white/80 border-white/10`}>{text}</span>;
  };

  const leaderTag = streakTag(leaderStreak);

  const renderSkeleton = () => (
    <div className="rounded-3xl border border-white/10 bg-black overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
      </div>
      <div className="p-4 grid gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
                <div className="mt-2 h-2 w-28 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-16 bg-white/10 rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 text-white min-h-screen pb-24"
      style={
        {
          ["--torpie-red" as any]: TORPIE_RED,
          ["--torpie-red-rgb" as any]: TORPIE_RED_RGB,
        } as any
      }
    >
      {/* PAGE TOP: LIVE STRIP */}
      <div className="sticky top-[56px] sm:top-[64px] z-40 mb-4">
        <div className="rounded-3xl border border-white/10 bg-black/85 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
                style={{ background: TORPIE_RED }}
              />
              <span className="text-[11px] font-black uppercase tracking-wide text-white/80">
                Live
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-white/55">
              <span>Updated</span>
              <span className="text-white/80">{lastUpdatedLabel || "—"}</span>
            </div>

            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-white/55">
                Scope
              </span>
              <select
                value={scope}
                onChange={handleScopeChange}
                className="rounded-2xl bg-black border px-3 py-2 text-[12px] font-black text-white focus:outline-none"
                style={{
                  borderColor: `rgba(${TORPIE_RED_RGB},0.55)`,
                  boxShadow: `0 0 18px rgba(${TORPIE_RED_RGB},0.12)`,
                }}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/picks"
              className="rounded-2xl px-4 py-2 text-[12px] font-black text-white"
              style={{ background: TORPIE_RED, textDecoration: "none" }}
            >
              GO PICK
            </Link>
          </div>
        </div>

        {/* Mobile scope dropdown (separate row so it doesn’t squash) */}
        <div className="mt-2 md:hidden">
          <div className="rounded-3xl border border-white/10 bg-black px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-wide text-white/55">
              Scope
            </span>
            <select
              value={scope}
              onChange={handleScopeChange}
              className="rounded-2xl bg-black border px-3 py-2 text-[12px] font-black text-white focus:outline-none"
              style={{
                borderColor: `rgba(${TORPIE_RED_RGB},0.55)`,
                boxShadow: `0 0 18px rgba(${TORPIE_RED_RGB},0.12)`,
              }}
            >
              {SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* HERO: SCOREBOARD */}
      <div className="mb-4 rounded-3xl border border-white/10 bg-gradient-to-b from-black to-black overflow-hidden">
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                LEADERBOARD
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Ranked by <span className="font-black" style={{ color: TORPIE_RED }}>CURRENT STREAK</span>.
                One wrong pick in a match and you’re cooked.
              </p>
            </div>

            <div className="hidden sm:flex flex-col items-end gap-2">
              {tonePill(`${totalPlayers || 0} PLAYERS`, "dark")}
              {tonePill(`${leaderTag.label}`, leaderTag.tone)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* LEADER STREAK big */}
            <div className="sm:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5 relative overflow-hidden">
              <div
                className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-40"
                style={{ background: TORPIE_RED }}
              />
              <div className="relative">
                <div className="text-[11px] font-black uppercase tracking-wide text-white/60">
                  Leader streak
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <div
                    className="text-6xl sm:text-7xl font-black leading-none"
                    style={{ color: TORPIE_RED }}
                  >
                    {leaderStreak}
                  </div>
                  <div className="pb-2">
                    <div className="text-[12px] text-white/70 font-bold">
                      {leader ? `Held by ${safeName(leader.displayName)}` : "No leader yet"}
                    </div>
                    <div className="mt-1">{tonePill(leaderTag.label, leaderTag.tone)}</div>
                  </div>
                </div>

                <div className="mt-4 text-[12px] text-white/70">
                  {streakBandDescription ?? "First streak takes top spot."}
                </div>
              </div>
            </div>

            {/* CHASE THE LEADER */}
            <div className="rounded-3xl border border-white/10 bg-black p-5">
              <div className="text-[11px] font-black uppercase tracking-wide text-white/60">
                Chase the leader
              </div>

              {user ? (
                userEntry ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[12px] text-white/60 font-black uppercase">Your streak</div>
                        <div className="text-4xl font-black" style={{ color: TORPIE_RED }}>
                          {yourStreak}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] text-white/60 font-black uppercase">Distance</div>
                        <div className="text-4xl font-black">
                          {yourDistance ?? "—"}
                        </div>
                      </div>
                    </div>

                    {yourDistance === 0 ? (
                      <div className="mt-3 text-[12px] font-bold text-emerald-300">
                        You’re tied for the lead. Keep it clean.
                      </div>
                    ) : (
                      <div className="mt-3 text-[12px] text-white/70">
                        You need{" "}
                        <span className="font-black" style={{ color: TORPIE_RED }}>
                          {yourDistance}
                        </span>{" "}
                        more to catch the top.
                      </div>
                    )}

                    <div className="mt-3 text-[12px] text-white/55">
                      Current rank: <span className="font-black text-white">#{userEntry.rank}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/70">
                    Make a pick and you’ll show up here.
                  </div>
                )
              ) : (
                <div className="mt-3 text-sm text-white/70">
                  Log in to see your rank + distance.
                </div>
              )}

              <div className="mt-4">
                <Link
                  href="/picks"
                  className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-[13px] font-black text-white"
                  style={{ background: TORPIE_RED, textDecoration: "none" }}
                >
                  GO PICK NOW
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {error ? (
        <div className="mb-4 rounded-3xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-rose-300">
          {error} Refresh and try again.
        </div>
      ) : null}

      {loading && !hasLoadedRef.current ? (
        renderSkeleton()
      ) : (
        <>
          {/* TOP 3 PODIUM */}
          {top3.length > 0 ? (
            <div className="mb-4 rounded-3xl border border-white/10 bg-black overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="text-[12px] font-black uppercase tracking-wide text-white/70">
                  Podium
                </div>
                <div className="text-[12px] font-black text-white/55">
                  Updated {lastUpdatedLabel || "—"}
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3.map((e, idx) => {
                  const isYou = user && e.uid === user.uid;
                  const ring =
                    idx === 0
                      ? `rgba(${TORPIE_RED_RGB},0.75)`
                      : "rgba(255,255,255,0.12)";

                  return (
                    <div
                      key={e.uid}
                      className="rounded-3xl border bg-white/5 p-4"
                      style={{
                        borderColor: ring,
                        boxShadow: idx === 0 ? `0 0 30px rgba(${TORPIE_RED_RGB},0.18)` : "none",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(e, 44)}
                          <div className="min-w-0">
                            <div className="text-sm font-black truncate">
                              #{e.rank} {safeName(e.displayName)}
                              {isYou ? (
                                <span className="ml-2 text-[12px] font-black" style={{ color: TORPIE_RED }}>
                                  YOU
                                </span>
                              ) : null}
                            </div>
                            {e.username ? (
                              <div className="text-[12px] text-white/55 truncate">@{e.username}</div>
                            ) : null}
                            <div className="mt-2 flex items-center gap-2">
                              {idx === 0 ? tonePill("👑 #1", "hot") : tonePill(`TOP ${e.rank}`, "cold")}
                              {tonePill("LIVE", "warm")}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-white/55 font-black uppercase">Streak</div>
                          <div className="text-3xl font-black" style={{ color: TORPIE_RED }}>
                            {e.currentStreak ?? 0}
                          </div>
                          <div className="mt-1">{renderRankDelta(e.rankDelta)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* TOP 10 LIST */}
          <div className="rounded-3xl border border-white/10 bg-black overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-[12px] font-black uppercase tracking-wide text-white/70">
                Top 10
              </div>
              <div className="text-[12px] font-black text-white/55">
                {totalPlayers > 0 ? `${totalPlayers} on board` : "No players yet"}
              </div>
            </div>

            {top10.length === 0 ? (
              <div className="p-4 text-sm text-white/70">
                No players yet. Be the first — go pick.
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {top10.map((e) => {
                  const isYou = user && e.uid === user.uid;

                  return (
                    <li
                      key={e.uid}
                      className="px-4 py-3 hover:bg-white/5 transition"
                      style={{
                        outline: isYou ? `2px solid rgba(${TORPIE_RED_RGB},0.55)` : "none",
                        outlineOffset: isYou ? "-2px" : 0,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-[54px] flex flex-col">
                            <div className="text-sm font-black text-white/85">
                              #{e.rank}
                              {e.rank === 1 ? <span className="ml-1">👑</span> : null}
                            </div>
                            {renderRankDelta(e.rankDelta)}
                          </div>

                          {renderAvatar(e, 36)}

                          <div className="min-w-0">
                            <div className="text-sm font-black truncate">
                              {safeName(e.displayName)}
                              {isYou ? (
                                <span className="ml-2 text-[12px] font-black" style={{ color: TORPIE_RED }}>
                                  YOU
                                </span>
                              ) : null}
                            </div>
                            {e.username ? (
                              <div className="text-[12px] text-white/55 truncate">@{e.username}</div>
                            ) : (
                              <div className="text-[12px] text-white/35 truncate">&nbsp;</div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-white/55 font-black uppercase">Current</div>
                          <div className="text-3xl font-black leading-none" style={{ color: TORPIE_RED }}>
                            {e.currentStreak ?? 0}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* YOUR POSITION IF OUTSIDE TOP10 */}
          {user && userOutsideTop10 && userEntry ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-[12px] font-black uppercase tracking-wide text-white/70">
                Your position
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {renderAvatar(userEntry, 40)}
                  <div className="min-w-0">
                    <div className="text-sm font-black truncate">
                      #{userEntry.rank} {safeName(userEntry.displayName)}
                    </div>
                    {userEntry.username ? (
                      <div className="text-[12px] text-white/55 truncate">@{userEntry.username}</div>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-white/55 font-black uppercase">Current</div>
                  <div className="text-3xl font-black" style={{ color: TORPIE_RED }}>
                    {userEntry.currentStreak ?? 0}
                  </div>
                  {leaderStreak > (userEntry.currentStreak ?? 0) ? (
                    <div className="mt-1 text-[12px] text-white/65">
                      Need{" "}
                      <span className="font-black" style={{ color: TORPIE_RED }}>
                        {leaderStreak - (userEntry.currentStreak ?? 0)}
                      </span>{" "}
                      to catch the lead.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* FIXED MOBILE CTA BAR (always visible) */}
      <div className="fixed left-0 right-0 bottom-0 z-50 md:hidden">
        <div className="mx-3 mb-3 rounded-3xl border border-white/10 bg-black/85 backdrop-blur px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wide text-white/60">
                Leader streak
              </div>
              <div className="text-[18px] font-black truncate" style={{ color: TORPIE_RED }}>
                {leaderStreak}
              </div>
            </div>

            <Link
              href="/picks"
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[13px] font-black text-white"
              style={{ background: TORPIE_RED, textDecoration: "none" }}
            >
              GO PICK
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
