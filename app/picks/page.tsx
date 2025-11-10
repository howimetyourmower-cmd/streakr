"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import dayjs from "dayjs";

export default function PicksPage() {
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const roundsRef = collection(db, "rounds");
        const querySnapshot = await getDocs(roundsRef);

        const allPicks: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.games && Array.isArray(data.games)) {
            data.games.forEach((game: any) => {
              if (game.questions && Array.isArray(game.questions)) {
                game.questions.forEach((question: any, index: number) => {
                  allPicks.push({
                    id: `${doc.id}-${index}`,
                    match: game.match,
                    venue: game.venue || "TBD",
                    question: question.question,
                    quarter: question.quarter,
                    yesPercent: question.yesPercent || 0,
                    noPercent: question.noPercent || 0,
                    startTime: game.startTime || null,
                    status: game.status || "open",
                  });
                });
              }
            });
          }
        });

        setPicks(allPicks);
      } catch (error) {
        console.error("Error fetching picks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-gray-400">Loading picks...</div>;
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "TBD";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).format("ddd, D MMM • h:mm A [AEDT]");
    } catch {
      return "TBD";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6 text-white">Make Picks</h1>

      <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-lg">
        <table className="min-w-full text-left text-gray-200">
          <thead className="bg-gray-800 text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Match · Venue</th>
              <th className="px-4 py-3">Q#</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3 text-center">Yes %</th>
              <th className="px-4 py-3 text-center">No %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {picks.map((pick) => (
              <tr key={pick.id} className="hover:bg-gray-800 transition-all">
                <td className="px-4 py-3 text-sm text-gray-400">
                  {formatDate(pick.startTime)}
                  <div
                    className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      pick.status === "open"
                        ? "bg-green-800 text-green-300"
                        : pick.status === "pending"
                        ? "bg-yellow-800 text-yellow-300"
                        : pick.status === "final"
                        ? "bg-blue-800 text-blue-300"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {pick.status.toUpperCase()}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-orange-400">
                  {pick.match}
                  <div className="text-xs text-gray-400">{pick.venue}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">Q{pick.quarter}</td>
                <td className="px-4 py-3 font-bold text-white">{pick.question}</td>
                <td className="px-4 py-3 text-center text-green-400">{pick.yesPercent}%</td>
                <td className="px-4 py-3 text-center text-red-400">{pick.noPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
