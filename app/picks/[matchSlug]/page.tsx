// /app/picks/[matchSlug]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: QuestionStatus; // MUST stay lowercase from API
  userPick?: PickOutcome;

  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorPrize?: string;

  yesPercent?: number;
  noPercent?: number;
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
  roundNumber?: number;
};

const COLORS = {
  pageBg: "#0d1117",
  cardBg: "#161b22",
  red: "#FF2E4D",
};

const HOW_TO_PLAY_KEY = "torpie_seen_how_to_play_match_v1";

function formatAedt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return dateIso;
  }
}

function msToCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitMatch(match: string): { home: string; away: string } | null {
  const m = (match || "").split(/\s+vs\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}

/** Silhouette used behind each card + sponsor cover */
function CardSilhouetteBg({ opacity = 1, scale = 1.06 }: { opacity?: number; scale?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ opacity }}>
        <Image
          src="/afl1.png"
          alt=""
          fill
          sizes="(max-width: 1200px) 100vw, 1200px"
          style={{
            objectFit: "cover",
            filter: "grayscale(1) brightness(0.32) contrast(1.25)",
            transform: `scale(${scale})`,
          }}
          priority={false}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.92) 100%)",
        }}
      />
    </div>
  );
}

function quarterLabel(q: number): string {
  if (!q || q <= 0) return "FULL GAME";
  return `QUARTER ${q}`;
}

/** player detection: "Will First Last (Abbr)" */
function extractPlayerName(question: string): string | null {
  const q = (question || "").trim();
  if (!q.toLowerCase().startsWith("will ")) return null;
  const paren = q.match(/^Will\s+(.+?)\s*\(/i);
  if (paren && paren[1]) return paren[1].trim();
  const capWords = q.match(/^Will\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  if (capWords && capWords[1]) return capWords[1].trim();
  return null;
}

function isProbablyPlayerName(name: string): boolean {
  const n = (name || "").trim();
  if (!n) return false;
  if (n.split(/\s+/).filter(Boolean).length < 2) return false;
  if (/\bvs\b/i.test(n)) return false;
  if (/\d/.test(n)) return false;
  return true;
}

function playerImageCandidates(playerName: string): string[] {
  const slug = slugify(playerName);
  return [
    `/players/${slug}.png`,
    `/players/${slug}.jpg`,
    `/players/${slug}.jpeg`,
    `/players/${slug}.webp`,
  ];
}

/** Squircle avatar with RED background behind cutout */
function PlayerAvatar({
  playerName,
  size = 56,
}: {
  playerName: string;
  size?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const candidates = useMemo(() => playerImageCandidates(playerName), [playerName]);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  const squircleRadius = 18; // “squircle” look (not circle)

  if (dead) {
    return (
      <div
        className="flex items-center justify-center border"
        style={{
          width: size,
          height: size,
          borderRadius: squircleRadius,
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(255,46,77,0.18)",
          color: "rgba(255,255,255,0.88)",
          fontWeight: 900,
          fontSize: 12,
        }}
        title={playerName}
      >
        ?
      </div>
    );
  }

  return (
    <div
      className="relative border overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: squircleRadius,
        borderColor: "rgba(255,255,255,0.14)",
        background: COLORS.red, // solid red behind player
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
      }}
      title={playerName}
    >
      <Image
        src={src}
        alt={playerName}
        fill
        sizes={`${size}px`}
        style={{ objectFit: "cover" }}
        onError={() => {
          setIdx((p) => {
            if (p + 1 < candidates.length) return p + 1;
            setDead(true);
            return p;
          });
        }}
      />
      {/* subtle dark fade at bottom like your reference */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.22) 100%)",
        }}
      />
    </div>
  );
}

function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(15,15,15,0.98)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.85)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-white/60">How to play</div>
              <div className="mt-1 text-[22px] font-black text-white">Pick. Lock. Survive.</div>
              <div className="mt-1 text-[13px] text-white/70 leading-snug">Picks auto-lock at bounce. No lock-in button.</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-3 py-1.5 text-[12px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">1</div>
              <div className="mt-1 text-[14px] font-black text-white">Pick any amount</div>
              <div className="mt-1 text-[12px] text-white/70">Choose 0–12 questions for this match.</div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">2</div>
              <div className="mt-1 text-[14px] font-black text-white">Locks at bounce</div>
              <div className="mt-1 text-[12px] text-white/70">Once the countdown hits zero, picks are locked.</div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">3</div>
              <div className="mt-1 text-[14px] font-black text-white">Clean Sweep</div>
              <div className="mt-1 text-[12px] text-white/70">One wrong pick wipes this match streak. Voids don’t count.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl border px-5 py-4 text-[13px] font-black"
            style={{
              borderColor: "rgba(255,46,77,0.55)",
              background: "rgba(255,46,77,0.18)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "0 10px 30px rgba(255,46,77,0.18)",
            }}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchPicksPage({ params }: { params: { matchSlug: string } }) {
  const { user } = useAuth();
  const matchSlug = params.matchSlug;

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [localPicks, setLocalPicks] = useState<Record<string, LocalPick>>({});
  const [revealedSponsor, setRevealedSponsor] = useState<Record<string, boolean>>({});

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [howToOpen, setHowToOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(HOW_TO_PLAY_KEY);
      if (!seen) setHowToOpen(true);
    } catch {}
  }, []);

  const closeHowTo = useCallback(() => {
    try {
      localStorage.setItem(HOW_TO_PLAY_KEY, "1");
    } catch {}
    setHowToOpen(false);
  }, []);

  const savePick = useCallback(
    async (questionId: string, pick: LocalPick) => {
      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const payload = { questionId, pick: pick === "none" ? null : pick };
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
    },
    [user]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const res = await fetch("/api/picks", { headers: authHeader, cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;

      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);

      const games: ApiGame[] = Array.isArray(data.games) ? data.games : [];
      const found: ApiGame | null = games.find((g) => slugify(g.match) === matchSlug) || null;

      setGame(found);

      const next: Record<string, LocalPick> = {};
      if (found?.questions?.length) for (const q of found.questions) next[q.id] = q.userPick ? q.userPick : "none";
      setLocalPicks(next);
    } catch (e) {
      console.error(e);
      setErr("Could not load this match right now.");
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [matchSlug, user]);

  useEffect(() => {
    load();
  }, [load]);

  const lockMs = useMemo(() => {
    if (!game) return 0;
    return new Date(game.startTime).getTime() - nowMs;
  }, [game, nowMs]);

  const isLocked = lockMs <= 0;

  const picksSelected = useMemo(() => {
    return Object.values(localPicks).filter((v) => v === "yes" || v === "no").length;
  }, [localPicks]);

  const roundLabel = roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const headerTeams = useMemo(() => {
    if (!game) return { home: "", away: "" };
    const m = splitMatch(game.match);
    return { home: m?.home ?? game.match, away: m?.away ?? "" };
  }, [game]);

  const onPick = useCallback(
    async (questionId: string, nextPick: LocalPick) => {
      if (isLocked) return;
      setLocalPicks((prev) => ({ ...prev, [questionId]: nextPick }));
      try {
        await savePick(questionId, nextPick);
      } catch (e) {
        console.error(e);
        load();
      }
    },
    [isLocked, load, savePick]
  );

  const onClear = useCallback((questionId: string) => onPick(questionId, "none"), [onPick]);

  const revealSponsor = useCallback((qid: string) => setRevealedSponsor((p) => ({ ...p, [qid]: true })), []);

  const sortedQuestions = useMemo(() => {
    if (!game?.questions?.length) return [];
    return game.questions.slice().sort((a, b) => {
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [game]);

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.pageBg }}>
      <HowToPlayModal open={howToOpen} onClose={closeHowTo} />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-28">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/picks"
            className="rounded-full border px-4 py-2 text-[12px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.92)",
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            className="rounded-full border px-4 py-2 text-[12px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            How to play
          </button>
        </div>

        {/* Header */}
        <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
          <div
            className="p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
            }}
          >
            {loading ? (
              <div className="text-white/70 text-sm">Loading match…</div>
            ) : !game ? (
              <div className="text-white/70 text-sm">Match not found.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* Aggressive italic ALL CAPS title */}
                    <div className="text-[18px] sm:text-[22px] font-black italic tracking-wide text-white leading-tight uppercase">
                      {game.match}
                    </div>
                    <div className="mt-2 text-[12px] text-white/65">{game.venue}</div>
                    <div className="mt-2 text-[11px] text-white/70 font-semibold">{formatAedt(game.startTime)}</div>
                  </div>

                  <div className="text-right shrink-0">
                    {roundLabel ? (
                      <div
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{
                          borderColor: "rgba(255,46,77,0.35)",
                          background: "rgba(255,46,77,0.10)",
                          color: "rgba(255,255,255,0.92)",
                        }}
                      >
                        {roundLabel}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                    style={{
                      borderColor: "rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    Picks selected: {picksSelected} / 12
                  </span>

                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                    style={{
                      borderColor: isLocked ? "rgba(255,46,77,0.55)" : "rgba(255,46,77,0.28)",
                      background: isLocked ? "rgba(255,46,77,0.16)" : "rgba(255,46,77,0.10)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {isLocked ? "LOCKED (auto)" : `Locks in ${msToCountdown(lockMs)}`}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Grid (tight gap) */}
        <div className="mt-5 mx-auto w-full max-w-[1200px]">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border overflow-hidden"
                  style={{ borderColor: "rgba(255,255,255,0.10)", background: COLORS.cardBg, minHeight: 200 }}
                >
                  <div className="h-[200px] bg-white/5" />
                </div>
              ))}
            </div>
          ) : !game ? null : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedQuestions.map((q, idx) => {
                const pick = localPicks[q.id] ?? "none";
                const sponsor = !!q.isSponsorQuestion;
                const revealed = !!revealedSponsor[q.id];

                const sponsorName = (q.sponsorName || "Rebel Sport").trim();
                const prize = (q.sponsorPrize || "$100 Rebel Sport Gift Card").trim();
                const sponsorLine = `Proudly sponsored by ${sponsorName}. Get this pick correct and go in the draw to win ${prize}.`;

                const playerNameRaw = extractPlayerName(q.question);
                const playerName = playerNameRaw && isProbablyPlayerName(playerNameRaw) ? playerNameRaw : null;

                // Percent fallback if API doesn't send it
                const yesPct = typeof q.yesPercent === "number" ? Math.max(0, Math.min(100, q.yesPercent)) : 50;
                const noPct = typeof q.noPercent === "number" ? Math.max(0, Math.min(100, q.noPercent)) : 50;

                const cardBorder =
                  sponsor && revealed
                    ? "rgba(255,46,77,0.55)"
                    : "rgba(255,255,255,0.10)";

                return (
                  <div
                    key={q.id}
                    className="relative rounded-2xl border overflow-hidden"
                    style={{
                      borderColor: cardBorder,
                      background: COLORS.cardBg, // ✅ lighter than page bg
                      boxShadow: "0 12px 36px rgba(0,0,0,0.55)",
                      minHeight: 210,
                    }}
                  >
                    {/* silhouette */}
                    <div className="absolute inset-0">
                      <CardSilhouetteBg opacity={1} scale={1.06} />
                    </div>

                    <div className="relative z-10 p-3 sm:p-4 flex flex-col h-full">
                      {/* Top meta row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {/* ✅ Needs to be significantly bolder (900) */}
                          <div className="text-[11px] uppercase tracking-widest text-white/70 font-black">
                            {`Q${String(idx + 1).padStart(2, "0")} - ${quarterLabel(q.quarter)}`}
                          </div>

                          {/* ✅ case sensitivity: do NOT capitalize open/final/pending/void */}
                          <div className="mt-0.5 text-[11px] text-white/55">
                            Status: <span className="font-semibold text-white/70">{q.status}</span>
                          </div>
                        </div>

                        {pick !== "none" ? (
                          <button
                            type="button"
                            onClick={() => onClear(q.id)}
                            disabled={isLocked || (sponsor && !revealed)}
                            className="shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-black"
                            style={{
                              borderColor: "rgba(255,255,255,0.14)",
                              background: "rgba(0,0,0,0.40)",
                              color: "rgba(255,255,255,0.92)",
                              opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                            }}
                            title={isLocked ? "Locked" : "Clear pick"}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>

                      {/* Sponsor banner (when revealed) */}
                      {sponsor ? (
                        <div
                          className="mt-2 rounded-xl border px-2.5 py-2"
                          style={{
                            borderColor: revealed ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.12)",
                            background: revealed ? "rgba(255,46,77,0.14)" : "rgba(0,0,0,0.35)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          <div className="text-[10px] font-black uppercase tracking-widest">SPONSOR QUESTION - {sponsorName}</div>
                          <div className="mt-1 text-[11px] text-white/75 leading-snug">{sponsorLine}</div>
                        </div>
                      ) : null}

                      {/* Avatar block */}
                      <div className="mt-3 flex flex-col items-center justify-center">
                        {playerName ? (
                          <>
                            <PlayerAvatar playerName={playerName} size={56} />
                            {/* ✅ centered under avatar, small, low opacity, uppercase */}
                            <div className="mt-2 text-[10px] uppercase tracking-widest text-white/45 font-semibold text-center">
                              Player pick
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-[10px] uppercase tracking-widest text-white/45 font-semibold text-center">
                            Match pick
                          </div>
                        )}
                      </div>

                      {/* Question */}
                      <div className="mt-3 text-[12px] sm:text-[13px] font-semibold text-white/92 leading-snug">
                        {q.question}
                      </div>

                      {/* Buttons + Stats */}
                      <div className="mt-auto pt-3">
                        {/* ✅ chunkier pill buttons, subtle border even when unselected */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPick(q.id, pick === "yes" ? "none" : "yes")}
                            disabled={isLocked || (sponsor && !revealed)}
                            className="flex-1 rounded-2xl border text-[12px] font-black"
                            style={{
                              paddingTop: 12,
                              paddingBottom: 12,
                              borderColor: pick === "yes" ? "rgba(255,46,77,0.70)" : "rgba(255,255,255,0.14)",
                              background: pick === "yes" ? "rgba(255,46,77,0.24)" : "rgba(0,0,0,0.35)",
                              color: "rgba(255,255,255,0.96)",
                              opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                            }}
                          >
                            YES
                          </button>

                          <button
                            type="button"
                            onClick={() => onPick(q.id, pick === "no" ? "none" : "no")}
                            disabled={isLocked || (sponsor && !revealed)}
                            className="flex-1 rounded-2xl border text-[12px] font-black"
                            style={{
                              paddingTop: 12,
                              paddingBottom: 12,
                              borderColor: pick === "no" ? "rgba(255,46,77,0.70)" : "rgba(255,255,255,0.14)",
                              background: pick === "no" ? "rgba(255,46,77,0.24)" : "rgba(0,0,0,0.35)",
                              color: "rgba(255,255,255,0.96)",
                              opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                            }}
                          >
                            NO
                          </button>
                        </div>

                        {/* ✅ percent labels ABOVE thin bar */}
                        <div className="mt-3 flex items-center justify-between text-[10px] font-semibold">
                          <span style={{ color: "rgba(255,255,255,0.48)" }}>{`Yes ${Math.round(yesPct)}%`}</span>
                          <span style={{ color: "rgba(255,255,255,0.48)" }}>{`No ${Math.round(noPct)}%`}</span>
                        </div>

                        {/* ✅ ultra thin bar (2-3px) */}
                        <div
                          className="mt-1 w-full overflow-hidden"
                          style={{
                            height: 3,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.10)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.round(yesPct)}%`,
                              background: "rgba(255,46,77,0.85)",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sponsor reveal cover — must completely hide the card */}
                    {sponsor && !revealed ? (
                      <button
                        type="button"
                        onClick={() => revealSponsor(q.id)}
                        className="absolute inset-0 z-[40] flex items-center justify-center p-3"
                        style={{
                          background: "rgba(0,0,0,0.94)",
                          color: "rgba(255,255,255,0.94)",
                          cursor: "pointer",
                        }}
                        aria-label="Reveal sponsored question"
                      >
                        <div className="absolute inset-0">
                          <CardSilhouetteBg opacity={0.12} scale={1.08} />
                        </div>

                        <div
                          className="relative z-10 w-full h-full rounded-2xl border p-4 flex flex-col items-center justify-center text-center"
                          style={{
                            borderColor: "rgba(255,255,255,0.14)",
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.42) 65%, rgba(0,0,0,0.62) 100%)",
                            boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
                          }}
                        >
                          <div className="text-[10px] font-black uppercase tracking-widest text-white/70">
                            SPONSOR QUESTION
                          </div>

                          <div className="mt-2 text-[13px] sm:text-[14px] font-black">Tap to reveal</div>

                          <div className="mt-2 text-[11px] text-white/80">
                            Proudly sponsored by <span className="font-black text-white">{sponsorName}</span>
                          </div>

                          <div className="mt-2 text-[11px] text-white/70">
                            Win <span className="font-black text-white">{prize}</span>
                          </div>

                          <div
                            className="mt-3 inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-[11px] font-black"
                            style={{
                              borderColor: "rgba(255,46,77,0.55)",
                              background: "rgba(255,46,77,0.16)",
                              color: "rgba(255,255,255,0.95)",
                            }}
                          >
                            TAP TO REVEAL
                          </div>
                        </div>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[90] px-3 pb-3">
        <div className="mx-auto max-w-6xl rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div
            className="px-4 py-3 flex items-center justify-between gap-3"
            style={{
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="min-w-0">
              <div className="text-[12px] font-black text-white">Picks selected: {picksSelected} / 12</div>
              <div className="text-[11px] text-white/65">{loading ? "Loading…" : isLocked ? "LOCKED — Changes disabled" : `Locks in ${msToCountdown(lockMs)}`}</div>
            </div>

            <div
              className="shrink-0 rounded-xl border px-3 py-2 text-[11px] font-black"
              style={{
                borderColor: isLocked ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.14)",
                background: isLocked ? "rgba(255,46,77,0.14)" : "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {isLocked ? "LOCKED" : "AUTO-LOCK"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
