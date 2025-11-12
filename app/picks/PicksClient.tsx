"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import { Card } from "@/components/ui/card";

interface Question {
  question: string;
  quarter: number;
  yesVotes: number;
  noVotes: number;
}

interface Game {
  match: string;
  venue: string;
  startTime: string;
  status: string;
  questions: Question[];
}

export default function PicksClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const roundsRef = collection(db, "rounds");
        const roundsSnapshot = await getDocs(roundsRef);
        const fetchedGames: Game[] = [];

        roundsSnapshot.forEach((roundDoc) => {
          const roundData = roundDoc.data();
          if (roundData.games) {
            roundData.games.forEach((game: any) => {
              fetchedGames.push({
                match: game.match,
                venue: game.venue,
                startTime: game.startTime?.toDate
                  ? game.startTime.toDate().toLocaleString("en-AU", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                      timeZoneName: "short",
                    })
                  : game.startTime || "TBD",
                status: game.status || "OPEN",
                questions: game.questions || [],
              });
            });
          }
        });

        setGames(fetchedGames);
      } catch (error) {
        console.error("Error fetching games:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (loading) return <p className="text-center text-white mt-10">Loading picks...</p>;

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Title + Sponsor Banner */}
        <h1 className="text-center text-4xl font-extrabold text-[#fe6f27] mb-4">Make Picks</h1>
        <div className="sponsor-banner flex items-center justify-center mb-8">
          Sponsor Banner • 970×90
        </div>

        {/* Filters */}
        <div className="flex justify-center gap-3 mb-8">
          {["Open", "Final", "Pending", "Void", "All"].map((status) => (
            <button
              key={status}
              className={`px-4 py-2 rounded-lg font-semibold ${
                status === "Open"
                  ? "bg-[#fe6f27] text-black"
                  : "bg-[#1c1f26] text-gray-300 hover:bg-[#2c2f36]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Picks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-gray-400 text-sm uppercase">
                <th className="pl-4">Start</th>
                <th>Match · Venue</th>
                <th>Q#</th>
                <th>Question</th>
                <th>Pick · Yes % · No %</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game, index) =>
                game.questions.map((q, i) => (
                  <tr key={`${index}-${i}`} className="bg-[#10151c] hover:bg-[#1b222e] rounded-lg">
                    <td className="pl-4 py-3 text-sm text-gray-300">
                      {game.startTime}{" "}
                      <span className="chip-open ml-2">{game.status}</span>
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-[#fe6f27]">{game.match}</span>
                      <p className="text-xs text-gray-400">{game.venue}</p>
                    </td>
                    <td className="text-center">Q{q.quarter}</td>
                    <td>{q.question}</td>
                    <td className="pr-4 text-right text-sm">
                      <button className="btn btn-primary mr-2">Yes</button>
                      <button className="btn btn-ghost mr-4">No</button>
                      <span className="text-gray-400">
                        {q.yesVotes || 0}% · {q.noVotes || 0}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
