// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import Link from "next/link";

type Game = {
  id: string;
  match: string;
  startTime?: string;
  questions?: { quarter: number; question: string }[];
};

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGames() {
      try {
        const snapshot = await getDocs(collection(db, "games"));
        const data: Game[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Game[];
        setGames(data);
      } catch (err: any) {
        console.error("Error loading games:", err);
        setError("Failed to load games");
      } finally {
        setLoading(false);
      }
    }
    loadGames();
  }, []);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen bg-black text-white">
        <p>Loading games...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex items-center justify-center h-screen bg-black text-red-400">
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-orange-500">
          🏉 Streakr Picks
        </h1>

        {games.length === 0 ? (
          <p className="text-center text-zinc-400">No games loaded yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 hover:border-orange-500 transition"
              >
                <h2 className="text-lg font-semibold mb-1">{game.match}</h2>
                <p className="text-sm text-zinc-400 mb-2">
                  {game.startTime ? `Start: ${game.startTime}` : "TBA"}
                </p>
                <Link
                  href={`/picks?game=${encodeURIComponent(game.id)}`}
                  className="inline-block mt-2 text-sm text-orange-400 hover:underline"
                >
                  View Picks →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
