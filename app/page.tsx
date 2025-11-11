"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

// ---------- Types ----------
type Question = {
  quarter: number;
  question: string;
  yesPercent?: number;
  noPercent?: number;
};

type Game = {
  match: string;
  venue?: string;
  startTime?: Timestamp | string | Date | null;
  status?: "open" | "pending" | "final" | "void";
  questions: Question[];
};

type RoundDoc = { games: Game[] };

type CardRow = {
  id: string;
  roundId: string;
  match: string;
  venue: string;
  quarter: number;
  question: string;
  yesPercent: number;
  noPercent: number;
  startTime: Timestamp | string | Date | null;
  status: "open" | "pending" | "final" | "void";
};

// ---------- Robust startTime parsing ----------
const toDate = (v: CardRow["startTime"]): Date | null => {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof (v as any)?.toDate === "function") {
    try {
      return (v as Timestamp).toDate();
    } catch {
      /* ignore */
    }
  }

  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "string") {
    // ISO first
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;

    // Human formats you seeded (with dot minutes and optional commas/AEDT)
    const formats = [
      "dddd, D MMMM YYYY, h.mm a",
      "ddd, D MMM YYYY, h.mm a",
      "D MMMM YYYY, h.mm a",
      "D MMM YYYY, h.mm a",
      "dddd D MMMM YYYY, h.mm a",
      "dddd, D MMMM YYYY, h.mm a [AEDT]",
      "ddd, D MMM YYYY, h.mm a [AEDT]",
    ];
    for (const fmt of formats) {
      const p = dayjs(v, fmt, true);
      if (p.isValid()) return p.toDate();
    }
  }

  return null;
};

const formatStart = (v: CardRow["startTime"]) => {
  const d = toDate(v);
  if (!d) return "TBD";
  return `${dayjs(d).format("ddd, D MMM")} • ${dayjs(d).format("h:mm A")} AEDT`;
};

// ---------- Component ----------
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "rounds"));
        const all: CardRow[] = [];
        snap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            (Array.isArray(g.questions) ? g.questions : []).forEach((q, qi) => {
              all.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? "TBD",
                venue: g.venue ?? "TBD",
                quarter: Number(q.quarter ?? 1),
                question: q.question ?? "",
                yesPercent: Number(q.yesPercent ?? 0),
                noPercent: Number(q.noPercent ?? 0),
                startTime: g.startTime ?? null,
                status: (g.status as CardRow["status"]) ?? "open",
              });
            });
          });
        });

        // Only OPEN selections, soonest first
        const openOnly = all
          .filter((r) => r.status === "open")
          .sort((a, b) => {
            const ta = toDate(a.startTime)?.getTime() ?? 0;
            const tb = toDate(b.startTime)?.getTime() ?? 0;
            if (ta !== tb) return ta - tb;
            return a.quarter - b.quarter;
          })
          .slice(0, 6);

        setCards(openOnly);
      } catch (e) {
        console.error("home fetch rounds error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handlePick = (row: CardRow, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    // TODO: write to Firestore (/picks). For now:
    console.log("pick", { row, choice, uid: user.uid });
  };

  const Card = ({ r }: { r: CardRow }) => (
    <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-5 shadow-lg backdrop-blur-sm flex flex-col">
      <div className="text-orange-400 font-semibold tracking-wide uppercase text-sm">
        {r.match}
      </div>
      <div className="text-xs text-gray-400 mb-3">
        {formatStart(r.startTime)} • {r.venue}
      </div>

      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-4 flex-1 flex flex-col">
        <div className="text-[11px] text-gray-300 font-semibold mb-1">Q{r.quarter}</div>
        <div className="text-white font-bold text-[15px] leading-snug mb-4">
          {r.question}
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => handlePick(r, "yes")}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white"
            >
              Yes
            </button>
            <button
              onClick={() => handlePick(r, "no")}
              className="px-3 py-1.5 rounded-md text-sm font-semibold bg-purple-500 hover:bg-purple-600 text-white"
            >
              No
            </button>
          </div>

          <Link
            href="/picks"
            className="text-sm text-gray-300 hover:text-white"
          >
            See other picks →
          </Link>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          Yes {r.yesPercent}% • No {r.noPercent}%
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative w-full h-[62vh] md:h-[64vh]">
        {/* background image fills width; object-[center_90%] keeps the grass + goals + sky in view */}
        <Image
          src="/mcg-hero.jpg"
          alt="MCG at twilight"
          fill
          priority
          className="object-cover object-[center_85%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-16 md:pt-20">
          <h1 className="max-w-3xl text-4xl md:text-6xl font-extrabold leading-tight text-white">
            Real <span className="text-orange-500">Streakr&apos;s</span> don&apos;t get caught.
          </h1>
          <p className="mt-3 text-gray-300 max-w-2xl">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 font-semibold"
            >
              Sign up / Log in
            </Link>
            <Link
              href="/picks"
              className="rounded-xl bg-gray-800/70 hover:bg-gray-800 text-white px-4 py-2 font-semibold border border-white/10"
            >
              View Picks
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsor banner under hero */}
      <section className="max-w-6xl mx-auto px-2 -mt-4 md:-mt-5">
        <div className="rounded-2xl border border-white/10 bg-gray-900/70 p-6 text-center text-gray-300">
          Sponsor banner • 970×90
        </div>
      </section>

      {/* OPEN PICKS GRID */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
          Open Selections
        </h2>

        {loading ? (
          <div className="text-gray-400">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="text-gray-400">No open selections right now. Check back soon.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.id} r={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
