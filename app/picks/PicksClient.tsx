"use client";

import { useEffect, useState } from "react";

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
  startTime: string; // ISO string
  // Optional round/season if your API sends them
  round?: number;
  season?: number;
  questions: Question[];
};

type PicksResponse = {
  games: Game[];
};

function formatKickoffTwoLines(start: string | Date) {
  const date = typeof start === "string" ? new Date(start) : start;

  const line1 = date.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  });

  const line2 = date.toLocaleString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
    timeZoneName: "short",
  });

  return { line1, line2 };
}

export default function PicksClient() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [filter, setFilter] = useState<
    "open" | "final" | "pending" | "void" | "all"
  >("open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/picks");
        const data: PicksResponse = await res.json();
        setGames(data.games);
      } catch (err) {
        console.error("Error loading picks:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredGames =
    filter === "all"
      ? games
      : games.filter((g) => g.questions.some((q) => q.status === filter));

  async function handlePick(
    gameId: string,
    questionId: string,
    answer: "yes" | "no"
  ) {
    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) =>
        g.id !== gameId
          ? g
          : {
              ...g,
              questions: g.questions.map((q) =>
                q.id !== questionId ? q : { ...q, userPick: answer }
              ),
            }
      )
    );

    // Find game + question details for payload
    const game = games.find((g) => g.id === gameId);
    const question = game?.questions.find((q) => q.id === questionId);
    if (!game || !question) return;

    try {
      setSaving(true);
      await fetch("/api/user-picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId,
          questionId,
          match: game.match,
          question: question.question,
          answer,
          round: game.round ?? null,
          season: game.season ?? null,
        }),
      });
    } catch (err) {
      console.error("Error saving pick:", err);
      // Optional: rollback optimistic update if you want
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center text-white mt-20">
        Loading picks…
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Picks</h1>
        {saving && (
          <span className="text-xs text-slate-400">
            Saving…
          </span>
        )}
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex gap-2 mb-6">
        {["open", "final", "pending", "void", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              filter === f
                ? "bg-orange-500 text-black"
                : "bg-slate-700 text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* GAME LIST */}
      <div className="flex flex-col gap-6">
        {filteredGames.map((game) => {
          const { line1, line2 } = formatKickoffTwoLines(game.startTime);

          // For now, treat games as OPEN – you can later pass a real game-level status
          const gameStatus: "open" | "final" | "pending" | "void" = "open";

          return (
            <div
              key={game.id}
              className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg"
            >
              {/* MATCH HEADER */}
              <div className="flex justify-between items-center mb-4 gap-3">
                {/* Date/time on the left */}
                <div className="flex flex-col text-slate-300 text-xs">
                  <span className="font-semibold">{line1}</span>
                  <span>{line2}</span>
                </div>

                {/* Status chip + match/venue on the right */}
                <div className="flex items-center gap-3 ml-auto">
                  {/* Status chip in the middle */}
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      gameStatus === "open"
                        ? "bg-green-600 text-white"
                        : gameStatus === "final"
                        ? "bg-blue-600 text-white"
                        : gameStatus === "pending"
                        ? "bg-yellow-500 text-black"
                        : "bg-slate-600 text-white"
                    }`}
                  >
                    {gameStatus.toUpperCase()}
                  </span>

                  {/* Match + venue */}
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">
                      {game.match}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {game.venue}
                    </div>
                  </div>
                </div>
              </div>

              {/* QUESTIONS */}
              <div className="flex flex-col gap-4">
                {game.questions.map((q) => (
                  <div
                    key={q.id}
                    className="bg-slate-900 border border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-orange-400 font-bold text-sm">
                        Q{q.quarter}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          q.status === "open"
                            ? "bg-green-700 text-white"
                            : q.status === "final"
                            ? "bg-blue-700 text-white"
                            : q.status === "pending"
                            ? "bg-yellow-600 text-black"
                            : "bg-slate-600 text-white"
                        }`}
                      >
                        {q.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-white mb-4 font-medium">
                      {q.question}
                    </div>

                    {/* YES / NO BUTTONS */}
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          handlePick(game.id, q.id, "yes")
                        }
                        disabled={saving}
                        className={`flex-1 px-4 py-2 rounded-lg border text-center text-sm ${
                          q.userPick === "yes"
                            ? "bg-green-500 border-green-400 text-black"
                            : "bg-slate-800 border-slate-600 text-white"
                        }`}
                      >
                        Yes{" "}
                        {q.yesPercent ? `(${q.yesPercent}%)` : ""}
                      </button>

                      <button
                        onClick={() =>
                          handlePick(game.id, q.id, "no")
                        }
                        disabled={saving}
                        className={`flex-1 px-4 py-2 rounded-lg border text-center text-sm ${
                          q.userPick === "no"
                            ? "bg-red-500 border-red-400 text-black"
                            : "bg-slate-800 border-slate-600 text-white"
                        }`}
                      >
                        No{" "}
                        {q.noPercent ? `(${q.noPercent}%)` : ""}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredGames.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            No picks in this category.
          </div>
        )}
      </div>
    </div>
  );
}
