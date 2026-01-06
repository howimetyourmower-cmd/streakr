// /app/picks/[gameId]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  gameId: string;
  quarter: number;
  question: string;
  status: QuestionStatus;

  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorBlurb?: string;

  correctOutcome?: QuestionOutcome;
  outcome?: QuestionOutcome;
  correctPick?: boolean | null;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  isUnlockedForPicks?: boolean;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber: number;
  currentStreak: number;
  leaderScore: number;
  leaderName: string | null;
};

function parseRoundNumberFromGameId(gameId: string): number {
  const upper = String(gameId || "").toUpperCase();
  if (upper.startsWith("OR-")) return 0;

  const m = upper.match(/^R(\d+)-/);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function formatAEST(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function extractPlayerName(question: string): { first: string; last: string } | null {
  // expects: "Will Jeremy Cameron (Gee) ...?"
  const q = String(question || "").trim();
  const m = q.match(/^Will\s+([A-Za-z'-]+)\s+([A-Za-z'-]+)\s*\(/i);
  if (!m) return null;
  return { first: m[1], last: m[2] };
}

async function fetchPicksForRound(params: { roundNumber: number; idToken?: string | null }) {
  const { roundNumber, idToken } = params;
  const res = await fetch(`/api/picks?round=${roundNumber}`, {
    method: "GET",
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load /api/picks (${res.status}) ${txt}`);
  }
  return (await res.json()) as PicksApiResponse;
}

async function setUserPick(params: {
  questionId: string;
  pick: "yes" | "no" | "clear";
  idToken: string;
}) {
  // This assumes you already have /app/api/user-picks/route.ts handling POST.
  // If your route shape differs, change ONLY this function.
  const res = await fetch("/api/user-picks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      questionId: params.questionId,
      pick: params.pick === "clear" ? null : params.pick,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to save pick (${res.status}) ${txt}`);
  }
}

export default function PicksMatchPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = useMemo(() => String(params?.gameId || ""), [params]);

  const { user, getIdToken } = useAuth();

  const roundNumber = useMemo(() => parseRoundNumberFromGameId(gameId), [gameId]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<PicksApiResponse | null>(null);

  const game: ApiGame | null = useMemo(() => {
    if (!data?.games?.length) return null;
    return data.games.find((g) => g.id === gameId) ?? null;
  }, [data, gameId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const idToken = user ? await getIdToken() : null;
      const next = await fetchPicksForRound({ roundNumber, idToken });
      setData(next);
    } catch (e: any) {
      setError(e?.message || "Failed to load match");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, roundNumber, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPick = useCallback(
    async (questionId: string, pick: "yes" | "no" | "clear") => {
      if (!user) {
        setError("Please log in to make picks.");
        return;
      }

      setSavingId(questionId);
      setError(null);

      try {
        const idToken = await getIdToken();
        await setUserPick({ questionId, pick, idToken });
        await refresh(); // ✅ keep single source of truth: always re-pull from /api/picks
      } catch (e: any) {
        setError(e?.message || "Failed to save pick");
      } finally {
        setSavingId(null);
      }
    },
    [getIdToken, refresh, user]
  );

  return (
    <div className="min-h-screen bg-[#0b0f16] text-white">
      {/* top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f16]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/picks"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
            >
              ← Back
            </Link>
            <div className="text-sm text-white/70">
              Round {roundNumber === 0 ? "Opening" : roundNumber} • Game{" "}
              <span className="font-mono text-white/80">{gameId}</span>
            </div>
          </div>

          <button
            onClick={refresh}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            Loading match…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && !game && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            Match not found for <span className="font-mono">{gameId}</span>.{" "}
            <div className="mt-2 text-sm text-white/60">
              (This page only reads from <span className="font-mono">/api/picks</span> for the
              game’s round.)
            </div>
          </div>
        )}

        {!loading && !error && game && (
          <>
            {/* header */}
            <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl font-extrabold tracking-tight">{game.match}</div>
              <div className="mt-1 text-white/70">
                {game.venue} • {formatAEST(game.startTime)}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Source: /api/picks ✅
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Picks: {game.questions.filter((q) => q.userPick).length} / {game.questions.length}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Auto-locks at bounce
                </span>
              </div>
            </div>

            {/* questions grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {game.questions.map((q, idx) => {
                const num = String(idx + 1).padStart(2, "0");
                const player = extractPlayerName(q.question);
                const selected = q.userPick;

                const disabledBecauseSaving = savingId === q.id;
                const disabledBecauseLock = !game.isUnlockedForPicks; // matches your current lock model

                const showResult =
                  q.status === "final" || q.status === "void" || q.correctPick === true || q.correctPick === false;

                const resultPill =
                  q.status === "void" || q.correctOutcome === "void"
                    ? { label: "VOID", cls: "bg-white/10 border-white/15 text-white/80" }
                    : q.status === "final" && q.correctPick === true
                    ? { label: "CORRECT", cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200" }
                    : q.status === "final" && q.correctPick === false
                    ? { label: "WRONG", cls: "bg-red-500/15 border-red-500/30 text-red-200" }
                    : null;

                return (
                  <div
                    key={q.id}
                    className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold tracking-wide text-white">
                          Q{num} • QUARTER {q.quarter}
                        </div>
                        <div className="mt-1 text-xs text-white/60">Status: {q.status}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {showResult && resultPill && (
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${resultPill.cls}`}
                          >
                            {resultPill.label}
                          </span>
                        )}

                        {selected && (
                          <button
                            title="Clear pick"
                            onClick={() => onPick(q.id, "clear")}
                            disabled={disabledBecauseSaving || disabledBecauseLock}
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* sponsor ribbon */}
                    {q.isSponsorQuestion && (
                      <div className="mb-3 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-3">
                        <div className="text-xs font-bold text-yellow-200">
                          {q.sponsorName ?? "OFFICIAL PARTNER"}
                        </div>
                        {q.sponsorBlurb && (
                          <div className="mt-1 text-xs text-yellow-100/80">{q.sponsorBlurb}</div>
                        )}
                      </div>
                    )}

                    {/* player badge */}
                    {player && (
                      <div className="mb-3 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/80 text-center text-[11px] font-bold leading-[12px] text-white">
                          <div>
                            <div>{player.first}</div>
                            <div>{player.last}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold tracking-[0.22em] text-white/60">
                            PLAYER PICK
                          </div>
                          <div className="text-xs text-white/75">{q.commentCount ?? 0} comments</div>
                        </div>
                      </div>
                    )}

                    <div className="text-lg font-extrabold leading-snug">{q.question}</div>

                    {/* buttons */}
                    <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => onPick(q.id, "yes")}
                          disabled={disabledBecauseSaving || disabledBecauseLock}
                          className={[
                            "h-12 rounded-2xl border text-sm font-extrabold transition",
                            selected === "yes"
                              ? "border-white/25 bg-white/15"
                              : "border-white/10 bg-white/5 hover:bg-white/10",
                            "disabled:opacity-50",
                          ].join(" ")}
                        >
                          YES
                        </button>

                        <button
                          onClick={() => onPick(q.id, "no")}
                          disabled={disabledBecauseSaving || disabledBecauseLock}
                          className={[
                            "h-12 rounded-2xl border text-sm font-extrabold transition",
                            selected === "no"
                              ? "border-white/25 bg-white/15"
                              : "border-white/10 bg-white/5 hover:bg-white/10",
                            "disabled:opacity-50",
                          ].join(" ")}
                        >
                          NO
                        </button>
                      </div>

                      {/* percents */}
                      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                        <span>Yes {q.yesPercent ?? 0}%</span>
                        <span>No {q.noPercent ?? 0}%</span>
                      </div>
                    </div>

                    {disabledBecauseLock && (
                      <div className="mt-3 text-xs text-white/50">
                        Picks locked for this match.
                      </div>
                    )}

                    {savingId === q.id && (
                      <div className="mt-3 text-xs text-white/60">Saving…</div>
                    )}

                    <div className="mt-3 text-[11px] text-white/40">
                      ID: <span className="font-mono">{q.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center text-xs text-white/40">
              This page intentionally does <span className="font-bold">not</span> read Firestore
              for question text — it always consumes <span className="font-mono">/api/picks</span>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
