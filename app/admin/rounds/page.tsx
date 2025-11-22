"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  CURRENT_SEASON,
  ROUND_OPTIONS,
  type RoundKey,
} from "@/lib/rounds";

type RoundRow = {
  id: string;              // Firestore doc id (e.g. "2026-0")
  roundKey: RoundKey;      // "OR", "R1" etc
  roundNumber: number;     // 0–23
  label: string;           // Opening Round, Round 1, etc.
  gamesCount: number;
  questionsCount: number;
  published: boolean;
};

const ADMIN_EMAIL_FALLBACK = "howimetyourmower@gmail.com"; // change if needed

export default function AdminRoundsPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin =
    !!user &&
    (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
      user.email === ADMIN_EMAIL_FALLBACK);

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyRoundId, setBusyRoundId] = useState<string | null>(null);

  // ---- load rounds from Firestore ----
  async function loadRounds() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "rounds"));
      const list: RoundRow[] = [];

      snap.forEach((d) => {
        const data = d.data() as any;
        if (data.season !== CURRENT_SEASON) return;

        const games = (data.games || []) as any[];
        const gamesCount = games.length;
        const questionsCount = games.reduce(
          (sum, g) => sum + ((g.questions || []).length as number),
          0
        );

        const roundKey = (data.roundKey ?? "OR") as RoundKey;
        const fromOptions =
          ROUND_OPTIONS.find((r) => r.key === roundKey)?.label ?? d.id;

        list.push({
          id: d.id,
          roundKey,
          roundNumber: (data.roundNumber ?? 0) as number,
          label: (data.label ?? fromOptions) as string,
          gamesCount,
          questionsCount,
          published: !!data.published,
        });
      });

      // order 0..23
      list.sort((a, b) => a.roundNumber - b.roundNumber);
      setRounds(list);
    } finally {
      setLoading(false);
    }
  }

  // ---- publish / unpublish (PERSIST) ----
  async function setPublished(roundId: string, value: boolean) {
    setBusyRoundId(roundId);
    try {
      const ref = doc(db, "rounds", roundId);
      await updateDoc(ref, { published: value });

      // update local state so UI responds instantly
      setRounds((old) =>
        old.map((r) =>
          r.id === roundId ? { ...r, published: value } : r
        )
      );
    } catch (err) {
      console.error(err);
      alert("Error saving publish state. Check console / logs.");
    } finally {
      setBusyRoundId(null);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) return;
    void loadRounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin]);

  if (authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-slate-200">
        <p>Checking admin access…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-slate-200">
        <h1 className="text-3xl font-bold mb-4">Rounds &amp; publishing</h1>
        <p className="text-sm text-slate-400">
          You must be an admin to access this page.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-slate-100 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Rounds &amp; publishing</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Load all rounds in advance, then control when each round&apos;s
          questions become visible on the Picks page. Unpublished rounds always
          return an empty list of games to players.
        </p>
      </header>

      <section className="rounded-2xl bg-slate-900/70 border border-slate-700/70 overflow-hidden">
        <div className="grid grid-cols-[1.4fr,0.9fr,0.9fr,0.9fr,0.9fr,1.1fr] gap-2 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-800/80">
          <div>Round</div>
          <div className="text-right">Games</div>
          <div className="text-right">Questions</div>
          <div className="text-center">Season</div>
          <div className="text-center">Published</div>
          <div className="text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-400">
            Loading rounds…
          </div>
        ) : rounds.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">
            No rounds found for season {CURRENT_SEASON}.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {rounds.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.4fr,0.9fr,0.9fr,0.9fr,0.9fr,1.1fr] gap-2 px-4 py-3 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold">{r.label}</div>
                  <div className="text-[11px] text-slate-400 flex gap-2">
                    <span className="font-mono">{r.roundKey}</span>
                    <span>Doc: {r.id}</span>
                  </div>
                </div>

                <div className="text-right text-sm">
                  {r.gamesCount.toLocaleString()}
                </div>

                <div className="text-right text-sm">
                  {r.questionsCount.toLocaleString()}
                </div>

                <div className="text-center text-xs text-slate-400">
                  {CURRENT_SEASON}
                </div>

                <div className="flex items-center justify-center">
                  {r.published ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                      Live
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-slate-700/50 text-slate-100 border border-slate-500/60">
                      Draft
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 text-[11px]">
                  <button
                    disabled={busyRoundId === r.id}
                    onClick={() => setPublished(r.id, true)}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      r.published
                        ? "bg-emerald-700/30 text-emerald-200 border border-emerald-500/40"
                        : "bg-emerald-500 text-slate-900 border border-transparent"
                    } disabled:opacity-60`}
                  >
                    Publish round
                  </button>
                  <button
                    disabled={busyRoundId === r.id}
                    onClick={() => setPublished(r.id, false)}
                    className={`px-3 py-1 rounded-full font-semibold ${
                      !r.published
                        ? "bg-slate-700/60 text-slate-200 border border-slate-500/60"
                        : "bg-slate-800 text-slate-100 border border-slate-600"
                    } disabled:opacity-60`}
                  >
                    Unpublish
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-500 max-w-3xl">
        Note: the Picks API should only return games where
        <span className="font-mono"> published === true </span> on the round
        document. This page is the single source of truth for that flag.
      </p>
    </main>
  );
}
