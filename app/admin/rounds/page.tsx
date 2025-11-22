"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import dayjs from "dayjs";

type RoundMeta = {
  id: string;
  season: number;
  roundNumber: number;
  roundKey: string;
  label: string;
  games: any[];
  published: boolean;
};

const SEASON = 2026;

export default function RoundsAdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [rounds, setRounds] = useState<RoundMeta[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) return;

    const loadRounds = async () => {
      try {
        setError(null);
        const snap = await getDocs(collection(db, "rounds"));

        const list: RoundMeta[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data.season !== SEASON) return;

          list.push({
            id: docSnap.id,
            season: data.season,
            roundNumber: data.roundNumber ?? 0,
            roundKey: data.roundKey ?? "",
            label: data.label ?? "",
            games: data.games ?? [],
            published: !!data.published,
          });
        });

        list.sort((a, b) =>
          a.roundNumber === b.roundNumber
            ? a.id.localeCompare(b.id)
            : a.roundNumber - b.roundNumber
        );

        setRounds(list);
      } catch (err) {
        console.error("Failed to load rounds", err);
        setError("Failed to load rounds.");
      } finally {
        setInitialised(true);
      }
    };

    loadRounds();
  }, [user, isAdmin, loading]);

  const handlePublish = async (round: RoundMeta) => {
    try {
      setSavingId(round.id);
      setError(null);

      // 1) Mark this round as published
      await updateDoc(doc(db, "rounds", round.id), {
        published: true,
      });

      // 2) Update the season config used by /api/picks & Settlement
      const configRef = doc(db, "config", `season-${SEASON}`);
      await setDoc(
        configRef,
        {
          season: SEASON,
          currentRoundId: round.id,
          currentRoundKey: round.roundKey,
          currentRoundNumber: round.roundNumber,
          currentRoundLabel: round.label,
          updatedAt: dayjs().toISOString(),
        },
        { merge: true }
      );

      // 3) Update local state
      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, published: true } : r
        )
      );
    } catch (err) {
      console.error("Error publishing round", err);
      setError("Failed to publish that round.");
    } finally {
      setSavingId(null);
    }
  };

  const handleUnpublish = async (round: RoundMeta) => {
    try {
      setSavingId(round.id);
      setError(null);

      await updateDoc(doc(db, "rounds", round.id), {
        published: false,
      });

      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, published: false } : r
        )
      );

      // Note: we leave config/season-2026 alone so currentRound
      // keeps pointing at the last published round.
    } catch (err) {
      console.error("Error unpublishing round", err);
      setError("Failed to unpublish that round.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-white">Checking admin access…</div>;
  }

  if (!user || !isAdmin) {
    return <div className="p-6 text-white">Admins only.</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Rounds</h1>
      <p className="mb-4 text-sm text-gray-300 max-w-2xl">
        Use this page to control which round is live on the Picks page.
        Clicking <strong>Publish round</strong> will:
        <br />
        1) set the round&apos;s <code>published</code> flag to{" "}
        <code>true</code>, and
        <br />
        2) update the <code>config / season-{SEASON}</code> document
        that the Picks API and Settlement console read.
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-700/80 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {!initialised ? (
        <div>Loading rounds…</div>
      ) : rounds.length === 0 ? (
        <div>No rounds found for {SEASON}.</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 text-left">Season</th>
              <th className="px-3 py-2 text-left">Round</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Games</th>
              <th className="px-3 py-2 text-left">Questions</th>
              <th className="px-3 py-2 text-left">Published</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => {
              const questionCount = round.games.reduce(
                (total, g: any) => total + (g.questions?.length ?? 0),
                0
              );

              return (
                <tr key={round.id} className="border-b border-slate-800">
                  <td className="px-3 py-2">{round.season}</td>
                  <td className="px-3 py-2">{round.roundNumber}</td>
                  <td className="px-3 py-2">{round.label}</td>
                  <td className="px-3 py-2">{round.games.length}</td>
                  <td className="px-3 py-2">{questionCount}</td>
                  <td className="px-3 py-2">
                    {round.published ? (
                      <span className="rounded bg-green-700/70 px-2 py-1 text-xs font-semibold">
                        PUBLISHED
                      </span>
                    ) : (
                      <span className="rounded bg-slate-700/70 px-2 py-1 text-xs font-semibold">
                        DRAFT
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      disabled={savingId === round.id}
                      onClick={() => handlePublish(round)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    >
                      Publish round
                    </button>
                    <button
                      disabled={savingId === round.id}
                      onClick={() => handleUnpublish(round)}
                      className="rounded-full bg-slate-600 px-3 py-1 text-xs font-semibold disabled:opacity-60"
                    >
                      Unpublish
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
