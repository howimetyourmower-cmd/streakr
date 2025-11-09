"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  // optional future fields
  status?: "OPEN" | "PENDING" | "FINAL";
  yesPct?: number;
  noPct?: number;
};

type Game = {
  match: string;               // "Carlton v Brisbane"
  venue?: string;              // "MCG, Melbourne"
  startTime?: string;          // ISO string or text
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

export default function PicksPage() {
  const db = useMemo(() => getFirestore(app), []);
  const auth = useMemo(() => getAuth(app), []);
  const router = useRouter();
  const path = usePathname();

  const [userId, setUserId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch auth state (only for gating the button action, not for visibility)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserId(u ? u.uid : null));
    return () => unsub();
  }, [auth]);

  // Load Round 1 (adjust doc id if you use something else)
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "rounds", "round-1");
        const snap = await getDoc(ref);
        const data = snap.exists() ? (snap.data() as RoundDoc) : { games: [] };
        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (e) {
        console.error("Failed to load picks:", e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  const handlePick = (game: Game, q: Question, value: "YES" | "NO") => {
    if (!userId) {
      // Not logged in → send to auth, then bounce back to this page
      router.push(`/auth?redirect=${encodeURIComponent(path || "/picks")}`);
      return;
    }
    // TODO: implement the real pick write here
    // e.g. addDoc(collection(db, "picks"), { uid:userId, round:1, match:game.match, quarter:q.quarter, value })
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="text-3xl font-extrabold tracking-tight mb-6">Make Picks</h1>

      {loading ? (
        <div className="text-zinc-300">Loading…</div>
      ) : games.length === 0 ? (
        <div className="text-zinc-300">No questions found for Round 1.</div>
      ) : (
        <div className="space-y-6">
          {games.map((g, gi) => (
            <section key={gi} className="rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 shadow-xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-xl font-bold tracking-wide">
                  <span className="text-orange-400">{g.match}</span>
                </h2>
                <p className="text-sm text-zinc-300 mt-1">
                  {g.startTime ? g.startTime : "TBD"}
                  {g.venue ? ` • ${g.venue}` : ""}
                </p>
              </div>

              {/* Questions */}
              <ul className="divide-y divide-white/5">
                {g.questions?.map((q, qi) => (
                  <li key={qi} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-zinc-700/60 text-zinc-100">
                        Q{q.quarter}
                      </span>
                      {q.status && (
                        <span
                          className={
                            "text-[11px] font-semibold px-2 py-1 rounded-full ring-1 " +
                            (q.status === "OPEN"
                              ? "bg-emerald-600/20 text-emerald-300 ring-emerald-600/40"
                              : q.status === "PENDING"
                              ? "bg-indigo-600/20 text-indigo-300 ring-indigo-600/40"
                              : "bg-fuchsia-600/20 text-fuchsia-300 ring-fuchsia-600/40")
                          }
                        >
                          {q.status}
                        </span>
                      )}

                      <p className="flex-1 text-base md:text-lg font-semibold text-zinc-100">
                        {q.question}
                      </p>

                      <div className="flex items-center gap-2">
                        {/* Percent placeholders (wire up later) */}
                        {typeof q.yesPct === "number" && (
                          <span className="text-xs text-emerald-300 min-w-[2.5rem] text-right">
                            Yes {q.yesPct}%
                          </span>
                        )}
                        {typeof q.noPct === "number" && (
                          <span className="text-xs text-rose-300 min-w-[2.5rem] text-right">
                            No {q.noPct}%
                          </span>
                        )}

                        {/* Yes / No buttons */}
                        <button
                          onClick={() => handlePick(g, q, "YES")}
                          className="px-3 py-1.5 rounded-md text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 transition"
                          aria-label="Pick Yes"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => handlePick(g, q, "NO")}
                          className="px-3 py-1.5 rounded-md text-sm font-semibold bg-rose-600 hover:bg-rose-500 transition"
                          aria-label="Pick No"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
