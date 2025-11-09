"use client";
import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "@/config/firebaseClient";

interface Question {
  question: string;
  quarter: number;
}

interface Game {
  match: string;
  questions: Question[];
}

export default function PicksPage() {
  const [fixtures, setFixtures] = useState<Game[]>([]);
  const db = getFirestore(app);

  useEffect(() => {
    const fetchFixtures = async () => {
      const colRef = collection(db, "fixtures");
      const snapshot = await getDocs(colRef);
      const docs = snapshot.docs.map((doc) => doc.data() as Game);
      setFixtures(docs);
    };
    fetchFixtures();
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Make Picks</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fixtures.flatMap((game, i) =>
          game.questions.map((q, j) => (
            <div
              key={`${i}-${j}`}
              className="bg-[#12161b] p-4 rounded-xl shadow-lg border border-gray-800 hover:border-orange-500 transition-all"
            >
              <h2 className="text-orange-400 text-sm font-semibold uppercase mb-2">
                {game.match} — Q{q.quarter}
              </h2>
              <p className="text-lg mb-4">{q.question}</p>

              <div className="flex justify-center gap-4">
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold">
                  Yes
                </button>
                <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold">
                  No
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
