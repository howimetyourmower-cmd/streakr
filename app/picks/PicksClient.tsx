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
