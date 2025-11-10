// app/picks.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, db } from "@/lib/firebaseClient";

type Question = {
  quarter: number;
  question: string;
};

type Game = {
  id: string;
  match: string;
  startTime?: string;
  questions?: Question[];
};

export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Load games from Firestore
  useEffect(() => {
    async function loadGames() {
      try {
        const snap = await getDocs(collection(db, "games"));
        const data: Game[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Game, "id">) }));
        setGames(data);
      } finally {
        setLoading(false);
      }
    }
    loadGames();
  }, []);

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-black text-white">
        <p>Loading picks…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="mb-4 text-zinc-400">You must be signed in to view picks.</p>
          <Link href="/auth" className="text-orange-500 hover:underline">
            Go to sign in →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold text-orange-500 mb-6">Streakr Picks</h1>

        {games.length === 0 ? (
          <p className="text-zinc-400 text-center">No games available right now.</p>
        ) : (
          <div className="space-y-6">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700 hover:border-orange-500 transition"
              >
                <h2 className="text-xl font-semibold mb-2">{game.match}</h2>
                <p className="text-zinc-400 text-sm mb-2">
                  {game.startTime ? `Start: ${game.startTime}` : "Start time TBA"}
                </p>

                {game.questions?.length ? (
                  <ul className="space-y-1">
                    {game.questions.map((q, i) => (
                      <li key={i} className="text-sm text-zinc-300">
                        Q{q.quarter}: {q.question}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-500 text-sm">No questions available yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
