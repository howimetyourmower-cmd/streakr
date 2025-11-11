"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { db, auth } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

import dayjsBase from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsBase.extend(customParseFormat);
dayjsBase.extend(utc);
dayjsBase.extend(tz);

const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

/** ---------- Types ---------- */
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

/** ---------- Robust startTime parsing ---------- */
const toDate = (raw: CardRow["startTime"]): Date | null => {
  if (!raw) return null;

  // Firestore Timestamp
  if (typeof (raw as any)?.toDate === "function") {
    try {
      return (raw as Timestamp).toDate();
    } catch {
      /* ignore and continue */
    }
  }

  // Native Date
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

  // String formats we accept
  if (typeof raw === "string") {
    // Try ISO first
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;

    // Handle “Thu, 19 Mar 7.20pm AEDT” and close variants
    const formats = [
      "ddd, D MMM h.mm a [AEDT]",
      "ddd, D MMM h.mm a",              // without AEDT literal
      "ddd, D MMM YYYY, h.mm a [AEDT]", // with year
      "ddd, D MMM YYYY, h.mm a",
      "dddd, D MMMM h.mm a [AEDT]",
      "dddd, D MMMM h.mm a",
    ];
    for (const fmt of formats) {
      const d = dayjs(raw, fmt, true);
      if (d.isValid()) return d.toDate();
    }
  }

  return null;
};

const formatStart = (raw: CardRow["startTime"]) => {
  const d = toDate(raw);
  if (!d) return "TBD";

  // Force to Melbourne time, render exactly “Thu, 19 Mar 7.20pm AEDT”
  const dd = dayjs(d).tz(LOCAL_TZ);
  const datePart = dd.format("ddd, D MMM");
  const timePart = dd.format("h.mm");   // “7.20”
  const ampm = dd.format("a");          // “pm” (lowercase)
  return `${datePart} ${timePart}${ampm} AEDT`;
};

/** ---------- Page ---------- */
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
            const qs = Array.isArray(g.questions) ? g.questions : [];
            qs.forEach((q, qi) => {
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
                status:
                  (String(g.status || "open").toLowerCase() as CardRow["status"]) ||
                  "open",
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-black/40 to-black/20 p-8 mb-8">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG under lights"
          width={1600}
          height={900}
          className="absolute inset-0 h-full w-full object-cover -z-10 opacity-60"
          priority
        />
        <h1 className="text-4xl md:text-6xl font-extrabold text-white max-w-3xl drop-shadow">
          Real <span className="text-orange-400">Streakr’s</span> don’t get caught!
        </h1>
        <p className="mt-4 text-white/90 max-w-2xl">
          Free-to-play AFL prediction streaks. Build your streak, top the
          leaderboard, win prizes.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
          >
            Sign up / Log in
          </Link>
          <Link
            href="/picks"
            className="rounded-lg bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
          >
            View Picks
          </Link>
        </div>
      </section>

      {/* Open selections grid */}
      <h2 className="text-2xl font-bold text-white mb-4">Round 1 Open Picks</h2>

      {loading ? (
        <div className="text-white/80">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="text-white/70">No open selections right now.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {cards.map((c) => (
            <article
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
            >
              <h3 className="text-sm font-bold text-orange-300 tracking-wide">
                {c.match}
              </h3>
              <p className="text-white/80 text-sm">
                {formatStart(c.startTime)} • {c.venue}
              </p>

              <div className="mt-4">
                <span className="mr-2 inline-flex h-6 w-10 items-center justify-center rounded-md bg-white/10 text-xs text-white/80">
                  Q{c.quarter}
                </span>
                <span className="font-semibold text-white">
                  {c.question}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Link
                  href="/picks"
                  className="text-sm text-white/80 hover:text-white underline underline-offset-4"
                >
                  Make a pick →
                </Link>
                <div className="text-sm text-white/70">
                  Yes {c.yesPercent}% · No {c.noPercent}%
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
