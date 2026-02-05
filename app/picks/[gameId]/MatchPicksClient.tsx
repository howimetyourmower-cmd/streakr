// /app/picks/[gameId]/MatchPicksClient.tsx
"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: unknown;

  match?: string;
  venue?: string;
  startTime?: string;

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
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

const BRAND_BG = "#000000";
const SEASON = 2026; // localStorage keys only (beta)

function roundNumberFromGameId(gameId: string): number {
  const s = String(gameId || "").toUpperCase().trim();
  if (s.startsWith("OR-")) return 0;
  if (s.startsWith("R")) {
    const dash = s.indexOf("-");
    const prefix = dash === -1 ? s : s.slice(0, dash);
    const n = Number(prefix.replace("R", ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function extractPlayerName(question: string) {
  const q = String(question || "").trim();
  const lower = q.toLowerCase();
  if (!lower.startsWith("will ")) return null;

  const start = 5;
  const parenIdx = q.indexOf(" (", start);
  if (parenIdx === -1) return null;

  const name = q.slice(start, parenIdx).trim();
  if (!name) return null;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const badFirstWords = new Set([
    "the",
    "a",
    "an",
    "total",
    "match",
    "game",
    "team",
    "quarter",
    "first",
    "next",
    "any",
    "either",
    "both",
    "combined",
  ]);
  if (badFirstWords.has(words[0].toLowerCase())) return null;

  if (/\b(goals?|behinds?|disposals?|marks?|tackles?|kicks?|handballs?|points?)\b/i.test(name)) return null;

  const tokenLooksName = (w: string) =>
    /^[A-Z][A-Za-z''\-]+$/.test(w) || /^[A-Z][A-Za-z''\-]+$/.test(w.replace(/[^A-Za-z''\-]/g, ""));

  const connectors = new Set(["de", "del", "da", "di", "van", "von", "la", "le", "st"]);
  let nameTokens = 0;
  for (const w of words) {
    const wl = w.toLowerCase();
    if (connectors.has(wl)) continue;
    if (!tokenLooksName(w)) return null;
    nameTokens += 1;
  }
  if (nameTokens < 2) return null;

  return name;
}

function playerSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

/**
 * Firestore may contain "locked"
 * UI treats "locked" as "pending"
 */
function safeStatus(s: unknown): QuestionStatus {
  const v = String(s || "").toLowerCase().trim();
  if (v === "open") return "open";
  if (v === "final") return "final";
  if (v === "pending") return "pending";
  if (v === "locked") return "pending";
  if (v === "void") return "void";
  return "open";
}

function formatQuarterLabel(q: number) {
  if (q === 0) return "FULL GAME";
  return `QUARTER ${q}`;
}

function parseTeams(match: string) {
  const m = String(match || "").trim();
  const re = /^(.*?)\s+(?:vs|v)\s+(.*?)$/i;
  const hit = m.match(re);
  if (hit) return { home: hit[1].trim(), away: hit[2].trim() };
  return { home: m, away: "" };
}

function msToCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;

  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  const ss = rem % 60;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

/* Teams */

type TeamSlug =
  | "adelaide"
  | "brisbane"
  | "carlton"
  | "collingwood"
  | "essendon"
  | "fremantle"
  | "geelong"
  | "goldcoast"
  | "gws"
  | "hawthorn"
  | "melbourne"
  | "northmelbourne"
  | "portadelaide"
  | "richmond"
  | "stkilda"
  | "sydney"
  | "westcoast"
  | "westernbulldogs";

function teamNameToSlug(nameRaw: string): TeamSlug | null {
  const n = (nameRaw || "").toLowerCase().trim();

  if (n.includes("greater western sydney") || n === "gws" || n.includes("giants")) return "gws";
  if (n.includes("gold coast") || n.includes("suns")) return "goldcoast";
  if (n.includes("west coast") || n.includes("eagles")) return "westcoast";
  if (n.includes("western bulldogs") || n.includes("bulldogs") || n.includes("footscray")) return "westernbulldogs";
  if (n.includes("north melbourne") || n.includes("kangaroos")) return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (n.includes("st kilda") || n.includes("saints") || n.replace(/\s/g, "") === "stkilda") return "stkilda";

  if (n.includes("adelaide")) return "adelaide";
  if (n.includes("brisbane")) return "brisbane";
  if (n.includes("carlton")) return "carlton";
  if (n.includes("collingwood")) return "collingwood";
  if (n.includes("essendon")) return "essendon";
  if (n.includes("fremantle")) return "fremantle";
  if (n.includes("geelong")) return "geelong";
  if (n.includes("hawthorn")) return "hawthorn";
  if (n.includes("melbourne")) return "melbourne";
  if (n.includes("richmond")) return "richmond";
  if (n.includes("sydney") || n.includes("swans")) return "sydney";

  return null;
}

function logoCandidates(teamSlug: TeamSlug): string[] {
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
    `/afllogos/${teamSlug}-logo.jpg`,
    `/afllogos/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = memo(function TeamLogo({ teamName, size = 72 }: { teamName: string; size?: number }) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);

  if (!slug) return null;

  const candidates = logoCandidates(slug);
  const src = candidates[idx];
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={teamName}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setIdx((p) => Math.min(p + 1, candidates.length - 1))}
      priority
    />
  );
});

const PlayersHeadshot = memo(function PlayersHeadshot({ playerName, width }: { playerName: string; width?: number }) {
  const url = `/afl-players/${playerSlug(playerName)}.jpg`;
  return (
    <Image
      src={url}
      alt={playerName}
      width={width ?? 120}
      height={width ?? 120}
      className="rounded-full border-2 border-white/10"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
});

type PickCardProps = {
  q: ApiQuestion;
  qNum: string;
  status: QuestionStatus;
  isPersonallyVoided: boolean;
  match: string;
  matchIsLocked: boolean;
  matchStartMs: number | null;
  selected: LocalPick;
  isSaving: boolean;
  freeKickEligibleForThisGame: boolean;
  freeKickUsedSeason: boolean;
  panicEnabledHere: boolean;
  onOpenPanic: () => void;
  onOpenFreeKick: () => void;
  onSetPick: (v: PickOutcome) => void;
  onClearPick: () => void;
};

function PickCard({
  q,
  qNum,
  status,
  isPersonallyVoided,
  match,
  matchIsLocked,
  matchStartMs,
  selected,
  isSaving,
  freeKickEligibleForThisGame,
  freeKickUsedSeason,
  panicEnabledHere,
  onOpenPanic,
  onOpenFreeKick,
  onSetPick,
  onClearPick,
}: PickCardProps) {
  const { home, away } = parseTeams(match);
  const disabled = status !== "open" || isSaving;
  const hasPickOutcome = status === "final" && q.outcome && q.outcome !== "void";
  const wasCorrectPick = hasPickOutcome && q.correctPick;
  const wasIncorrectPick = hasPickOutcome && q.correctPick === false;

  const yesPercent = q.yesPercent || 0;
  const noPercent = q.noPercent || 0;

  const playerNameParsed = extractPlayerName(q.question);

  const lockTime = q.startTime ? new Date(q.startTime) : null;
  const nowMs = Date.now();
  const remainingMs = lockTime ? lockTime.getTime() - nowMs : null;

  const showCountdown = lockTime && remainingMs && remainingMs > 0;

  let bottomLineHtml = "";
  if (isPersonallyVoided) {
    bottomLineHtml = "You voided this question (no impact on streak).";
  } else if (status === "void") {
    bottomLineHtml = "Voided by system (no outcome).";
  } else if (status === "pending") {
    bottomLineHtml = "Awaiting official outcome…";
  } else if (status === "final") {
    if (q.outcome === "void") {
      bottomLineHtml = "Voided by system (no outcome).";
    } else if (wasCorrectPick) {
      bottomLineHtml = "You got this one! +1 point.";
    } else if (wasIncorrectPick) {
      bottomLineHtml = "Missed. Your streak resets.";
    }
  } else if (status === "open") {
    if (matchIsLocked) {
      bottomLineHtml = "Game locked, check back soon…";
    } else if (showCountdown) {
      bottomLineHtml = `Locks in ${msToCountdown(remainingMs)}`;
    } else {
      bottomLineHtml = "Auto-locks at bounce";
    }
  }

  return (
    <div className="relative rounded-3xl border border-white/10 bg-[#0b0b0e] p-5 shadow-xl">
      <div className="flex items-center justify-between text-[12px] font-black tracking-[0.24em] text-white/55">
        <div>
          Q{qNum} — {formatQuarterLabel(q.quarter)}
        </div>
      </div>

      {panicEnabledHere ? (
        <div className="absolute top-4 right-4">
          <button
            type="button"
            className="relative rounded-xl border border-rose-400/35 bg-gradient-to-br from-rose-500/20 to-rose-600/5 p-3 shadow-lg overflow-hidden group"
            style={{ boxShadow: "0 0 24px rgba(255,46,77,0.12)" }}
            onClick={(e) => {
              e.preventDefault();
              onOpenPanic();
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Image
              src="/icons/panic-button.svg"
              alt="PANIC"
              width={28}
              height={28}
              className="relative z-10 drop-shadow-[0_0_8px_rgba(255,46,77,0.4)]"
            />
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TeamLogo teamName={home} size={64} />
          <span className="text-[13px] font-black text-white/65 tracking-wider">VS</span>
          <TeamLogo teamName={away} size={64} />
        </div>

        {playerNameParsed ? (
          <div className="flex-shrink-0">
            <PlayersHeadshot playerName={playerNameParsed} width={90} />
          </div>
        ) : null}
      </div>

      <div className="mt-5 text-[15px] font-extrabold text-white leading-snug">{q.question}</div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-2xl border py-4 font-black tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selected === "yes" ? "rgba(0,229,255,0.55)" : "rgba(255,255,255,0.1)",
            background:
              selected === "yes"
                ? "linear-gradient(135deg, rgba(0,229,255,0.22) 0%, rgba(0,229,255,0.08) 100%)"
                : "rgba(0,0,0,0.35)",
            color: selected === "yes" ? "rgb(0,229,255)" : "rgba(255,255,255,0.65)",
            boxShadow: selected === "yes" ? "0 0 24px rgba(0,229,255,0.18)" : "none",
          }}
          disabled={disabled}
          onClick={() => (selected === "yes" ? onClearPick() : onSetPick("yes"))}
        >
          YES
        </button>

        <button
          type="button"
          className="flex-1 rounded-2xl border py-4 font-black tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selected === "no" ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.1)",
            background:
              selected === "no"
                ? "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(255,46,77,0.08) 100%)"
                : "rgba(0,0,0,0.35)",
            color: selected === "no" ? "rgb(255,46,77)" : "rgba(255,255,255,0.65)",
            boxShadow: selected === "no" ? "0 0 24px rgba(255,46,77,0.18)" : "none",
          }}
          disabled={disabled}
          onClick={() => (selected === "no" ? onClearPick() : onSetPick("no"))}
        >
          NO
        </button>
      </div>

      {yesPercent > 0 || noPercent > 0 ? (
        <div className="mt-3 text-[11px] text-white/50">
          <div className="font-black tracking-[0.18em] text-white/60">COMMUNITY PULSE</div>
          <div className="mt-1 flex items-center gap-2 text-white/75">
            <div>Yes {yesPercent}%</div>
            <div>•</div>
            <div>No {noPercent}%</div>
          </div>
        </div>
      ) : null}

      {freeKickEligibleForThisGame && status === "final" && wasIncorrectPick && !freeKickUsedSeason ? (
        <div className="mt-4">
          <button
            type="button"
            className="w-full rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/20 to-amber-600/5 py-3 text-sm font-black text-amber-100 tracking-wider"
            style={{ boxShadow: "0 0 24px rgba(251,191,36,0.12)" }}
            onClick={onOpenFreeKick}
          >
            USE FREE KICK
          </button>
        </div>
      ) : null}

      {bottomLineHtml ? <div className="mt-4 text-[12px] text-white/60">{bottomLineHtml}</div> : null}
    </div>
  );
}

type SponsorMysteryCardProps = {
  q: ApiQuestion;
  status: QuestionStatus;
  matchStartMs: number | null;
  matchIsLocked: boolean;
  selected: LocalPick;
  isSaving: boolean;
  freeKickEnabledHere: boolean;
  freeKickUsedSeason: boolean;
  onOpenFreeKick: () => void;
  onClearPick: () => void;
  onSetPickYes: () => void;
  onSetPickNo: () => void;
};

function SponsorMysteryCard({
  q,
  status,
  matchStartMs,
  matchIsLocked,
  selected,
  isSaving,
  freeKickEnabledHere,
  freeKickUsedSeason,
  onOpenFreeKick,
  onClearPick,
  onSetPickYes,
  onSetPickNo,
}: SponsorMysteryCardProps) {
  const disabled = status !== "open" || isSaving;
  const hasPickOutcome = status === "final" && q.outcome && q.outcome !== "void";
  const wasCorrectPick = hasPickOutcome && q.correctPick;
  const wasIncorrectPick = hasPickOutcome && q.correctPick === false;

  const lockTime = q.startTime ? new Date(q.startTime) : null;
  const nowMs = Date.now();
  const remainingMs = lockTime ? lockTime.getTime() - nowMs : null;
  const showCountdown = lockTime && remainingMs && remainingMs > 0;

  let bottomLineHtml = "";
  if (status === "void") {
    bottomLineHtml = "Voided by system (no outcome).";
  } else if (status === "pending") {
    bottomLineHtml = "Awaiting official outcome…";
  } else if (status === "final") {
    if (q.outcome === "void") {
      bottomLineHtml = "Voided by system (no outcome).";
    } else if (wasCorrectPick) {
      bottomLineHtml = "You got this one! +1 point.";
    } else if (wasIncorrectPick) {
      bottomLineHtml = "Missed. Your streak resets.";
    }
  } else if (status === "open") {
    if (matchIsLocked) {
      bottomLineHtml = "Game locked, check back soon…";
    } else if (showCountdown) {
      bottomLineHtml = `Locks in ${msToCountdown(remainingMs)}`;
    } else {
      bottomLineHtml = "Auto-locks at bounce";
    }
  }

  return (
    <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-purple-950/40 to-[#0b0b0e] p-5 shadow-xl">
      <div className="flex items-center justify-between text-[12px] font-black tracking-[0.24em] text-purple-300/75">
        <div>MYSTERY Q — {formatQuarterLabel(q.quarter)}</div>
      </div>

      <div className="mt-5 text-center">
        <div className="inline-block rounded-2xl border border-purple-400/25 bg-purple-500/10 px-6 py-4">
          <div className="text-[11px] font-black tracking-[0.20em] text-purple-300/80">SPONSOR MYSTERY</div>
          <div className="mt-1 text-[18px] font-black text-purple-200">{q.sponsorName || "Mystery Sponsor"}</div>
        </div>
      </div>

      {q.sponsorBlurb ? (
        <div className="mt-4 text-center text-[13px] text-white/70 italic">&ldquo;{q.sponsorBlurb}&rdquo;</div>
      ) : null}

      <div className="mt-5 text-[15px] font-extrabold text-white text-center leading-snug">{q.question}</div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-2xl border py-4 font-black tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selected === "yes" ? "rgba(192,132,252,0.55)" : "rgba(255,255,255,0.1)",
            background:
              selected === "yes"
                ? "linear-gradient(135deg, rgba(192,132,252,0.22) 0%, rgba(192,132,252,0.08) 100%)"
                : "rgba(0,0,0,0.35)",
            color: selected === "yes" ? "rgb(192,132,252)" : "rgba(255,255,255,0.65)",
            boxShadow: selected === "yes" ? "0 0 24px rgba(192,132,252,0.18)" : "none",
          }}
          disabled={disabled}
          onClick={() => (selected === "yes" ? onClearPick() : onSetPickYes())}
        >
          YES
        </button>

        <button
          type="button"
          className="flex-1 rounded-2xl border py-4 font-black tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: selected === "no" ? "rgba(192,132,252,0.55)" : "rgba(255,255,255,0.1)",
            background:
              selected === "no"
                ? "linear-gradient(135deg, rgba(192,132,252,0.22) 0%, rgba(192,132,252,0.08) 100%)"
                : "rgba(0,0,0,0.35)",
            color: selected === "no" ? "rgb(192,132,252)" : "rgba(255,255,255,0.65)",
            boxShadow: selected === "no" ? "0 0 24px rgba(192,132,252,0.18)" : "none",
          }}
          disabled={disabled}
          onClick={() => (selected === "no" ? onClearPick() : onSetPickNo())}
        >
          NO
        </button>
      </div>

      {freeKickEnabledHere && status === "final" && wasIncorrectPick && !freeKickUsedSeason ? (
        <div className="mt-4">
          <button
            type="button"
            className="w-full rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/20 to-amber-600/5 py-3 text-sm font-black text-amber-100 tracking-wider"
            style={{ boxShadow: "0 0 24px rgba(251,191,36,0.12)" }}
            onClick={onOpenFreeKick}
          >
            USE FREE KICK
          </button>
        </div>
      ) : null}

      {bottomLineHtml ? <div className="mt-4 text-[12px] text-purple-200/60">{bottomLineHtml}</div> : null}
    </div>
  );
}

export default function MatchPicksClient({ gameId }: { gameId: string }) {
  const { user, uid } = useAuth();
  const [sg, setSg] = useState<ApiGame | null>(null);
  const [err, setErr] = useState("");
  const [picks, setPicks] = useState<Record<string, LocalPick>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [panicModal, setPanicModal] = useState<{ questionId: string; questionText: string } | null>(null);
  const [panicBusy, setPanicBusy] = useState(false);
  const [panicErr, setPanicErr] = useState("");

  const [personalVoids, setPersonalVoids] = useState<Record<string, boolean>>({});

  const [freeKickModal, setFreeKickModal] = useState<{ gameId: string; label: string } | null>(null);
  const [freeKickErr, setFreeKickErr] = useState("");

  const [freeKickUsedSeason, setFreeKickUsedSeason] = useState(false);

  const roundNum = roundNumberFromGameId(gameId);

  const fetchMatch = async (why: string) => {
    if (!uid) {
      setErr("Please sign in to view picks.");
      return;
    }

    try {
      setErr("");
      const res = await fetch(`/api/picks?userId=${uid}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Fetch error: ${res.status}`);

      const data: PicksApiResponse = await res.json();
      const g = data.games.find((x) => x.id === gameId);
      if (!g) throw new Error("Game not found in response.");

      setSg(g);

      const local: Record<string, LocalPick> = {};
      for (const q of g.questions) {
        const p = q.userPick;
        local[q.id] = p === "yes" || p === "no" ? p : "none";
      }
      setPicks(local);
    } catch (er: unknown) {
      setErr(String((er as Error).message || er));
    }
  };

  useEffect(() => {
    void fetchMatch("mount");
  }, [uid, gameId]);

  useEffect(() => {
    const k = `freeKick_used_season_${SEASON}`;
    const val = localStorage.getItem(k);
    if (val === "true") setFreeKickUsedSeason(true);
  }, []);

  useEffect(() => {
    if (roundNum > 0) {
      const k = `panicVoids_${SEASON}_R${roundNum}`;
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const arr: string[] = JSON.parse(raw);
          const obj: Record<string, boolean> = {};
          for (const qId of arr) obj[qId] = true;
          setPersonalVoids(obj);
        } catch {}
      }
    }
  }, [roundNum]);

  const setPick = async (qId: string, val: PickOutcome, statusAtCall: QuestionStatus) => {
    if (statusAtCall !== "open") {
      return;
    }
    if (!uid || !sg) return;

    const prev = picks[qId];
    if (prev === val) return;

    setPicks((p) => ({ ...p, [qId]: val }));

    setSaving((s) => ({ ...s, [qId]: true }));
    try {
      const docRef = doc(db, "picks", uid, "season-2026", qId);
      await setDoc(
        docRef,
        {
          questionId: qId,
          gameId: sg.id,
          pick: val,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (er: unknown) {
      console.error("setPick error:", er);
    } finally {
      setSaving((s) => ({ ...s, [qId]: false }));
    }

    void fetchMatch("after-pick");
  };

  const clearPick = async (qId: string, statusAtCall: QuestionStatus) => {
    if (statusAtCall !== "open") {
      return;
    }
    if (!uid) return;

    const prev = picks[qId];
    if (prev === "none") return;

    setPicks((p) => ({ ...p, [qId]: "none" }));

    setSaving((s) => ({ ...s, [qId]: true }));
    try {
      const docRef = doc(db, "picks", uid, "season-2026", qId);
      await deleteDoc(docRef);
    } catch (er: unknown) {
      console.error("clearPick error:", er);
    } finally {
      setSaving((s) => ({ ...s, [qId]: false }));
    }

    void fetchMatch("after-clear");
  };

  const canShowPanic = (q: ApiQuestion, status: QuestionStatus, selected: LocalPick) => {
    if (roundNum < 1) return false;
    if (status !== "open") return false;
    if (selected === "none") return false;

    const already = Object.keys(personalVoids).length;
    return already === 0;
  };

  const triggerPanic = async (questionId: string) => {
    if (!uid) return;
    if (roundNum < 1) {
      setPanicErr("Panic not available for this round.");
      return;
    }

    const already = Object.keys(personalVoids).length;
    if (already > 0) {
      setPanicErr("Already used Panic for this round.");
      return;
    }

    setPanicBusy(true);
    setPanicErr("");

    try {
      await clearPick(questionId, "open");

      const k = `panicVoids_${SEASON}_R${roundNum}`;
      const arr = [questionId];
      localStorage.setItem(k, JSON.stringify(arr));
      setPersonalVoids({ [questionId]: true });

      setPanicModal(null);
    } catch (er: unknown) {
      setPanicErr(String((er as Error).message || er));
    } finally {
      setPanicBusy(false);
    }
  };

  const freeKickEligibleForThisGame = useMemo(() => {
    if (!sg) return false;
    return true;
  }, [sg]);

  const triggerFreeKickSeasonUse = () => {
    if (!freeKickModal) return;

    const k = `freeKick_used_season_${SEASON}`;
    localStorage.setItem(k, "true");
    setFreeKickUsedSeason(true);

    setFreeKickModal(null);
  };

  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/75 text-lg">
        Please sign in to continue.
      </div>
    );
  }

  if (!sg) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/75 text-lg">
        {err || "Loading picks…"}
      </div>
    );
  }

  const questions = sg.questions || [];

  const matchTitle = sg.match || "Game";
  const venueLine = sg.venue ? `${sg.venue} • ${new Date(sg.startTime).toLocaleString()}` : "";

  const matchStartMs = sg.startTime ? new Date(sg.startTime).getTime() : null;
  const nowMs = Date.now();
  const matchIsLocked = matchStartMs ? nowMs >= matchStartMs : false;

  const totalQuestions = questions.length;
  const selectedCount = Object.values(picks).filter((p) => p !== "none").length;
  const selectedPct = totalQuestions > 0 ? Math.round((selectedCount / totalQuestions) * 100) : 0;

  const lockedCount = questions.filter((q) => safeStatus(q.status) === "pending").length;

  return (
    <div className="min-h-screen" style={{ background: BRAND_BG }}>
      {panicModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => (panicBusy ? null : setPanicModal(null))} />
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0b0e] p-5 shadow-2xl">
            <div className="text-[12px] font-black tracking-[0.24em] text-white/55">PANIC BUTTON</div>
            <div className="mt-2 text-[18px] font-black text-white leading-snug">This will void this question for this round.</div>
            <div className="mt-3 text-[13px] text-white/75 leading-relaxed">
              No point earned, streak won't break. You only get <span className="text-white font-black">ONE</span> per round.
              Decision is final.
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/50 p-3">
              <div className="text-[11px] font-black tracking-[0.20em] text-white/55">QUESTION</div>
              <div className="mt-1 text-[14px] font-extrabold text-white/90">{panicModal.questionText}</div>
            </div>

            {panicErr ? (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200/90">
                {panicErr}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
                disabled={panicBusy}
                onClick={() => setPanicModal(null)}
              >
                CANCEL
              </button>

              <button
                type="button"
                className="rounded-full border border-rose-400/25 bg-rose-500/15 px-4 py-2 font-extrabold text-rose-100"
                disabled={panicBusy}
                onClick={() => void triggerPanic(panicModal.questionId)}
              >
                {panicBusy ? "VOIDING…" : "VOID"}
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/40">ARE YOU SURE?</div>
          </div>
        </div>
      ) : null}

      {freeKickModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setFreeKickModal(null)} />
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0b0e] p-5 shadow-2xl">
            <div className="text-[12px] font-black tracking-[0.24em] text-white/55">GOLDEN FREE KICK</div>
            <div className="mt-2 text-[18px] font-black text-white leading-snug">Use your one-time season insurance?</div>

            <div className="mt-3 text-[13px] text-white/75 leading-relaxed">
              If you lost this game, using Free Kick will protect your streak for this game.
              <span className="text-white/90 font-black"> You only get ONE for the whole season.</span>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/50 p-3">
              <div className="text-[11px] font-black tracking-[0.20em] text-white/55">GAME</div>
              <div className="mt-1 text-[14px] font-extrabold text-white/90">{freeKickModal.label}</div>
            </div>

            {freeKickErr ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200/90">
                {freeKickErr}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
                onClick={() => setFreeKickModal(null)}
              >
                CANCEL
              </button>

              <button
                type="button"
                className="rounded-full border border-amber-400/25 bg-amber-500/15 px-4 py-2 font-extrabold text-amber-100"
                onClick={() => triggerFreeKickSeasonUse()}
              >
                USE FREE KICK
              </button>
            </div>

            <div className="mt-3 text-[11px] text-white/40">Decision is final.</div>
          </div>
        </div>
      ) : null}

      {/* Updated Top Section - matching image 2 style */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        {/* Title and Refresh Button */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-[28px] md:text-[34px] font-black tracking-wide text-white">{matchTitle}</div>

          <button
            type="button"
            className="rounded-xl border px-4 py-2 font-black text-sm tracking-[0.10em]"
            style={{
              borderColor: "rgba(0,229,255,0.45)",
              background: "rgba(0,0,0,0.55)",
              color: "rgba(0,229,255,0.95)",
              boxShadow: "0 0 18px rgba(0,229,255,0.14)",
            }}
            onClick={() => void fetchMatch("refresh")}
          >
            REFRESH
          </button>
        </div>

        {/* Picks count and Locks inline */}
        <div className="flex items-center justify-between text-[14px] text-white/80 mb-3">
          <div>
            Picks selected: <span className="text-white font-bold">{selectedCount} / {totalQuestions}</span>
          </div>
          <div>
            Locks: <span className="text-white font-bold">{lockedCount}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/10 border border-white/10 mb-2">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${selectedPct}%`,
              background: `linear-gradient(90deg, rgba(255,46,77,0.95), rgba(255,46,77,0.45))`,
              boxShadow: "0 0 18px rgba(255,46,77,0.18)",
            }}
          />
        </div>

        {err ? (
          <div className="mt-3 text-sm text-rose-200/80 bg-rose-500/10 border border-rose-400/20 rounded-2xl px-4 py-2">{err}</div>
        ) : null}
      </div>

      {/* Cards Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-24 pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {questions.map((q, idx) => {
            const baseStatus = safeStatus(q.status);
            const isPersonallyVoided = !!personalVoids[q.id];
            const status: QuestionStatus = isPersonallyVoided ? "void" : baseStatus;

            const qNum = String(idx + 1).padStart(2, "0");
            const selected = picks[q.id] || "none";
            const isSaving = !!saving[q.id];

            const panicEnabledHere = canShowPanic(q, status, selected);

            if (q.isSponsorQuestion) {
              return (
                <SponsorMysteryCard
                  key={q.id}
                  q={q}
                  status={status}
                  matchStartMs={matchStartMs}
                  matchIsLocked={matchIsLocked}
                  selected={selected}
                  isSaving={isSaving}
                  freeKickEnabledHere={freeKickEligibleForThisGame}
                  freeKickUsedSeason={freeKickUsedSeason}
                  onOpenFreeKick={() => setFreeKickModal({ gameId: sg.id, label: `${sg.match}` })}
                  onClearPick={() => void clearPick(q.id, status)}
                  onSetPickYes={() => void setPick(q.id, "yes", status)}
                  onSetPickNo={() => void setPick(q.id, "no", status)}
                />
              );
            }

            return (
              <PickCard
                key={q.id}
                q={q}
                qNum={qNum}
                status={status}
                isPersonallyVoided={isPersonallyVoided}
                match={sg.match}
                matchIsLocked={matchIsLocked}
                matchStartMs={matchStartMs}
                selected={selected}
                isSaving={isSaving}
                freeKickEligibleForThisGame={freeKickEligibleForThisGame}
                freeKickUsedSeason={freeKickUsedSeason}
                panicEnabledHere={panicEnabledHere}
                onOpenPanic={() => setPanicModal({ questionId: q.id, questionText: q.question })}
                onOpenFreeKick={() => setFreeKickModal({ gameId: sg.id, label: `${sg.match}` })}
                onSetPick={(v) => void setPick(q.id, v, status)}
                onClearPick={() => void clearPick(q.id, status)}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 bg-black/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-white/70">
          <div className="rounded-full border border-white/15 px-3 py-1">
            Picks selected: <span className="font-semibold text-white">{selectedCount}</span> / {totalQuestions}
          </div>

          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
            onClick={() => void fetchMatch("refresh")}
          >
            REFRESH
          </button>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
