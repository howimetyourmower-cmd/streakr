"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "./config/firebaseClient";

// ---------- Types ----------
type Question = { quarter: number; question: string };
type Game = {
  match: string;
  venue?: string;
  startTime?: any;       // Firestore Timestamp or string
  date?: string;         // "2026-03-19"
  time?: string;         // "19:50"
  tz?: string;           // "Australia/Melbourne" or "+11:00"
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

// ---------- Time helpers ----------
function isFsTimestamp(v: any): v is { seconds: number } {
  return v && typeof v.seconds === "number";
}
function parseFreeformStartTime(v: string): Date | null {
  const re =
    /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*UTC([+-]\d{1,2})$/i;
  const m = v.trim().replace(/\s+/g, " ").match(re);
  if (!m) return null;
  const [, monName, dStr, yStr, hStr, minStr, secStr, ampmRaw, tzOffStr] = m;
  const monthMap: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const month = monthMap[monName.toLowerCase()];
  if (month == null) return null;
  let hour = parseInt(hStr, 10);
  const minute = parseInt(minStr, 10);
  const second = secStr ? parseInt(secStr, 10) : 0;
  const ampm = ampmRaw.toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const day = parseInt(dStr, 10);
  const year = parseInt(yStr, 10);
  const tz = tzOffStr.startsWith("+") || tzOffStr.startsWith("-") ? tzOffStr : `+${tzOffStr}`;
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
    second
  ).padStart(2, "0")}${tz}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
function toDate(game: Game): Date | null {
  if (game.date && game.time) {
    const tz = game.tz ?? "+11:00";
    const d = new Date(`${game.date}T${game.time}:00${tz}`);
    if (!isNaN(d.getTime())) return d;
  }
  const st = game.startTime;
  if (isFsTimestamp(st)) return new Date(st.seconds * 1000);
  if (typeof st === "string") {
    const parsed = parseFreeformStartTime(st);
    if (parsed) return parsed;
    const d = new Date(st);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
function formatWhenWhere(game: Game): string {
  const tz = game.tz || "Australia/Melbourne";
  const d = toDate(game);
  const venue = game.venue;
  if (!d) return venue ? `TBD • ${venue}` : "TBD";
  const day = new Intl.DateTimeFormat("en-AU", {
    weekday: "short", day: "2-digit", month: "short", timeZone: tz,
  }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz,
  }).format(d);
  const tzName = new Intl.DateTimeFormat("en-AU", {
    timeZoneName: "short", timeZone: tz,
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value || "";
  return `${day} • ${time} ${tzName}${venue ? ` • ${venue}` : ""}`;
}

// ---------- Page ----------
export default function HomePage() {
  const [round, setRound] = useState<RoundDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getFirestore(app);
      const snap = await getDoc(doc(db, "fixtures", `round-${CURRENT_ROUND}`));
      setRound((snap.data() as RoundDoc) || { games: [] });
      setLoading(false);
    })();
  }, []);

  // Flatten to question cards then take first 6
  const sixSamples = useMemo(() => {
    if (!round?.games?.length) return [];
    const cards: Array<{ game: Game; q: Question }> = [];
    for (const g of round.games) {
      for (const q of g.questions) cards.push({ game: g, q });
    }
    return cards.slice(0, 6);
  }, [round]);

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      {/* HERO */}
      <section className="relative">
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-24">
          <h1 className="mb-4 text-5xl font-extrabold leading-tight md:text-6xl">
            One pick. <span className="text-orange-500">One streak.</span> Win the round.
          </h1>
          <p className="mb-6 max-w-2xl text-white/80">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="flex gap-3">
            <Link href="/picks" className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600">
              Make your first pick
            </Link>
            <Link href="/leaderboard" className="rounded-xl bg-white/10 px-5 py-3 font-semibold hover:bg-white/20">
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Stadium image */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG sunset"
            fill
            priority
            className="object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f13]/20 to-[#0b0f13]" />
        </div>
      </section>

      {/* Sponsor banner (kept below full hero so image is fully visible) */}
      <div className="mx-auto mb-10 mt-4 max-w-6xl px-4">
        <div className="flex h-[90px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-white/60">
          Sponsor banner • 970×90
        </div>
      </div>

      {/* Round 1 sample questions */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="mb-4 text-2xl font-extrabold">Round {CURRENT_ROUND} Questions</h2>

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sixSamples.map(({ game, q }, idx) => (
              <article key={idx} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-1 text-sm font-bold uppercase tracking-wide text-orange-400">
                  {game.match}
                </div>
                <div className="mb-3 text-xs text-white/60">{formatWhenWhere(game)}</div>
                <div className="mb-3 text-white/90">
                  <span className="mr-2 inline-block rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                    Q{q.quarter}
                  </span>
                  {q.question}
                </div>
                <div className="flex gap-2">
                  <button className="rounded-md bg-green-600 px-3 py-1 text-sm font-semibold hover:bg-green-700">Yes</button>
                  <button className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold hover:bg-red-700">No</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
