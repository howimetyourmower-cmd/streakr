// /app/leaderboards/page.tsx
"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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

const SCREAMR_RED = "#FF2E4D";
const SCREAMR_RED_RGB = "255,46,77";
const SCREAMR_CYAN = "#00E5FF";
const SCREAMR_GREEN = "#2DFF7A";

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

/**
 * ✅ Your saved photo background
 * /public/screamr/markbackground.jpg => src "/screamr/markbackground.jpg"
 */
function MarkBg({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <Image
        src="/screamr/markbackground.jpg"
        alt=""
        fill
        sizes="(max-width: 1200px) 100vw, 1200px"
        style={{
          objectFit: "cover",
          opacity,
          transform: "scale(1.04)",
          filter: "contrast(1.08) saturate(1.02) brightness(0.78)",
        }}
        priority={false}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.80) 100%)",
        }}
      />
      <div className="absolute inset-0 screamr-vignette" />
    </div>
  );
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
    if (delta > 0) return <span className="text-[10px] text-emerald-300 screamr-deltaUp">▲ {delta}</span>;
    return <span className="text-[10px] text-rose-300 screamr-deltaDown">▼ {Math.abs(delta)}</span>;
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
        <span className={`${base} text-black`} style={{ background: SCREAMR_RED, borderColor: "rgba(0,0,0,0.10)" }}>
          {text}
        </span>
      );
    }
    if (tone === "warm") {
      return (
        <span
          className={`${base} text-white`}
          style={{
            background: `rgba(${SCREAMR_RED_RGB},0.16)`,
            borderColor: `rgba(${SCREAMR_RED_RGB},0.55)`,
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

  const ScoreDigits = ({ value }: { value: number }) => {
    const str = String(value ?? 0);
    return (
      <div className="inline-flex items-end gap-1">
        {str.split("").map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className="screamr-digit"
            style={{
              color: SCREAMR_RED,
              textShadow: `0 0 28px rgba(${SCREAMR_RED_RGB},0.28), 0 0 10px rgba(${SCREAMR_RED_RGB},0.25)`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className="text-white min-h-screen"
      style={
        {
          backgroundColor: "#000",
          ["--screamr-red" as any]: SCREAMR_RED,
          ["--screamr-red-rgb" as any]: SCREAMR_RED_RGB,
          ["--screamr-cyan" as any]: SCREAMR_CYAN,
          ["--screamr-green" as any]: SCREAMR_GREEN,
        } as any
      }
    >
      {/* GAME SHOW FX */}
      <style>{`
        .screamr-vignette {
          box-shadow: inset 0 0 140px rgba(0,0,0,0.70);
        }
        .screamr-sparks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.14;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(circle at 12% 78%, rgba(0,229,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 22%, rgba(255,46,77,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 55% 62%, rgba(255,255,255,0.20) 0 1px, transparent 2px);
          background-size: 220px 220px;
          animation: sparksMove 6.5s linear infinite;
        }
        @keyframes sparksMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-220px, -220px, 0); }
        }

        .screamr-spotlights {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: 0.42;
          background:
            radial-gradient(900px 340px at 20% 0%, rgba(0,229,255,0.14) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(900px 340px at 80% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(1100px 420px at 50% 115%, rgba(255,46,77,0.08) 0%, rgba(0,0,0,0) 70%);
        }

        .screamr-cardBorder {
          background: linear-gradient(135deg,
            rgba(255,46,77,0.52) 0%,
            rgba(255,46,77,0.10) 25%,
            rgba(0,229,255,0.12) 55%,
            rgba(255,46,77,0.40) 100%);
        }

        .screamr-pill {
          position: relative;
          border: 1px solid rgba(255,255,255,0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          color: rgba(255,255,255,0.92);
          box-shadow:
            0 10px 26px rgba(0,0,0,0.35),
            0 0 0 1px rgba(0,0,0,0.12) inset;
          overflow: hidden;
        }
        .screamr-pill::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -35%;
          width: 60%;
          height: 200%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.16), rgba(255,255,255,0.00));
          animation: pillShine 3.6s ease-in-out infinite;
        }
        @keyframes pillShine {
          0% { transform: translateX(-40%) rotate(22deg); opacity: 0; }
          18% { opacity: 0.65; }
          40% { transform: translateX(210%) rotate(22deg); opacity: 0; }
          100% { transform: translateX(210%) rotate(22deg); opacity: 0; }
        }

        .screamr-scanlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.18;
          background: repeating-linear-gradient(
            180deg,
            rgba(255,255,255,0.08) 0px,
            rgba(255,255,255,0.08) 1px,
            rgba(0,0,0,0.00) 3px,
            rgba(0,0,0,0.00) 7px
          );
          mix-blend-mode: overlay;
        }

        .screamr-digit {
          font-weight: 900;
          line-height: 0.92;
          font-size: 64px;
          letter-spacing: -0.03em;
        }
        @media (min-width: 640px) {
          .screamr-digit { font-size: 76px; }
        }

        .screamr-deltaUp { animation: deltaPopUp 600ms ease-out; }
        .screamr-deltaDown { animation: deltaPopDown 600ms ease-out; }
        @keyframes deltaPopUp {
          0% { transform: translateY(4px); opacity: 0.0; }
          100% { transform: translateY(0px); opacity: 1.0; }
        }
        @keyframes deltaPopDown {
          0% { transform: translateY(-4px); opacity: 0.0; }
          100% { transform: translateY(0px); opacity: 1.0; }
        }

        .screamr-btn {
          border: 1px solid rgba(255,46,77,0.32);
          background: linear-gradient(180deg, rgba(255,46,77,0.98) 0%, rgba(255,46,77,0.72) 100%);
          box-shadow: 0 14px 34px rgba(255,46,77,0.18);
        }
        .screamr-btn:hover { filter: brightness(1.04); }
        .screamr-btn:active { transform: translateY(1px); }

        .screamr-frame {
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.80);
          backdrop-filter: blur(10px);
          box-shadow: 0 26px 90px rgba(0,0,0,0.72);
        }
      `}</style>

      {/* PAGE WRAP */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 relative">
        {/* Background stage */}
        <div className="absolute inset-0 -z-10">
          <MarkBg opacity={0.14} />
          <div className="screamr-sparks" />
          <div className="screamr-spotlights" />
        </div>

        {/* LIVE STRIP */}
        <div className="sticky top-[56px] sm:top-[64px] z-40 mb-4">
          <div className="relative rounded-3xl overflow-hidden screamr-frame">
            <div className="screamr-scanlines" />

            <div className="relative px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
                    style={{ background: SCREAMR_RED, boxShadow: `0 0 14px rgba(${SCREAMR_RED_RGB},0.55)` }}
                  />
                  LIVE BOARD
                </span>

                <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-white/55">
                  <span>Updated</span>
                  <span className="text-white/85">{lastUpdatedLabel || "—"}</span>
                </div>

                <div className="hidden md:flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wide text-white/55">Scope</span>
                  <select
                    value={scope}
                    onChange={handleScopeChange}
                    className="rounded-2xl bg-black border px-3 py-2 text-[12px] font-black text-white focus:outline-none"
                    style={{
                      borderColor: `rgba(${SCREAMR_RED_RGB},0.55)`,
                      boxShadow: `0 0 18px rgba(${SCREAMR_RED_RGB},0.12)`,
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
                  className="rounded-2xl px-4 py-2 text-[12px] font-black text-white screamr-btn"
                  style={{ textDecoration: "none" }}
                >
                  GO PICK
                </Link>
              </div>
            </div>
          </div>

          {/* Mobile scope dropdown */}
          <div className="mt-2 md:hidden">
            <div className="relative rounded-3xl overflow-hidden screamr-frame">
              <div className="screamr-scanlines" />
              <div className="relative px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-wide text-white/55">Scope</span>
                <select
                  value={scope}
                  onChange={handleScopeChange}
                  className="rounded-2xl bg-black border px-3 py-2 text-[12px] font-black text-white focus:outline-none"
                  style={{
                    borderColor: `rgba(${SCREAMR_RED_RGB},0.55)`,
                    boxShadow: `0 0 18px rgba(${SCREAMR_RED_RGB},0.12)`,
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
        </div>

        {/* HERO: GAME SHOW SCOREBOARD */}
        <div className="mb-4 rounded-3xl overflow-hidden">
          <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
            <div className="relative rounded-3xl overflow-hidden screamr-frame">
              <MarkBg opacity={0.18} />
              <div className="screamr-scanlines" />
              <div className="absolute inset-0 screamr-spotlights" />
              <div className="absolute inset-0 screamr-sparks" />

              <div className="relative px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                      LEADERBOARD
                      <span className="ml-3 text-[12px] sm:text-[13px] font-black uppercase tracking-[0.22em] text-white/55">
                        GAME SHOW MODE
                      </span>
                    </h1>
                    <p className="mt-1 text-sm text-white/70">
                      Ranked by{" "}
                      <span className="font-black" style={{ color: SCREAMR_RED }}>
                        CURRENT STREAK
                      </span>
                      . One wrong pick in a match and you’re cooked.
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-2">
                    <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                      {totalPlayers || 0} PLAYERS
                    </span>
                    {tonePill(leaderTag.label, leaderTag.tone)}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* LEADER SCOREBOARD */}
                  <div className="sm:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-5 relative overflow-hidden">
                    <div
                      className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-40"
                      style={{ background: SCREAMR_RED }}
                    />
                    <div
                      className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full blur-3xl opacity-25"
                      style={{ background: SCREAMR_CYAN }}
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-black uppercase tracking-wide text-white/60">Leader streak</div>
                        <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                          Updated {lastUpdatedLabel || "—"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
                        <div className="flex items-end gap-3">
                          <ScoreDigits value={leaderStreak} />
                          <div className="pb-1">
                            <div className="text-[12px] text-white/70 font-bold">
                              {leader ? `Held by ${safeName(leader.displayName)}` : "No leader yet"}
                            </div>
                            <div className="mt-2">{tonePill(leaderTag.label, leaderTag.tone)}</div>
                          </div>
                        </div>

                        <div className="min-w-[220px] flex-1">
                          <div className="text-[11px] text-white/60 font-black uppercase">Streak pulse</div>
                          <div className="mt-2 h-[10px] w-full rounded-full border border-white/10 bg-white/5 overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.max(
                                  8,
                                  Math.min(100, (leaderStreak / Math.max(leaderStreak, 12)) * 100)
                                )}%`,
                                background: `linear-gradient(90deg, rgba(${SCREAMR_RED_RGB},0.95) 0%, rgba(${SCREAMR_RED_RGB},0.35) 100%)`,
                              }}
                            />
                          </div>
                          <div className="mt-2 text-[12px] text-white/70">{streakBandDescription ?? "First streak takes top spot."}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CHASE PANEL */}
                  <div className="rounded-3xl border border-white/10 bg-black/70 p-5 relative overflow-hidden">
                    <div className="screamr-scanlines" />
                    <div className="relative">
                      <div className="text-[11px] font-black uppercase tracking-wide text-white/60">Chase the leader</div>

                      {user ? (
                        userEntry ? (
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] text-white/60 font-black uppercase">Your streak</div>
                                <div className="text-4xl font-black" style={{ color: SCREAMR_RED }}>
                                  {yourStreak}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] text-white/60 font-black uppercase">Distance</div>
                                <div className="text-4xl font-black">{yourDistance ?? "—"}</div>
                              </div>
                            </div>

                            {yourDistance === 0 ? (
                              <div className="mt-3 text-[12px] font-bold" style={{ color: SCREAMR_GREEN }}>
                                You’re tied for the lead. Don’t blink.
                              </div>
                            ) : (
                              <div className="mt-3 text-[12px] text-white/70">
                                You need{" "}
                                <span className="font-black" style={{ color: SCREAMR_RED }}>
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
                          <div className="mt-3 text-sm text-white/70">Make a pick and you’ll show up here.</div>
                        )
                      ) : (
                        <div className="mt-3 text-sm text-white/70">Log in to see your rank + distance.</div>
                      )}

                      <div className="mt-4">
                        <Link
                          href="/picks"
                          className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-[13px] font-black text-white screamr-btn"
                          style={{ textDecoration: "none" }}
                        >
                          GO PICK NOW
                        </Link>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-white/55 font-semibold">
                        <span>Auto-refresh</span>
                        <span className="text-white/80">15s</span>
                      </div>
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-sm font-bold text-rose-300">
                    {error} Refresh and try again.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        {loading && !hasLoadedRef.current ? (
          renderSkeleton()
        ) : (
          <>
            {/* PODIUM */}
            {top3.length > 0 ? (
              <div className="mb-4 rounded-3xl overflow-hidden">
                <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
                  <div className="relative rounded-3xl overflow-hidden screamr-frame">
                    <MarkBg opacity={0.12} />
                    <div className="screamr-scanlines" />
                    <div className="absolute inset-0 screamr-spotlights" />

                    <div className="relative px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: SCREAMR_CYAN, boxShadow: "0 0 14px rgba(0,229,255,0.50)" }}
                          />
                          PODIUM
                        </span>
                        <span className="text-[12px] font-black text-white/55 hidden sm:inline">Finalists on stage</span>
                      </div>
                      <div className="text-[12px] font-black text-white/55">Updated {lastUpdatedLabel || "—"}</div>
                    </div>

                    <div className="relative p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {top3.map((e, idx) => {
                        const isYou = user && e.uid === user.uid;

                        const isFirst = idx === 0;
                        const glow = isFirst ? `0 0 30px rgba(${SCREAMR_RED_RGB},0.20)` : `0 0 22px rgba(255,255,255,0.06)`;
                        const border = isFirst ? `rgba(${SCREAMR_RED_RGB},0.65)` : "rgba(255,255,255,0.12)";

                        return (
                          <div
                            key={e.uid}
                            className="rounded-3xl border bg-white/5 p-4 relative overflow-hidden"
                            style={{
                              borderColor: border,
                              boxShadow: glow,
                              transform: isFirst ? "scale(1.02)" : "none",
                            }}
                          >
                            <div
                              className="absolute inset-0"
                              style={{
                                background:
                                  "radial-gradient(520px 180px at 50% 0%, rgba(255,46,77,0.12), rgba(0,0,0,0) 70%)",
                              }}
                            />
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {renderAvatar(e, 44)}
                                <div className="min-w-0">
                                  <div className="text-sm font-black truncate">
                                    #{e.rank} {safeName(e.displayName)}
                                    {isYou ? (
                                      <span className="ml-2 text-[12px] font-black" style={{ color: SCREAMR_RED }}>
                                        YOU
                                      </span>
                                    ) : null}
                                  </div>
                                  {e.username ? <div className="text-[12px] text-white/55 truncate">@{e.username}</div> : null}
                                  <div className="mt-2 flex items-center gap-2">
                                    {idx === 0 ? tonePill("👑 #1", "hot") : tonePill(`TOP ${e.rank}`, "cold")}
                                    <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                                      LIVE
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-[10px] text-white/55 font-black uppercase">Streak</div>
                                <div className="text-3xl font-black" style={{ color: SCREAMR_RED }}>
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
                </div>
              </div>
            ) : null}

            {/* TOP 10 */}
            <div className="rounded-3xl overflow-hidden">
              <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
                <div className="relative rounded-3xl overflow-hidden screamr-frame">
                  <MarkBg opacity={0.10} />
                  <div className="screamr-scanlines" />
                  <div className="absolute inset-0 screamr-spotlights" />

                  <div className="relative px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: SCREAMR_RED, boxShadow: `0 0 14px rgba(${SCREAMR_RED_RGB},0.55)` }}
                        />
                        TOP 10
                      </span>
                      <span className="text-[12px] font-black text-white/55 hidden sm:inline">Run the board</span>
                    </div>
                    <div className="text-[12px] font-black text-white/55">{totalPlayers > 0 ? `${totalPlayers} on board` : "No players yet"}</div>
                  </div>

                  {top10.length === 0 ? (
                    <div className="relative p-4 text-sm text-white/70">No players yet. Be the first — go pick.</div>
                  ) : (
                    <ul className="relative divide-y divide-white/10">
                      {top10.map((e) => {
                        const isYou = user && e.uid === user.uid;
                        const tag = streakTag(e.currentStreak ?? 0);

                        return (
                          <li
                            key={e.uid}
                            className="px-4 py-3 hover:bg-white/5 transition"
                            style={{
                              outline: isYou ? `2px solid rgba(${SCREAMR_RED_RGB},0.55)` : "none",
                              outlineOffset: isYou ? "-2px" : 0,
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-[58px] flex flex-col">
                                  <div className="text-sm font-black text-white/90">
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
                                      <span className="ml-2 text-[12px] font-black" style={{ color: SCREAMR_RED }}>
                                        YOU
                                      </span>
                                    ) : null}
                                  </div>

                                  {e.username ? (
                                    <div className="text-[12px] text-white/55 truncate">@{e.username}</div>
                                  ) : (
                                    <div className="text-[12px] text-white/35 truncate">&nbsp;</div>
                                  )}

                                  <div className="mt-2 flex items-center gap-2">
                                    {tonePill(tag.label, tag.tone)}
                                    <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black">
                                      STREAK
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-[10px] text-white/55 font-black uppercase">Current</div>
                                <div className="text-3xl font-black leading-none" style={{ color: SCREAMR_RED }}>
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
              </div>
            </div>

            {/* YOUR POSITION IF OUTSIDE TOP10 */}
            {user && userOutsideTop10 && userEntry ? (
              <div className="mt-4 rounded-3xl overflow-hidden">
                <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
                  <div className="relative rounded-3xl overflow-hidden screamr-frame">
                    <MarkBg opacity={0.10} />
                    <div className="screamr-scanlines" />
                    <div className="relative p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: SCREAMR_GREEN, boxShadow: "0 0 14px rgba(45,255,122,0.40)" }}
                          />
                          YOUR POSITION
                        </span>
                        <Link
                          href="/picks"
                          className="rounded-2xl px-4 py-2 text-[12px] font-black text-white screamr-btn"
                          style={{ textDecoration: "none" }}
                        >
                          GO PICK
                        </Link>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(userEntry, 40)}
                          <div className="min-w-0">
                            <div className="text-sm font-black truncate">
                              #{userEntry.rank} {safeName(userEntry.displayName)}
                            </div>
                            {userEntry.username ? <div className="text-[12px] text-white/55 truncate">@{userEntry.username}</div> : null}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-white/55 font-black uppercase">Current</div>
                          <div className="text-3xl font-black" style={{ color: SCREAMR_RED }}>
                            {userEntry.currentStreak ?? 0}
                          </div>
                          {leaderStreak > (userEntry.currentStreak ?? 0) ? (
                            <div className="mt-1 text-[12px] text-white/65">
                              Need{" "}
                              <span className="font-black" style={{ color: SCREAMR_RED }}>
                                {leaderStreak - (userEntry.currentStreak ?? 0)}
                              </span>{" "}
                              to catch the lead.
                            </div>
                          ) : (
                            <div className="mt-1 text-[12px] font-bold" style={{ color: SCREAMR_GREEN }}>
                              You’re right there.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* FIXED MOBILE CTA BAR */}
        <div className="fixed left-0 right-0 bottom-0 z-50 md:hidden">
          <div className="mx-3 mb-3 rounded-3xl overflow-hidden screamr-frame shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="screamr-scanlines" />
            <div className="relative px-3 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-white/60">Leader streak</div>
                <div className="text-[18px] font-black truncate" style={{ color: SCREAMR_RED }}>
                  {leaderStreak}
                </div>
              </div>

              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[13px] font-black text-white screamr-btn"
                style={{ textDecoration: "none" }}
              >
                GO PICK
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
