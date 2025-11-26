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
  getDoc,
} from "firebase/firestore";
import dayjs from "dayjs";

type QuestionMeta = {
  quarter?: number;
  question?: string;
  isSponsorQuestion?: boolean;
  // allow any extra fields already in your data
  [key: string]: any;
};

type GameMeta = {
  match?: string;
  venue?: string;
  startTime?: string;
  questions?: QuestionMeta[];
  [key: string]: any;
};

type RoundMeta = {
  id: string;
  season: number;
  roundNumber: number;
  roundKey: string;
  label: string;
  games: GameMeta[];
  published: boolean;
};

const SEASON = 2026;

// Helper: generate round code used by picks API and sponsorQuestion
// 0 -> "OR", 1 -> "R1", 2 -> "R2", etc.
function getRoundCode(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  return `R${roundNumber}`;
}

export default function RoundsAdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [rounds, setRounds] = useState<RoundMeta[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

  // Sponsor question editor state
  const [sponsorRoundId, setSponsorRoundId] = useState<string | null>(null);
  const [sponsorSelection, setSponsorSelection] = useState<{
    gameIndex: number;
    questionIndex: number;
  } | null>(null);
  const [sponsorSaving, setSponsorSaving] = useState(false);
  const [sponsorSavedMessage, setSponsorSavedMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) return;

    const loadRounds = async () => {
      try {
        setError(null);

        // 1) Load all rounds for this season
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
            games: (data.games ?? []) as GameMeta[],
            published: !!data.published, // temporary, refined below
          });
        });

        list.sort((a, b) =>
          a.roundNumber === b.roundNumber
            ? a.id.localeCompare(b.id)
            : a.roundNumber - b.roundNumber
        );

        // 2) Load config/season-2026 to see which round is actually live
        const configRef = doc(db, "config", `season-${SEASON}`);
        const configSnap = await getDoc(configRef);

        let currentRoundId: string | null = null;
        if (configSnap.exists()) {
          const cfg = configSnap.data() as any;
          currentRoundId = cfg.currentRoundId ?? null;
        }

        // 3) Derive "published" state from config as the source of truth.
        const withPublished = list.map((round) => {
          if (currentRoundId) {
            return {
              ...round,
              published: round.id === currentRoundId,
            };
          }
          // Fallback if config doc doesn't exist yet
          return round;
        });

        setRounds(withPublished);
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

      // 1) Mark this round as published (optional, mainly for debugging / other tools)
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

      // 3) Update local state – only this round is treated as "published"
      setRounds((prev) =>
        prev.map((r) => ({
          ...r,
          published: r.id === round.id,
        }))
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
    } catch (err) {
      console.error("Error unpublishing round", err);
      setError("Failed to unpublish that round.");
    } finally {
      setSavingId(null);
    }
  };

  // --- Sponsor Question helpers ---

  const openSponsorEditor = (round: RoundMeta) => {
    setSponsorRoundId(round.id);
    setSponsorSavedMessage(null);

    // Find existing sponsor question in this round, if any
    let found: { gameIndex: number; questionIndex: number } | null = null;

    round.games.forEach((game, gi) => {
      (game.questions ?? []).forEach((q, qi) => {
        if (q.isSponsorQuestion) {
          found = { gameIndex: gi, questionIndex: qi };
        }
      });
    });

    setSponsorSelection(found);
  };

  const cancelSponsorEditor = () => {
    setSponsorRoundId(null);
    setSponsorSelection(null);
    setSponsorSavedMessage(null);
  };

  const handleSaveSponsorQuestion = async () => {
    if (!sponsorRoundId || !sponsorSelection) return;

    const round = rounds.find((r) => r.id === sponsorRoundId);
    if (!round) return;

    try {
      setSponsorSaving(true);
      setError(null);
      setSponsorSavedMessage(null);

      const { gameIndex, questionIndex } = sponsorSelection;

      // Build a new games array with a single sponsor question flag
      const updatedGames: GameMeta[] = round.games.map((game, gi) => {
        const questions = (game.questions ?? []).map((q, qi) => ({
          ...q,
          isSponsorQuestion: gi === gameIndex && qi === questionIndex,
        }));

        return {
          ...game,
          questions,
        };
      });

      // 1) Persist the sponsor flag into this round doc (for admin view)
      await updateDoc(doc(db, "rounds", round.id), {
        games: updatedGames,
      });

      // 2) ALSO update config/season-2026.sponsorQuestion
      // so that /api/picks can tag the correct question.
      const roundCode = getRoundCode(round.roundNumber);
      const sponsorQuestionId = `${roundCode}-G${gameIndex + 1}-Q${
        questionIndex + 1
      }`;

      const configRef = doc(db, "config", `season-${SEASON}`);
      await setDoc(
        configRef,
        {
          sponsorQuestion: {
            roundNumber: round.roundNumber,
            questionId: sponsorQuestionId,
          },
          // keep other fields (currentRound*, season, etc.) untouched
        },
        { merge: true }
      );

      // 3) Update local state
      setRounds((prev) =>
        prev.map((r) =>
          r.id === round.id ? { ...r, games: updatedGames } : r
        )
      );

      setSponsorSavedMessage(
        `Sponsor question saved: ${sponsorQuestionId} (Round ${round.roundNumber}).`
      );
    } catch (err) {
      console.error("Error saving sponsor question", err);
      setError("Failed to save sponsor question.");
    } finally {
      setSponsorSaving(false);
    }
  };

  const activeSponsorRound = sponsorRoundId
    ? rounds.find((r) => r.id === sponsorRoundId)
    : null;

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
        Use this page to control which round is live on the Picks page and to
        set the Sponsor Question for each round.
        <br />
        Clicking <strong>Publish round</strong> will:
        <br />
        1) set the round&apos;s <code>published</code> flag to{" "}
        <code>true</code> (for admin visibility), and
        <br />
        2) update the <code>config / season-{SEASON}</code> document
        that the Picks API and Settlement console read.
        <br />
        Saving a <strong>Sponsor question</strong> will also write
        <code>config / season-{SEASON} / sponsorQuestion</code>, which the
        Picks API uses to tag the sponsor question.
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
        <>
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
                  (total, g: GameMeta) =>
                    total + (g.questions?.length ?? 0),
                  0
                );

                return (
                  <tr
                    key={round.id}
                    className="border-b border-slate-800 align-top"
                  >
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
                      <button
                        type="button"
                        onClick={() => openSponsorEditor(round)}
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold"
                      >
                        Sponsor question
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {activeSponsorRound && (
            <div className="mt-6 rounded border border-slate-700 bg-slate-900/60 p-4">
              <h2 className="mb-2 text-lg font-semibold">
                Sponsor Question – Season {activeSponsorRound.season}, Round{" "}
                {activeSponsorRound.roundNumber} ({activeSponsorRound.label})
              </h2>
              {activeSponsorRound.games.length === 0 ? (
                <p className="text-sm text-gray-300">
                  This round has no games configured yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {activeSponsorRound.games.map((game, gi) => (
                    <div key={gi} className="rounded bg-slate-800/60 p-3">
                      <div className="mb-1 text-sm font-semibold">
                        Game {gi + 1}: {game.match ?? "Untitled match"}
                      </div>
                      {game.questions && game.questions.length > 0 ? (
                        <div className="space-y-1">
                          {game.questions.map((q, qi) => {
                            const isSelected =
                              sponsorSelection?.gameIndex === gi &&
                              sponsorSelection?.questionIndex === qi;
                            const isCurrentSponsor = !!q.isSponsorQuestion;

                            return (
                              <label
                                key={qi}
                                className="flex items-start gap-2 text-xs text-gray-200"
                              >
                                <input
                                  type="radio"
                                  name="sponsor-question"
                                  className="mt-0.5"
                                  checked={isSelected}
                                  onChange={() =>
                                    setSponsorSelection({
                                      gameIndex: gi,
                                      questionIndex: qi,
                                    })
                                  }
                                />
                                <span>
                                  <span className="font-semibold">
                                    Q{q.quarter ?? "?"}:
                                  </span>{" "}
                                  {q.question ?? "No question text"}
                                  {isCurrentSponsor && !isSelected && (
                                    <span className="ml-2 rounded bg-amber-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                      CURRENT SPONSOR
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="ml-2 rounded bg-emerald-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                      SELECTED
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          No questions for this game.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="text-[11px] text-gray-400">
                  Only one Sponsor Question is allowed per round. Saving will
                  mark the selected question as the Sponsor Question and update{" "}
                  <code>config/season-{SEASON}.sponsorQuestion</code> to match
                  the new ID (e.g. OR-G1-Q1).
                  {sponsorSavedMessage && (
                    <div className="mt-1 text-emerald-400">
                      {sponsorSavedMessage}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelSponsorEditor}
                    className="rounded-full bg-slate-600 px-4 py-1.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!sponsorSelection || sponsorSaving}
                    onClick={handleSaveSponsorQuestion}
                    className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    {sponsorSaving
                      ? "Saving sponsor question…"
                      : "Save sponsor question"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
