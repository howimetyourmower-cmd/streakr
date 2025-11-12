"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";

export default function PicksClient() {
  const [picks, setPicks] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("Open");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "rounds"));
        const data: any[] = [];
        querySnapshot.forEach((doc) => {
          const roundData = doc.data();
          if (roundData.games) {
            roundData.games.forEach((game: any) => {
              if (game.questions) {
                game.questions.forEach((q: any, index: number) => {
                  data.push({
                    id: `${doc.id}-${index}`,
                    match: game.match,
                    venue: game.venue,
                    startTime: game.startTime?.seconds
                      ? new Date(game.startTime.seconds * 1000)
                      : null,
                    question: q.question,
                    quarter: q.quarter,
                    status: game.status || "Open",
                  });
                });
              }
            });
          }
        });
        setPicks(data);
      } catch (error) {
        console.error("Error fetching picks:", error);
      }
    };

    fetchData();
  }, []);

  const filteredPicks = picks.filter((pick) => {
    if (statusFilter === "All") return true;
    return pick.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-[#0b0f13] text-white px-6 py-8">
      <h1 className="text-center text-4xl font-bold text-orange-500 mb-4">
        Make Picks
      </h1>

      <div className="flex justify-center gap-3 mb-6">
        {["Open", "Final", "Pending", "Void", "All"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-md font-medium ${
              statusFilter === status
                ? "bg-orange-500 text-white"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="min-w-full text-left border-collapse">
          <thead className="bg-gray-800 text-gray-300 text-sm uppercase">
            <tr>
              <th className="px-4 py-2">Start</th>
              <th className="px-4 py-2">Match · Venue</th>
              <th className="px-4 py-2">Q#</th>
              <th className="px-4 py-2">Question</th>
              <th className="px-4 py-2 text-right">Pick · Yes % · No %</th>
            </tr>
          </thead>
          <tbody>
            {filteredPicks.map((pick) => (
              <tr key={pick.id} className="border-b border-gray-800">
                <td className="px-4 py-3 text-sm text-gray-400">
                  {pick.startTime
                    ? pick.startTime.toLocaleString("en-AU", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                        timeZone: "Australia/Melbourne",
                      })
                    : "TBD"}
                  <span className="ml-2 text-green-400 font-semibold text-xs">
                    {pick.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-orange-400">
                    {pick.match}
                  </div>
                  <div className="text-sm text-gray-400">{pick.venue}</div>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">
                  Q{pick.quarter}
                </td>

                {/* 💪 Updated Question Styling */}
                <td className="px-4 py-3 font-semibold text-lg text-orange-300">
                  {pick.question}
                </td>

                <td className="px-4 py-3 text-right text-sm">
                  <div className="flex justify-end gap-2">
                    <button className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-md text-sm">
                      Yes
                    </button>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm">
                      No
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    0% · 0%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
