"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/config/firebaseClient"; // ✅ keep this import name
const db = getFirestore(app);

// ----- Types -----
type Question = {
  quarter: number;
  question: string;
};

type Game = {
  match: string;
  startTime?: any;   // Firestore Timestamp or string
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

// ----- Utils -----
const tz = "Australia/Melbourne";

function isFSTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}

function toDate(v: any): Date | null {
  if (!v) return null;
  if (isFSTimestamp(v)) return new Date(v.seconds * 1000);
  if (typeof v === "string") {
    // Try ISO first
    const iso = Date.parse(v);
    if (!Number.isNaN(iso)) return new Date(iso);
    // Try “Thursday, 19 March 2026, 7.20pm” style
    // Replace “.” in minutes and normalize “pm/am”
    const normalized = v.replace(/(\d)\.(\d\d)/, "$1:$2").replace(/\s*(am|pm)\b/i, " $1");
    const try2 = Date.parse(normalized);
    if (!Number.isNaN(try2)) return new Date(try2);
  }
  return null;
}

function fmtStart(dt: Date | null) {
  if (!dt) return "TBD";
  const d = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: tz,
  }).format(dt);
  const t = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(dt);
  // Quick zone label
  const zone = dt
    .toLocaleTimeString("en-AU", { timeZoneName: "short", timeZone: tz })
    .split(" ")
    .pop();
  return `${d} • ${t} ${zone}`;
}

function metaLine(game: Game) {
  const dt = toDate(game.startTime);
  const left = fmtStart(dt);
  const venue = game.venue ? ` • ${game.venue}` : "";
  return `${left}${venue}`;
}

// ----- Page -----
export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "rounds", "round-1"));
        if (snap.exists()) {
          const data = snap.data() as RoundDoc;
          setGames(data.games ?? []);
        } else {
          setGames([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Only show OPEN (we keep your rule from earlier: show all for now; filter later if status lives on a question)
  const six = useMemo(() => games.slice(0, 6), [games]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative w-full overflow-hidden">
        <div className="relative h-[48vh] sm:h-[56vh] lg:h-[60vh]">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG at dusk"
            fill
            priority
            className="object-cover object-bottom"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
          <div className="absolute bottom-8 left-6 sm:left-10">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold">
              <span className="text-white">Real</span>{" "}
              <span className="text-orange-400">Streakr&apos;s</span>{" "}
              <span className="text-white">don&apos;t get caught.</span>
            </h1>
            <p className="mt-3 text-white/85 max-w-2xl">
              Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/auth" className="rounded-xl px-4 py-2 bg-orange-500 text-black font-semibold">
                Sign up / Log in
              </Link>
              <Link href="/picks" className="rounded-xl px-4 py-2 bg-white/15 text-white backdrop-blur">
                View Picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsor strip */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 h-20 grid place-items-center">
          <span className="text-white/60">Sponsor banner • 970×90</span>
        </div>
      </div>

      {/* Open picks */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6">Round 1 Open Picks</h2>

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : six.length === 0 ? (
          <div className="text-white/70">No open selections right now. Check back soon.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {six.map((g, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
                <div className="text-sm text-orange-400 font-extrabold tracking-wide">
                  {g.match?.toUpperCase()}
                </div>
                <div className="text-xs text-white/70 mt-1">{metaLine(g)}</div>

                {/* First question preview */}
                {g.questions?.[0] && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div className="text-xs text-white/70 mb-1">Q{g.questions[0].quarter}</div>
                    <div className="text-white font-medium">{g.questions[0].question}</div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-md bg-orange-500 text-black text-sm font-semibold">
                          Yes
                        </button>
                        <button className="px-3 py-1 rounded-md bg-purple-500 text-white text-sm font-semibold">
                          No
                        </button>
                      </div>
                      <Link href="/picks" className="text-sm text-white/80 hover:text-white">
                        See other picks →
                      </Link>
                    </div>

                    <div className="mt-2 text-xs text-white/60">Yes 0% • No 0%</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
