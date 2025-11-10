// app/picks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  status?: "open" | "pending" | "final" | "void";
  yesPct?: number;
  noPct?: number;
  commentsCount?: number;
};

type Game = {
  id: string;
  match: string;
  startTime?: string;
  tz?: string;
  venue?: string;
  status?: "open" | "pending" | "final";
  questions: Question[];
};

function fmt(t?: string) {
  if (!t) return "TBA";
  return t;
}

export default function PicksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "games"));
        const data = snap.docs.map((d) => {
          const gameData = d.data() as Omit<Game, "id">;
          return { id: d.id, ...gameData };
        }) as Game[];
        const open = data.filter((g) => (g.status ?? "open") === "open");
        setGames(open);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handlePick(gameId: string, qIndex: number, choice: "yes" | "no") {
    if (!user) return;
    const ref = doc(db, "games", gameId);
    try {
      await updateDoc(ref, {
        [`questions.${qIndex}.${choice}Votes`]: increment(1),
      });
    } catch (e) {
      console.warn("Pick write not configured yet:", e);
    }
  }

  const signedOutBanner = useMemo(
    () =>
      !user ? (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
          You’re viewing as a guest. <b>Sign in</b> to make picks and build your streak.{" "}
          <Link href="/auth" className="text-orange-400 hover:underline">
            Go to sign in →
          </Link>
        </div>
      ) : null,
    [user]
  );

  if (loading) {
    return (
      <main className="grid place-items-center min-h-screen bg-black text-white">
        <p>Loading picks…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold">
            🔥 Streakr <span className="text-orange-500">Picks</span>
          </h1>
          <nav className="text-sm">
            <Link href="/" className="text-zinc-400 hover:text-white mr-4">
              Home
            </Link>
            <Link href="/leaderboard" className="text-zinc-400 hover:text-white">
              Leaderboards
            </Link>
          </nav>
        </header>

        {signedOutBanner}

        {games.length === 0 ? (
          <p className="text-zinc-400">No open selections right now.</p>
        ) : (
          <div className="space-y-6">
            {games.map((g) => (
              <section
                key={g.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">{g.match}</h2>
                    <p className="text-sm text-zinc-400">
                      {fmt(g.startTime)}
                      {g.venue ? ` • ${g.venue}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                    {(g.status ?? "open").toUpperCase()}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {g.questions?.map((q, i) => (
                    <article
                      key={i}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                          Q{q.quarter}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {(q.status ?? "open").toUpperCase()}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-200">{q.question}</p>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex gap-2">
                          <button
                            disabled={!user || (q.status ?? "open") !== "open"}
                            onClick={() => handlePick(g.id, i, "yes")}
                            className={[
                              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                              user && (q.status ?? "open") === "open"
                                ? "bg-orange-500 text-black hover:bg-orange-600"
                                : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
                            ].join(" ")}
                          >
                            Yes
                          </button>
                          <button
                            disabled={!user || (q.status ?? "open") !== "open"}
                            onClick={() => handlePick(g.id, i, "no")}
                            className={[
                              "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                              user && (q.status ?? "open") === "open"
                                ? "bg-zinc-700 text-white hover:bg-zinc-600"
                                : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
                            ].join(" ")}
                          >
                            No
                          </button>
                        </div>

                        <Link
                          href={`/discussion?game=${encodeURIComponent(g.id)}&q=${i}`}
                          className="text-xs text-zinc-400 hover:text-orange-400"
                        >
                          Discuss
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
