'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  getFirestore,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { app } from '@/lib/firebaseClient';

type Question = {
  quarter: number;
  question: string;
  status?: 'OPEN' | 'PENDING' | 'FINAL';
  yesCount?: number;
  noCount?: number;
  commentsCount?: number;
};

type Game = {
  match: string;                 // e.g., "Carlton v Brisbane"
  venue?: string;                // e.g., "MCG"
  startTime?: string | number | Date | Timestamp; // Firestore Timestamp or ISO
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

const db = getFirestore(app);

/** Format "Fri, Mar 21 • 7:20 PM • MCG" or "TBD" */
function formatMeta(game: Game): string {
  const venue = game.venue?.trim();
  let dt: Date | undefined;

  if (game.startTime instanceof Timestamp) {
    dt = game.startTime.toDate();
  } else if (typeof game.startTime === 'number') {
    dt = new Date(game.startTime);
  } else if (typeof game.startTime === 'string') {
    const tryDt = new Date(game.startTime);
    if (!Number.isNaN(tryDt.getTime())) dt = tryDt;
  } else if (game.startTime instanceof Date) {
    dt = game.startTime;
  }

  if (!dt && !venue) return 'TBD';
  if (!dt && venue) return `TBD • ${venue}`;

  const weekday = dt!.toLocaleDateString(undefined, { weekday: 'short' });
  const month = dt!.toLocaleDateString(undefined, { month: 'short' });
  const day = dt!.getDate();
  const time = dt!.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${weekday}, ${month} ${day} • ${time}${venue ? ` • ${venue}` : ''}`;
}

/** Percent helper */
function toPerc(yes = 0, no = 0): { yesPct: number; noPct: number } {
  const total = (yes || 0) + (no || 0);
  if (!total) return { yesPct: 0, noPct: 0 };
  return {
    yesPct: Math.round((yes / total) * 100),
    noPct: 100 - Math.round((yes / total) * 100),
  };
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Current round: change 'round-1' as needed later
        const ref = doc(db, 'fixtures', 'round-1');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as RoundDoc;
          setGames(Array.isArray(data.games) ? data.games : []);
        } else {
          setGames([]);
        }
      } catch (e) {
        console.error('Failed to load picks:', e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <h1 className="text-3xl font-bold mb-6">Make Picks</h1>

      {loading && (
        <div className="text-sm text-zinc-400">Loading questions…</div>
      )}

      {!loading && games.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-zinc-300">
          No questions found for this round yet.
        </div>
      )}

      <div className="space-y-6">
        {games.map((g, gi) => (
          <section
            key={`${g.match}-${gi}`}
            className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5"
          >
            {/* Match header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{g.match}</h2>
                <p className="text-xs md:text-sm text-zinc-400 mt-1">
                  {formatMeta(g)}
                </p>
              </div>
              {/* Small crest placeholder if you want later */}
              <div className="hidden sm:block">
                <Image
                  src="/streakrlogo.jpg"
                  alt="STREAKr"
                  width={40}
                  height={40}
                  className="opacity-80"
                />
              </div>
            </div>

            {/* Questions */}
            <div className="mt-3 space-y-3">
              {g.questions?.map((q, qi) => {
                const status = (q.status || 'OPEN').toUpperCase() as
                  | 'OPEN'
                  | 'PENDING'
                  | 'FINAL';

                const { yesPct, noPct } = toPerc(q.yesCount, q.noCount);

                return (
                  <div
                    key={`${g.match}-${qi}`}
                    className="
                      rounded-lg bg-[#1c1c1c]
                      p-3 md:p-4 mb-1 shadow-md
                      flex flex-col gap-2
                    "
                  >
                    {/* Top row: Q#, status, kebab */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-zinc-300 px-2 py-0.5 rounded bg-white/10">
                          Q{q.quarter ?? '?'}
                        </span>
                        <span
                          className={[
                            'text-[11px] font-semibold px-2 py-0.5 rounded',
                            status === 'OPEN' && 'bg-emerald-500/15 text-emerald-300',
                            status === 'PENDING' && 'bg-amber-500/15 text-amber-300',
                            status === 'FINAL' && 'bg-violet-500/15 text-violet-300',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {status}
                        </span>
                      </div>

                      {/* optional actions placeholder */}
                      <div className="text-zinc-500 text-sm">⋮</div>
                    </div>

                    {/* Question + Actions row */}
                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-base md:text-[17px] font-semibold leading-tight">
                        {q.question}
                      </p>

                      {/* Yes / No */}
                      <div className="flex items-center gap-2">
                        <button
                          className="
                            rounded-md px-3 py-1.5 text-sm font-semibold
                            bg-emerald-600 hover:bg-emerald-500
                            text-white transition-colors
                          "
                        >
                          Yes
                        </button>
                        <button
                          className="
                            rounded-md px-3 py-1.5 text-sm font-semibold
                            bg-rose-600 hover:bg-rose-500
                            text-white transition-colors
                          "
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {/* Percent + comments */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-xs text-zinc-400">
                        Yes {yesPct}% • No {noPct}%
                      </div>
                      <div className="text-xs text-zinc-400">
                        💬 {q.commentsCount ?? 0}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
