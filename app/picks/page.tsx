"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "@/config/firebaseClient";

const db = getFirestore(app);

type Status = "OPEN" | "PENDING" | "FINAL";

interface Question {
  question: string;
  quarter?: number;
  yesVotes?: number;
  noVotes?: number;
  comments?: number;
  status?: Status;
}

interface Game {
  match: string;          // "Carlton v Brisbane"
  date?: string;          // "Thu, Mar 20 · 7:20 PM AEDT"
  venue?: string;         // "MCG, Melbourne"
  questions?: Question[];
}

function pct(yes = 0, no = 0) {
  const total = yes + no;
  if (!total) return { yesPct: 0, noPct: 0 };
  return {
    yesPct: Math.round((yes / total) * 100),
    noPct: Math.round((no / total) * 100),
  };
}

function StatusBadge({ status = "OPEN" as Status }) {
  const styles: Record<Status, string> = {
    OPEN: "bg-emerald-600/20 text-emerald-300 border-emerald-600/40",
    PENDING: "bg-yellow-600/20 text-yellow-300 border-yellow-600/40",
    FINAL: "bg-sky-600/20 text-sky-300 border-sky-600/40",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Load all docs under "fixtures" and combine their games arrays
        const snap = await getDocs(collection(db, "fixtures"));
        const round: Game[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as { games?: Game[] };
          if (Array.isArray(data?.games)) round.push(...data.games);
        });
        setGames(round);
      } catch (e) {
        console.error("Error loading fixtures:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const body = useMemo(() => {
    if (loading) return <p className="text-white/70">Loading…</p>;
    if (!games.length) return <p className="text-white/70">No games found.</p>;

    return (
      <ol className="space-y-10">
        {games.map((g, gi) => (
          <li
            key={gi}
            className="rounded-2xl border border-white/10 bg-[#11161C] p-6 shadow-xl"
          >
            {/* Game header */}
            <header className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight">{g.match}</h2>
              <div className="mt-1 text-sm text-white/60">
                {g.date || "TBD"}
                {g.venue ? ` • ${g.venue}` : ""}
              </div>
            </header>

            {/* Questions */}
            <div className="space-y-4">
              {g.questions?.map((q, qi) => {
                const yes = q.yesVotes ?? 0;
                const no = q.noVotes ?? 0;
                const { yesPct, noPct } = pct(yes, no);
                const comments = q.comments ?? 0;
                const status: Status = (q.status as Status) || "OPEN";

                return (
                  <div
                    key={qi}
                    className="rounded-xl bg-[#0E1318] border border-white/10 p-4"
                  >
                    {/* Top row: Q#, Status, Comments */}
                    <div className="mb-2 flex items-center gap-3 text-xs">
                      {q.quarter ? (
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/70">
                          Q{q.quarter}
                        </span>
                      ) : null}
                      <StatusBadge status={status} />
                      <span className="ml-auto text-white/60">
                        💬 {comments}
                      </span>
                    </div>

                    {/* Question text */}
                    <div className="font-medium text-white mb-3">
                      {q.question}
                    </div>

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex gap-2 ml-auto">
                        <button className="rounded-xl bg-green-600 hover:bg-green-700 px-5 py-2 text-sm font-semibold text-white transition">
                          Yes
                        </button>
                        <button className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white transition">
                          No
                        </button>
                      </div>
                    </div>

                    {/* Percent bars */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-white/70 mb-1">
                        <span>Yes {yesPct}%</span>
                        <span>No {noPct}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600"
                          style={{ width: `${yesPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    );
  }, [games, loading]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Make Picks</h1>
        {body}
      </div>
    </main>
  );
}
