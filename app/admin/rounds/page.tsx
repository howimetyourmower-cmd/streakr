"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type RoundMeta = {
  id: string;
  label: string;
  season: number;
  roundNumber: number;
  roundKey: string;
  gamesCount: number;
  questionsCount: number;
  published: boolean;
};

export default function AdminRoundsPage() {
  const { user, isAdmin, loading } = useAuth();

  const [rounds, setRounds] = useState<RoundMeta[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(true);
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load all rounds for all seasons
  useEffect(() => {
    if (!user || !isAdmin) return;

    async function loadRounds() {
      try {
        setRoundsLoading(true);
        setError(null);

        const q = query(
          collection(db, "rounds"),
          orderBy("season", "asc"),
          orderBy("roundNumber", "asc")
        );

        const snap = await getDocs(q);

        const loaded: RoundMeta[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;

          const games = Array.isArray(data.games) ? data.games : [];
          const questionsCount = games.reduce((total: number, game: any) => {
            const qs = Array.isArray(game.questions) ? game.questions : [];
            return total + qs.length;
          }, 0);

          return {
            id: docSnap.id,
            label: data.label ?? "",
            season: data.season ?? 0,
            roundNumber: data.roundNumber ?? 0,
            roundKey: data.roundKey ?? "",
            gamesCount: games.length,
            questionsCount,
            published: Boolean(data.published),
          };
        });

        setRounds(loaded);
      } catch (err) {
        console.error("Failed to load rounds", err);
        setError("Failed to load rounds.");
      } finally {
        setRoundsLoading(false);
      }
    }

    loadRounds();
  }, [user, isAdmin]);

  async function handlePublishRound(round: RoundMeta) {
    try {
      setSavingRoundId(round.id);
      setError(null);

      // 1) Mark round as published
      const roundRef = doc(db, "rounds", round.id);
      await updateDoc(roundRef, { published: true });

      // 2) Update the config document for this season
      const configRef = doc(db, "config", `season-${round.season}`);
      await setDoc(
        configRef,
        {
          season: round.season,
          currentRoundId: round.id,
          currentRoundKey: round.roundKey,
          currentRoundLabel: round.label,
          currentRoundNumber: round.roundNumber,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3) Update local UI state
      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, published: true } : r
        )
      );
    } catch (err) {
      console.error("Failed to publish round", err);
      setError("Failed to publish round.");
    } finally {
      setSavingRoundId(null);
    }
  }

  async function handleUnpublishRound(round: RoundMeta) {
    try {
      setSavingRoundId(round.id);
      setError(null);

      const roundRef = doc(db, "rounds", round.id);
      await updateDoc(roundRef, { published: false });

      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, published: false } : r
        )
      );
    } catch (err) {
      console.error("Failed to unpublish round", err);
      setError("Failed to unpublish round.");
    } finally {
      setSavingRoundId(null);
    }
  }

  if (loading || roundsLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-4">Rounds</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-4">Rounds</h1>
        <p>You must be an admin to view this page.</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-6">Rounds</h1>

      <p className="mb-4 text-sm text-slate-300">
        Use this page to control which round is live on the Picks page.
        Clicking <span className="font-semibold">Publish round</span> will:
        <br />
        1) set the round&apos;s <code>published</code> flag to{" "}
        <code>true</code>, and
        <br />
        2) update the <code>config / season-YYYY</code> document that the
        Picks API reads.
      </p>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-900/40 border border-red-500/40 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/70">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Season</th>
              <th className="px-4 py-3 text-left font-semibold">Round</th>
              <th className="px-4 py-3 text-left font-semibold">Label</th>
              <th className="px-4 py-3 text-left font-semibold">Games</th>
              <th className="px-4 py-3 text-left font-semibold">
                Questions
              </th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr
                key={round.id}
                className="border-t border-slate-800 hover:bg-slate-800/60"
              >
                <td className="px-4 py-3">{round.season}</td>
                <td className="px-4 py-3">{round.roundNumber}</td>
                <td className="px-4 py-3">{round.label}</td>
                <td className="px-4 py-3">{round.gamesCount}</td>
                <td className="px-4 py-3">{round.questionsCount}</td>
                <td className="px-4 py-3">
                  {round.published ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-600/80 px-3 py-1 text-xs font-semibold">
                      PUBLISHED
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-600/80 px-3 py-1 text-xs font-semibold">
                      DRAFT
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => handlePublishRound(round)}
                    disabled={savingRoundId === round.id}
                    className="inline-flex items-center rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-1 text-xs font-semibold text-black"
                  >
                    {savingRoundId === round.id && round.published === false
                      ? "Publishing..."
                      : "Publish round"}
                  </button>
                  <button
                    onClick={() => handleUnpublishRound(round)}
                    disabled={savingRoundId === round.id}
                    className="inline-flex items-center rounded-full bg-slate-600 hover:bg-slate-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-1 text-xs font-semibold"
                  >
                    {savingRoundId === round.id && round.published === true
                      ? "Unpublishing..."
                      : "Unpublish"}
                  </button>
                </td>
              </tr>
            ))}

            {rounds.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No rounds found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
