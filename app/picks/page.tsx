"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import dayjs from "dayjs";

export default function PicksPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const roundRef = collection(db, "rounds");
        const snapshot = await getDocs(roundRef);
        const roundsData: any[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data?.games) roundsData.push(...data.games);
        });

        setGames(roundsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching picks:", error);
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (loading) return <p className="text-center text-white mt-20">Loading...</p>;

  return (
    <div className="min-h-screen bg-[#0e1420] text-white px-4 md:px-16 py-12">
      <h1 className="text-3xl font-bold mb-10">Make Picks</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border border-gray-800 rounded-xl">
          <thead className="bg-gray-800 text-gray-300 text-sm">
            <tr>
              <th className="py-3 px-4 border border-gray-700">Start</th>
              <th className="py-3 px-4 border border-gray-700">Match • Venue</th>
              <th className="py-3 px-4 border border-gray-700">Q#</th>
              <th className="py-3 px-4 border border-gray-700">Question</th>
              <th className="py-3 px-4 border border-gray-700">Yes %</th>
              <th className="py-3 px-4 border border-gray-700">No %</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game, i) =>
              game.questions?.map((q: any, index: number) => (
                <tr key={`${i}-${index}`} className="hover:bg-gray-900 transition">
                  <td className="py-3 px-4 border border-gray-700">
                    {game.startTime
                      ? dayjs(game.startTime).format("ddd, D MMM h:mm A")
                      : "TBD"}
                  </td>
                  <td className="py-3 px-4 border border-gray-700 text-orange-400 font-semibold">
                    {game.match}
                    <div className="text-xs text-gray-400">{game.venue}</div>
                  </td>
                  <td className="py-3 px-4 border border-gray-700">Q{q.quarter}</td>
                  <td className="py-3 px-4 border border-gray-700">
                    <span className="font-bold">{q.question}</span>
                  </td>
                  <td className="py-3 px-4 border border-gray-700 text-center text-green-400">
                    0%
                  </td>
                  <td className="py-3 px-4 border border-gray-700 text-center text-purple-400">
                    0%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
