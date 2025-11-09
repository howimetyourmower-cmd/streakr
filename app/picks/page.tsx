"use client";

import { useEffect, useState, useMemo } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "@/src/config/firebaseClient";

const db = getFirestore(app);

interface Question {
  question: string;
  quarter?: number;
}

interface Game {
  match: string;
  date?: string;
  venue?: string;
  questions?: Question[];
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "fixtures"));
        const roundData: Game[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.games) roundData.push(...data.games);
        });
        setGames(roundData);
      } catch (e) {
        console.error("Error loading games:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const content = useMemo(() => {
    if (loading) return <p className="text-white/70">Loading…</p>;
    if (!games.length) return <p className="text-white/70">No games found.</p>;

    return (
      <ol className="space-y-10">
        {games.map((g, gi) => (
          <li
            key={gi}
            className="rounded-2xl border border-white/10 bg-[#11161C] p-6 shadow-lg"
          >
            {/* Game header */}
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">{g.match}</h2>
              <div className="text-sm text-white/60">
                {g.date || "TBD"} • {g.venue || ""}
              </div>
            </div>

            {/* Questions list */}
            <div className="space-y-4">
              {g.questions?.map((q, qi) => (
                <div
                  key={qi}
                  className="flex justify-between items-center rounded-xl bg-[#0E1318] px-4 py-3 border border-white/10"
                >
                  <div>
                    <div className="text-xs uppercase text-white/60">
                      {q.quarter ? `Q${q.quarter}` : ""}
                    </div>
                    <div className="font-medium text-white">{q.question}</div>
                  </div>

                  <div className="flex gap-2">
                    <button className="rounded-xl bg-green-600 hover:bg-green-700 px-5 py-2 text-sm font-semibold text-white transition">
                      Yes
                    </button>
                    <button className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white transition">
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    );
  }, [games, loading]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Make Picks</h1>
        {content}
      </div>
    </main>
  );
}
