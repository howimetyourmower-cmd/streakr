// app/picks/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, Timestamp } from "firebase/firestore";
import { app } from "../config/firebaseClient";

type Question = {
  quarter: number;
  question: string;
  status?: "OPEN" | "PENDING" | "FINAL";
  yesPct?: number;
  noPct?: number;
  startTime?: any;
  venue?: string;
};

type Game = {
  match: string;
  startTime?: any;
  date?: string;
  time?: string;
  tz?: string;
  venue?: string;
  questions: Question[];
};

type RoundDoc = { games: Game[] };

const CURRENT_ROUND = 1;

function isFsTimestamp(v: any): v is Timestamp {
  return v && typeof v.seconds === "number";
}

function pretty(v: any): string | null {
  if (!v) return null;
  if (isFsTimestamp(v)) {
    const d = new Date(v.seconds * 1000);
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(d);
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      }).format(d);
    }
    return v.replace(" at ", " · ").replace("UTC", "UTC");
  }
  return null;
}

export default function PicksPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>("");

  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUserUid(u ? u.uid : null));
  }, [auth]);

  useEffect(() => {
    const tries = [
      ["rounds", `round-${CURRENT_ROUND}`], // /rounds/round-1
      ["rounds", `Round-${CURRENT_ROUND}`], // /rounds/Round-1
      [null, `round-${CURRENT_ROUND}`],     // /round-1
      [null, `Round-${CURRENT_ROUND}`],     // /Round-1
    ] as const;

    (async () => {
      const tried: string[] = [];
      try {
        for (const [col, id] of tries) {
          const path = col ? `${col}/${id}` : id;
          tried.push(path);
          const ref = col ? doc(db, col, id) : doc(db, id);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as RoundDoc;
            setGames(data?.games ?? []);
            setDebugMsg(
              `Loaded from: ${path} · projectId: ${app.options.projectId}`
            );
            setLoading(false);
            return;
          }
        }
        setGames([]);
        setDebugMsg(
          `Not found. Tried: ${tried.join(
            " | "
          )} · projectId: ${app.options.projectId}`
        );
      } catch (e: any) {
        setGames([]);
        setDebugMsg(
          `Read failed (${app.options.projectId}): ${e?.message ?? e}`
        );
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  function onPick(game: Game, q: Question, value: "YES" | "NO") {
    if (!userUid) {
      router.push("/auth");
      return;
    }
    // TODO: save the pick
    console.log("Pick", { game: game.match, quarter: q.quarter, value });
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-6">
          Make Picks
        </h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!games || games.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          Make Picks
        </h1>
        <p className="mb-2">No questions found for Round {CURRENT_ROUND}.</p>
        <p className="text-xs text-white/50">{debugMsg}</p>
        <div className="mt-6 text-sm text-white/60">
          <Link href="/" className="underline hover:text-white">
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">Make Picks</h1>
      <p className="text-xs text-white/50 mb-6">{debugMsg}</p>

      <div className="space-y-6">
        {games.map((game, gi) => {
          const firstQ = game.questions?.[0];
          const when =
            pretty(game.startTime) ?? pretty(firstQ?.startTime) ?? "TBD";
          const venue = game.venue ?? firstQ?.venue;

          return (
            <section
              key={`${game.match}-${gi}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6"
            >
              <div className="mb-1 text-xl md:text-2xl font-bold text-orange-400 uppercase tracking-wide">
                {game.match}
              </div>
              <div className="mb-4 text-sm text-white/70">
                {when}
                {venue ? ` · ${venue}` : ""}
              </div>

              <div className="space-y-3">
                {game.questions.map((q, qi) => {
                  const status = q.status ?? "OPEN";
                  const yesPct = q.yesPct ?? 0;
                  const noPct = q.noPct ?? 0;

                  return (
                    <div
                      key={`${gi}-${qi}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                            Q{q.quarter}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                              status === "FINAL"
                                ? "bg-purple-500/20 text-purple-300"
                                : status === "PENDING"
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-green-500/20 text-green-300"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="hidden md:flex items-center gap-2">
                          <button
                            onClick={() => onPick(game, q, "YES")}
                            className="rounded-md bg-green-600 hover:bg-green-500 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => onPick(game, q, "NO")}
                            className="rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white"
                          >
                            No
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-base md:text-lg font-semibold leading-snug">
                        {q.question}
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs md:text-sm text-white/70">
                          Yes {yesPct}% · No {noPct}%
                        </div>
                        <div className="md:hidden flex items-center gap-2">
                          <button
                            onClick={() => onPick(game, q, "YES")}
                            className="rounded-md bg-green-600 hover:bg-green-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => onPick(game, q, "NO")}
                            className="rounded-md bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 text-sm text-white/60">
        <Link href="/" className="underline hover:text-white">
          ← Back to Home
        </Link>
      </div>
    </main>
  );
}
