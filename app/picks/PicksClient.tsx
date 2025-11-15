"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
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
  startTime: string; // ISO string
  questions: Question[];
};

export default function PicksClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    "open" | "final" | "pending" | "void" | "all"
  >("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // -------------------------------------------------------------
  // FIXED FUNCTION — ALWAYS RETURNS {date, time}
  // -------------------------------------------------------------
  const formatStartDate = (
    iso: string
  ): { date: string; time: string } => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return { date: "", time: "" }; // <— FIX prevents build errors
    }

    const date = d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Australia/Melbourne",
    });

    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    });

    return { date, time };
  };

  // -------------------------------------------------------------
  // LOAD PICKS DATA FROM API
  // -------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        setGames(data.games || []);
        setFilteredGames(data.games || []);
      } catch (e) {
        setError("Failed to load picks");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // -------------------------------------------------------------
  // FILTER LOGIC
  // -------------------------------------------------------------
  const applyFilter = (filter: typeof activeFilter) => {
    setActiveFilter(filter);

    if (filter === "all") {
      setFilteredGames(games);
      return;
    }

    const filtered = games
      .map((g) => ({
        ...g,
        questions: g.questions.filter((q) => q.status === filter),
      }))
      .filter((g) => g.questions.length > 0);

    setFilteredGames(filtered);
  };

  // -------------------------------------------------------------
  // USER PICKS — SAVE TO FIRESTORE
  // -------------------------------------------------------------
  const handlePick = async (gameId: string, questionId: string, pick: "yes" | "no") => {
    try {
      await addDoc(collection(db, "picks"), {
        gameId,
        questionId,
        pick,
        createdAt: serverTimestamp(),
      });

      setFilteredGames((prev) =>
        prev.map((g) =>
          g.id === gameId
            ? {
                ...g,
                questions: g.questions.map((q) =>
                  q.id === questionId ? { ...q, userPick: pick } : q
                ),
              }
            : g
        )
      );
    } catch (err) {
      console.error("Error saving pick:", err);
    }
  };

  // -------------------------------------------------------------
  // UI
  // -------------------------------------------------------------
  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-white">
      <h1 className="text-4xl font-bold mb-4">Picks</h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {/* FILTER BUTTONS */}
      <div className="flex gap-3 mb-6">
        {(["open", "final", "pending", "void", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
            className={`px-4 py-2 rounded-lg transition ${
              activeFilter === f
                ? "bg-orange-500 text-white"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* HEADER ROW */}
      <div className="grid grid-cols-12 text-gray-300 text-sm mb-2">
        <div className="col-span-2">START</div>
        <div className="col-span-2">STATUS</div>
        <div className="col-span-3">MATCH • VENUE</div>
        <div className="col-span-1">Q#</div>
        <div className="col-span-2">QUESTION</div>
        <div className="col-span-2">PICK • YES % • NO %</div>
      </div>

      {/* GAME LIST */}
      {loading && <p>Loading...</p>}

      {!loading && filteredGames.length === 0 && (
        <p className="text-gray-400">No picks in this category.</p>
      )}

      <div className="space-y-4 mt-2">
        {filteredGames.map((game) => {
          const { date, time } = formatStartDate(game.startTime);

          return (
            <div key={game.id} className="bg-[#0f1b2a] p-4 rounded-xl shadow-lg">
              {/* GAME HEADER */}
              <div className="grid grid-cols-12 gap-2 mb-3">
                <div className="col-span-2 font-semibold">
                  {date}
                  <br />
                  {time}
                </div>

                <div className="col-span-2">
                  <span className="bg-green-600 px-3 py-1 rounded-full text-xs font-bold">
                    OPEN
                  </span>
                </div>

                <div className="col-span-3 font-semibold text-orange-400">
                  {game.match}
                  <div className="text-gray-400 text-xs">{game.venue}</div>
                </div>
              </div>

              {/* QUESTIONS */}
              <div className="space-y-3">
                {game.questions.map((q) => (
                  <div
                    key={q.id}
                    className="grid grid-cols-12 items-center bg-[#132235] py-3 px-4 rounded-lg"
                  >
                    <div className="col-span-1 text-orange-400 font-bold">
                      Q{q.quarter}
                    </div>

                    <div className="col-span-5 font-semibold">{q.question}</div>

                    <div className="col-span-3 flex gap-3">
                      <button
                        onClick={() => handlePick(game.id, q.id, "yes")}
                        className={`px-4 py-2 rounded-lg font-bold w-20 text-center ${
                          q.userPick === "yes"
                            ? "bg-orange-500 text-white"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                      >
                        Yes
                      </button>

                      <button
                        onClick={() => handlePick(game.id, q.id, "no")}
                        className={`px-4 py-2 rounded-lg font-bold w-20 text-center ${
                          q.userPick === "no"
                            ? "bg-purple-600 text-white"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                      >
                        No
                      </button>
                    </div>

                    <div className="col-span-3 text-right text-sm text-gray-400">
                      Yes: {q.yesPercent ?? 0}% • No: {q.noPercent ?? 0}%
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
