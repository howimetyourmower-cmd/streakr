// app/admin/settlement/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROUND_OPTIONS, CURRENT_SEASON } from "@/lib/rounds";

type SportKey = "AFL" | "BBL";
type QuestionStatus = "open" | "final" | "pending" | "void";

type SettlementAction =
  | "lock"
  | "reopen"
  | "final_yes"
  | "final_no"
  | "final_void"
  | "void";

type RoundKey = (typeof ROUND_OPTIONS)[number]["key"];

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  isSponsorQuestion?: boolean;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number; // ✅ optional so BBL doesn’t break
};

type QuestionRow = {
  id: string;
  gameId: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  match: string;
  venue: string;
  startTime: string;
  isSponsorQuestion?: boolean;
};

// Map ROUND_OPTIONS.key → numeric roundNumber used by /api/picks & /api/settlement
function keyToRoundNumber(key: string): number {
  if (key === "OR") return 0; // Opening Round
  if (key.startsWith("R")) {
    const num = Number(key.slice(1));
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}

function formatStart(iso: string) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };

  const date = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Melbourne",
  });

  const time = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
  });

  return { date, time };
}

export default function SettlementPage() {
  // ✅ Sport switch
  const [sport, setSport] = useState<SportKey>("AFL");

  // ✅ AFL round selector (only used when sport === "AFL")
  const [roundKey, setRoundKey] = useState<RoundKey>("OR");

  // ✅ BBL doc selector (only used when sport === "BBL")
  const [bblDocId, setBblDocId] = useState<string>("BBL-2025-12-14-SCO-VS-SIX");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "pending" | "final" | "void"
  >("all");

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk lock state
  const [bulkLocking, setBulkLocking] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<string | null>(null); // "ALL" | gameId
  const [bulkProgress, setBulkProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Derived roundNumber from key (AFL only)
  const roundNumber = useMemo(() => keyToRoundNumber(roundKey), [roundKey]);

  const roundLabel = useMemo(() => {
    const found = ROUND_OPTIONS.find((r) => r.key === roundKey);
    return found?.label ?? "Round";
  }, [roundKey]);

  const seasonLabel = useMemo(() => {
    if (sport === "BBL") return "BBL";
    return `AFL Season ${CURRENT_SEASON}`;
  }, [sport]);

  async function refreshRoundData() {
    const url =
      sport === "BBL"
        ? `/api/picks?sport=BBL&docId=${encodeURIComponent(bblDocId)}`
        : `/api/picks?round=${roundNumber}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to load picks (status ${res.status})`);
    }

    const json: PicksApiResponse = await res.json();

    const flatQuestions: QuestionRow[] = [];
    for (const game of json.games || []) {
      for (const q of game.questions || []) {
        flatQuestions.push({
          id: q.id,
          gameId: game.id,
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          match: game.match,
          venue: game.venue,
          startTime: game.startTime,
          isSponsorQuestion: q.isSponsorQuestion,
        });
      }
    }

    setQuestions(flatQuestions);
  }

  // Load questions when round changes (AFL) OR docId changes (BBL) OR sport changes
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setBulkError(null);
        await refreshRoundData();
      } catch (err: any) {
        console.error("[Settlement] load error", err);
        setError(err?.message || "Failed to load questions for settlement console.");
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport, roundNumber, bblDocId]);

  // ─────────────────────────────────────────────
  // Derived helpers
  // ─────────────────────────────────────────────
  const filteredQuestions = useMemo(() => {
    if (statusFilter === "all") return questions;
    return questions.filter((q) => q.status === statusFilter);
  }, [questions, statusFilter]);

  const openQuestionCount = useMemo(
    () => questions.filter((q) => q.status === "open").length,
    [questions]
  );

  const openQuestionCountByGame = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      if (q.status !== "open") continue;
      counts[q.gameId] = (counts[q.gameId] ?? 0) + 1;
    }
    return counts;
  }, [questions]);

  const gameMetaList = useMemo(() => {
    const map = new Map<
      string,
      { id: string; match: string; venue: string; startTime: string }
    >();

    for (const q of questions) {
      if (!map.has(q.gameId)) {
        map.set(q.gameId, {
          id: q.gameId,
          match: q.match,
          venue: q.venue,
          startTime: q.startTime,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = new Date(a.startTime).getTime();
      const tb = new Date(b.startTime).getTime();
      return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
    });
  }, [questions]);

  const filteredByGame = useMemo(() => {
    const groups: Record<string, QuestionRow[]> = {};
    for (const q of filteredQuestions) {
      if (!groups[q.gameId]) groups[q.gameId] = [];
      groups[q.gameId].push(q);
    }
    // Stable sort within game: quarter then question
    for (const gid of Object.keys(groups)) {
      groups[gid].sort((a, b) => {
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return a.question.localeCompare(b.question);
      });
    }
    return groups;
  }, [filteredQuestions]);

  // ─────────────────────────────────────────────
  // Settlement helpers
  // ─────────────────────────────────────────────
  async function postSettlement(questionId: string, action: SettlementAction) {
    // ✅ IMPORTANT:
    // - AFL uses roundNumber + questionId
    // - BBL uses sport + docId + questionId
    // Your /app/api/settlement/route.ts must support sport/docId for BBL.
    const body =
      sport === "BBL"
        ? {
            sport: "BBL",
            docId: bblDocId,
            roundNumber: 0, // safe placeholder (backend should ignore for BBL)
            questionId,
            action,
          }
        : {
            roundNumber,
            questionId,
            action,
          };

    const res = await fetch("/api/settlement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error || `Settlement API failed (status ${res.status})`;
      throw new Error(message);
    }
  }

  // ─────────────────────────────────────────────
  // Single question action
  // ─────────────────────────────────────────────
  async function handleAction(questionId: string, action: SettlementAction) {
    try {
      setSavingId(questionId);
      setError(null);

      // Optimistic local status update
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;

          let newStatus: QuestionStatus = q.status;

          switch (action) {
            case "lock":
              newStatus = "pending";
              break;
            case "reopen":
              newStatus = "open";
              break;
            case "final_yes":
            case "final_no":
              newStatus = "final";
              break;
            case "final_void":
            case "void":
              newStatus = "void";
              break;
            default:
              break;
          }

          return { ...q, status: newStatus };
        })
      );

      await postSettlement(questionId, action);

      // Hard refresh so everything is in sync
      await refreshRoundData();
    } catch (err: any) {
      console.error("[Settlement] action error", err);
      alert(err?.message || "Failed to update settlement.");
      // best-effort refresh to recover UI state
      try {
        await refreshRoundData();
      } catch {}
    } finally {
      setSavingId(null);
    }
  }

  // ─────────────────────────────────────────────
  // BULK: Lock all open questions (round or per-game)
  // ─────────────────────────────────────────────
  async function bulkLock(questionIds: string[], targetLabel: string) {
    if (!questionIds.length) return;

    setBulkError(null);
    setBulkLocking(true);
    setBulkTarget(targetLabel);
    setBulkProgress({ done: 0, total: questionIds.length });

    // Optimistic: mark them pending instantly
    const idSet = new Set(questionIds);
    setQuestions((prev) =>
      prev.map((q) => (idSet.has(q.id) ? { ...q, status: "pending" } : q))
    );

    const failures: Array<{ id: string; error: string }> = [];

    try {
      let done = 0;

      // Sequential = safer (avoids rate limits / write contention)
      for (const id of questionIds) {
        try {
          await postSettlement(id, "lock");
        } catch (e: any) {
          failures.push({ id, error: e?.message || "Unknown error" });
        } finally {
          done += 1;
          setBulkProgress({ done, total: questionIds.length });
        }
      }

      await refreshRoundData();

      if (failures.length) {
        setBulkError(
          `Locked ${questionIds.length - failures.length}/${questionIds.length}. Failed: ${
            failures.length
          }. (Refresh done — you can retry.)`
        );
      }
    } catch (err: any) {
      console.error("[Settlement] bulk lock error", err);
      setBulkError(err?.message || "Bulk lock failed. Please try again.");
      // recover UI
      try {
        await refreshRoundData();
      } catch {}
    } finally {
      setBulkLocking(false);
      setBulkTarget(null);
      setBulkProgress(null);
    }
  }

  async function lockAllOpenQuestions() {
    const ids = questions.filter((q) => q.status === "open").map((q) => q.id);
    if (!ids.length) return;

    const label =
      sport === "BBL"
        ? `BBL (${bblDocId})`
        : `${roundLabel}`;

    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Lock ALL open questions for ${label}?\n\nThis sets them to PENDING (same as clicking LOCK). You can REOPEN any question if needed.`
          );
    if (!ok) return;

    await bulkLock(ids, "ALL");
  }

  async function lockEntireGame(gameId: string, matchLabel: string) {
    const ids = questions
      .filter((q) => q.gameId === gameId && q.status === "open")
      .map((q) => q.id);

    if (!ids.length) return;

    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Lock ENTIRE GAME (all OPEN questions) for:\n${matchLabel}\n\nThis sets them to PENDING. You can REOPEN any question if needed.`
          );
    if (!ok) return;

    await bulkLock(ids, gameId);
  }

  function statusBadge(status: QuestionStatus) {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/40">
            OPEN
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-400/40">
            PENDING
          </span>
        );
      case "final":
        return (
          <span className="inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-400/40">
            FINAL
          </span>
        );
      case "void":
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-500/15 px-3 py-1 text-xs font-semibold text-slate-200 border border-slate-400/40">
            VOID
          </span>
        );
    }
  }

  const bulkBusyText = useMemo(() => {
    if (!bulkLocking || !bulkProgress) return "";
    const scope = bulkTarget === "ALL" ? "round" : "game";
    return `Locking ${bulkProgress.done}/${bulkProgress.total} (${scope})…`;
  }, [bulkLocking, bulkProgress, bulkTarget]);

  const headerRightLabel = useMemo(() => {
    if (sport === "BBL") return `Match Doc: ${bblDocId}`;
    return `Round: ${roundLabel}`;
  }, [sport, bblDocId, roundLabel]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <section className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Settlement console
            </h1>
            <p className="mt-2 text-sm text-slate-200/80 max-w-xl">
              Lock questions at kickoff (sets them to <strong>PENDING</strong>),
              then settle them with the correct outcome. Reopen is a safety net
              if you lock or settle the wrong question.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-3 text-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center rounded-full bg-white/5 border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wide text-white/80">
                {seasonLabel}
              </span>
              <span className="text-xs text-slate-300">
                {headerRightLabel.includes("Round:")
                  ? (
                    <>
                      Round: <span className="font-semibold text-white">{roundLabel}</span>
                    </>
                  )
                  : (
                    <>
                      Match Doc: <span className="font-semibold text-white">{bblDocId}</span>
                    </>
                  )
                }
              </span>
            </div>

            {/* ✅ SPORT TOGGLE + SELECTORS */}
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="inline-flex rounded-full bg-black border border-white/25 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSport("AFL")}
                  disabled={loading || bulkLocking}
                  className={`px-4 py-2 text-sm font-extrabold transition ${
                    sport === "AFL"
                      ? "bg-orange-500 text-black"
                      : "bg-black text-white/80 hover:bg-white/5"
                  }`}
                >
                  AFL
                </button>
                <button
                  type="button"
                  onClick={() => setSport("BBL")}
                  disabled={loading || bulkLocking}
                  className={`px-4 py-2 text-sm font-extrabold transition ${
                    sport === "BBL"
                      ? "bg-orange-500 text-black"
                      : "bg-black text-white/80 hover:bg-white/5"
                  }`}
                >
                  BBL
                </button>
              </div>

              {sport === "AFL" ? (
                <select
                  value={roundKey}
                  onChange={(e) => setRoundKey(e.target.value as RoundKey)}
                  className="rounded-full bg-black border border-white/25 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
                  disabled={loading || bulkLocking}
                >
                  {ROUND_OPTIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={bblDocId}
                  onChange={(e) => setBblDocId(e.target.value)}
                  placeholder="BBL docId (e.g. BBL-2025-12-14-SCO-VS-SIX)"
                  className="w-full md:w-[360px] rounded-full bg-black border border-white/25 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/80 focus:border-orange-500/80"
                  disabled={loading || bulkLocking}
                />
              )}

              <button
                type="button"
                disabled={loading || bulkLocking}
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    await refreshRoundData();
                  } catch (e: any) {
                    setError(e?.message || "Refresh failed.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="rounded-full bg-slate-900 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* BULK LOCK STRIP */}
        <section className="rounded-2xl bg-slate-950/90 border border-amber-500/35 shadow-[0_0_40px_rgba(15,23,42,0.9)] overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-500/25 bg-gradient-to-r from-amber-900/40 via-slate-900 to-slate-950">
            <h2 className="text-sm font-bold tracking-wide uppercase text-amber-100">
              Bulk actions
            </h2>
            <p className="mt-1 text-xs text-slate-100/80 max-w-2xl">
              All games are open for players now — this console only controls{" "}
              <strong>question status</strong>.
            </p>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-[11px] text-slate-200/80">{bulkBusyText}</div>
              {bulkError && (
                <p className="text-xs text-red-300 font-medium">{bulkError}</p>
              )}
            </div>
          </div>

          <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-black/30">
            <div className="text-xs text-slate-300">
              Open questions:{" "}
              <span className="font-semibold text-white">{openQuestionCount}</span>
            </div>

            <button
              type="button"
              disabled={bulkLocking || loading || openQuestionCount === 0}
              onClick={lockAllOpenQuestions}
              className={`rounded-full px-5 py-2 text-xs font-extrabold border transition ${
                openQuestionCount === 0
                  ? "bg-slate-800/50 text-white/40 border-white/10 cursor-not-allowed"
                  : bulkLocking
                  ? "bg-amber-400/60 text-black border-amber-300 opacity-80"
                  : "bg-amber-400 text-black border-amber-300 hover:bg-amber-300"
              }`}
            >
              {bulkLocking && bulkTarget === "ALL"
                ? "Locking…"
                : "Lock ALL open questions"}
            </button>
          </div>
        </section>

        {/* FILTER ROW FOR QUESTIONS */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Filter questions by status
          </span>
          {(["open", "pending", "final", "void", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${
                statusFilter === s
                  ? "bg-orange-500 text-black border-orange-400"
                  : "bg-slate-900/70 text-slate-200 border-slate-600 hover:bg-slate-800"
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {bulkBusyText && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <span className="font-semibold">{bulkBusyText}</span>{" "}
            <span className="text-amber-100/80">
              (UI is optimistic — refresh runs automatically when done.)
            </span>
          </div>
        )}

        {/* QUESTIONS (GROUPED BY GAME like Picks page) */}
        <section className="space-y-3">
          {loading && (
            <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-6 text-sm text-slate-200">
              Loading questions…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-black/40 border border-red-500/30 px-4 py-6 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && gameMetaList.length === 0 && (
            <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-6 text-sm text-slate-200">
              No games found.
            </div>
          )}

          {!loading &&
            !error &&
            gameMetaList.map((g) => {
              const items = filteredByGame[g.id] || [];
              if (!items.length) return null;

              const { date, time } = formatStart(g.startTime);
              const openCount = openQuestionCountByGame[g.id] ?? 0;

              const perGameBulkBusy = bulkLocking && bulkTarget === g.id;

              return (
                <div key={g.id} className="space-y-2">
                  {/* GAME HEADER */}
                  <div className="rounded-xl bg-[#0b1220] border border-slate-700 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-extrabold text-white truncate">
                          {g.match}
                        </div>
                        <div className="text-[11px] sm:text-xs text-white/70">
                          {g.venue} • {date} {time} AEDT
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="inline-flex items-center rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/80 border border-white/10">
                          {openCount} open questions
                        </span>

                        <button
                          type="button"
                          disabled={bulkLocking || loading || openCount === 0}
                          onClick={() => lockEntireGame(g.id, g.match)}
                          className={`inline-flex items-center rounded-full px-4 py-2 text-[11px] font-extrabold border transition ${
                            openCount === 0
                              ? "bg-slate-800/50 text-white/40 border-white/10 cursor-not-allowed"
                              : perGameBulkBusy
                              ? "bg-amber-400/60 text-black border-amber-300 opacity-80"
                              : "bg-amber-400 text-black border-amber-300 hover:bg-amber-300"
                          }`}
                        >
                          {perGameBulkBusy ? "Locking…" : "Lock entire game"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* QUESTIONS UNDER GAME */}
                  <div className="rounded-2xl bg-slate-950/90 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.7)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs uppercase tracking-wide text-slate-300 bg-black/80">
                      <div className="flex items-center gap-6">
                        <span className="w-10 text-left">Qtr</span>
                        <span>Question</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span>Status</span>
                        <span>Set outcome</span>
                      </div>
                    </div>

                    <div className="divide-y divide-white/10">
                      {items.map((q) => (
                        <div
                          key={q.id}
                          className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-black/40"
                        >
                          <div className="flex items-start gap-4 md:w-2/3">
                            <div className="w-10 mt-1 text-sm font-semibold text-slate-200">
                              Q{q.quarter}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {q.question}
                              </div>
                              {q.isSponsorQuestion && (
                                <div className="mt-1 inline-flex items-center rounded-full bg-yellow-400/15 border border-yellow-400/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-200">
                                  Sponsor Question
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 md:w-1/3">
                            <div>{statusBadge(q.status)}</div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* YES / NO / VOID */}
                              <button
                                type="button"
                                disabled={savingId === q.id || bulkLocking}
                                onClick={() => handleAction(q.id, "final_yes")}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/80 text-black hover:bg-emerald-400 disabled:opacity-60"
                              >
                                YES
                              </button>
                              <button
                                type="button"
                                disabled={savingId === q.id || bulkLocking}
                                onClick={() => handleAction(q.id, "final_no")}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/80 text-black hover:bg-red-400 disabled:opacity-60"
                              >
                                NO
                              </button>
                              <button
                                type="button"
                                disabled={savingId === q.id || bulkLocking}
                                onClick={() => handleAction(q.id, "final_void")}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/80 text-black hover:bg-slate-400 disabled:opacity-60"
                              >
                                VOID
                              </button>

                              {/* LOCK / REOPEN */}
                              <button
                                type="button"
                                disabled={savingId === q.id || bulkLocking}
                                onClick={() => handleAction(q.id, "lock")}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-60"
                              >
                                LOCK
                              </button>
                              <button
                                type="button"
                                disabled={savingId === q.id || bulkLocking}
                                onClick={() => handleAction(q.id, "reopen")}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-100 border border-slate-500 hover:bg-slate-700 disabled:opacity-60"
                              >
                                REOPEN
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
        </section>

        <p className="text-xs text-slate-400">
          Tip: use <strong>Lock entire game</strong> at kickoff to flip all OPEN
          questions in that match to <strong>PENDING</strong>, then settle the
          outcomes as they’re confirmed. If you settle incorrectly, hit{" "}
          <strong>REOPEN</strong> and set the correct outcome.
        </p>
      </section>
    </main>
  );
}
