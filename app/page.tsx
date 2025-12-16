// /app/picks/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Confetti from "react-confetti";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
} from "firebase/firestore";

/* -------------------- Types -------------------- */

type SportKey = "AFL" | "BBL";
type QuestionStatus = "open" | "pending" | "final" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  isSponsorQuestion?: boolean;
  correctOutcome?: "yes" | "no" | "void" | null;
  outcome?: "yes" | "no" | "void" | null;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  sport: SportKey;
  isSponsorQuestion?: boolean;
  correctOutcome?: "yes" | "no" | "void" | null;
};

type PickHistory = Record<string, "yes" | "no">;

/* -------------------- Helpers -------------------- */

const PICK_HISTORY_KEY = "streakr_pick_history_v2";

const normaliseOutcome = (val: any): "yes" | "no" | "void" | null => {
  if (!val) return null;
  const s = String(val).toLowerCase();
  if (["yes", "y", "correct"].includes(s)) return "yes";
  if (["no", "n", "wrong"].includes(s)) return "no";
  if (["void", "cancelled"].includes(s)) return "void";
  return null;
};

const formatStart = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }),
    time: d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

/* -------------------- Component -------------------- */

export default function PicksPage() {
  const { user } = useAuth();
  const params = useSearchParams();

  const sport = (params.get("sport") ?? "AFL") as SportKey;
  const docId = params.get("docId") ?? null;

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pickHistory, setPickHistory] = useState<PickHistory>({});
  const pickHistoryRef = useRef<PickHistory>({});

  const [userCurrentStreak, setUserCurrentStreak] = useState<number>(0);
  const [leaderCurrentStreak, setLeaderCurrentStreak] = useState<number>(0);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  /* -------------------- URL validation -------------------- */

  useEffect(() => {
    if (sport === "BBL" && !docId) {
      setError("BBL match not selected. Please return to the BBL hub.");
      setLoading(false);
    }
  }, [sport, docId]);

  /* -------------------- Load pick history -------------------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PICK_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setPickHistory(parsed);
        pickHistoryRef.current = parsed;
      }
    } catch {}
  }, []);

  /* -------------------- Fetch picks -------------------- */

  const fetchPicks = async () => {
    setLoading(true);
    setError("");

    try {
      const url =
        sport === "BBL"
          ? `/api/picks?sport=BBL&docId=${encodeURIComponent(docId!)}`
          : `/api/picks`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("API error");

      const data: PicksApiResponse = await res.json();

      const flat: QuestionRow[] = data.games.flatMap((g) =>
        g.questions.map((q) => ({
          id: q.id,
          gameId: g.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          userPick: pickHistoryRef.current[q.id],
          yesPercent: q.yesPercent,
          noPercent: q.noPercent,
          sport,
          isSponsorQuestion: q.isSponsorQuestion,
          correctOutcome:
            q.status === "final" || q.status === "void"
              ? normaliseOutcome(q.correctOutcome ?? q.outcome)
              : null,
        }))
      );

      setRows(flat);
    } catch (e) {
      setError("Failed to load picks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, [sport, docId]);

  useEffect(() => {
    const id = setInterval(fetchPicks, 15000);
    return () => clearInterval(id);
  }, [sport, docId]);

  /* -------------------- Streak listeners -------------------- */

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("currentStreak", "desc"), limit(1));
    return onSnapshot(q, (snap) => {
      snap.forEach((d) => setLeaderCurrentStreak(d.data().currentStreak ?? 0));
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    return onSnapshot(ref, (snap) => {
      setUserCurrentStreak(snap.data()?.currentStreak ?? 0);
    });
  }, [user]);

  /* -------------------- Window size (confetti) -------------------- */

  useEffect(() => {
    const resize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* -------------------- Pick handler -------------------- */

  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (row.status !== "open") return;

    const next = { ...pickHistory, [row.id]: pick };
    setPickHistory(next);
    pickHistoryRef.current = next;
    localStorage.setItem(PICK_HISTORY_KEY, JSON.stringify(next));

    try {
      const token = await user.getIdToken();
      await fetch("/api/user-picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: row.id,
          outcome: pick,
          sport,
          docId: sport === "BBL" ? docId : undefined,
        }),
      });
    } catch {}
  };

  /* -------------------- Render -------------------- */

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href={sport === "BBL" ? "/play/bbl" : "/play/afl"} className="text-orange-400 underline">
          Back to {sport} hub
        </Link>
      </div>
    );
  }

  return (
    <>
      {showConfetti && (
        <Confetti width={windowSize.width} height={windowSize.height} recycle={false} />
      )}

      <div className="max-w-7xl mx-auto p-4 text-white">
        <h1 className="text-3xl font-bold mb-2">Picks</h1>
        <p className="text-sm text-white/70 mb-6">
          {sport === "AFL"
            ? "AFL clean sweep scoring – survive each match."
            : "BBL clean sweep scoring – all picks in a match must land."}
        </p>

        {loading && <p>Loading…</p>}

        <div className="space-y-3">
          {rows.map((row) => {
            const { date, time } = formatStart(row.startTime);
            const effectivePick = pickHistory[row.id];
            const outcome = row.correctOutcome;

            let outcomeLabel: string | null = null;
            let outcomeClass = "";

            if (row.status === "void") {
              outcomeLabel = "Question voided – no streak change";
              outcomeClass = "bg-slate-700";
            } else if (row.status === "final" && effectivePick && outcome) {
              outcomeLabel =
                effectivePick === outcome ? "Correct pick" : "Wrong pick";
              outcomeClass =
                effectivePick === outcome ? "bg-emerald-600" : "bg-red-600";
            }

            return (
              <div key={row.id} className="rounded-xl bg-[#020617] border border-slate-800 p-4">
                <div className="flex justify-between mb-2 text-xs text-white/60">
                  <span>
                    {date} • {time}
                  </span>
                  <span>{row.match}</span>
                </div>

                <p className="font-semibold mb-3">{row.question}</p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePick(row, "yes")}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                      effectivePick === "yes"
                        ? "bg-sky-400 text-black"
                        : "bg-green-600"
                    }`}
                  >
                    Yes
                  </button>

                  <button
                    onClick={() => handlePick(row, "no")}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                      effectivePick === "no"
                        ? "bg-sky-400 text-black"
                        : "bg-red-600"
                    }`}
                  >
                    No
                  </button>

                  {outcomeLabel && (
                    <span
                      className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${outcomeClass}`}
                    >
                      {outcomeLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-[#050816] p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Log in to play</h2>
            <p className="text-sm text-white/70 mb-4">
              You need an account to make picks and build a streak.
            </p>
            <div className="flex gap-3">
              <Link
                href={`/auth?mode=login&returnTo=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.pathname + window.location.search : "/picks"
                )}`}
                className="flex-1 bg-orange-500 text-black rounded-full px-4 py-2 text-center font-semibold"
              >
                Login
              </Link>
              <Link
                href={`/auth?mode=signup&returnTo=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.pathname + window.location.search : "/picks"
                )}`}
                className="flex-1 border border-white/20 rounded-full px-4 py-2 text-center"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
