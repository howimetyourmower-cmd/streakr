"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { CURRENT_SEASON, ROUND_OPTIONS, type RoundKey } from "@/lib/rounds";

type QuestionStatus = "open" | "final" | "pending" | "void";
type Outcome = "yes" | "no" | "void" | null;

type SettlementQuestionRow = {
  id: string;
  status: QuestionStatus;
  outcome: Outcome;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
};

type RoundMeta = {
  id: string;
  roundKey: RoundKey;
  roundNumber: number;
  label: string;
  questionCount: number;
  published: boolean;
};

const ADMIN_EMAIL_FALLBACK = "howimetyourmower@gmail.com"; // <-- change if needed

export default function SettlementPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin =
    !!user &&
    (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
      user.email === ADMIN_EMAIL_FALLBACK);

  const [rounds, setRounds] = useState<RoundMeta[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SettlementQuestionRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | "all">(
    "open"
  );
  const [pageLoading, setPageLoading] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // ---------- Helpers ----------

  async function loadQuestionsForRound(roundDocId: string) {
    setPageLoading(true);
    try {
      const roundRef = doc(db, "rounds", roundDocId);
      const snap = await getDoc(roundRef);

      if (!snap.exists()) {
        setQuestions([]);
        return;
      }

      const data = snap.data() as any;

      const games = (data.games || []) as any[];

      const flat: SettlementQuestionRow[] = games.flatMap((g) =>
        (g.questions || []).map((q: any) => ({
          id: q.id as string,
          status: (q.status ?? "open") as QuestionStatus,
          outcome:
            (q.outcome as Outcome | undefined | null) === undefined
              ? null
              : (q.outcome as Outcome),
          gameId: g.id as string,
          match: (g.match ?? "") as string,
          venue: (g.venue ?? "") as string,
          startTime: (g.startTime ?? "") as string,
          quarter: (q.quarter ?? 1) as number,
          question: (q.question ?? "") as string,
        }))
      );

      // Sort by start time, then game, then quarter
      flat.sort((a, b) => {
        if (a.startTime < b.startTime) return -1;
        if (a.startTime > b.startTime) return 1;
        if (a.match < b.match) return -1;
        if (a.match > b.match) return 1;
        return a.quarter - b.quarter;
      });

      setQuestions(flat);
    } finally {
      setPageLoading(false);
    }
  }

  async function initialiseRoundsAndSelection() {
    setPageLoading(true);
    try {
      const roundsSnap = await getDocs(collection(db, "rounds"));
      const all: RoundMeta[] = [];

      roundsSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.season !== CURRENT_SEASON) return;

        const games = (data.games || []) as any[];
        const questionCount = games.reduce(
          (sum, g) => sum + ((g.questions || []).length as number),
          0
        );

        all.push({
          id: docSnap.id,
          roundKey: (data.roundKey ?? "OR") as RoundKey,
          roundNumber: (data.roundNumber ?? 0) as number,
          label: (data.label ?? docSnap.id) as string,
          questionCount,
          published: !!data.published,
        });
      });

      all.sort((a, b) => a.roundNumber - b.roundNumber);
      setRounds(all);

      // Try to read current round from config
      let initialId: string | null = null;
      try {
        const cfgRef = doc(db, "config", `season-${CURRENT_SEASON}`);
        const cfgSnap = await getDoc(cfgRef);
        if (cfgSnap.exists()) {
          const cfg = cfgSnap.data() as any;
          const key = cfg.currentRoundKey as RoundKey | undefined;
          const match = key
            ? all.find((r) => r.roundKey === key)
            : undefined;
          if (match) initialId = match.id;
        }
      } catch {
        // If config missing, just fall back
      }

      if (!initialId && all.length > 0) {
        initialId = all[0].id;
      }

      if (initialId) {
        setSelectedRoundId(initialId);
        await loadQuestionsForRound(initialId);
      } else {
        setQuestions([]);
      }
    } finally {
      setPageLoading(false);
    }
  }

  async function handleSelectRound(newId: string) {
    setSelectedRoundId(newId);
    await loadQuestionsForRound(newId);
  }

  async function callSettlementAPI(
    questionId: string,
    action: "lock" | "settle-yes" | "settle-no" | "settle-void"
  ) {
    const res = await fetch("/api/settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, action }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Settlement API error");
    }
  }

  async function handleSingleAction(
    q: SettlementQuestionRow,
    action: "lock" | "settle-yes" | "settle-no" | "settle-void"
  ) {
    if (!selectedRoundId) return;

    const labels: Record<typeof action, string> = {
      lock: "Lock this question?",
      "settle-yes": "Settle this question as YES?",
      "settle-no": "Settle this question as NO?",
      "settle-void": "VOID this question?",
    };

    if (!window.confirm(labels[action])) return;

    setRowBusyId(q.id);
    try {
      await callSettlementAPI(q.id, action);
      await loadQuestionsForRound(selectedRoundId);
    } catch (err) {
      console.error(err);
      alert("Error updating question. Check console / logs for details.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleBulkAction(
    action: "lock" | "settle-yes" | "settle-no" | "settle-void"
  ) {
    if (!selectedRoundId) return;

    const openQuestions = questions.filter((q) => q.status === "open");
    if (openQuestions.length === 0) {
      alert("There are no OPEN questions to update in this round.");
      return;
    }

    const labelMap: Record<typeof action, string> = {
      lock: "Lock ALL open questions in this round?",
      "settle-yes":
        "Settle ALL open questions in this round as YES? This cannot be undone.",
      "settle-no":
        "Settle ALL open questions in this round as NO? This cannot be undone.",
      "settle-void":
        "VOID ALL open questions in this round? This cannot be undone.",
    };

    if (!window.confirm(labelMap[action])) return;

    setBulkBusy(true);
    try {
      // Simple sequential loop – 60 questions is fine
      for (const q of openQuestions) {
        await callSettlementAPI(q.id, action);
      }
      await loadQuestionsForRound(selectedRoundId);
    } catch (err) {
      console.error(err);
      alert(
        "Error performing bulk action. Some questions may have been updated; check Firestore and logs."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  // ---------- Derived state ----------

  const filteredQuestions = useMemo(() => {
    if (filterStatus === "all") return questions;
    return questions.filter((q) => q.status === filterStatus);
  }, [questions, filterStatus]);

  const matrix = useMemo(() => {
    const base = {
      open: 0,
      pending: 0,
      final: 0,
      voidStatus: 0,
      yes: 0,
      no: 0,
      voidOutcome: 0,
    };

    for (const q of questions) {
      base[q.status === "void" ? "voidStatus" : q.status]++;

      if (q.status === "final") {
        if (q.outcome === "yes") base.yes++;
        else if (q.outcome === "no") base.no++;
        else base.voidOutcome++;
      }
    }

    return base;
  }, [questions]);

  const selectedRoundMeta = rounds.find((r) => r.id === selectedRoundId);

  // ---------- Effects ----------

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) return;
    void initialiseRoundsAndSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin]);

  // ---------- Render ----------

  if (authLoading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-slate-200">
        <p>Checking admin access…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 text-slate-200">
        <h1 className="text-2xl font-semibold mb-4">Settlement console</h1>
        <p className="text-sm text-slate-400">
          You must be an admin to access this page.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 text-slate-100 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Settlement console</h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Internal tool to lock and settle STREAKr questions. This calls
          <span className="font-mono"> /api/settlement </span>
          and updates picks and question status. Use carefully.
        </p>
      </header>

      {/* Round selector + matrix + bulk controls */}
      <section className="grid gap-4 md:grid-cols-[2.1fr,1.3fr]">
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Round
              </div>
              <select
                value={selectedRoundId ?? ""}
                onChange={(e) => handleSelectRound(e.target.value)}
                className="bg-slate-950/70 border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.questionCount} qns)
                    {!r.published ? " • Draft" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoundMeta && (
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  Season {CURRENT_SEASON} • Round key{" "}
                  <span className="font-mono">{selectedRoundMeta.roundKey}</span>
                </div>
                <div>
                  {selectedRoundMeta.published ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-700/40 text-green-200 text-[11px] uppercase tracking-wide">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-200 text-[11px] uppercase tracking-wide">
                      Draft only
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${
                  filterStatus === "all"
                    ? "bg-slate-100 text-slate-900 border-slate-100"
                    : "bg-slate-900 text-slate-200 border-slate-700"
                }`}
                onClick={() => setFilterStatus("all")}
              >
                All ({questions.length})
              </button>
              {(["open", "pending", "final", "void"] as const).map((s) => (
                <button
                  key={s}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${
                    filterStatus === s
                      ? "bg-slate-100 text-slate-900 border-slate-100"
                      : "bg-slate-900 text-slate-200 border-slate-700"
                  }`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s.toUpperCase()} (
                  {questions.filter((q) => q.status === s).length})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-400 mr-1">Bulk:</span>
              <button
                disabled={bulkBusy || pageLoading}
                onClick={() => handleBulkAction("lock")}
                className="px-3 py-1 rounded-full bg-amber-500 text-slate-900 font-semibold disabled:opacity-60"
              >
                Lock all OPEN
              </button>
              <button
                disabled={bulkBusy || pageLoading}
                onClick={() => handleBulkAction("settle-yes")}
                className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 font-semibold disabled:opacity-60"
              >
                YES all OPEN
              </button>
              <button
                disabled={bulkBusy || pageLoading}
                onClick={() => handleBulkAction("settle-no")}
                className="px-3 py-1 rounded-full bg-rose-500 text-slate-50 font-semibold disabled:opacity-60"
              >
                NO all OPEN
              </button>
              <button
                disabled={bulkBusy || pageLoading}
                onClick={() => handleBulkAction("settle-void")}
                className="px-3 py-1 rounded-full bg-slate-600 text-slate-50 font-semibold disabled:opacity-60"
              >
                VOID all OPEN
              </button>
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 p-4 grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Status matrix
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Open / Pending
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {matrix.open + matrix.pending}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Open: {matrix.open} • Pending: {matrix.pending}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Final / Void
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {matrix.final + matrix.voidStatus}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Final: {matrix.final} • Void: {matrix.voidStatus}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Final breakdown
            </div>
            <div className="mt-1 text-sm">
              <span className="text-emerald-300 font-semibold">
                YES {matrix.yes}
              </span>
              <span className="mx-2 text-slate-500">|</span>
              <span className="text-rose-300 font-semibold">
                NO {matrix.no}
              </span>
              <span className="mx-2 text-slate-500">|</span>
              <span className="text-slate-200">
                VOID {matrix.voidOutcome}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              Total questions
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {questions.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              In selected round
            </div>
          </div>
        </div>
      </section>

      {/* Questions list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-slate-100">
              {filteredQuestions.length}
            </span>{" "}
            question{filteredQuestions.length === 1 ? "" : "s"} (
            {filterStatus === "all" ? "all statuses" : filterStatus})
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/70 border border-slate-700/70 overflow-hidden">
          <div className="grid grid-cols-[1.3fr,2.3fr,1.4fr] gap-2 px-4 py-2 text-[11px] font-semibold tracking-wide uppercase text-slate-400 border-b border-slate-800/80">
            <div>Game / Qtr / Status</div>
            <div>Question</div>
            <div className="text-right">Lock / Settle</div>
          </div>

          {pageLoading ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              Loading questions…
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              No questions match this filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="grid grid-cols-[1.3fr,2.3fr,1.4fr] gap-2 px-4 py-3 text-sm"
                >
                  {/* Left: game + status */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">
                      {q.match || "—"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {q.startTime || "TBC"} • Q{q.quarter} •{" "}
                      {q.venue || "Venue TBC"}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold uppercase ${
                          q.status === "open"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : q.status === "pending"
                            ? "bg-amber-500/10 text-amber-300 border border-amber-500/40"
                            : q.status === "final"
                            ? "bg-sky-500/10 text-sky-300 border border-sky-500/40"
                            : "bg-slate-600/40 text-slate-100 border border-slate-500/60"
                        }`}
                      >
                        {q.status.toUpperCase()}
                      </span>

                      {q.status === "final" && (
                        <span className="text-[11px] text-slate-300">
                          Outcome:{" "}
                          <span className="font-semibold">
                            {q.outcome === "yes"
                              ? "YES"
                              : q.outcome === "no"
                              ? "NO"
                              : "VOID"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: question text */}
                  <div className="flex items-center">
                    <p className="text-sm leading-snug">{q.question}</p>
                  </div>

                  {/* Right: controls */}
                  <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                    <button
                      disabled={rowBusyId === q.id || bulkBusy}
                      onClick={() => handleSingleAction(q, "lock")}
                      className="px-3 py-1 rounded-full bg-amber-500 text-slate-900 font-semibold disabled:opacity-60"
                    >
                      Lock
                    </button>
                    <button
                      disabled={rowBusyId === q.id || bulkBusy}
                      onClick={() => handleSingleAction(q, "settle-yes")}
                      className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 font-semibold disabled:opacity-60"
                    >
                      Settle YES
                    </button>
                    <button
                      disabled={rowBusyId === q.id || bulkBusy}
                      onClick={() => handleSingleAction(q, "settle-no")}
                      className="px-3 py-1 rounded-full bg-rose-500 text-slate-50 font-semibold disabled:opacity-60"
                    >
                      Settle NO
                    </button>
                    <button
                      disabled={rowBusyId === q.id || bulkBusy}
                      onClick={() => handleSingleAction(q, "settle-void")}
                      className="px-3 py-1 rounded-full bg-slate-600 text-slate-50 font-semibold disabled:opacity-60"
                    >
                      Void
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
