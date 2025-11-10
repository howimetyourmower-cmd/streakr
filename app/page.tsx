"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type Question = { quarter: number; question: string };
type Game = {
  id: string;
  match: string;
  startTime?: string;
  status?: "open" | "pending" | "final";
  venue?: string;
  questions?: Question[];
};

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "games"));
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Game, "id">),
        })) as Game[];

        // only show games with status "open"
        const openOnly = data.filter((g) => (g.status ?? "open") === "open");
        setGames(openOnly);
      } catch (err: any) {
        console.error(err);
        setError("Failed to load games");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-black text-white">
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen flex items-center justify-center bg-black text-red-400">
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative w-full">
        <div className="relative h-[42vh] md:h-[56vh] w-full">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG hero"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />
          <div className="absolute bottom-6 left-6 right-6">
            <h1 className="text-4xl md:text-5xl font-extrabold">
              STREAK<span className="text-orange-500">r</span>
            </h1>
            <p className="mt-2 text-zinc-300">
              Real Streakr&apos;s don&apos;t get caught.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/auth"
                className="bg-orange-500 text-black px-4 py-2 rounded-xl font-semibold hover:bg-orange-600 transition"
              >
                Sign up / Log in
              </Link>
              <Link
                href="/picks"
                className="border border-zinc-700 px-4 py-2 rounded-xl hover:border-orange-500 transition"
              >
                View Picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Open Selections */}
      <section className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-bold">Open Selections</h2>
            <Link
              href="/leaderboard"
              className="text-sm text-zinc-400 hover:text-orange-400"
            >
              View Leaderboard →
            </Link>
          </div>

          {games.length === 0 ? (
            <p className="text-zinc-400">
              No open selections right now. Check back soon.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {games.map((g) => (
                <article
                  key={g.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-orange-500 transition"
                >
                  <header className="mb-2">
                    <h3 className="text-lg font-semibold">{g.match}</h3>
                    <p className="text-sm text-zinc-400">
                      {g.startTime ? `Start: ${g.startTime}` : "Start time TBA"}
                      {g.venue ? ` • ${g.venue}` : ""}
                    </p>
                  </header>

                  <ul className="text-sm text-zinc-300 space-y-1">
                    {(g.questions ?? []).slice(0, 3).map((q, i) => (
                      <li key={i}>
                        Q{q.quarter}: {q.question}
                      </li>
                    ))}
                    {(g.questions?.length ?? 0) > 3 && (
                      <li className="text-zinc-500">
                        + {(g.questions!.length - 3)} more…
                      </li>
                    )}
                  </ul>

                  <footer className="mt-3">
                    <Link
                      href={`/picks?game=${encodeURIComponent(g.id)}`}
                      className="inline-block text-sm text-orange-400 hover:underline"
                    >
                      Make your pick →
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
