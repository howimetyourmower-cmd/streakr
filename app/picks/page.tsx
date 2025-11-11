"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { useEffect, useState, Suspense } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import dayjs from "dayjs";

function PicksContent() {
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPicks() {
      try {
        const roundsRef = collection(db, "rounds");
        const snapshot = await getDocs(roundsRef);

        const allPicks: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.games) {
            data.games.forEach((game: any) => {
              if (game.questions) {
                game.questions.forEach((question: any) => {
                  if (question.status === "open") {
                    allPicks.push({
                      ...question,
                      match: game.match,
                      venue: game.venue,
                      startTime: game.startTime,
                    });
                  }
                });
              }
            });
          }
        });

        setPicks(allPicks);
      } catch (error) {
        console.error("Error loading picks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPicks();
  }, []);

  if (loading) {
    return (
      <div className="text-center text-gray-300 mt-10 text-lg">
        Loading picks...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">Make Picks</h1>

      <div className="overflow-x-auto rounded-2xl shadow-lg bg-gray-900/40">
        <table className="min-w-full text-left text-gray-200">
          <thead className="text-sm uppercase bg-gray-800/70">
            <tr>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">Match · Venue</th>
              <th className="px-4 py-3">Q#</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3 text-center">Yes %</th>
              <th className="px-4 py-3 text-center">No %</th>
            </tr>
          </thead>
          <tbody>
            {picks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No open selections right now.
                </td>
              </tr>
            ) : (
              picks.map((pick, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-700 hover:bg-gray-800/60"
                >
                  <td className="px-4 py-3 text-sm">
                    {pick.startTime
                      ? dayjs(pick.startTime).format("ddd, D MMM · h:mm A")
                      : "TBD"}
                    <div
                      className={`inline-block ml-2 px-2 py-1 rounded-full text-xs ${
                        pick.status === "open"
                          ? "bg-green-700 text-white"
                          : pick.status === "pending"
                          ? "bg-yellow-600 text-black"
                          : pick.status === "final"
                          ? "bg-blue-700 text-white"
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      {pick.status ? pick.status.toUpperCase() : "OPEN"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-orange-400 font-semibold">
                      {pick.match}
                    </div>
                    <div className="text-xs text-gray-400">{pick.venue}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{`Q${pick.quarter || "?"}`}</td>
                  <td className="px-4 py-3 font-semibold">{pick.question}</td>
                  <td className="px-4 py-3 text-center text-green-400">0%</td>
                  <td className="px-4 py-3 text-center text-red-400">0%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PicksPage() {
  return (
    <Suspense fallback={<div className="text-center text-white mt-10">Loading...</div>}>
      <PicksContent />
    </Suspense>
  );
}
