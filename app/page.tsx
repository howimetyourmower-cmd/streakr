// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type Game = { id: string; match: string; startTime?: string; questions?: { quarter: number; question: string }[]; };

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "games"));
        setGames(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Game,"id">) })));
      } catch (e:any) { setError("Failed to load games"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <main className="h-screen flex items-center justify-center bg-black text-white"><p>Loading…</p></main>;
  if (error) return <main className="h-screen flex items-center justify-center bg-black text-red-400"><p>{error}</p></main>;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-orange-500">🏉 Streakr Picks</h1>
        {games.length===0 ? <p className="text-center text-zinc-400">No games loaded yet.</p> :
          <div className="grid md:grid-cols-2 gap-4">
            {games.map(g=>(
              <div key={g.id} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 hover:border-orange-500 transition">
                <h2 className="text-lg font-semibold mb-1">{g.match}</h2>
                <p className="text-sm text-zinc-400 mb-2">{g.startTime?`Start: ${g.startTime}`:"TBA"}</p>
                <Link href={`/picks?game=${encodeURIComponent(g.id)}`} className="text-sm text-orange-400 hover:underline">View Picks →</Link>
              </div>
            ))}
          </div>}
      </div>
    </main>
  );
}
