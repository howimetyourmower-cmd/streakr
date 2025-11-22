// app/admin/settlement/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { CURRENT_SEASON, ROUND_OPTIONS, RoundKey } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";
type Outcome = "yes" | "no" | "void";

type RoundMeta = {
  id: string; // Firestore doc id, e.g. "2026-0"
  label: string;
  roundKey: RoundKey;
  roundNumber: number;
  published: boolean;
  gameCount: number;
  questionCount: number;
};

type SettlementQuestion = {
  id: string;
  roundDocId: string;
  gameIndex: number;
  questionIndex: number;

  match: string;
  venue: string;
  sport: string;
  startTime: string;

  quarter: number;
  question: string;
  status: QuestionStatus;
};

export default function SettlementPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [rounds, setRounds] = useState<RoundMeta[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<SettlementQuestion[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1) Load all rounds for the current season
  useEffect(() => {
    async function loadRounds() {
      try {
        setLoadingRounds(true);
        setError(null);

        const q = query(
          collection(db, "rounds"),
          where("season", "==", CURRENT_SEASON),
          orderBy("roundNumber", "asc")
        );

        const snap = await getDocs(q);

        const roundList: RoundMeta[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const games = (data.games || []) as any[];

          const questionCount = games.reduce(
            (acc, g) => acc + (g.questions ? g.questions.length : 0),
            0
          );

          roundList.push({
            id: docSnap.id,
            label: data.label ?? `Round ${data.roundNumber}`,
            roundKey: data.roundKey as RoundKey,
            roundNumber: data.roundNumber ?? 0,
            published: Boolean(data.published),
            gameCount: games.length,
            questionCount,
          });
        });

        setRounds(roundList);

        // Default to the first round if nothing selected yet
        if (!selectedRoundId && roundList.length > 0) {
          setSelectedRoundId(roundList[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to load rounds.");
      } finally {
        setLoadingRounds(false);
      }
    }

    loadRounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Load questions for the selected round
  useEffect(() => {
    if (!selectedRoundId) return;

    async function loadQuestions() {
      try {
        setLoadingQuestions(true);
        setError(null);

        const roundRef = doc(db, "rounds", selectedRoundId);
        const roundSnap = await getDoc(roundRef);

        if (!roundSnap.exists()) {
          setQuestions([]);
          return;
        }

        const data = roundSnap.data() as any;
        const games = (data.games || []) as any[];

        const flat: SettlementQuestion[] = [];

        games.forEach((game, gameIndex) => {
          const qs = (game.questions || []) as any[];
          qs.forEach((q: any, questionIndex: number) => {
            flat.push({
              id: q.id,
              roundDocId: roundSnap.id,
              gameIndex,
              questionIndex,
              match: game.match,
              venue: game.venue,
              sport: game.sport ?? "AFL",
              startTime: game.startTime ?? "",
              quarter: q.quarter,
              question: q.question,
              status: q.status as QuestionStatus,
            });
          });
        });

        // Show newest / highest quarter first feels nice
        flat.sort((a, b) => {
          if (a.match === b.match) {
            return a.quarter - b.quarter;
          }
          return a.match.localeCompare(b.match);
        });

        setQuestions(flat);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load questions for this round.");
      } finally {
        setLoadingQuestions(false);
      }
    }

    loadQuestions();
  }, [selectedRoundId]);

  // 3) Update a single nested question (status + outcome) in Firestore
  async function updateQuestion(
    q: SettlementQuestion,
    newStatus: QuestionStatus,
    outcome?: Outcome
  ) {
    try {
      setSavingId(q.id + "-" + newStatus);
      setError(null);

      const roundRef = doc(db, "rounds", q.roundDocId);

      const pathBase = `games.${q.gameIndex}.questions.${q.questionIndex}`;
      const updatePayload: any = {
        [`${pathBase}.status`]: newStatus,
      };

      if (typeof outcome === "string") {
        updatePayload[`${pathBase}.outcome`] = outcome;
      } else {
        // Clear any previous outcome when reopening or locking
        updatePayload[`${pathBase}.outcome`] = null;
      }

      await updateDoc(roundRef, updatePayload);

      // Update local state so UI reflects instantly
      setQuestions((prev) =>
        prev.map((item) =>
          item.roundDocId === q.roundDocId &&
          item.gameIndex === q.gameIndex &&
          item.questionIndex === q.questionIndex
            ? { ...item, status: newStatus }
            : item
        )
      );
    } catch (err: any) {
      console.error(err);
      setError("Failed to update question. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  // Button handlers
  const handleLock = (q: SettlementQuestion) =>
    updateQuestion(q, "pending");
  const handleSettleYes = (q: SettlementQuestion) =>
    updateQuestion(q, "final", "yes");
  const handleSettleNo = (q: SettlementQuestion) =>
    updateQuestion(q, "final", "no");
  const handleVoid = (q: SettlementQuestion) =>
    updateQuestion(q, "void", "void");
  const handleReopen = (q: SettlementQuestion) =>
    updateQuestion(q, "open");

  // Convenience
  const selectedRound = rounds.find((r) => r.id === selectedRoundId);
  const showingCount = questions.length;

  if (authLoading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-white">
        <p>Checking admin access…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Settlement console</h1>
        <p>You must be an admin to access this page.</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-white">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Settlement console
        </h1>
        <p className="text-sm md:text-base text-gray-300">
          Internal tool to lock and settle STREAKr questions. This writes
          directly to Firestore. Use carefully.
        </p>
      </header>

      {/* Round selector + summary */}
      <section className="mb-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
            Round
          </p>
          <select
            className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm"
            value={selectedRoundId ?? ""}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            disabled={loadingRounds}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} ({r.questionCount} questions)
              </option>
            ))}
          </select>
          {selectedRound && (
            <p className="mt-1 text-xs text-gray-400">
              Season {CURRENT_SEASON} ·{" "}
              {selectedRound.published ? "PUBLISHED" : "DRAFT"} ·{" "}
              {selectedRound.gameCount} games /{" "}
              {selectedRound.questionCount} questions
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Showing
          </p>
          <p className="text-lg font-semibold">
            {loadingQuestions ? "…" : showingCount} questions
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-4 rounded-md bg-red-900/40 border border-red-500 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[1.5fr,3fr,2fr] gap-4 px-2 pb-2 text-xs uppercase tracking-wide text-gray-400">
        <div>Game / time</div>
        <div>Q · Question</div>
        <div className="text-right pr-6">Lock / settle</div>
      </div>

      {/* Question list */}
      <section className="space-y-3">
        {loadingQuestions && (
          <div className="text-sm text-gray-300">Loading questions…</div>
        )}

        {!loadingQuestions && questions.length === 0 && (
          <div className="text-sm text-gray-300">
            No questions found for this round.
          </div>
        )}

        {questions.map((q) => {
          const isSavingLock = savingId === q.id + "-pending";
          const isSavingYes = savingId === q.id + "-final";
          const isSavingNo = savingId === q.id + "-finalno"; // we don’t distinguish in savingId, but harmless
          const isSavingVoid = savingId === q.id + "-void";
          const isSavingReopen = savingId === q.id + "-open";

          const disabled = Boolean(savingId);

          return (
            <div
              key={`${q.roundDocId}-${q.gameIndex}-${q.questionIndex}`}
              className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-3 md:px-4 md:py-3 flex flex-col md:grid md:grid-cols-[1.5fr,3fr,2fr] gap-3 md:gap-4"
            >
              {/* Game / time */}
              <div className="text-xs md:text-sm">
                <div className="font-semibold">{q.match}</div>
                <div className="text-gray-400">
                  {q.venue}
                  {q.startTime && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="uppercase">
                        {q.startTime}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-gray-300">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5">
                    {q.sport}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      q.status === "open"
                        ? "bg-emerald-700 text-white"
                        : q.status === "pending"
                        ? "bg-amber-600 text-black"
                        : q.status === "final"
                        ? "bg-sky-700 text-white"
                        : "bg-slate-700 text-gray-100"
                    }`}
                  >
                    {q.status.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5">
                    Q{q.quarter}
                  </span>
                </div>
              </div>

              {/* Question text */}
              <div className="text-xs md:text-sm flex items-center">
                <p>{q.question}</p>
              </div>

              {/* Matrix buttons */}
              <div className="flex md:justify-end">
                <div className="flex flex-col gap-1 text-[11px] md:text-xs">
                  {/* Row 1: Lock | YES */}
                  <div className="flex gap-1">
                    <button
                      className={`flex-1 rounded-full px-3 py-1 font-semibold ${
                        q.status === "pending"
                          ? "bg-amber-500 text-black"
                          : "bg-amber-600 hover:bg-amber-500 text-black"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      onClick={() => handleLock(q)}
                      disabled={disabled || q.status !== "open"}
                    >
                      {isSavingLock ? "Locking…" : "Lock"}
                    </button>
                    <button
                      className="flex-1 rounded-full px-3 py-1 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleSettleYes(q)}
                      disabled={disabled || q.status === "final"}
                    >
                      {isSavingYes ? "Saving…" : "Yes"}
                    </button>
                  </div>

                  {/* Row 2: Reopen | NO */}
                  <div className="flex gap-1">
                    <button
                      className="flex-1 rounded-full px-3 py-1 font-semibold bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleReopen(q)}
                      disabled={disabled || q.status === "open"}
                    >
                      {isSavingReopen ? "Reopening…" : "Reopen"}
                    </button>
                    <button
                      className="flex-1 rounded-full px-3 py-1 font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleSettleNo(q)}
                      disabled={disabled || q.status === "final"}
                    >
                      {isSavingNo ? "Saving…" : "No"}
                    </button>
                  </div>

                  {/* Row 3: Void */}
                  <div className="flex gap-1">
                    <button
                      className="flex-1 rounded-full px-3 py-1 font-semibold bg-slate-500 hover:bg-slate-400 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleVoid(q)}
                      disabled={disabled}
                    >
                      {isSavingVoid ? "Voiding…" : "Void"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
