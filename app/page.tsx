'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { app } from '@/lib/firebaseClient';
import {
  getFirestore,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

type Question = {
  quarter: number;
  question: string;
  yesCount?: number;
  noCount?: number;
};

type Game = {
  match: string;                 // "Carlton v Brisbane"
  venue?: string;
  startTime?: string | number | Date | Timestamp;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const db = getFirestore(app);
const ROUND_ID = 'round-1'; // change later when the current round changes

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

function toPct(yes = 0, no = 0) {
  const total = yes + no;
  if (!total) return 'Yes 0% • No 0%';
  const y = Math.round((yes / total) * 100);
  return `Yes ${y}% • No ${100 - y}%`;
}

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Flatten all questions for the round and take the first 6
  const sample = useMemo(() => {
    const rows: Array<{ game: Game; q: Question }> = [];
    games.forEach((g) => g.questions?.forEach((q) => rows.push({ game: g, q })));
    return rows.slice(0, 6);
  }, [games]);

  return (
    <main className="relative">
      {/* HERO with MCG background */}
      <section className="relative h-[56vh] min-h-[420px] w-full overflow-hidden">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/85" />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl items-center px-4">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold">
              <span className="text-white">One pick.</span>{' '}
              <span className="text-orange-400">One streak.</span>{' '}
              <span className="text-white">Win the round.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-zinc-300">
              Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
            </p>

            <div className="mt-6 flex gap-3">
              <Link
                href="/picks"
                className="rounded-md bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-400"
              >
                Make your first pick
              </Link>
              <Link
                href="/leaderboard"
                className="rounded-md bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SAMPLE PICKS (3×2 grid) */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-4 text-xl font-semibold">Round 1 Questions</h2>

        {loading ? (
          <div className="text-sm text-zinc-400">Loading sample picks…</div>
        ) : sample.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-zinc-300">
            No questions found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sample.map(({ game, q }, i) => (
              <div
                key={`${game.match}-${q.quarter}-${i}`}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-4"
              >
                <div className="text-[11px] font-semibold tracking-wide text-zinc-400">
                  {game.match.toUpperCase()} — Q{q.quarter}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{formatMeta(game)}</p>

                <div className="mt-3 text-base font-semibold leading-snug">
                  {q.question}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-zinc-400">
                    {toPct(q.yesCount ?? 0, q.noCount ?? 0)}
                  </div>
                  <Link
                    href="/picks"
                    className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
                  >
                    Make This Pick
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
