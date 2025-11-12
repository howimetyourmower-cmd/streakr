"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

// ---------------- Types ----------------
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

// ---------------- Time helpers ----------------
const toDate = (v: CardRow["startTime"]): Date | null => {
  if (!v) return null;
  if (typeof (v as any)?.toDate === "function") {
    try {
      return (v as Timestamp).toDate();
    } catch {}
  }
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso;
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
  if (!d) return "TBD •";
  return `${dayjs(d).format("ddd, D MMM")} • ${dayjs(d).format("h:mm A")} AEDT`;
};

// ---------------- Page ----------------
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
    // TODO: write pick to Firestore
    console.log("pick", { row, choice, uid: user.uid });
  };

  return (
    <main className="relative">
      {/* ---------- HERO (full image visible + seamless blend) ---------- */}
      <section className="relative w-full overflow-hidden">
        {/* Backdrop colour to match image edges (seamless) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1b2a] via-[#0b1b2a] to-transparent pointer-events-none" />
        <div className="relative w-full h-[72vh] md:h-[86vh]">
          <Image
            src="/mcg-hero.jpg"
            alt="MCG Stadium"
            fill
            className="object-contain"
            priority
          />
          {/* readability gradient over image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
          {/* Headline + CTAs */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-white text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
              Real <span className="text-orange-500">Streakr’s</span> don’t get
              caught.
            </h1>
            <p className="text-white/90 max-w-2xl text-lg md:text-xl mb-8">
              Free-to-play AFL prediction streaks. Build your streak, top the
              leaderboard, win prizes.
            </p>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="bg-orange-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-orange-400"
              >
                Sign up / Log in
              </Link>
              <Link
                href="/picks"
                className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20"
              >
                View Picks
              </Link>
            </div>
          </div>
        </div>

        {/* Sponsor Banner BELOW image */}
        <div className="bg-white/5 border border-white/10 text-center py-4 text-white text-sm">
          Sponsor Banner • 970×90
        </div>
      </section>

      {/* ---------- OPEN SELECTIONS (3×2 grid) ---------- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-10 mb-20">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-6">
          Round 1 Open Picks
        </h2>

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="text-white/70">No open selections.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white"
              >
                <div className="mb-2">
                  <div className="text-orange-400 font-semibold">
                    {c.match}
                  </div>
                  <div className="text-white/70 text-sm">
                    {formatStart(c.startTime)} • {c.venue}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-white/80 mt-3 mb-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-white/10 px-2 py-0.5 text-xs">
                    Q{c.quarter}
                  </span>
                  <span className="font-semibold">{c.question}</span>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => handlePick(c, "yes")}
                    className="px-3 py-1.5 rounded-md bg-orange-500 text-black font-semibold hover:bg-orange-400"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handlePick(c, "no")}
                    className="px-3 py-1.5 rounded-md bg-white/20 text-white font-semibold hover:bg-white/30"
                  >
                    No
                  </button>
                  <div className="ml-auto text-sm text-white/70">
                    Yes {c.yesPercent}% · No {c.noPercent}%
                  </div>
                </div>

                <div className="mt-3">
                  <Link
                    href={`/picks?match=${encodeURIComponent(c.match)}`}
                    className="text-white/90 underline underline-offset-4 hover:text-white"
                  >
                    See other picks →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
