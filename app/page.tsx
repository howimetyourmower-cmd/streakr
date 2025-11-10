"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { app } from "../config/firebaseClient";

// ---------- Types ----------
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
  startTime?: any; // Firestore Timestamp | ISO/string
  date?: string;
  time?: string;
  tz?: string;
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

// ---------- Helpers ----------
function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

function toDate(game: Game): Date | null {
  if (isFsTimestamp(game.startTime)) return new Date(game.startTime.seconds * 1000);
  if (typeof game.startTime === "string") {
    const d = new Date(game.startTime);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatWhen(game: Game) {
  // Firestore Timestamp
  if (isFsTimestamp(game.startTime)) {
    const dt = new Date(game.startTime.seconds * 1000);
    const date = dt.toLocaleDateString("en-AU", { weekday: "short", day: "2-digit", month: "short" });
    const time = dt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
    const tz = "AEDT";
    return `${date} · ${time} ${tz} · ${game.venue ?? "TBD"}`;
  }
  // Pre-split fields
  if (game.date && game.time) {
    return `${game.date} · ${game.time}${game.tz ? ` ${game.tz}` : ""} · ${game.venue ?? "TBD"}`;
  }
  // Raw string (fallback)
  if (typeof game.startTime === "string") {
    return `${game.startTime}${game.venue ? ` · ${game.venue}` : ""}`;
  }
  return `TBD${game.venue ? ` · ${game.venue}` : ""}`;
}

function isFinal(q?: Question) {
  return (q?.status ?? "OPEN") === "FINAL";
}

export default function PicksPage() {
  const router = useRouter();
  const db = useMemo(() => getFirestore(app), []);
  const auth = useMemo(() => getAuth(app), []);

  const [user, setUser] = useState<null | { uid: string }>(null);
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

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
        if (!snap.exists()) setRound({ games: [] });
        else setRound(snap.data() as RoundDoc);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Failed to load picks.");
        setRound({ games: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  // Build a flat list of playable questions (OPEN/PENDING, not FINAL), sorted by kickoff then quarter.
  const nextAvailable = useMemo(() => {
    if (!round?.games?.length) return [];
    const now = Date.now();

    const items = round.games.flatMap((g) => {
      const dt = toDate(g)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return g.questions
        .filter((q) => !isFinal(q) && (q.status === "OPEN" || q.status === "PENDING"))
        .map((q) => ({ game: g, q, dt }));
    });

    items.sort((a, b) => (a.dt - b.dt) || (a.q.quarter - b.q.quarter));
    return items;
  }, [round]);

  const clickPick = (game: Game, q: Question, pick: "YES" | "NO") => {
    if (!user) {
      router.push("/auth?next=/picks");
      return;
    }
    // TODO: write pick to Firestore when backend ready
    console.log("MAKE PICK", { game: game.match, quarter: q.quarter, pick });
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-4xl font-extrabold text-white">Make Picks</h1>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-orange-500"
          />
          Show completed
        </label>
      </div>

      {loading && <div className="text-white/80">Loading…</div>}

      {!loading && err && (
        <div className="text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-6">
          {err}
        </div>
      )}

      {/* Next available picks */}
      {!loading && nextAvailable.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white/90 mb-3">Next available picks</h2>
          <div className="space-y-3">
            {nextAvailable.slice(0, 6).map(({ game, q }, idx) => {
              const yes = typeof q.yesPct === "number" ? q.yesPct : 0;
              const no = typeof q.noPct === "number" ? q.noPct : 0;
              const comments = typeof q.comments === "number" ? q.comments : 0;

              return (
                <article
                  key={`next-${idx}-${game.match}-Q${q.quarter}`}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-white/70 mb-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/10 font-bold">Q{q.quarter}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600/30 text-emerald-300 font-bold">
                          {q.status ?? "OPEN"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/10">💬 {comments}</span>
                        <span className="truncate text-white/60">• {formatWhen(game)}</span>
                      </div>
                      <p className="text-orange-400 font-extrabold tracking-wide uppercase">{game.match}</p>
                      <p className="text-white font-semibold leading-snug line-clamp-2">{q.question}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => clickPick(game, q, "YES")}
                        className="px-3 py-1.5 rounded-lg font-semibold text-black bg-[#ff7a00] hover:opacity-90 transition"
                        title={user ? "Pick Yes" : "Login to make picks"}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => clickPick(game, q, "NO")}
                        className="px-3 py-1.5 rounded-lg font-semibold text-white bg-[#6f3aff] hover:opacity-90 transition"
                        title={user ? "Pick No" : "Login to make picks"}
                      >
                        No
                      </button>
                      <span className="text-xs text-white/70 ml-2 whitespace-nowrap">Yes {yes}% • No {no}%</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Games list */}
      {!loading && round?.games?.length === 0 && (
        <div className="text-white/80">No questions found for Round {CURRENT_ROUND}.</div>
      )}

      <div className="space-y-6">
        {round?.games
          ?.map((g) => {
            const hasOpen = g.questions.some((q) => !isFinal(q));
            // Hide fully-final games unless user wants to see completed
            if (!showCompleted && !hasOpen) return null;
            return g;
          })
          .filter(Boolean)
          .map((game) => (
            <section key={game!.match} className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
              <header className="mb-3">
                <h2 className="text-orange-400 font-extrabold tracking-wide uppercase">{game!.match}</h2>
                <p className="text-white/70 text-sm">{formatWhen(game as Game)}</p>
              </header>

              <div className="space-y-3">
                {(game as Game).questions
                  .filter((q) => (showCompleted ? true : !isFinal(q)))
                  .map((q, idx) => {
                    const yes = typeof q.yesPct === "number" ? q.yesPct : 0;
                    const no = typeof q.noPct === "number" ? q.noPct : 0;
                    const comments = typeof q.comments === "number" ? q.comments : 0;
                    const status = q.status ?? "OPEN";

                    return (
                      <article key={`${(game as Game).match}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                        {/* Top row */}
                        <div className="flex items-center gap-2 text-xs text-white/80 mb-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-white/10 font-bold">Q{q.quarter}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              status === "OPEN"
                                ? "bg-emerald-600/30 text-emerald-300"
                                : status === "PENDING"
                                ? "bg-amber-600/30 text-amber-300"
                                : "bg-blue-600/30 text-blue-300"
                            }`}
                          >
                            {status}
                          </span>
                          <span className="ml-auto px-2 py-0.5 rounded-md bg-white/10">💬 {comments}</span>
                        </div>

                        {/* Question */}
                        <p className="text-white font-semibold leading-snug">{q.question}</p>

                        {/* Bottom row */}
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => clickPick(game as Game, q, "YES")}
                              disabled={isFinal(q)}
                              className={`px-3 py-1.5 rounded-lg font-semibold text-black transition
                                ${isFinal(q) ? "bg-gray-500/50 text-black/50 cursor-not-allowed" : "bg-[#ff7a00] hover:opacity-90"}`}
                              title={user ? "Pick Yes" : "Login to make picks"}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => clickPick(game as Game, q, "NO")}
                              disabled={isFinal(q)}
                              className={`px-3 py-1.5 rounded-lg font-semibold text-white transition
                                ${isFinal(q) ? "bg-gray-700/50 text-white/40 cursor-not-allowed" : "bg-[#6f3aff] hover:opacity-90"}`}
                              title={user ? "Pick No" : "Login to make picks"}
                            >
                              No
                            </button>
                            <span className="text-xs text-white/70 ml-2">Yes {yes}% • No {no}%</span>
                          </div>

                          <Link href="/picks" className="px-3 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/15 transition text-sm">
                            See Other Picks
                          </Link>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          ))}
      </div>
    </main>
  );
}
