"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { app } from "./config/firebaseClient";

// -------- Types --------
type Question = {
  quarter: number;
  question: string;
  yesPct?: number;
  noPct?: number;
  comments?: number;
  status?: "OPEN" | "PENDING" | "FINAL";
};

type Game = {
  match: string;
  startTime?: any; // Firestore Timestamp | ISO string
  date?: string;
  time?: string;
  tz?: string;
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

// -------- Helpers --------
function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

function kickoffMs(g: Game): number {
  if (isFsTimestamp(g.startTime)) return g.startTime.seconds * 1000;
  if (typeof g.startTime === "string") {
    const d = new Date(g.startTime);
    return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
  }
  return Number.MAX_SAFE_INTEGER;
}

function whenText(g: Game): string {
  if (isFsTimestamp(g.startTime)) {
    const dt = new Date(g.startTime.seconds * 1000);
    const date = dt.toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const time = dt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date}, ${time} AEDT • ${g.venue ?? "TBD"}`;
  }
  if (g.date && g.time) return `${g.date}, ${g.time}${g.tz ? ` ${g.tz}` : ""} • ${g.venue ?? "TBD"}`;
  if (typeof g.startTime === "string") return `${g.startTime}${g.venue ? ` • ${g.venue}` : ""}`;
  return `TBD${g.venue ? ` • ${g.venue}` : ""}`;
}

export default function HomePage() {
  const db = useMemo(() => getFirestore(app), []);
  const auth = useMemo(() => getAuth(app), []);
  const router = useRouter();

  const [user, setUser] = useState<null | { uid: string }>(null);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ? { uid: u.uid } : null));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    (async () => {
      try {
        const id = CURRENT_ROUND === 1 ? "round-1" : `round-${CURRENT_ROUND}`;
        const ref = doc(db, "rounds", id);
        const snap = await getDoc(ref);
        setRound(snap.exists() ? (snap.data() as RoundDoc) : { games: [] });
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Failed to load data");
        setRound({ games: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  // -------- Only OPEN questions --------
  const sixOpen = useMemo(() => {
    if (!round?.games?.length) return [];
    const pool = round.games.flatMap((g) => {
      const t = kickoffMs(g);
      return g.questions
        .filter((q) => (q.status ?? "OPEN") === "OPEN") // only OPEN
        .map((q) => ({ game: g, q, t }));
    });
    pool.sort((a, b) => (a.t - b.t) || (a.q.quarter - b.q.quarter));
    return pool.slice(0, 6);
  }, [round]);

  const handlePickClick = () => router.push("/picks");

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative w-full overflow-hidden">
        <div className="relative h-[44vh] md:h-[52vh] w-full">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG at dusk"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/65" />
          <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 h-full flex flex-col justify-center gap-4">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight max-w-3xl">
              <span className="text-white">Real Streakr’s</span>{" "}
              <span className="text-orange-500">don’t get Caught.</span>
            </h1>
            <p className="text-white/80 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push("/picks")}
                className="px-4 py-2 rounded-xl bg-orange-500 text-black font-semibold hover:opacity-90 transition"
              >
                Make your first pick
              </button>
              <Link
                href="/leaderboards"
                className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SPONSOR BANNER */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="mt-6 mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* SIX OPEN SELECTIONS */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">Round {CURRENT_ROUND} Open Picks</h2>

        {loading && <div className="text-white/80">Loading…</div>}
        {!loading && err && (
          <div className="text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-6">{err}</div>
        )}

        {!loading && sixOpen.length === 0 && (
          <div className="text-white/70">No open questions right now. Check back soon!</div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sixOpen.map(({ game, q }, idx) => {
            const yes = typeof q.yesPct === "number" ? q.yesPct : 0;
            const no = typeof q.noPct === "number" ? q.noPct : 0;
            const comments = typeof q.comments === "number" ? q.comments : 0;

            return (
              <article
                key={`${game.match}-Q${q.quarter}-${idx}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/[0.07] transition"
              >
                <header className="mb-3">
                  <h3 className="text-orange-400 font-extrabold tracking-wide uppercase">{game.match}</h3>
                  <p className="text-white/70 text-sm">{whenText(game)}</p>
                </header>

                <div className="text-xs text-white/70 flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-bold">Q{q.quarter}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600/30 text-emerald-300 font-bold">
                    {q.status ?? "OPEN"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10">💬 {comments}</span>
                </div>

                <p className="text-white font-semibold leading-snug mb-3">{q.question}</p>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePickClick}
                      className="px-3 py-1.5 rounded-lg font-semibold text-black bg-[#ff7a00] hover:opacity-90 transition"
                    >
                      Yes
                    </button>
                    <button
                      onClick={handlePickClick}
                      className="px-3 py-1.5 rounded-lg font-semibold text-white bg-[#6f3aff] hover:opacity-90 transition"
                    >
                      No
                    </button>
                    <span className="text-xs text-white/70 ml-2 whitespace-nowrap">Yes {yes}% • No {no}%</span>
                  </div>

                  <Link
                    href="/picks"
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 transition text-sm"
                  >
                    See Other Picks
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
