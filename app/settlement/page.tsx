// app/settlement/page.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  MouseEvent,
} from "react";
import { ROUND_OPTIONS } from "@/lib/rounds";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  isSponsorQuestion?: boolean;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  correctOutcome?: QuestionOutcome;
};

type ApiGame = {
  id: string;
  match: string;
  sport: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
};

type StatusFilter = "all" | "open" | "pending" | "final" | "void";
type RoundKey = (typeof ROUND_OPTIONS)[number]["key"];

function formatStartTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettlementPage() {
  // Which round (by key from ROUND_OPTIONS)
  const [roundKey, setRoundKey] = useState<RoundKey>(ROUND_OPTIONS[0].key);
  // Questions / games for that round
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Which status filter tab
  const [filter, setFilter] = useState<StatusFilter>("all");

  // Which button is currently saving "roundNumber|questionId|action"
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // roundNumber used by /api/picks & /api/settlement
  const roundNumber = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found?.roundNumber ?? 0;
  }, [roundKey]);

  const roundLabel = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found?.label ?? "Round";
  }, [roundKey]);

  // Load questions via /api/picks for the selected round
  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("round", String(roundNumber));

      const res = await fetch(`/api/picks?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load picks (status ${res.status})`);
      }

      const data: PicksApiResponse = await res.json();
      setGames(data.games ?? []);
    } catch (err: any) {
      console.error("[Settlement] loadQuestions error", err);
      setError(
        err?.message || "Failed to load questions. Please try again later."
      );
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [roundNumber]);

  // Initial + whenever roundNumber changes
  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Send settlement action to /api/settlement
  const sendAction = useCallback(
    async (
      questionId: string,
      action:
        | "lock"
        | "reopen"
        | "final_yes"
        | "final_no"
        | "final_void"
        | "void"
    ) => {
      const key = `${roundNumber}|${questionId}|${action}`;
      setSavingKey(key);

      try {
        const res = await fetch("/api/settlement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roundNumber,
            questionId,
            action, // 👈 always send explicit action
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          console.error("[Settlement] API error", res.status, json);
          alert(json?.error || "Failed to update question status.");
          return;
        }

        // Reload from /api/picks so status & correctOutcome are fresh
        await loadQuestions();
      } catch (err) {
        console.error("[Settlement] sendAction error", err);
        alert("Something went wrong. Please try again.");
      } finally {
        setSavingKey(null);
      }
    },
    [roundNumber, loadQuestions]
  );

  const onChangeRound = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoundKey(e.target.value as RoundKey);
  };

  const handleActionClick =
    (
      q: ApiQuestion,
      action:
        | "lock"
        | "reopen"
        | "final_yes"
        | "final_no"
        | "final_void"
        | "void"
    ) =>
    (ev: MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault();
      // small safety net so you don't double click while saving
      if (savingKey) return;
      sendAction(q.id, action);
    };

  const filteredGames = useMemo(() => {
    if (filter === "all") return games;

    return games
      .map((g) => ({
        ...g,
        questions: g.questions.filter((q) => q.status === filter),
      }))
      .filter((g) => g.questions.length > 0);
  }, [games, filter]);

  const isSaving = (q: ApiQuestion, action: string) =>
    savingKey === `${roundNumber}|${q.id}|${action}`;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement console
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Use this page to lock questions when the game is live and then
              mark them as YES / NO / VOID once the stats are confirmed. The
              picks page reads from <code>/api/picks</code> and this endpoint,
              and streaks are recalculated from here.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Current round
            </span>
            <select
              value={roundKey}
              onChange={onChangeRound}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Helper strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 text-xs md:text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              {roundLabel}
            </span>
            <span className="text-white/80">
              Uses <code>/api/picks</code> for data and{" "}
              <code>/api/settlement</code> for updates.{" "}
              <span className="font-semibold">Reopen</span> is a safety net if
              you lock or settle the wrong question.
            </span>
          </div>
          <div className="text-white/60">
            Lock → question becomes{" "}
            <span className="font-semibold text-amber-300">PENDING</span>. YES /
            NO / VOID →{" "}
            <span className="font-semibold text-sky-300">FINAL</span> (or{" "}
            <span className="font-semibold text-slate-200">VOID</span>) and
            streaks are recalculated.
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(["all", "open", "pending", "final", "void"] as StatusFilter[]).map(
            (key) => {
              const label =
                key === "all"
                  ? "All"
                  : key === "open"
                  ? "Open"
                  : key === "pending"
                  ? "Pending"
                  : key === "final"
                  ? "Final"
                  : "Void";
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition ${
                    active
                      ? "bg-orange-500 text-black border-orange-300"
                      : "bg-black/50 text-white/80 border-white/25 hover:bg-black/80"
                  }`}
                >
                  {label}
                </button>
              );
            }
          )}
        </div>

        {/* Main table */}
        <section className="rounded-2xl bg-black/80 border border-white/12 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)]">
          {/* Header row */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wide text-white/60 bg-black/80">
            <div className="flex items-center gap-6">
              <span className="w-10 text-left">Qtr</span>
              <span>Question</span>
            </div>
            <div className="flex items-center gap-6">
              <span>Status</span>
              <span className="hidden md:inline">Set outcome</span>
            </div>
          </div>

          {loading && (
            <div className="px-4 py-6 text-sm text-white/70">
              Loading questions…
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-6 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && filteredGames.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/70">
              No questions match this filter.
            </div>
          )}

          {!loading && !error && filteredGames.length > 0 && (
            <div className="divide-y divide-white/8">
              {filteredGames.map((game) => (
                <div key={game.id} className="bg-slate-950/80">
                  {/* Game header */}
                  <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-1 md:flex-row md:items-center md:justify-between text-xs md:text-sm">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 border border-white/20">
                        {game.sport}
                      </span>
                      <div>
                        <div className="font-semibold text-white">
                          {game.match}
                        </div>
                        <div className="text-white/60">
                          {game.venue} • {formatStartTime(game.startTime)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  {game.questions.map((q) => {
                    const isOpen = q.status === "open";
                    const isPending = q.status === "pending";
                    const isFinal = q.status === "final";
                    const isVoid = q.status === "void";

                    let statusColour =
                      "bg-slate-700 text-white border border-slate-500";
                    if (isOpen)
                      statusColour =
                        "bg-emerald-600/80 text-white border border-emerald-500/80";
                    if (isPending)
                      statusColour =
                        "bg-amber-500/90 text-black border border-amber-300";
                    if (isFinal)
                      statusColour =
                        "bg-sky-600/90 text-white border border-sky-400";
                    if (isVoid)
                      statusColour =
                        "bg-slate-500/90 text-white border border-slate-300";

                    return (
                      <div
                        key={q.id}
                        className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-black/40"
                      >
                        {/* Left: quarter + question + tags */}
                        <div className="flex-1 flex gap-3">
                          <div className="w-10 mt-0.5">
                            <span className="inline-flex items-center justify-center rounded-full bg-white/8 border border-white/20 text-[11px] font-semibold px-2 py-1">
                              Q{q.quarter}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm md:text-base font-semibold text-white">
                              {q.question}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {q.isSponsorQuestion && (
                                <span className="inline-flex items-center rounded-full bg-sky-500/20 px-3 py-1 font-semibold text-sky-300 border border-sky-500/60">
                                  Streak Pick
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${statusColour}`}
                              >
                                {q.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: outcome buttons */}
                        <div className="mt-1 md:mt-0 flex flex-col items-end gap-2 min-w-[230px] text-[11px]">
                          <div className="flex flex-wrap gap-2">
                            {/* YES */}
                            <button
                              type="button"
                              onClick={handleActionClick(q, "final_yes")}
                              disabled={isVoid || isFinal || isSaving(q, "final_yes")}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                                isFinal && q.correctOutcome === "yes"
                                  ? "bg-emerald-500 text-black border-emerald-300"
                                  : "bg-emerald-600/40 text-emerald-100 border-emerald-400/70 hover:bg-emerald-600/70"
                              } ${
                                isSaving(q, "final_yes")
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                            >
                              YES
                            </button>
                            {/* NO */}
                            <button
                              type="button"
                              onClick={handleActionClick(q, "final_no")}
                              disabled={isVoid || isFinal || isSaving(q, "final_no")}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                                isFinal && q.correctOutcome === "no"
                                  ? "bg-red-500 text-black border-red-300"
                                  : "bg-red-600/40 text-red-100 border-red-400/70 hover:bg-red-600/70"
                              } ${
                                isSaving(q, "final_no")
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                            >
                              NO
                            </button>
                            {/* VOID */}
                            <button
                              type="button"
                              onClick={handleActionClick(q, "final_void")}
                              disabled={isVoid || isSaving(q, "final_void")}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                                isVoid
                                  ? "bg-slate-400 text-black border-slate-200"
                                  : "bg-slate-600/40 text-slate-100 border-slate-400/70 hover:bg-slate-600/70"
                              } ${
                                isSaving(q, "final_void")
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                            >
                              VOID
                            </button>
                            {/* LOCK */}
                            <button
                              type="button"
                              onClick={handleActionClick(q, "lock")}
                              disabled={isPending || isFinal || isVoid || isSaving(q, "lock")}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                                isPending
                                  ? "bg-amber-400 text-black border-amber-200"
                                  : "bg-amber-500/40 text-amber-100 border-amber-300/70 hover:bg-amber-500/70"
                              } ${
                                isSaving(q, "lock")
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                            >
                              LOCK
                            </button>
                            {/* REOPEN */}
                            <button
                              type="button"
                              onClick={handleActionClick(q, "reopen")}
                              disabled={isOpen || isSaving(q, "reopen")}
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                                isOpen
                                  ? "bg-slate-500/40 text-slate-200 border-slate-300"
                                  : "bg-slate-700/60 text-slate-100 border-slate-400/70 hover:bg-slate-700"
                              } ${
                                isSaving(q, "reopen")
                                  ? "opacity-50 cursor-wait"
                                  : ""
                              }`}
                            >
                              REOPEN
                            </button>
                          </div>
                          <div className="text-[11px] text-white/60">
                            Saving updates will briefly highlight buttons and
                            then refresh this table from <code>/api/picks</code>.
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
