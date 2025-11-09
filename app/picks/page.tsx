"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../config/firebaseClient";
import { getAuth, onAuthStateChanged } from "firebase/auth";

type Q = {
  quarter: number;
  question: string;
  status?: "OPEN" | "PENDING" | "FINAL";
  yesPct?: number;
  noPct?: number;
};

type Game = {
  match: string;
  startTime?: string;
  venue?: string;
  questions: Q[];
};

type RoundDoc = {
  games: Game[];
};

export default function PicksPage() {
  const db = useMemo(() => getFirestore(app), []);
  const auth = useMemo(() => getAuth(app), []);
  const [games, setGames] = useState<Game[]>([]);
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    async function fetchRound() {
      const ref = doc(db, "rounds", "round-1");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
        return;
      }
      const fallbackRef = doc(db, "round-1");
      const fbSnap = await getDoc(fallbackRef);
      if (fbSnap.exists()) {
        const data = fbSnap.data() as RoundDoc;
        setGames(Array.isArray(data.games) ? data.games : []);
      }
    }
    fetchRound();
  }, [db]);

  const isAuthed = !!user;

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white antialiased">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-extrabold">Make Picks</h1>

        <div className="space-y-8">
          {games.map((g, gi) => {
            const headerLine = [
              g.startTime || "TBD",
              g.venue ? g.venue : "",
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <section
                key={gi}
                className="rounded-2xl border border-white/10 bg-[#12161c] p-4 shadow-lg"
              >
                <h2 className="text-xl font-extrabold tracking-wide text-orange-400">
                  {g.match?.toUpperCase() || "MATCH"}
                </h2>
                <div className="mb-3 mt-1 text-sm text-white/60">{headerLine}</div>

                <div className="space-y-3">
                  {g.questions.map((q, qi) => {
                    const status = q.status || "OPEN";
                    const yes = q.yesPct ?? 0;
                    const no = q.noPct ?? 0;

                    return (
                      <div
                        key={qi}
                        className="rounded-xl border border-white/10 bg-[#0f1318] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold">
                              Q{q.quarter}
                            </span>
                            <span
                              className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                                status === "OPEN"
                                  ? "bg-emerald-700/50 text-emerald-200"
                                  : status === "PENDING"
                                  ? "bg-yellow-700/50 text-yellow-200"
                                  : "bg-purple-700/50 text-purple-200"
                              }`}
                            >
                              {status}
                            </span>
                          </div>

                          <div className="hidden md:flex items-center gap-3 text-xs text-white/60">
                            <span>Yes {yes}%</span>
                            <span>No {no}%</span>
                            <span className="rounded-md bg-white/10 px-2 py-1">💬 0</span>
                          </div>
                        </div>

                        <p className="mt-2 text-base font-semibold">{q.question}</p>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            className="rounded-xl bg-green-600 px-3 py-2 font-semibold hover:bg-green-500"
                            onClick={() => {
                              if (!isAuthed) {
                                window.location.href = "/auth";
                                return;
                              }
                              // TODO: call your pick handler
                            }}
                          >
                            Yes
                          </button>
                          <button
                            className="rounded-xl bg-red-600 px-3 py-2 font-semibold hover:bg-red-500"
                            onClick={() => {
                              if (!isAuthed) {
                                window.location.href = "/auth";
                                return;
                              }
                              // TODO: call your pick handler
                            }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
