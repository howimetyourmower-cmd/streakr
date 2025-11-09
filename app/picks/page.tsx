// app/picks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getFirestore, collection, doc, getDoc } from "firebase/firestore";
import { app } from "@/config/firebaseClient";

type Question = { question: string; quarter?: number };
type Game = {
  match: string;                 // e.g. "Carlton v Brisbane"
  questions: Question[];
  // Optional metadata (use whatever you’ve stored – works with ISO or Firestore timestamps)
  startTime?: string | number | { seconds: number; nanoseconds?: number };
  venue?: string;                // e.g. "MCG"
  location?: string;             // e.g. "Melbourne, VIC"
  timezone?: string;             // e.g. "Australia/Melbourne"
};

export default function PicksPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Format “Fri 14 Mar • 7:20 PM AEDT • MCG, Melbourne”
  const fmtGameMeta = (g: Game) => {
    // Convert many possible shapes to a Date
    let d: Date | null = null;

    if (typeof g.startTime === "string") {
      const t = Date.parse(g.startTime);
      if (!Number.isNaN(t)) d = new Date(t);
    } else if (typeof g.startTime === "number") {
      d = new Date(g.startTime);
    } else if (g.startTime && typeof g.startTime === "object" && "seconds" in g.startTime) {
      d = new Date((g.startTime.seconds as number) * 1000);
    }

    const tz = g.timezone || "Australia/Melbourne";

    const datePart = d
      ? new Intl.DateTimeFormat("en-AU", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          timeZone: tz,
        }).format(d)
      : "TBD";

    const timePart = d
      ? new Intl.DateTimeFormat("en-AU", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
          hour12: true,
        }).format(d)
      : "";

    const venuePart = [g.venue, g.location].filter(Boolean).join(", ");

    return [datePart, timePart ? `${timePart}` : null, venuePart || null]
      .filter(Boolean)
      .join(" • ");
  };

  useEffect(() => {
    (async () => {
      try {
        const db = getFirestore(app);

        // Use current round; swap "round-1" → "round-<n>" when you wire your round switcher
        const snap = await getDoc(doc(collection(db, "fixtures"), "round-1"));
        const data = snap.exists() ? (snap.data() as { games: Game[] }) : { games: [] };

        setGames(Array.isArray(data.games) ? data.games : []);
      } catch (e) {
        console.error(e);
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const content = useMemo(() => {
    if (loading) return <p>Loading…</p>;
    if (!games.length) return <p>No games found for this round.</p>;

    return (
      <ol className="space-y-8">
        {games.map((g, gi) => (
          <li key={gi} className="rounded-2xl border border-white/10 bg-[#11161C] p-5">
            {/* Game header */}
            <div className="mb-3">
              <h2 className="text-xl font-semibold tracking-tight">{g.match}</h2>
              <div className="text-sm text-white/70">{fmtGameMeta(g)}</div>
            </div>

            {/* Questions stacked in a single column */}
            <div className="space-y-4">
              {g.questions?.map((q, qi) => (
                <div
                  key={qi}
                  className="rounded-2xl bg-[#0E1318] p-4 border border-white/10"
                >
                  <div className="mb-1 text-xs uppercase text-white/60">
                    {q.quarter ? `Q${q.quarter}` : "Quarter"}
                  </div>
                  <div className="mb-3 font-medium">{q.question}</div>
                  <div className="flex gap-2">
                    <button className="rounded-xl bg-[#1f2937] px-4 py-2">Yes</button>
                    <button className="rounded-xl bg-[#1f2937] px-4 py-2">No</button>
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    );
  }, [games, loading]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-white">
      <h1 className="mb-6 text-3xl font-bold">Make Picks</h1>
      {content}
    </main>
  );
}
