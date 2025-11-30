// /app/admin/settlement/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport?: string;
  isSponsorQuestion?: boolean;
  correctOutcome?: QuestionOutcome;
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
  roundNumber: number;
};

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

type Row = {
  id: string;
  roundNumber: number;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  correctOutcome?: QuestionOutcome;
  isSponsorQuestion?: boolean;
};

const statusClass = (status: QuestionStatus) => {
  switch (status) {
    case "open":
      return "bg-green-600";
    case "pending":
      return "bg-yellow-500";
    case "final":
      return "bg-slate-600";
    case "void":
      return "bg-red-600";
    default:
      return "bg-slate-600";
  }
};

export default function SettlementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // roundNumber is numeric (0 = Opening Round)
  const [roundNumber, setRoundNumber] = useState<number>(() => {
    const p = searchParams?.get("round");
    const n = p ? Number(p) : NaN;
    return Number.isNaN(n) ? 0 : n;
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string>("");

  // For the header dropdown label
  const roundLabel = useMemo(() => {
    const match = ROUND_OPTIONS.find((r) => r.roundNumber === roundNumber);
    return match ? match.label : "Round";
  }, [roundNumber]);

  // Keep URL in sync with selected round
  useEffect(() => {
    const params = new URLSearchParams(searchParams ?? undefined);
    params.set("round", String(roundNumber));
    router.replace(`/admin/settlement?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  // Load picks for this round
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/picks?round=${roundNumber}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data: PicksApiResponse = await res.json();

        const flat: Row[] = data.games.flatMap((g) =>
          g.questions.map((q) => ({
            id: q.id,
            roundNumber: data.roundNumber,
            gameId: g.id,
            match: g.match,
            venue: g.venue,
            startTime: g.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
            correctOutcome: q.correctOutcome,
            isSponsorQuestion: !!q.isSponsorQuestion,
          }))
        );

        setRows(flat);
      } catch (err) {
        console.error("[Settlement] load error", err);
        setError("Failed to load questions for this round.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [roundNumber]);

  const formatStart = (iso: string) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
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

  const handleRoundChange = (value: string) => {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      setRoundNumber(num);
    }
  };

  const applyLocalAction = (
    rowId: string,
    action: SettlementAction
  ): { status: QuestionStatus; correctOutcome?: QuestionOutcome } => {
    switch (action) {
      case "lock":
        return { status: "pending" };
      case "reopen":
        return { status: "open" };
      case "final_yes":
        return { status: "final", correctOutcome: "yes" };
      case "final_no":
        return { status: "final", correctOutcome: "no" };
      case "final_void":
      case "void":
        return { status: "void", correctOutcome: "void" };
      default:
        return { status: "open" };
    }
  };

  const handleAction = async (row: Row, action: SettlementAction) => {
    setSaveError("");
    setSavingId(row.id);

    try {
      const res = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNumber,
          questionId: row.id,
          action,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Settlement error:", text);
        throw new Error("Failed to update question. See console for details.");
      }

      // Apply optimistic local update so the admin can see the change instantly
      const patch = applyLocalAction(row.id, action);

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: patch.status, correctOutcome: patch.correctOutcome }
            : r
        )
      );
    } catch (err: any) {
      console.error("[Settlement] handleAction error", err);
      setSaveError(err?.message || "Failed to update question.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Settlement
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl">
              Lock questions, settle outcomes and reopen if needed. Reopen is a
              safety net if you lock or settle the wrong question.
            </p>
          </div>

          {/* Round selector */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-white/60">
              Round
            </span>
            <select
              value={roundNumber}
              onChange={(e) => handleRoundChange(e.target.value)}
              className="rounded-full bg-black border border-white/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
            >
              {ROUND_OPTIONS.map((r) => (
                <option key={r.key} value={r.roundNumber}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Meta strip */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-black via-slate-900/70 to-black px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs md:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
              AFL Season {CURRENT_SEASON}
            </span>
            <span className="text-white/80">
              Updating settlement for{" "}
              <span className="font-semibold text-white">{roundLabel}</span>
            </span>
          </div>
          <div className="text-white/60">
            Set the correct outcome once play has finished. Final results will
            update player streaks automatically.
          </div>
        </div>

        {/* Sponsor helper strip */}
        <div className="rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-500/40 px-4 py-3 text-xs sm:text-sm text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="uppercase tracking-wide text-[11px] font-semibold text-amber-300">
            Sponsor Question
          </span>
          <span className="text-[12px] sm:text-[13px]">
            If a question is tagged as the{" "}
            <span className="font-semibold">Sponsor Question</span>, its
            outcome drives the $100 gift card draw for this round.
          </span>
        </div>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
        {saveError && (
          <p className="text-sm text-red-400">
            {saveError}
          </p>
        )}

        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[1.2fr_3fr_0.6fr_2.2fr] text-xs text-white/70 px-4 pb-2">
          <div>START</div>
          <div>QUESTION</div>
          <div className="text-center">STATUS</div>
          <div className="text-center">SET OUTCOME</div>
        </div>

        {loading && (
          <p className="text-sm text-white/70">
            Loading questions…
          </p>
        )}

        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-white/70">
            No questions found for this round.
          </p>
        )}

        {/* Rows */}
        {!loading && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) => {
              const { date, time } = formatStart(row.startTime);
              const isSaving = savingId === row.id;
              const isSponsor = !!row.isSponsorQuestion;

              return (
                <div
                  key={row.id}
                  className="rounded-lg bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.7)] px-4 py-3 text-sm flex flex-col lg:grid lg:grid-cols-[1.2fr_3fr_0.6fr_2.2fr] gap-3 lg:items-center"
                >
                  {/* Start */}
                  <div>
                    <div className="font-semibold">
                      {date || "—"}
                    </div>
                    <div className="text-[11px] text-white/80">
                      {time ? `${time} AEDT` : ""}
                    </div>
                    <div className="text-[11px] text-white/60 mt-1">
                      {row.match}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {row.venue}
                    </div>
                    <div className="mt-1 text-[11px] text-white/60">
                      Q{row.quarter}
                    </div>
                  </div>

                  {/* Question + sponsor badge */}
                  <div>
                    <p className="font-medium leading-snug">
                      {row.question}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {isSponsor && (
                        <span className="inline-flex items-center rounded-full bg-amber-400 text-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          Sponsor Question
                        </span>
                      )}
                      {row.status === "pending" && (
                        <span className="inline-flex items-center rounded-full bg-sky-500/90 text-black px-2 py-0.5 text-[10px] font-semibold">
                          Locked – awaiting result
                        </span>
                      )}
                      {row.status === "final" && row.correctOutcome && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/90 text-black px-2 py-0.5 text-[10px] font-semibold">
                          Final outcome: {row.correctOutcome.toUpperCase()}
                        </span>
                      )}
                      {row.status === "void" && (
                        <span className="inline-flex items-center rounded-full bg-slate-500 text-black px-2 py-0.5 text-[10px] font-semibold">
                          Void – excluded from streaks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status pill */}
                  <div className="flex lg:justify-center">
                    <span
                      className={`${statusClass(
                        row.status
                      )} inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase`}
                    >
                      {row.status}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap justify-start lg:justify-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving || row.status === "final"}
                      onClick={() => handleAction(row, "lock")}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        row.status === "pending"
                          ? "bg-yellow-400 text-black"
                          : "bg-yellow-500/80 text-black hover:bg-yellow-400"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      LOCK
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAction(row, "reopen")}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      REOPEN
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAction(row, "final_yes")}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAction(row, "final_no")}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      NO
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAction(row, "final_void")}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500 hover:bg-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      VOID
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
