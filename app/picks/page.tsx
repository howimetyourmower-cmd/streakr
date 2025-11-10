// app/picks/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// -------------------- Types --------------------
type Question = {
  quarter: number;
  question: string;
  status?: "open" | "pending" | "final" | "void";
  yesCount?: number;
  noCount?: number;
};

type Game = {
  match: string;              // e.g. "Richmond vs Carlton"
  venue?: string;             // e.g. "MCG, Melbourne"
  startTime?: any;            // Firestore Timestamp | ISO string | Date
  questions: Question[];
};

type RoundDoc = {
  games: Game[];
};

// -------------------- Config --------------------
const CURRENT_ROUND = 1;             // change when you move rounds
const ROUND_DOC_ID = `round-${CURRENT_ROUND}`;

// -------------------- Helpers --------------------
function toDate(value: any): Date | null {
  if (!value) return null;
  // Firestore Timestamp (v9)
  if (typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate();
    if ("seconds" in value && typeof value.seconds === "number")
      return new Date(value.seconds * 1000);
  }
  // ISO string or epoch ms or Date
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const d = new Date(value as any);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatStartTime(value: any): string {
  const d = toDate(value);
  if (!d) return "TBD";
  // AU-friendly short format, uses embedded offset if ISO string had it
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function computeStatus(q?: Question, start?: any): Question["status"] {
  if (q?.status === "final" || q?.status === "void" || q?.status === "pending") return q.status;
  // default: open if start time in future
  const d = toDate(start);
  if (!d) return "open"; // treat unknown date as open so it’s visible
  return Date.now() < d.getTime() ? "open" : "pending";
}

function pct(yes?: number, no?: number): { yes: number; no: number } {
  const y = yes ?? 0;
  const n = no ?? 0;
  const t = y + n;
  if (t === 0) return { yes: 0, no: 0 };
  return {
    yes: Math.round((y / t) * 100),
    no: Math.round((n / t) * 100),
  };
}

// -------------------- Page --------------------
export default function PicksPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<RoundDoc | null>(null);

  // auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // live round doc
  useEffect(() => {
    const ref = doc(collection(db, "rounds"), ROUND_DOC_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setRound((snap.exists() ? (snap.data() as RoundDoc) : null));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const rows = useMemo(() => {
    if (!round?.games) return [];
    const out: Array<{
      gameIndex: number;
      qIndex: number;
      startLabel: string;
      match: string;
      venue: string;
      qNum: string;
      text: string;
      status: Question["status"];
      yesPct: number;
      noPct: number;
    }> = [];

    round.games.forEach((g, gi) => {
      const venue = g.venue ?? "";
      const startLabel = formatStartTime(g.startTime);
      g.questions?.forEach((q, qi) => {
        const stat = computeStatus(q, g.startTime);
        const { yes, no } = pct(q.yesCount, q.noCount);
        out.push({
          gameIndex: gi,
          qIndex: qi,
          startLabel,
          match: g.match,
          venue,
          qNum: `Q${q.quarter}`,
          text: q.question,
          status: stat,
          yesPct: yes,
          noPct: no,
        });
      });
    });

    // sort by start time asc (unknown/TBD last), then quarter
    return out.sort((a, b) => {
      const da = toDate(round!.games[a.gameIndex].startTime)?.getTime() ?? Infinity;
      const dbt = toDate(round!.games[b.gameIndex].startTime)?.getTime() ?? Infinity;
      if (da !== dbt) return da - dbt;
      return a.qIndex - b.qIndex;
    });
  }, [round]);

  const handlePick = async (
    gameIndex: number,
    qIndex: number,
    choice: "yes" | "no"
  ) => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      // minimal, safe write location (adjust later to your schema)
      const pickId = `r${CURRENT_ROUND}_g${gameIndex}_q${qIndex}`;
      await setDoc(
        doc(collection(db, "users", user.uid, "picks"), pickId),
        {
          round: CURRENT_ROUND,
          gameIndex,
          questionIndex: qIndex,
          choice,
          madeAt: serverTimestamp(),
        },
        { merge: true }
      );
      // optional: toast / visual feedback
      // eslint-disable-next-line no-alert
      alert(`Pick saved: ${choice.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      // eslint-disable-next-line no-alert
      alert("Sorry—couldn’t save your pick.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight text-white mb-6">
        Make Picks
      </h1>

      {loading && <div className="text-slate-300">Loading…</div>}
      {!loading && !round && (
        <div className="text-slate-300">No questions found for Round {CURRENT_ROUND}.</div>
      )}

      {!loading && round && (
        <div className="rounded-2xl bg-slate-800/60 ring-1 ring-slate-700 overflow-hidden">
          {/* header row */}
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 bg-slate-900/60">
            <div className="col-span-2">Start</div>
            <div className="col-span-3">Match · Venue</div>
            <div className="col-span-1">Q#</div>
            <div className="col-span-4">Question</div>
            <div className="col-span-1 text-right">Yes %</div>
            <div className="col-span-1 text-right">No %</div>
          </div>

          {/* rows */}
          <div className="divide-y divide-slate-700">
            {rows.map((r) => {
              const isOpen = r.status === "open";
              const game = round.games[r.gameIndex];
              return (
                <div
                  key={`${r.gameIndex}-${r.qIndex}`}
                  className="grid grid-cols-12 items-center px-5 py-4 hover:bg-slate-800/70"
                >
                  <div className="col-span-2 text-slate-300">
                    <div className="text-sm">{r.startLabel}</div>
                    <div
                      className={
                        "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (r.status === "open"
                          ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40"
                          : r.status === "pending"
                          ? "bg-amber-600/20 text-amber-300 ring-1 ring-amber-500/40"
                          : r.status === "final"
                          ? "bg-sky-600/20 text-sky-300 ring-1 ring-sky-500/40"
                          : "bg-rose-700/20 text-rose-300 ring-1 ring-rose-500/40")
                      }
                    >
                      {r.status?.toUpperCase()}
                    </div>
                  </div>

                  <div className="col-span-3">
                    <Link
                      href="#"
                      className="text-orange-400 font-semibold hover:underline"
                    >
                      {r.match}
                    </Link>
                    <div className="text-xs text-slate-400">{game?.venue ?? r.venue}</div>
                  </div>

                  <div className="col-span-1">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-700 text-slate-200 text-xs font-bold">
                      {r.qNum}
                    </span>
                  </div>

                  <div className="col-span-4 text-slate-100 text-sm">
                    {r.text}
                    {/* action buttons */}
                    <div className="mt-3 flex gap-2">
                      <button
                        disabled={!isOpen}
                        onClick={() => handlePick(r.gameIndex, r.qIndex, "yes")}
                        className={
                          "rounded-md px-3 py-1 text-sm font-semibold ring-1 transition " +
                          (isOpen
                            ? "bg-orange-500/90 hover:bg-orange-500 ring-orange-400 text-white"
                            : "bg-slate-700 text-slate-400 ring-slate-600 cursor-not-allowed")
                        }
                      >
                        Yes
                      </button>
                      <button
                        disabled={!isOpen}
                        onClick={() => handlePick(r.gameIndex, r.qIndex, "no")}
                        className={
                          "rounded-md px-3 py-1 text-sm font-semibold ring-1 transition " +
                          (isOpen
                            ? "bg-purple-500/90 hover:bg-purple-500 ring-purple-400 text-white"
                            : "bg-slate-700 text-slate-400 ring-slate-600 cursor-not-allowed")
                        }
                      >
                        No
                      </button>
                      <Link
                        href={`/picks/game/${r.gameIndex}`}
                        className="ml-auto text-sm text-slate-300 hover:text-slate-100"
                      >
                        See other picks →
                      </Link>
                    </div>
                  </div>

                  <div className="col-span-1 text-right text-slate-200 font-semibold">
                    {r.yesPct}%
                  </div>
                  <div className="col-span-1 text-right text-slate-200 font-semibold">
                    {r.noPct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* link to finals/closed picks if you later want it */}
      <div className="mt-6 text-sm text-slate-300">
        Looking for finished questions?{" "}
        <Link href="/picks/final" className="text-orange-400 hover:underline">
          View finalised selections
        </Link>
      </div>
    </div>
  );
}
