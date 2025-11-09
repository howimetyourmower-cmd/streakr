// app/picks/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getFirestore, collection, doc, getDoc, getDocs } from "firebase/firestore";
import { app } from "@/config/firebaseClient";

type Question = { question: string; quarter?: number };
type Game = { match: string; questions: Question[] };

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore(app);

        // Choose current round (you can swap "round-1" dynamically later)
        const roundRef = doc(collection(db, "fixtures"), "round-1");
        const snap = await getDoc(roundRef);
        const data = snap.exists() ? (snap.data() as { games: Game[] }) : { games: [] };

        setGames(data.games ?? []);
      } catch (e) {
        console.error(e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-white">
        <h1 className="text-3xl font-bold mb-6">Picks</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Make Picks</h1>

      {/* List each game with its quarter questions */}
      <div className="space-y-10">
        {games.map((g, gi) => (
          <section key={gi} className="rounded-2xl bg-[#12161C] p-5 shadow">
            <h2 className="text-xl font-semibold mb-4">{g.match}</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {g.questions?.map((q, qi) => (
                <div
                  key={qi}
                  className="rounded-2xl border border-white/10 bg-[#0E1318] p-4"
                >
                  <div className="text-xs uppercase text-white/60 mb-1">
                    {q.quarter ? `Q${q.quarter}` : "Quarter"}
                  </div>
                  <div className="font-medium mb-3">{q.question}</div>
                  <div className="flex gap-2">
                    <button className="rounded-xl bg-[#1f2937] px-4 py-2">Yes</button>
                    <button className="rounded-xl bg-[#1f2937] px-4 py-2">No</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
