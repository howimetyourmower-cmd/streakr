'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  addDoc,
  collection,
  serverTimestamp,
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
  match: string;                 // e.g. "Carlton v Brisbane"
  venue?: string;
  startTime?: string | number | Date | Timestamp;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const db = getFirestore(app);
const ROUND_ID = 'round-1'; // change later as needed

function formatMeta(game: Game): string {
  const venue = game.venue?.trim();
  let dt: Date | undefined;

  if (game.startTime instanceof Timestamp) dt = game.startTime.toDate();
  else if (typeof game.startTime === 'number') dt = new Date(game.startTime);
  else if (typeof game.startTime === 'string') {
    const t = new Date(game.startTime);
    if (!Number.isNaN(t.getTime())) dt = t;
  } else if (game.startTime instanceof Date) dt = game.startTime;

  if (!dt && !venue) return 'TBD';
  if (!dt && venue) return `TBD • ${venue}`;

  const weekday = dt!.toLocaleDateString(undefined, { weekday: 'short' });
  const month = dt!.toLocaleDateString(undefined, { month: 'short' });
  const day = dt!.getDate();
  const time = dt!.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${month} ${day} • ${time}${venue ? ` • ${venue}` : ''}`;
}

function toPerc(yes = 0, no = 0) {
  const total = (yes || 0) + (no || 0);
  if (!total) return { yesPct: 0, noPct: 0 };
  const yesPct = Math.round((yes / total) * 100);
  return { yesPct, noPct: 100 - yesPct };
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, 'fixtures', ROUND_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as RoundDoc;
          setGames(Array.isArray(data.games) ? data.games : []);
        } else {
          setGames([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleVote(gameIndex: number, questionIndex: number, choice: 'yes' | 'no') {
    const txKey = `${gameIndex}-${questionIndex}-${choice}`;
    setSavingKey(txKey);
    const roundRef = doc(db, 'fixtures', ROUND_ID);

    try {
      await runTransaction(db, async (transaction) => {
        const roundSnap = await transaction.get(roundRef);
        if (!roundSnap.exists()) throw new Error('Round doc missing');

        const data = roundSnap.data() as RoundDoc;
        const gamesCopy = structuredClone(data.games) as Game[];
        const g = gamesCopy[gameIndex];
        if (!g) throw new Error('Game missing');

        const q = g.questions?.[questionIndex];
        if (!q) throw new Error('Question missing');

        if (choice === 'yes') q.yesCount = (q.yesCount || 0) + 1;
        else q.noCount = (q.noCount || 0) + 1;

        transaction.set(roundRef, { games: gamesCopy }, { merge: true });

        // also write a pick record (anonymous for now)
        await addDoc(collection(db, 'picks'), {
          roundId: ROUND_ID,
          match: g.match,
          quarter: q.quarter ?? null,
          question: q.question,
          choice,
          createdAt: serverTimestamp(),
        });
      });

      // reflect immediately in UI
      setGames((prev) => {
        const next = structuredClone(prev);
        const q = next[gameIndex]?.questions?.[questionIndex];
        if (!q) return next;
        if (choice === 'yes') q.yesCount = (q.yesCount || 0) + 1;
        else q.noCount = (q.noCount || 0) + 1;
        return next;
      });
    } catch (e) {
      console.error('Vote failed:', e);
      alert('Could not save your pick. Please try again.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <h1 className="text-3xl font-bold mb-6">Make Picks</h1>

      {loading && <div className="text-sm text-zinc-400">Loading questions…</div>}

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
                <h2 className="text-xl font-semibold text-orange-400">{g.match}</h2>
                <p className="text-xs md:text-sm text-zinc-400 mt-1">{formatMeta(g)}</p>
              </div>
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
                const busyYes = savingKey === `${gi}-${qi}-yes`;
                const busyNo = savingKey === `${gi}-${qi}-no`;

                return (
                  <div
                    key={`${g.match}-${qi}`}
                    className="rounded-lg bg-[#1c1c1c] p-3 md:p-4 shadow-md"
                  >
                    {/* Top row: Q#, status, menu */}
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
                      <div className="text-zinc-500 text-sm">⋮</div>
                    </div>

                    {/* Question row */}
                    <div className="mt-2 flex items-center gap-3">
                      <p className="flex-1 text-base md:text-[17px] font-semibold leading-tight">
                        {q.question}
                      </p>

                      {/* Yes / No buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVote(gi, qi, 'yes')}
                          disabled={busyYes}
                          className="
                            rounded-md px-3 py-1.5 text-sm font-semibold
                            bg-emerald-600 hover:bg-emerald-500
                            disabled:opacity-60 disabled:cursor-not-allowed
                            text-white transition-colors
                          "
                          aria-busy={busyYes}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handleVote(gi, qi, 'no')}
                          disabled={busyNo}
                          className="
                            rounded-md px-3 py-1.5 text-sm font-semibold
                            bg-rose-600 hover:bg-rose-500
                            disabled:opacity-60 disabled:cursor-not-allowed
                            text-white transition-colors
                          "
                          aria-busy={busyNo}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {/* Percent + comments */}
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-xs text-zinc-400">
                        Yes {yesPct}% • No {noPct}%
                      </div>
                      <div className="text-xs text-zinc-400">💬 {q.commentsCount ?? 0}</div>
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
