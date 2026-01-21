// /app/reversa/picks/PicksClient.tsx
"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type ReversaGameStatus = "scheduled" | "live" | "final" | "void";

type ReversaGame = {
  id: string;
  roundId: string; // e.g. "R1"
  season: number; // 2026
  matchName: string; // "Carlton vs Richmond"
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  startTime: string; // ISO string with TZ
  status: ReversaGameStatus;

  // final result fields
  winnerTeam?: string; // exact team name
  margin?: number; // winning margin (points)
  homeScore?: number;
  awayScore?: number;

  // premium info (optional)
  publicPickHomePct?: number; // 0..100
  publicPickAwayPct?: number; // 0..100
  ladderHome?: number; // 1..18
  ladderAway?: number; // 1..18
  h2hLast5?: { homeWins: number; awayWins: number }; // last 5 vs each other
  trapAlert?: boolean;
};

type ReversaPick = {
  id: string; // `${uid}_${gameId}`
  uid: string;
  gameId: string;
  season: number;
  roundId: string;
  pickTeam: string; // team name
  createdAt?: any;
  updatedAt?: any;
};

type ReversaUser = {
  uid: string;
  createdAt?: any;
  isPremium?: boolean;
  insuranceUsed?: boolean;
  insuranceRemaining?: number; // default 1
};

function nowMs() {
  return Date.now();
}

function msUntil(iso: string) {
  const t = new Date(iso).getTime();
  return t - nowMs();
}

function fmtDuration(ms: number) {
  if (ms <= 0) return "Locked";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function badgeTone(game: ReversaGame, locked: boolean) {
  if (game.status === "final") return { label: "Final", pill: "border-white/15 bg-white/5 text-white/80" };
  if (game.status === "live") return { label: "Live", pill: "border-red-400/30 bg-red-400/10 text-red-200" };
  if (locked) return { label: "Locked", pill: "border-white/15 bg-white/5 text-white/70" };
  return { label: "Open", pill: "border-green-400/30 bg-green-400/10 text-green-200" };
}

function TeamPill({
  team,
  picked,
  disabled,
  onPick,
  tint,
}: {
  team: string;
  picked: boolean;
  disabled: boolean;
  onPick: () => void;
  tint?: "home" | "away";
}) {
  const base =
    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition";
  const pickedCls = picked
    ? "border-white/30 bg-white text-black"
    : "border-white/12 bg-white/5 text-white hover:bg-white/10";
  const disabledCls = disabled ? "opacity-60 hover:bg-white/5 cursor-not-allowed" : "cursor-pointer";
  const sub =
    tint === "home"
      ? "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      : "shadow-[0_0_0_1px_rgba(255,255,255,0.06)]";

  return (
    <button className={`${base} ${pickedCls} ${disabledCls} ${sub}`} onClick={onPick} disabled={disabled}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">{team}</span>
        {picked ? (
          <span className="rounded-full bg-black/10 px-2 py-1 text-xs font-bold text-black/70">
            PICKED
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ResultStrip({ game, myPick }: { game: ReversaGame; myPick?: ReversaPick }) {
  if (game.status !== "final") return null;

  const winner = game.winnerTeam;
  const margin = typeof game.margin === "number" ? game.margin : undefined;

  const isCorrect = !!(winner && myPick?.pickTeam && myPick.pickTeam === winner);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          Result:{" "}
          <span className="text-white/80">
            {winner ? `${winner}${typeof margin === "number" ? ` by ${margin}` : ""}` : "—"}
          </span>
        </div>

        {myPick?.pickTeam ? (
          <div className="text-xs text-white/60">
            Your pick:{" "}
            <span className={isCorrect ? "text-red-300" : "text-green-300"}>
              {myPick.pickTeam} {isCorrect ? "(correct = bad)" : "(wrong = good)"}
            </span>
          </div>
        ) : (
          <div className="text-xs text-white/60">No pick saved</div>
        )}
      </div>

      {(typeof game.homeScore === "number" && typeof game.awayScore === "number") ? (
        <div className="mt-2 text-xs text-white/60">
          Score: {game.homeTeam} {game.homeScore} — {game.awayTeam} {game.awayScore}
        </div>
      ) : null}
    </div>
  );
}

function PremiumIntel({
  game,
  isPremium,
}: {
  game: ReversaGame;
  isPremium: boolean;
}) {
  const homePct = typeof game.publicPickHomePct === "number" ? game.publicPickHomePct : undefined;
  const awayPct = typeof game.publicPickAwayPct === "number" ? game.publicPickAwayPct : undefined;

  const trap = !!game.trapAlert;
  const favTeam =
    typeof homePct === "number" && typeof awayPct === "number"
      ? homePct >= awayPct
        ? game.homeTeam
        : game.awayTeam
      : undefined;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-white/80">Premium intel</div>
        <div className="text-[11px] text-white/50">Info edge only</div>
      </div>

      {!isPremium ? (
        <div className="mt-3 text-sm text-white/60">
          Upgrade to see live public pick %, head-to-head, ladder positions, and Trap Alert.
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black p-3">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Public picks</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-xs text-white/60">{game.homeTeam}</div>
                <div className="mt-1 font-semibold">
                  {typeof homePct === "number" ? `${homePct.toFixed(0)}%` : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="text-xs text-white/60">{game.awayTeam}</div>
                <div className="mt-1 font-semibold">
                  {typeof awayPct === "number" ? `${awayPct.toFixed(0)}%` : "—"}
                </div>
              </div>
            </div>
            {trap && favTeam ? (
              <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 p-2 text-xs text-red-200">
                Trap Alert: {favTeam} is heavily tipped. The crowd is usually wrong.
              </div>
            ) : (
              <div className="mt-3 text-xs text-white/55">
                Tip: fading the favourite often wins in REVERSA.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black p-3">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Match context</div>
            <div className="mt-2 grid gap-2 text-xs text-white/70">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                <span>Ladder positions</span>
                <span className="text-white/80">
                  {typeof game.ladderHome === "number" ? `${game.homeTeam} #${game.ladderHome}` : "—"}{" "}
                  <span className="text-white/40">vs</span>{" "}
                  {typeof game.ladderAway === "number" ? `${game.awayTeam} #${game.ladderAway}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2">
                <span>H2H (last 5)</span>
                <span className="text-white/80">
                  {game.h2hLast5
                    ? `${game.homeTeam} ${game.h2hLast5.homeWins}–${game.h2hLast5.awayWins} ${game.awayTeam}`
                    : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60">
                Remember: information helps you pick the wrong side on purpose.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PicksClient() {
  const { user, loading } = useAuth();

  const [games, setGames] = useState<ReversaGame[]>([]);
  const [myPicks, setMyPicks] = useState<Record<string, ReversaPick>>({});
  const [me, setMe] = useState<ReversaUser | null>(null);
  const [tick, setTick] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPremium = !!me?.isPremium;

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      try {
        setError(null);

        // Ensure user doc exists
        const uref = doc(db, "reversaUsers", user.uid);
        const usnap = await getDoc(uref);
        if (!usnap.exists()) {
          await setDoc(
            uref,
            {
              uid: user.uid,
              createdAt: serverTimestamp(),
              isPremium: false,
              insuranceUsed: false,
              insuranceRemaining: 1,
            },
            { merge: true }
          );
          const created = await getDoc(uref);
          setMe((created.data() as ReversaUser) ?? null);
        } else {
          setMe((usnap.data() as ReversaUser) ?? null);
        }

        // Load upcoming + recent games (season 2026; adjust later as needed)
        const gq = query(collection(db, "reversaGames"), where("season", "==", 2026), orderBy("startTime", "asc"));
        const gsnap = await getDocs(gq);
        const glist: ReversaGame[] = gsnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        setGames(glist);

        // Load my picks for season
        const pq = query(
          collection(db, "reversaPicks"),
          where("uid", "==", user.uid),
          where("season", "==", 2026)
        );
        const psnap = await getDocs(pq);
        const pmap: Record<string, ReversaPick> = {};
        for (const d of psnap.docs) {
          const p = { id: d.id, ...(d.data() as any) } as ReversaPick;
          pmap[p.gameId] = p;
        }
        setMyPicks(pmap);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load REVERSA picks.");
      }
    })();
  }, [user?.uid]);

  const upcoming = useMemo(() => {
    // show all season games; optionally could filter
    return games;
  }, [games]);

  async function savePick(game: ReversaGame, pickTeam: string) {
    if (!user?.uid) return;
    setSavingId(game.id);
    setError(null);
    try {
      const locked = msUntil(game.startTime) <= 0;
      if (locked) return;

      const id = `${user.uid}_${game.id}`;
      const ref = doc(db, "reversaPicks", id);

      await setDoc(
        ref,
        {
          uid: user.uid,
          gameId: game.id,
          season: game.season,
          roundId: game.roundId,
          pickTeam,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMyPicks((prev) => ({
        ...prev,
        [game.id]: {
          id,
          uid: user.uid,
          gameId: game.id,
          season: game.season,
          roundId: game.roundId,
          pickTeam,
        },
      }));
    } catch (e: any) {
      setError(e?.message ?? "Failed to save pick.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/reversa" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl border border-white/15 bg-white/5" />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">REVERSA</div>
                <div className="text-xs text-white/60">Picks</div>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/reversa/ladder"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Ladder
            </Link>
            <Link
              href="/reversa/profile"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Profile
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400/80" />
              <span>Think opposite. Wrong is good.</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Make your picks</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              One tip per match. Locks at first bounce. Missing pick counts as incorrect (a win).
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Status</div>
            <div className="mt-1 text-sm font-semibold">
              {loading ? "Loading..." : user ? "Signed in" : "Sign in required"}
            </div>
            <div className="mt-2 text-xs text-white/60">
              Premium:{" "}
              <span className={isPremium ? "text-green-300" : "text-white/70"}>
                {isPremium ? "Active" : "Free"}
              </span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!user ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">Sign in to tip</div>
            <div className="mt-2 text-sm text-white/70">
              You need an account to save picks and appear on the ladder.
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {upcoming.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              No games found for 2026 yet.
            </div>
          ) : (
            upcoming.map((g) => {
              const ms = msUntil(g.startTime);
              const locked = ms <= 0;
              const myPick = myPicks[g.id];

              const badge = badgeTone(g, locked);
              const saving = savingId === g.id;

              return (
                <article
                  key={g.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-black p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{g.matchName}</div>
                        <div className={`rounded-full border px-3 py-1 text-xs ${badge.pill}`}>
                          {badge.label}
                        </div>
                        {g.roundId ? (
                          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                            {g.roundId}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {g.venue ? `${g.venue} • ` : ""}
                        {new Date(g.startTime).toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black p-3">
                      <div className="text-[11px] uppercase tracking-widest text-white/50">
                        Lock in
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {fmtDuration(ms)}
                        <span className="hidden">{tick}</span>
                      </div>
                      {myPick?.pickTeam ? (
                        <div className="mt-1 text-xs text-white/60">
                          Pick saved: <span className="text-white/80">{myPick.pickTeam}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-white/60">No pick saved</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <TeamPill
                      team={g.homeTeam}
                      tint="home"
                      picked={myPick?.pickTeam === g.homeTeam}
                      disabled={!user || locked || saving}
                      onPick={() => savePick(g, g.homeTeam)}
                    />
                    <TeamPill
                      team={g.awayTeam}
                      tint="away"
                      picked={myPick?.pickTeam === g.awayTeam}
                      disabled={!user || locked || saving}
                      onPick={() => savePick(g, g.awayTeam)}
                    />
                  </div>

                  {saving ? (
                    <div className="mt-3 text-xs text-white/60">Saving…</div>
                  ) : null}

                  <ResultStrip game={g} myPick={myPick} />

                  <PremiumIntel game={g} isPremium={isPremium} />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
                    <div>
                      Remember:{" "}
                      <span className="text-white/70">Correct tips are BAD.</span>{" "}
                      <span className="text-white/70">Wrong tips are GOOD.</span>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Perfect tipping loses
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Rules snapshot</div>
          <div className="mt-2 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <div className="text-xs text-white/60">Scoring</div>
              <div className="mt-1">
                Correct tip → <span className="text-red-300 font-semibold">+1 correct</span>
              </div>
              <div className="mt-1">
                Incorrect tip → <span className="text-green-300 font-semibold">+0 correct</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black p-4">
              <div className="text-xs text-white/60">Anti-AFK</div>
              <div className="mt-1">
                No pick → counts as <span className="text-green-300 font-semibold">incorrect</span>{" "}
                (a win)
              </div>
              <div className="mt-1 text-xs text-white/60">
                Premium insurance: 1 missed tip becomes random team instead.
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-white/10 pt-8 text-xs text-white/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>REVERSA • contrarian AFL anti-tipping</div>
            <div className="flex items-center gap-2">
              <Link href="/reversa" className="hover:text-white/80">
                Home
              </Link>
              <span className="text-white/30">•</span>
              <Link href="/reversa/ladder" className="hover:text-white/80">
                Ladder
              </Link>
              <span className="text-white/30">•</span>
              <Link href="/reversa/profile" className="hover:text-white/80">
                Profile
              </Link>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
