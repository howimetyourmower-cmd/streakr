"use client";

import { useEffect, useState } from "react";
import { getClientDb } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string from /api/picks
  status: "open" | "final" | "pending" | "void";
  round?: number;
  season?: number;
  questions: Question[];
};

type PicksResponse = {
  games: Game[];
};

type Filter = "open" | "final" | "pending" | "void" | "all";

function formatStartTwoLines(start: string | Date) {
  const date = typeof start === "string" ? new Date(start) : start;

  const dateLine = date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  });

  const timeLine = date.toLocaleString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
    timeZoneName: "short",
  });

  return { dateLine, timeLine };
}

export default function PicksClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPickId, setSavingPickId] = useState<string | null>(null);

  // TODO: replace with real Firebase Auth user when ready
  const demoUserId = "demo-user";

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/picks");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: PicksResponse = await res.json();

        const withStatus: Game[] = (data.games ?? []).map((g) => ({
          ...g,
          status: g.status ?? "open",
          questions: (g.questions ?? []).map((q) => ({
            ...q,
            status: q.status ?? "open",
          })),
        }));

        setGames(withStatus);
      } catch (err) {
        console.error("Error loading picks:", err);
        setError("Failed to load picks");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const visibleGames =
    filter === "all"
      ? games
      : games.filter((g) => g.questions.some((q) => q.status === filter));

  async function handlePick(
    game: Game,
    question: Question,
    answer: "yes" | "no"
  ) {
    try {
      if (!demoUserId) {
        // once auth exists, show a proper message / redirect to login
        alert("Please log in to make a pick.");
        return;
      }

      const compoundId = `${game.id}-${question.id}`;
      setSavingPickId(compoundId);

      const db = await getClientDb();

      // Write pick to Firestore
      await addDoc(collection(db, "picks"), {
        userId: demoUserId,
        gameId: game.id,
        questionId: question.id,
        answer,
        match: game.match,
        venue: game.venue,
        round: game.round ?? 1,
        season: game.season ?? 2026,
        createdAt: serverTimestamp(),
      });

      // Update local state so UI highlights the selection
      setGames((prev) =>
        prev.map((g) =>
          g.id === game.id
            ? {
                ...g,
                questions: g.questions.map((q) =>
                  q.id === question.id ? { ...q, userPick: answer } : q
                ),
              }
            : g
        )
      );
    } catch (err) {
      console.error("Error saving pick:", err);
      alert("Could not save your pick. Please try again.");
    } finally {
      setSavingPickId(null);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-white mb-4">Picks</h1>

      {/* FILTER TABS */}
      <div className="flex gap-2 mb-6">
        {(["open", "final", "pending", "void", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              filter === f
                ? "bg-orange-500 text-black"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {f === "all"
              ? "All"
              : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* HEADER ROW */}
      <div className="hidden md:grid grid-cols-[150px_80px_1.3fr_0.4fr_2.2fr_1.3fr] text-xs font-semibold text-slate-300 border-b border-slate-700 pb-2 mb-2">
        <div>START</div>
        <div className="text-center">STATUS</div>
        <div>MATCH • VENUE</div>
        <div className="text-center">Q#</div>
        <div>QUESTION</div>
        <div className="text-right">PICK · YES % · NO %</div>
      </div>

      {loading && (
        <div className="text-slate-300 text-sm">Loading picks…</div>
      )}

      {error && !loading && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {!loading && !error && visibleGames.length === 0 && (
        <div className="text-slate-400 text-sm mt-8">
          No picks in this category.
        </div>
      )}

      {/* QUESTION ROWS */}
      <div className="flex flex-col gap-1">
        {visibleGames.map((game) => {
          const { dateLine, timeLine } = formatStartTwoLines(
            game.startTime
          );

          return game.questions.map((q) => {
            const compoundId = `${game.id}-${q.id}`;
            const isSavingThis = savingPickId === compoundId;

            return (
              <div
                key={q.id}
                className="grid grid-cols-1 md:grid-cols-[150px_80px_1.3fr_0.4fr_2.2fr_1.3fr] gap-y-1 md:gap-y-0 items-center text-xs md:text-sm text-slate-100 py-3 px-3 rounded-lg hover:bg-slate-800/70 border-b border-slate-800"
              >
                {/* START (2 lines) */}
                <div className="md:pr-2 text-slate-300">
                  <div>{dateLine}</div>
                  <div>{timeLine}</div>
                </div>

                {/* STATUS BADGE */}
                <div className="md:flex md:justify-center md:items-center">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${
                      game.status === "open"
                        ? "bg-green-700 text-white"
                        : game.status === "final"
                        ? "bg-blue-700 text-white"
                        : game.status === "pending"
                        ? "bg-yellow-500 text-black"
                        : "bg-slate-600 text-white"
                    }`}
                  >
                    {game.status.toUpperCase()}
                  </span>
                </div>

                {/* MATCH + VENUE */}
                <div className="md:pr-2">
                  <div className="text-orange-400 font-semibold">
                    {game.match}
                  </div>
                  <div className="text-slate-400 text-[11px] md:text-xs">
                    {game.venue}
                  </div>
                </div>

                {/* Q# */}
                <div className="md:text-center text-orange-400 font-semibold">
                  Q{q.quarter}
                </div>

                {/* QUESTION + COMMENTS */}
                <div className="md:pr-2">
                  <div className="mb-1">{q.question}</div>
                  <button className="text-[11px] md:text-xs text-slate-300 underline decoration-slate-600 hover:decoration-slate-300">
                    Comments (0)
                  </button>
                </div>

                {/* YES / NO BUTTONS + PERCENTAGES */}
                <div className="flex justify-end gap-2 md:gap-3">
                  {/* YES = BRIGHT ORANGE */}
                  <button
                    onClick={() =>
                      !isSavingThis && handlePick(game, q, "yes")
                    }
                    disabled={isSavingThis || game.status !== "open"}
                    className={`px-3 py-1 rounded-full border text-xs md:text-sm min-w-[60px] text-center font-semibold transition
                      ${
                        q.userPick === "yes"
                          ? "bg-[#FF7A00] border-[#FFB366] text-black ring-2 ring-white/70"
                          : "bg-[#FF7A00] border-[#FFB366] text-black hover:bg-[#ff8a26]"
                      }
                      ${
                        isSavingThis || game.status !== "open"
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }
                    `}
                  >
                    Yes{" "}
                    {typeof q.yesPercent === "number"
                      ? `${q.yesPercent}%`
                      : ""}
                  </button>

                  {/* NO = PURPLE */}
                  <button
                    onClick={() =>
                      !isSavingThis && handlePick(game, q, "no")
                    }
                    disabled={isSavingThis || game.status !== "open"}
                    className={`px-3 py-1 rounded-full border text-xs md:text-sm min-w-[60px] text-center font-semibold transition
                      ${
                        q.userPick === "no"
                          ? "bg-[#7C3AED] border-[#C4B5FD] text-white ring-2 ring-white/70"
                          : "bg-[#7C3AED] border-[#C4B5FD] text-white hover:bg-[#8B5CF6]"
                      }
                      ${
                        isSavingThis || game.status !== "open"
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }
                    `}
                  >
                    No{" "}
                    {typeof q.noPercent === "number"
                      ? `${q.noPercent}%`
                      : ""}
                  </button>
                </div>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
