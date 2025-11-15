"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string from /api/picks
  status?: QuestionStatus;
  questions: Question[];
};

type ApiResponse = {
  games: Game[];
};

const FILTER_TABS: { key: QuestionStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "final", label: "Final" },
  { key: "pending", label: "Pending" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

const CURRENT_SEASON = 2026;
const CURRENT_ROUND = 1;

// TEMP until auth is wired up
const DEMO_USER_ID = "demo-user";

function formatStart(startTime: string) {
  if (!startTime) {
    return { date: "TBA", time: "" };
  }
  const d = new Date(startTime);
  const date = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { date, time: `${time} AEDT` };
}

export default function PicksClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    QuestionStatus | "all"
  >("open");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const loadPicks = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // 1) Load games/questions from API
        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch picks: ${res.status}`);
        }

        const data: ApiResponse = await res.json();
        let loadedGames: Game[] = (data.games ?? []).map((g) => ({
          ...g,
          questions: g.questions ?? [],
        }));

        // 2) Load this user's existing picks from Firestore
        const picksRef = collection(db, "picks");
        const picksQuery = query(
          picksRef,
          where("userId", "==", DEMO_USER_ID),
          where("season", "==", CURRENT_SEASON),
          where("round", "==", CURRENT_ROUND)
        );

        const picksSnap = await getDocs(picksQuery);
        const pickMap = new Map<string, "yes" | "no">();

        picksSnap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          if (
            typeof d.questionId === "string" &&
            (d.answer === "yes" || d.answer === "no")
          ) {
            pickMap.set(d.questionId, d.answer);
          }
        });

        // 3) Merge user picks into questions
        loadedGames = loadedGames.map((game) => ({
          ...game,
          questions: game.questions.map((q) => ({
            ...q,
            userPick: pickMap.get(q.id) ?? q.userPick,
          })),
        }));

        setGames(loadedGames);
      } catch (err) {
        console.error("Error loading picks", err);
        setLoadError("Failed to load picks");
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    loadPicks();
  }, []);

  async function handlePick(
    game: Game,
    question: Question,
    answer: "yes" | "no"
  ) {
    if (!DEMO_USER_ID) return;

    // Optional: don't spam multiple different questions at once
    if (savingQuestionId && savingQuestionId !== question.id) return;

    setSavingQuestionId(question.id);
    setSaveError(null);

    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) =>
        g.id !== game.id
          ? g
          : {
              ...g,
              questions: g.questions.map((q) =>
                q.id !== question.id ? q : { ...q, userPick: answer }
              ),
            }
      )
    );

    try {
      const picksRef = collection(db, "picks");
      const pickDocId = `${DEMO_USER_ID}_${question.id}`;

      await setDoc(
        doc(picksRef, pickDocId),
        {
          userId: DEMO_USER_ID,
          season: CURRENT_SEASON,
          round: CURRENT_ROUND,
          gameId: game.id,
          match: game.match,
          venue: game.venue,
          questionId: question.id,
          question: question.question,
          answer,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving pick", err);
      setSaveError("Failed to save pick. Please try again.");
    } finally {
      setSavingQuestionId(null);
    }
  }

  const filteredGames = games
    .map((game) => {
      const filteredQuestions =
        activeFilter === "all"
          ? game.questions
          : game.questions.filter((q) => q.status === activeFilter);

      return { ...game, questions: filteredQuestions };
    })
    .filter((game) => game.questions.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 text-white">
      <h1 className="text-3xl font-bold mb-2">Picks</h1>

      {loadError && (
        <p className="text-sm text-red-400 mb-2">{loadError}</p>
      )}
      {saveError && (
        <p className="text-sm text-red-400 mb-2">{saveError}</p>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-3 mb-6">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() =>
                setActiveFilter(tab.key as QuestionStatus | "all")
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition
                ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "bg-[#141b2f] text-gray-200 hover:bg-[#1c2438]"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Header row (desktop) */}
      <div className="hidden md:grid grid-cols-[1.5fr,1.1fr,2fr,0.5fr,2.4fr,1.8fr] text-xs uppercase text-gray-400 mb-2 px-4">
        <span>Start</span>
        <span>Status</span>
        <span>Match • Venue</span>
        <span>Q#</span>
        <span>Question</span>
        <span className="text-right">Pick • Yes % • No %</span>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-300">
            Loading picks...
          </div>
        )}

        {!loading && !loadError && filteredGames.length === 0 && (
          <div className="flex items-center justify-center py-16 text-gray-300">
            No picks in this category.
          </div>
        )}

        {!loading &&
          !loadError &&
          filteredGames.map((game) => {
            const { date, time } = formatStart(game.startTime);

            return (
              <div
                key={game.id}
                className="bg-[#111827] border border-[#1f2937] rounded-2xl overflow-hidden"
              >
                {/* Game header (desktop) */}
                <div className="hidden md:grid grid-cols-[1.5fr,1.1fr,2fr] items-center px-4 py-3 border-b border-[#1f2937] text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{date}</span>
                    <span className="text-xs text-gray-400">{time}</span>
                  </div>
                  <div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-600/20 text-green-400">
                      OPEN
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-orange-400">
                      {game.match}
                    </span>
                    <span className="text-xs text-gray-400">
                      {game.venue}
                    </span>
                  </div>
                </div>

                {/* Game header (mobile) */}
                <div className="md:hidden px-4 py-3 border-b border-[#1f2937]">
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <p className="text-sm font-medium">{date}</p>
                      <p className="text-xs text-gray-400">{time}</p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-600/20 text-green-400">
                      OPEN
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-400">
                      {game.match}
                    </p>
                    <p className="text-xs text-gray-400">{game.venue}</p>
                  </div>
                </div>

                {/* Questions */}
                <div className="divide-y divide-[#1f2937]">
                  {game.questions.map((q) => (
                    <div
                      key={q.id}
                      className="grid md:grid-cols-[1.5fr,1.1fr,2fr,0.5fr,2.4fr,1.8fr] grid-cols-1 gap-3 px-4 py-3 items-center text-sm"
                    >
                      {/* Start (mobile row) */}
                      <div className="md:hidden flex justify-between text-xs text-gray-400">
                        <span>
                          Q{q.quarter} • {date}
                        </span>
                        <span>{time}</span>
                      </div>

                      {/* Start (desktop placeholder – header shows date/time) */}
                      <div className="hidden md:block text-xs text-gray-400" />

                      {/* Status */}
                      <div className="hidden md:flex">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            q.status === "final"
                              ? "bg-blue-600/20 text-blue-300"
                              : q.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : q.status === "void"
                              ? "bg-gray-500/20 text-gray-300"
                              : "bg-green-600/20 text-green-400"
                          }`}
                        >
                          {q.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Match+venue blank in row (already shown in header) */}
                      <div className="hidden md:block" />

                      {/* Q# */}
                      <div className="md:text-center text-xs font-semibold text-gray-300">
                        Q{q.quarter}
                      </div>

                      {/* Question text */}
                      <div className="text-sm">
                        <p className="font-medium">{q.question}</p>
                      </div>

                      {/* Pick buttons + percents */}
                      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2">
                        <div className="inline-flex rounded-full border border-[#374151] overflow-hidden">
                          {/* YES button (orange) */}
                          <button
                            type="button"
                            onClick={() =>
                              handlePick(game, q, "yes")
                            }
                            disabled={savingQuestionId === q.id}
                            className={`px-4 py-1 text-sm font-semibold transition-colors
                              ${
                                q.userPick === "yes"
                                  ? "bg-orange-500 text-white"
                                  : "bg-transparent text-white hover:bg-orange-500/70"
                              }
                              ${
                                savingQuestionId === q.id
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }
                            `}
                          >
                            Yes
                          </button>

                          {/* NO button (purple) */}
                          <button
                            type="button"
                            onClick={() =>
                              handlePick(game, q, "no")
                            }
                            disabled={savingQuestionId === q.id}
                            className={`px-4 py-1 text-sm font-semibold transition-colors
                              ${
                                q.userPick === "no"
                                  ? "bg-purple-600 text-white"
                                  : "bg-transparent text-white hover:bg-purple-600/70"
                              }
                              ${
                                savingQuestionId === q.id
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }
                            `}
                          >
                            No
                          </button>
                        </div>

                        <div className="flex justify-end gap-3 text-xs text-gray-400">
                          <span>
                            Yes:{" "}
                            {q.yesPercent !== undefined
                              ? `${q.yesPercent}%`
                              : "0%"}
                          </span>
                          <span>
                            No:{" "}
                            {q.noPercent !== undefined
                              ? `${q.noPercent}%`
                              : "0%"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
