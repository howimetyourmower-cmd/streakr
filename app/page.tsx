"use client";

import React, { useEffect, useMemo, useState } from "react";
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

// Day.js setup
import dayjsBase from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsBase.extend(customParseFormat);
dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

/* ----------------------------- Types ----------------------------- */
type Question = { quarter: number; question: string; yesPercent?: number; noPercent?: number };
type Game = {
  match: string;
  venue?: string;
  startTime?: Timestamp | string | Date | null;
  status?: "open" | "pending" | "final" | "void";
  questions: Question[];
};
type RoundDoc = { games: Game[] };
type Fixture = { match: string; venue?: string; startTime?: Timestamp | string | Date | null; status?: string };
type FixturesDoc = { fixtures?: Fixture[] };

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

/* ------------------------ Helpers (dates) ------------------------ */
function normMatch(s: string) {
  return (s || "").trim().toLowerCase();
}
function toDate(raw: CardRow["startTime"]): Date | null {
  if (!raw) return null;
  // Firestore Timestamp
  if (typeof (raw as any)?.toDate === "function") {
    try { return (raw as Timestamp).toDate(); } catch {}
  }
  // Native
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  // Strings
  if (typeof raw === "string") {
    // ISO
    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;

    // Our seeded “Thu, 19 Mar 7.20pm AEDT” and variants
    const formats = [
      "ddd, D MMM h.mm a [AEDT]",
      "ddd, D MMM h.mm a",
      "ddd, D MMM YYYY, h.mm a [AEDT]",
      "ddd, D MMM YYYY, h.mm a",
      "dddd, D MMMM h.mm a [AEDT]",
      "dddd, D MMMM h.mm a",
    ];
    for (const f of formats) {
      const d = dayjs(raw, f, true);
      if (d.isValid()) return d.toDate();
    }
  }
  return null;
}
function formatStart(raw: CardRow["startTime"]) {
  const d = toDate(raw);
  if (!d) return "TBD";
  const dd = dayjs(d).tz(LOCAL_TZ);
  // exactly “Thu, 19 Mar 7.20pm AEDT”
  return `${dd.format("ddd, D MMM")} ${dd.format("h.mm")}${dd.format("a")} AEDT`;
}

/* ------------------------------ Page ----------------------------- */
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter] = useState<"open" | "pending" | "final" | "void">("open");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        // 1) rounds
        const roundsSnap = await getDocs(collection(db, "rounds"));

        // 2) fixtures (optional but used to fill start/venue)
        const fixturesSnap = await getDocs(collection(db, "fixtures"));
        const fixtureMap = new Map<string, Fixture>();
        fixturesSnap.forEach((doc) => {
          const fd = doc.data() as FixturesDoc | DocumentData;
          const arr = Array.isArray(fd?.fixtures) ? fd.fixtures : [];
          arr.forEach((fx) => {
            if (fx?.match) fixtureMap.set(normMatch(fx.match), fx);
          });
        });

        const all: CardRow[] = [];
        roundsSnap.forEach((doc) => {
          const roundId = doc.id;
          const data = doc.data() as RoundDoc | DocumentData;
          const games: Game[] = Array.isArray(data?.games) ? data.games : [];
          games.forEach((g, gi) => {
            const qs = Array.isArray(g.questions) ? g.questions : [];
            const fx = fixtureMap.get(normMatch(g.match || "")); // << use fixtures if present
            const startTime = g.startTime ?? fx?.startTime ?? null;
            const venue = g.venue ?? fx?.venue ?? "TBD";
            const status = ((g.status ?? fx?.status ?? "open") as CardRow["status"]).toLowerCase() as CardRow["status"];

            qs.forEach((q, qi) => {
              all.push({
                id: `${roundId}-${gi}-${qi}`,
                roundId,
                match: g.match ?? fx?.match ?? "TBD",
                venue,
                quarter: Number(q.quarter ?? 1),
                question: q.question ?? "",
                yesPercent: Number(q.yesPercent ?? 0),
                noPercent: Number(q.noPercent ?? 0),
                startTime,
                status,
              });
            });
          });
        });

        const filtered = all
          .filter((r) => r.status === statusFilter)
          .sort((a, b) => {
            const ta = toDate(a.startTime)?.getTime() ?? 0;
            const tb = toDate(b.startTime)?.getTime() ?? 0;
            if (ta !== tb) return ta - tb;
            return a.quarter - b.quarter;
          })
          .slice(0, 6); // 3x2 grid

        setCards(filtered);
      } catch (e) {
        console.error("home fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  const handlePick = (row: CardRow, choice: "yes" | "no") => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    // TODO: write to /picks. For now, navigate to picks page
    window.location.href = "/picks";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      {/* HERO */}
      <section className="relative mt-4 mb-6 rounded-3xl overflow-hidden">
        <Image
          src="/mcg-hero.jpg"
          alt="MCG under lights"
          width={1920}
          height={800}
          priority
          className="h-[340px] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/50" />
        <div className="absolute inset-0 p-8 flex flex-col justify-center">
          <h1 className="text-white text-4xl md:text-6xl font-extrabold max-w-3xl leading-tight drop-shadow">
            Real <span className="text-orange-400">Streakr’s</span> don’t get caught.
          </h1>
          <p className="mt-3 text-white/90 max-w-2xl">
            Free-to-play AFL prediction streaks. Build your streak, top the leaderboard, win prizes.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600"
            >
              Sign up / Log in
            </Link>
            <Link
              href="/picks"
              className="rounded-xl bg-white/10 px-4 py-2 font-semibold text-white hover:bg-white/20"
            >
              View Picks
            </Link>
          </div>

          {/* SPONSOR BANNER (restored) */}
          <div className="mt-6 w-full">
            <div className="mx-auto w-full max-w-[970px] h-[90px] rounded-xl border border-white/15 bg-white/10 backdrop-blur text-white/80 flex items-center justify-center text-sm">
              Sponsor Banner • 970×90
            </div>
          </div>
        </div>
      </section>

      <h2 className="text-2xl font-bold text-white mb-3">Round 1 Open Picks</h2>

      {loading ? (
        <div className="text-white/80">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="text-white/70">No open selections right now.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((c) => (
            <article key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-bold text-orange-300 tracking-wide">{c.match}</h3>
              <p className="text-white/80 text-sm">{formatStart(c.startTime)} • {c.venue}</p>

              <div className="mt-4">
                <span className="mr-2 inline-flex h-6 w-10 items-center justify-center rounded-md bg-white/10 text-xs text-white/80">
                  Q{c.quarter}
                </span>
                <span className="font-semibold text-white">{c.question}</span>
              </div>

              {/* Yes / No buttons (on home as well) */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => handlePick(c, "yes")}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Yes
                </button>
                <button
                  onClick={() => handlePick(c, "no")}
                  className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
                >
                  No
                </button>

                <Link
                  href="/picks"
                  className="ml-auto text-sm text-white/80 hover:text-white underline underline-offset-4"
                >
                  See other picks →
                </Link>
              </div>

              <div className="mt-3 text-sm text-white/70">
                Yes {c.yesPercent}% · No {c.noPercent}%
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
