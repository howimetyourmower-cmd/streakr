"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

import dayjsBase from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";

dayjsBase.extend(utc);
dayjsBase.extend(tz);
const dayjs = dayjsBase;
const LOCAL_TZ = "Australia/Melbourne";

// ---------- minimal types (loose to avoid TS build failures) ----------
type Question = { quarter: number; question: string };
type GameInRound = { match: string; questions: Question[] };
type RoundDoc = { round: number; games: GameInRound[] };
type FixtureDoc = {
  match?: string;
  startTime?: Timestamp | string | Date | null;
  venue?: string;
  status?: "open" | "pending" | "final" | "void";
};

// ---------- helpers ----------
function formatStart(raw: Timestamp | string | Date | null | undefined) {
  if (!raw) return "TBD";
  // Firestore Timestamp
  // @ts-ignore
  if (raw?.toDate) raw = (raw as Timestamp).toDate();
  if (typeof raw === "string") {
    const d =
      dayjs.tz(raw, ["ddd, D MMM YYYY, h:mm A", "YYYY-MM-DDTHH:mm:ssZ"], LOCAL_TZ);
    return d.isValid() ? d.tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z") : "TBD";
  }
  if (raw instanceof Date) {
    return dayjs(raw).tz(LOCAL_TZ).format("ddd, D MMM • h:mm A z");
  }
  return "TBD";
}

function deriveStatus(fix?: FixtureDoc | null) {
  return (fix?.status ?? "open").toUpperCase();
}

function splitMatch(match: string) {
  // "Richmond vs Carlton" -> ["Richmond", "Carlton"]
  const parts = match.split(/vs|v/gi).map((s) => s.trim());
  return parts.length >= 2 ? [parts[0], parts[1]] : [match, ""];
}

// ---------- main client component ----------
export default function PicksClient() {
  const [rows, setRows] = useState<
    {
      startLabel: string;
      status: string;
      match: string;
      venue: string;
      qNum: string;
      question: string;
      matchLinkHref: string;
    }[]
  >([]);

  useEffect(() => {
    const load = async () => {
      try {
        // 1) Load the round doc: /rounds/round-1  (your structure)
        const roundRef = doc(collection(db, "rounds"), "round-1");
        const roundSnap = await getDoc(roundRef);
        if (!roundSnap.exists()) {
          setRows([]);
          return;
        }

        const round = roundSnap.data() as RoundDoc;
        const games: GameInRound[] = round.games || [];

        // 2) For each game, try to look up a matching fixture in /fixtures
        //    We’ll do a simple fetch-all to avoid Firestore query gymnastics
        const fixturesSnap = await getDocs(collection(db, "fixtures"));
        const fixtures: FixtureDoc[] = fixturesSnap.docs.map((d) => d.data() as FixtureDoc);

        const builtRows: any[] = [];

        games.forEach((game) => {
          const [home, away] = splitMatch(game.match);
          const matchKey = `${home} vs ${away}`.toLowerCase();

          // find fixture by normalized "teamA vs teamB" or exact match field
          const fix =
            fixtures.find((f) => (f.match || "").toLowerCase() === matchKey) ||
            fixtures.find((f) => (f.match || "").toLowerCase() === game.match.toLowerCase()) ||
            null;

          const startLabel = formatStart(fix?.startTime ?? null);
          const venue = fix?.venue ?? "—";
          const status = deriveStatus(fix);

          (game.questions || []).forEach((q, idx) => {
            builtRows.push({
              startLabel,
              status,
              match: game.match,
              venue,
              qNum: `Q${q.quarter || idx + 1}`,
              question: q.question,
              matchLinkHref: `/picks?match=${encodeURIComponent(game.match)}`,
            });
          });
        });

        setRows(builtRows);
      } catch (e) {
        console.error("Error loading picks:", e);
        setRows([]);
      }
    };

    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold text-white mb-6">Make Picks</h1>

      <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
        <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          <div className="col-span-2">Start</div>
          <div className="col-span-4">Match · Venue</div>
          <div className="col-span-1 text-center">Q#</div>
          <div className="col-span-5">Question</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-6 text-slate-300">No questions found.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map((r, i) => (
              <li
                key={`${r.match}-${r.qNum}-${i}`}
                className="grid grid-cols-12 items-center px-6 py-4 hover:bg-white/[0.03]"
              >
                <div className="col-span-2 flex items-center gap-3">
                  <span className="text-slate-200">{r.startLabel}</span>
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      r.status === "OPEN"
                        ? "bg-emerald-900/60 text-emerald-300"
                        : r.status === "PENDING"
                        ? "bg-amber-900/60 text-amber-300"
                        : r.status === "FINAL"
                        ? "bg-indigo-900/60 text-indigo-300"
                        : "bg-red-900/60 text-red-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="col-span-4">
                  <Link
                    href={r.matchLinkHref}
                    className="text-amber-300 font-semibold hover:underline"
                  >
                    {r.match}
                  </Link>
                  <div className="text-slate-400 text-sm">{r.venue}</div>
                </div>

                <div className="col-span-1 text-center">
                  <span className="inline-flex items-center justify-center rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">
                    {r.qNum}
                  </span>
                </div>

                <div className="col-span-5">
                  <div className="font-semibold text-white">{r.question}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 text-right">
        <Link
          href="/picks?view=final"
          className="text-sm text-slate-300 hover:text-white underline"
        >
          View settled (final/void) selections →
        </Link>
      </div>
    </div>
  );
}
