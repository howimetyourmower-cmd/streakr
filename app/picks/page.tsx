"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  // future: status: "OPEN" | "PENDING" | "FINAL";
  // future: yesPct?: number; noPct?: number;
};

type Game = {
  match: string;
  startTime?: any;   // Firestore Timestamp or ISO string
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

function toDate(v: any): Date | null {
  if (!v) return null;
  // Firestore Timestamp
  if (typeof v === "object" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }
  // ISO string
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatStart(d: Date | null): string {
  if (!d) return "TBD";
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function deriveStatus(start: Date | null): "OPEN" | "PENDING" {
  if (!start) return "OPEN";
  const now = Date.now();
  return now < start.getTime() ? "OPEN" : "PENDING";
}

export default function PicksPage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Load Round 1 (adjust when you introduce Opening Round / finals)
        const ref = doc(db, "rounds", "round-1");
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setGames([]);
          return;
        }
        const data = snap.data() as RoundDoc;
        setGames(data.games ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load picks.");
        setGames([]);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!games) return [];
    const r: Array<{
      startText: string;
      match: string;
      qNum: string;
      question: string;
      status: "OPEN" | "PENDING";
      venue: string;
      game: Game;
      q: Question;
    }> = [];
    for (const g of games) {
      const d = toDate(g.startTime);
      const startText = `${formatStart(d)}`;
      const status = deriveStatus(d);
      const venue = g.venue ?? "";
      for (const q of g.questions ?? []) {
        r.push({
          startText,
          match: g.match,
          qNum: `Q${q.quarter}`,
          question: q.question,
          status,
          venue,
          game: g,
          q,
        });
      }
    }
    return r;
  }, [games]);

  const onPick = (choice: "YES" | "NO", rowIdx: number) => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/auth"); // gate actual pick to signed-in users
      return;
    }
    // TODO: write the pick to Firestore here (users/<uid>/picks/{round-1,...})
    console.log("Pick", choice, rows[rowIdx]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-6">Make Picks</h1>

      {err && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {err}
        </div>
      )}

      {!games && (
        <div className="text-gray-300">Loading…</div>
      )}

      {games && rows.length === 0 && !err && (
        <div className="text-gray-300">No questions found for Round 1.</div>
      )}

      {rows.length > 0 && (
        <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-gradient-to-b from-[#1B2330] to-[#161C24]">
          {/* Header */}
          <div className="grid grid-cols-[160px_1fr_64px_minmax(240px,1.5fr)_120px_120px_140px] items-center gap-4 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-300 border-b border-white/10">
            <div>Start</div>
            <div>Match • Venue</div>
            <div>Q#</div>
            <div>Question</div>
            <div>Status</div>
            <div>Yes / No %</div>
            <div className="text-right">Pick</div>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-white/10">
            {rows.map((r, idx) => (
              <li
                key={idx}
                className="grid grid-cols-[160px_1fr_64px_minmax(240px,1.5fr)_120px_120px_140px] items-center gap-4 px-4 py-3"
              >
                {/* Start */}
                <div className="text-sm text-gray-300 whitespace-nowrap">
                  {r.startText}
                </div>

                {/* Match + Venue */}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-300 truncate">
                    {r.match.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{r.venue}</div>
                </div>

                {/* Q# */}
                <div>
                  <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white">
                    {r.qNum}
                  </span>
                </div>

                {/* Question */}
                <div className="min-w-0">
                  <p className="text-sm text-gray-100 leading-tight line-clamp-2">
                    {r.question}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                      (r.status === "OPEN"
                        ? "bg-green-500/15 text-green-300"
                        : "bg-yellow-500/15 text-yellow-300")
                    }
                  >
                    {r.status}
                  </span>
                </div>

                {/* Yes / No % (placeholder until we track votes) */}
                <div className="text-sm text-gray-300">
                  Yes 0% • No 0%
                </div>

                {/* Pick buttons */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onPick("YES", idx)}
                    className="rounded-md bg-orange-500/90 hover:bg-orange-500 text-white px-3 py-1.5 text-sm font-semibold shadow-sm"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onPick("NO", idx)}
                    className="rounded-md bg-purple-600/90 hover:bg-purple-600 text-white px-3 py-1.5 text-sm font-semibold shadow-sm"
                  >
                    No
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Back to home */}
      <div className="mt-6">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
