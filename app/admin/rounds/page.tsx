// app/admin/rounds/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { ROUND_OPTIONS, RoundKey, CURRENT_SEASON } from "@/lib/rounds";

type RoundSummary = {
  docId: string;
  label: string;
  roundNumber: number;
  published: boolean;
  gameCount: number;
  questionCount: number;
};

function roundKeyToNumber(key: RoundKey): number {
  if (key === "OR") return 0;
  if (key === "FINALS") return 99;
  const match = key.match(/^R(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedRound, setSelectedRound] = useState<RoundKey>("OR");
  const [publishing, setPublishing] = useState<"publish" | "unpublish" | null>(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load a summary of all rounds in the current season
  useEffect(() => {
    const loadRounds = async () => {
      try {
        setLoadingList(true);
        setError(null);

        const q = query(
          collection(db, "rounds"),
          where("season", "==", CURRENT_SEASON)
        );
        const snap = await getDocs(q);

        const items: RoundSummary[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const games = Array.isArray(data.games) ? data.games : [];

          const gameCount = games.length;
          const questionCount = games.reduce(
            (sum: number, g: any) =>
              sum + (Array.isArray(g.questions) ? g.questions.length : 0),
            0
          );

          items.push({
            docId: docSnap.id,
            label: data.label ?? docSnap.id,
            roundNumber: data.roundNumber ?? 0,
            published: !!data.published,
            gameCount,
            questionCount,
          });
        });

        items.sort((a, b) => a.roundNumber - b.roundNumber);
        setRounds(items);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load rounds");
      } finally {
        setLoadingList(false);
      }
    };

    loadRounds();
  }, []);

  const handlePublish = async (isPublished: boolean) => {
    setMessage(null);
    setError(null);
    setPublishing(isPublished ? "publish" : "unpublish");

    try {
      const roundNumber = roundKeyToNumber(selectedRound);
      const docId = `${CURRENT_SEASON}-${roundNumber}`;

      await updateDoc(doc(db, "rounds", docId), {
        published: isPublished,
      });

      setRounds((prev) =>
        prev.map((r) =>
          r.docId === docId ? { ...r, published: isPublished } : r
        )
      );

      setMessage(
        isPublished
          ? `Round ${selectedRound} published ✅`
          : `Round ${selectedRound} unpublished`
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to update published status");
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold text-white">Rounds & publishing</h1>
          <p className="text-sm text-slate-300">
            Seed all rounds in advance, then control when each round&apos;s questions
            become visible on the Picks page.
          </p>
        </header>

        {/* Publish / Unpublish controls */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-lg font-semibold text-white mb-3">
            Publish questions for a round
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Select a round, then choose whether it should be live on the Picks
            page. Unpublished rounds are completely hidden from players even if
            questions are already in Firestore.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Round
              </label>
              <select
                className="rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-50"
                value={selectedRound}
                onChange={(e) =>
                  setSelectedRound(e.target.value as RoundKey)
                }
              >
                {ROUND_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => handlePublish(true)}
                disabled={publishing !== null}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {publishing === "publish" ? "Publishing…" : "Publish round"}
              </button>
              <button
                onClick={() => handlePublish(false)}
                disabled={publishing !== null}
                className="px-4 py-2 rounded-lg bg-slate-700 text-sm font-semibold text-slate-50 hover:bg-slate-600 disabled:opacity-60"
              >
                {publishing === "unpublish" ? "Unpublishing…" : "Unpublish round"}
              </button>
            </div>
          </div>

          {message && (
            <p className="mt-3 text-sm text-emerald-300">{message}</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-400">Error: {error}</p>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Note: the Picks API should check <code>published === true</code> on
            the round document. Unpublished rounds will return{" "}
            <code>games: []</code> even if data exists.
          </p>
        </section>

        {/* Summary table */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-lg font-semibold text-white mb-3">
            Season {CURRENT_SEASON} – round overview
          </h2>

          {loadingList ? (
            <p className="text-sm text-slate-300">Loading rounds…</p>
          ) : rounds.length === 0 ? (
            <p className="text-sm text-slate-300">
              No rounds found for this season. Run your seed API first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 text-left">Round</th>
                    <th className="py-2 px-4 text-right">Games</th>
                    <th className="py-2 px-4 text-right">Questions</th>
                    <th className="py-2 px-4 text-center">Published</th>
                    <th className="py-2 pl-4 text-left">Doc ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr
                      key={r.docId}
                      className="border-b border-slate-800/60 last:border-b-0"
                    >
                      <td className="py-2 pr-4 text-slate-50">{r.label}</td>
                      <td className="py-2 px-4 text-right text-slate-100">
                        {r.gameCount}
                      </td>
                      <td className="py-2 px-4 text-right text-slate-100">
                        {r.questionCount}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                            r.published
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/50"
                              : "bg-slate-700/60 text-slate-200 border border-slate-600"
                          }`}
                        >
                          {r.published ? "LIVE" : "DRAFT"}
                        </span>
                      </td>
                      <td className="py-2 pl-4 text-xs text-slate-400">
                        {r.docId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
