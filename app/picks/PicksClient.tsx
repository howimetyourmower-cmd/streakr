"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO
  questions: ApiQuestion[];
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
};

type PicksApiResponse = {
  games: ApiGame[];
};

const CURRENT_SEASON = 2026;
const CURRENT_ROUND_LABEL = "Round 1";

type FilterTab = "open" | "final" | "pending" | "void" | "all";

export default function PicksClient() {
  const { user } = useAuth();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // streak pick state – only ONE question can be active
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeOutcome, setActiveOutcome] = useState<"yes" | "no" | null>(null);

  // filter tabs
  const [filter, setFilter] = useState<FilterTab>("open");

  // modal for unauthenticated users
  const [showAuthModal, setShowAuthModal] = useState(false);

  // ---- LOAD QUESTIONS FROM API ----
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("Failed to load picks");

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
          }))
        );

        // sort by start time then quarter
        flat.sort((a, b) => {
          const da = new Date(a.startTime).getTime();
          const db = new Date(b.startTime).getTime();
          if (da !== db) return da - db;
          return a.quarter - b.quarter;
        });

        setQuestions(flat);
      } catch (err) {
        console.error(err);
        setError("Failed to load picks. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---- FILTERED QUESTIONS ----
  const filteredQuestions = useMemo(() => {
    if (filter === "all") return questions;
    return questions.filter((q) => q.status === filter);
  }, [questions, filter]);

  // ---- HANDLE PICK CLICK ----
  const handlePick = (questionId: string, outcome: "yes" | "no") => {
    // not logged in – show modal
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // set this as the only active streak question
    setActiveQuestionId(questionId);
    setActiveOutcome(outcome);
  };

  // helper to show Yes/No %
  const getPercentages = (questionId: string) => {
    if (questionId !== activeQuestionId || !activeOutcome) {
      return { yes: 0, no: 0 };
    }
    return activeOutcome === "yes"
      ? { yes: 100, no: 0 }
      : { yes: 0, no: 100 };
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "shortGeneric",
    });
  };

  return (
    <div className="py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Picks</h1>
          <p className="mt-1 text-sm text-white/70 max-w-2xl">
            One streak pick at a time. Choose carefully, lock it in before
            bounce, and ride your streak to the top of the ladder.
          </p>
        </div>
        <div className="text-right text-xs md:text-sm text-white/70">
          <div className="font-semibold">
            AFL Season {CURRENT_SEASON} •{" "}
            <span className="text-orange-400">Current Round: {CURRENT_ROUND_LABEL}</span>
          </div>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="inline-flex rounded-full bg-black/40 border border-white/10 p-1 text-xs mb-2">
        {(["open", "final", "pending", "void", "all"] as FilterTab[]).map(
          (tab) => {
            const label =
              tab === "all"
                ? "ALL"
                : tab === "open"
                ? "OPEN"
                : tab === "final"
                ? "FINAL"
                : tab === "pending"
                ? "PENDING"
                : "VOID";
            const active = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-full font-semibold transition ${
                  active
                    ? "bg-orange-500 text-black"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[0.7fr,3fr,2.2fr] text-xs text-white/60 px-2">
        <div className="">Q#</div>
        <div>Question</div>
        <div className="text-right">Pick • Yes% • No%</div>
      </div>

      {/* Content */}
      {loading && (
        <p className="text-sm text-white/70">Loading picks…</p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!loading && !error && filteredQuestions.length === 0 && (
        <p className="text-sm text-white/70">
          No questions in this status right now. Try another filter or check
          back later.
        </p>
      )}

      {!loading && !error && filteredQuestions.length > 0 && (
        <div className="space-y-3">
          {filteredQuestions.map((q) => {
            const isActive = q.id === activeQuestionId;
            const { yes, no } = getPercentages(q.id);

            return (
              <div
                key={q.id}
                className="rounded-2xl bg-gradient-to-r from-orange-900/60 via-orange-800/60 to-orange-700/60 border border-orange-500/40 shadow-md px-3 md:px-4 py-3 md:py-4"
              >
                <div className="grid md:grid-cols-[0.7fr,3fr,2.2fr] gap-3 items-center">
                  {/* Q / streak pill */}
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-sm font-semibold">
                      Q{q.quarter}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center justify-center rounded-full bg-sky-500 text-black text-[11px] font-semibold px-2 py-1">
                        Your streak pick
                      </span>
                    )}
                  </div>

                  {/* Question copy */}
                  <div>
                    <div className="text-xs text-white/70 mb-1">
                      {q.match} • {q.venue}
                    </div>
                    <div className="text-sm md:text-base font-semibold text-white mb-1">
                      {q.question}
                    </div>
                    <div className="text-[11px] text-white/60">
                      Starts: {formatDateTime(q.startTime)}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-[11px] underline underline-offset-2 text-white/70 hover:text-white"
                    >
                      Comments (0)
                    </button>
                  </div>

                  {/* Pick + percentages */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => handlePick(q.id, "yes")}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition border ${
                          isActive && activeOutcome === "yes"
                            ? "bg-sky-500 text-black border-sky-400"
                            : "bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePick(q.id, "no")}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition border ${
                          isActive && activeOutcome === "no"
                            ? "bg-sky-500 text-black border-sky-400"
                            : "bg-rose-500 text-black border-rose-400 hover:bg-rose-400"
                        }`}
                      >
                        No
                      </button>
                    </div>
                    <div className="text-[11px] text-white/80">
                      Yes: {yes}% • No: {no}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auth modal for guest users */}
      {showAuthModal && !user && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-sm w-full mx-4 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Log in to play</h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-white/60 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-white/70 mb-5">
              You need a free STREAKr account to make picks, build your streak
              and appear on the leaderboard.
            </p>
            <div className="flex gap-3">
              <Link
                href="/auth?mode=login"
                className="flex-1 text-center bg-orange-500 hover:bg-orange-600 text-black font-semibold py-2 rounded-full text-sm"
              >
                Login
              </Link>
              <Link
                href="/auth?mode=signup"
                className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-full text-sm border border-white/20"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
