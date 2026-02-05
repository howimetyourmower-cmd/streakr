// /app/picks/[gameId]/MatchPicksClient.tsx
"use client";

/**
 * What this update does (makes it work + fixes your UI issues):
 *
 * ✅ Fixes the client-side crash by HARDENING the data shape:
 *    - Your API sometimes returns `questions` as an OBJECT (map) instead of an ARRAY.
 *    - This file now normalizes questions safely so `.map/.sort/.filter` never blow up.
 *
 * ✅ Removes the big top “PANIC BUTTON / FREE KICK” tiles (you said no need for them).
 *
 * ✅ Updates the in-card Panic + Free Kick buttons to match Image 3 style:
 *    - Uses your actual asset paths from /public/screamr:
 *        /screamr/panic-button.png
 *        /screamr/free-kick.png
 *    - Mini plates (glow + metallic inset + crisp contain)
 *
 * ✅ Fixes “avatars flashing every second”:
 *    - Previously the WHOLE page re-rendered every second (global timer).
 *    - Now the page does NOT tick every second.
 *    - Only the countdown chip itself ticks inside each card.
 *    - Match lock state updates once at bounce time via setTimeout (no 1s rerender loop).
 *
 * ✅ Fixes game-pick question layout:
 *    - BOTH team logos appear side-by-side on TOP
 *    - Question sits BELOW (no overlap / no logo floating over text)
 */

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
  questions: any; // hardened: API can return array OR object
};

type PicksApiResponse = {
  games: any[];
  roundNumber?: number;
};

const BRAND_BG = "#000000";
const SEASON = 2026; // localStorage keys only (beta)

/* ----------------------------- HARDENING ----------------------------- */

function normalizeQuestions(input: any): ApiQuestion[] {
  // Supports:
  // - array of questions
  // - object/map of questions keyed by id
  // - null/undefined/garbage -> []
  try {
    if (!input) return [];
    if (Array.isArray(input)) return input as ApiQuestion[];

    if (typeof input === "object") {
      const vals = Object.values(input);
      return (Array.isArray(vals) ? vals : []) as ApiQuestion[];
    }

    return [];
  } catch {
    return [];
  }
}

function normalizeGames(input: any): ApiGame[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as ApiGame[];
  if (typeof input === "object") return Object.values(input) as ApiGame[];
  return [];
}

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
    /^[A-Z][A-Za-z'’\-]+$/.test(w) || /^[A-Z][A-Za-z'’\-]+$/.test(w.replace(/[^A-Za-z'’\-]/g, ""));

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
  const [dead, setDead] = useState(false);

  const fallbackInitials = (teamName || "AFL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (!slug || dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.90)",
        }}
        title={teamName}
      >
        {fallbackInitials || "AFL"}
      </div>
    );
  }

  const candidates = logoCandidates(slug);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        width: size,
        height: size,
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.35)",
      }}
      title={teamName}
    >
      <div className="absolute inset-0 p-2">
        <Image
          src={src}
          alt={`${teamName} logo`}
          fill
          sizes={`${size}px`}
          style={{ objectFit: "contain" }}
          onError={() => {
            setIdx((p) => {
              if (p + 1 < candidates.length) return p + 1;
              setDead(true);
              return p;
            });
          }}
        />
      </div>
    </div>
  );
});

/* UI bits */

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

const CommunityPulse = memo(function CommunityPulse({ yes, no }: { yes: number; no: number }) {
  let y = clampPct(yes);
  let n = clampPct(no);

  const total = y + n;
  if (total <= 0) {
    y = 0;
    n = 0;
  } else if (Math.abs(total - 100) > 0.5) {
    y = (y / total) * 100;
    n = 100 - y;
  }

  const yesPct = Math.round(y);
  const noPct = Math.round(n);

  return (
    <div className="mt-5">
      <div className="text-[11px] font-black tracking-[0.22em] text-white/60 text-center">COMMUNITY PULSE</div>

      <div className="mt-2 h-[10px] w-full overflow-hidden rounded-full bg-white/10 border border-white/10">
        <div className="h-full flex">
          <div
            className="h-full"
            style={{
              width: `${yesPct}%`,
              background: `linear-gradient(90deg, rgba(0,229,255,0.95), rgba(0,229,255,0.55))`,
              boxShadow: `0 0 18px rgba(0,229,255,0.25)`,
            }}
          />
          <div
            className="h-full"
            style={{
              width: `${Math.max(0, 100 - yesPct)}%`,
              background: `linear-gradient(90deg, rgba(255,46,77,0.55), rgba(255,46,77,0.95))`,
              boxShadow: `0 0 18px rgba(255,46,77,0.20)`,
            }}
          />
        </div>
      </div>

      <div className="mt-2 text-[11px] font-semibold text-white/70 text-center">
        Yes {yesPct}% <span className="text-white/35">•</span> No {noPct}%
      </div>
    </div>
  );
});

function ResultPill({
  status,
  selected,
  correctPick,
  outcome,
}: {
  status: QuestionStatus;
  selected: LocalPick;
  correctPick: boolean | null | undefined;
  outcome: QuestionOutcome | undefined;
}) {
  const isDone = status === "final" || status === "void";
  if (!isDone) return null;

  const base = "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]";

  if (status === "void" || outcome === "void") {
    return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>VOID</span>;
  }

  if (selected === "none") {
    return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>NO PICK</span>;
  }

  if (correctPick === true) {
    return <span className={`${base} border-emerald-400/30 bg-emerald-400/10 text-emerald-200`}>✅ CORRECT</span>;
  }

  if (correctPick === false) {
    return <span className={`${base} border-rose-400/30 bg-rose-400/10 text-rose-200`}>❌ WRONG</span>;
  }

  return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>FINAL</span>;
}

const QuestionText = memo(function QuestionText({ text }: { text: string }) {
  const style: React.CSSProperties = {
    lineHeight: 1.22,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  return (
    <div className="text-[17px] md:text-[18px] font-extrabold text-white break-words" style={style}>
      {text}
    </div>
  );
});

/* Avatars / Logos */

const PlayerAvatar = memo(function PlayerAvatar({ name }: { name: string }) {
  // stable URLs (no timer-based cache busters)
  const exact = useRef(`/players/${encodeURIComponent(name)}.jpg`);
  const slug = useRef(`/players/${playerSlug(name)}.jpg`);
  const [src, setSrc] = useState(exact.current);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[112px] w-[112px]">
        <div className="absolute inset-0 rounded-full blur-[18px] opacity-60" style={{ background: "rgba(255,46,77,0.55)" }} />
        <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,46,77,0.95)" }} />
        <div className="absolute inset-[3px] rounded-full bg-black/55 border border-white/10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => {
              if (src === exact.current) setSrc(slug.current);
            }}
          />
        </div>
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ boxShadow: "0 0 28px rgba(255,46,77,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        />
      </div>

      <div className="text-[11px] font-black tracking-[0.20em] text-white/55">PLAYER PICK</div>
    </div>
  );
});

const TeamLogoBadge = memo(function TeamLogoBadge({ teamName, size = 64 }: { teamName: string; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full blur-[14px] opacity-35" style={{ background: "rgba(255,46,77,0.35)" }} />
      <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,46,77,0.95)" }} />
      <div className="absolute inset-[3px] rounded-full bg-black/55 border border-white/10 overflow-hidden flex items-center justify-center">
        <TeamLogo teamName={teamName} size={Math.max(44, size - 22)} />
      </div>
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: "0 0 22px rgba(255,46,77,0.24), inset 0 0 0 1px rgba(255,255,255,0.08)" }}
      />
    </div>
  );
});

const GamePickTopLogos = memo(function GamePickTopLogos({ match }: { match: string }) {
  const { home, away } = parseTeams(match);
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <TeamLogoBadge teamName={home} size={76} />
      </div>

      <div className="text-[12px] font-black tracking-[0.24em] text-white/55">VS</div>

      <div className="flex flex-col items-center gap-2">
        <TeamLogoBadge teamName={away || "AFL"} size={76} />
      </div>
    </div>
  );
});

/* Feature plates (Image 3 style) */

function MiniFeaturePlate({
  variant,
  disabled,
  onClick,
}: {
  variant: "panic" | "freekick";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const isPanic = variant === "panic";
  // ✅ your actual repo paths: /public/screamr/...
  const imgPath = isPanic ? "/screamr/panic-button.png" : "/screamr/free-kick.png";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled}
      className={[
        "relative h-[44px] w-[96px] rounded-2xl overflow-hidden border",
        "transition active:scale-[0.99]",
        disabled ? "opacity-45 grayscale cursor-not-allowed" : "hover:brightness-110",
      ].join(" ")}
      style={{
        borderColor: isPanic ? "rgba(255,46,77,0.55)" : "rgba(246,198,75,0.55)",
        background: isPanic
          ? "linear-gradient(180deg, rgba(255,46,77,0.22), rgba(0,0,0,0.84))"
          : "linear-gradient(180deg, rgba(246,198,75,0.22), rgba(0,0,0,0.84))",
        boxShadow: disabled
          ? "none"
          : isPanic
          ? "0 0 22px rgba(255,46,77,0.14)"
          : "0 0 22px rgba(246,198,75,0.12)",
      }}
      aria-label={isPanic ? "Panic Button" : "Free Kick"}
      title={isPanic ? "Panic" : "Free Kick"}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 -14px 18px rgba(0,0,0,0.55), inset 0 14px 18px rgba(255,255,255,0.06)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgPath}
        alt={variant}
        className="relative z-10 w-full h-full object-contain p-1"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </button>
  );
}

/* Countdown chip (ONLY thing ticking each second) */

const CountdownChip = memo(function CountdownChip({ matchStartMs }: { matchStartMs: number | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!matchStartMs) return <div className="screamr-chip">—</div>;

  const remaining = matchStartMs - nowMs;
  if (remaining <= 0) return <div className="screamr-chip">LOCKED</div>;
  return <div className="screamr-chip">{msToCountdown(remaining)}</div>;
});

type PanicModalState =
  | null
  | {
      questionId: string;
      questionText: string;
    };

type FreeKickModalState =
  | null
  | {
      gameId: string;
      label: string;
    };

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

  onSetPick: (value: PickOutcome) => void;
  onClearPick: () => void;
};

const PickCard = memo(function PickCard(props: PickCardProps) {
  const {
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
  } = props;

  const isLocked = status !== "open" || isPersonallyVoided;
  const playerName = extractPlayerName(q.question);
  const isPlayerPick = !!playerName;

  const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
  const no = typeof q.noPercent === "number" ? q.noPercent : 0;

  const yesBtn = selected === "yes" ? "btn-yes btn-yes--selected" : "btn-yes";
  const noBtn = selected === "no" ? "btn-no btn-no--selected" : "btn-no";

  const freeKickEnabledHere = freeKickEligibleForThisGame && !freeKickUsedSeason;

  return (
    <div className="screamr-card p-5">
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
        <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
      </div>
      <div className="screamr-sparks" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-black tracking-[0.12em] text-white/90">
              Q{qNum} — {formatQuarterLabel(q.quarter)}
            </div>
            <div className="mt-1 text-[12px] text-white/55">
              Status: <span className="text-white/70">{status}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <ResultPill
                status={status}
                selected={selected}
                correctPick={q.correctPick}
                outcome={isPersonallyVoided ? "void" : q.correctOutcome ?? q.outcome}
              />
              {isSaving ? <span className="text-[11px] font-black tracking-[0.12em] text-white/35">SAVING…</span> : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <MiniFeaturePlate variant="panic" disabled={!panicEnabledHere} onClick={panicEnabledHere ? onOpenPanic : undefined} />
              <MiniFeaturePlate
                variant="freekick"
                disabled={!freeKickEnabledHere}
                onClick={freeKickEnabledHere ? onOpenFreeKick : undefined}
              />
            </div>

            <CountdownChip matchStartMs={matchStartMs} />

            <button
              type="button"
              className={`h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center ${
                isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
              }`}
              aria-label="Clear pick"
              disabled={isLocked || isSaving}
              onClick={onClearPick}
              title="Clear pick"
            >
              <span className="text-white/85 font-black">×</span>
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/50 p-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              background: "radial-gradient(760px 260px at 50% 0%, rgba(255,46,77,0.28), rgba(0,0,0,0) 65%)",
            }}
          />
          <div className="relative">
            {/* Layout rules:
                - PLAYER pick: avatar left, question right
                - GAME pick: logos side-by-side on TOP, question underneath (no overlap)
            */}
            {isPlayerPick ? (
              <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-center">
                <div className="flex justify-center">{playerName ? <PlayerAvatar name={playerName} /> : null}</div>

                <div>
                  <QuestionText text={q.question} />

                  <div className="mt-4">
                    <div className="text-[12px] font-black tracking-[0.18em] text-white/70">PLAYER INTEL</div>
                    <div className="text-[11px] font-black tracking-[0.16em] text-white/45">LAST 5 GAMES</div>

                    <div className="mt-2 flex items-end justify-start gap-2 h-10">
                      {[7, 14, 10, 18, 12].map((h, i) => (
                        <div
                          key={i}
                          className="w-4 rounded-sm"
                          style={{
                            height: `${h * 1.8}px`,
                            background: i === 3 ? "rgba(0,229,255,0.85)" : "rgba(0,229,255,0.45)",
                            boxShadow: "0 0 14px rgba(0,229,255,0.12)",
                          }}
                        />
                      ))}
                    </div>

                    <div className="mt-2 text-[12px] text-white/70">
                      Avg: <span className="font-black text-white/85">7.2 Disp</span> /{" "}
                      <span className="font-black text-white/85">1.5 Goals</span>
                      <span className="text-white/35"> (beta placeholder)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* ✅ both team logos on top, side by side */}
                <div className="flex justify-center">
                  <GamePickTopLogos match={match} />
                </div>

                {/* ✅ question below (no overlap) */}
                <div className="mt-4 text-center">
                  <QuestionText text={q.question} />
                  <div className="mt-3 text-[11px] font-black tracking-[0.20em] text-white/55">GAME PICK — TEAM VS TEAM</div>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isLocked || isSaving}
                className={`h-16 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                  isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                } ${yesBtn}`}
                onClick={() => onSetPick("yes")}
              >
                YES
              </button>

              <button
                type="button"
                disabled={isLocked || isSaving}
                className={`h-16 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                  isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                } ${noBtn}`}
                onClick={() => onSetPick("no")}
              >
                NO
              </button>
            </div>

            <CommunityPulse yes={yes} no={no} />

            {isPersonallyVoided ? (
              <div className="mt-3 text-center text-[11px] font-black tracking-[0.16em] text-white/55">
                PERSONAL VOID — streak protected
              </div>
            ) : null}

            {freeKickUsedSeason ? (
              <div className="mt-3 text-center text-[11px] font-black tracking-[0.16em] text-white/45">
                FREE KICK: USED (SEASON)
              </div>
            ) : null}

            {freeKickEligibleForThisGame && !freeKickUsedSeason ? (
              <div className="mt-3 text-center text-[11px] text-white/55">
                Free Kick available (season): you lost this game — use once to protect streak.
              </div>
            ) : null}

            {!matchIsLocked ? <div className="mt-3 text-center text-[11px] text-white/35">Locks at bounce.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
});

type SponsorCardProps = {
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

const SponsorMysteryCard = memo(function SponsorMysteryCard(props: SponsorCardProps) {
  const {
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
  } = props;

  const sponsorName = (q.sponsorName || "SPONSOR").toUpperCase();

  const isRevealTime = matchIsLocked;
  const showQuestionText = isRevealTime;
  const locked = status !== "open" || isRevealTime;

  const yesSelected = selected === "yes";
  const noSelected = selected === "no";

  return (
    <div className="screamr-card p-5 flex flex-col">
      <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
        <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
      </div>
      <div className="screamr-sparks" />

      <div className="relative flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-black tracking-[0.10em] text-white/90">
              SPONSOR — {formatQuarterLabel(q.quarter)}
            </div>
            <div className="mt-1 text-[12px] text-white/60">
              Status: <span className="text-white/70">{status}</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <ResultPill status={status} selected={selected} correctPick={q.correctPick} outcome={q.correctOutcome ?? q.outcome} />
              {isSaving ? <span className="text-[11px] font-black tracking-[0.12em] text-white/35">SAVING…</span> : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <MiniFeaturePlate variant="panic" disabled />
              <MiniFeaturePlate
                variant="freekick"
                disabled={!freeKickEnabledHere || freeKickUsedSeason}
                onClick={freeKickEnabledHere && !freeKickUsedSeason ? onOpenFreeKick : undefined}
              />
            </div>

            <CountdownChip matchStartMs={matchStartMs} />

            <button
              type="button"
              className={`h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center ${
                locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
              }`}
              aria-label="Clear pick"
              disabled={locked || isSaving}
              onClick={onClearPick}
              title="Clear pick"
            >
              <span className="text-white/85 font-black">×</span>
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/55 px-4 py-4 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.55]"
            style={{ background: "radial-gradient(600px 220px at 50% 0%, rgba(255,46,77,0.35), rgba(0,0,0,0) 65%)" }}
          />
          <div className="relative">
            <div className="text-[13px] font-black tracking-[0.20em] text-white/85">{sponsorName}</div>
            <div
              className="mt-2 inline-block rounded-xl px-4 py-2 border"
              style={{
                borderColor: "rgba(255,46,77,0.65)",
                boxShadow: "0 0 26px rgba(255,46,77,0.20)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              <div className="text-[22px] font-black tracking-[0.12em] text-white" style={{ textShadow: "0 0 16px rgba(255,46,77,0.35)" }}>
                MYSTERY GAMBLE
              </div>
            </div>
            <div className="mt-2 text-[12px] font-black tracking-[0.18em] text-white/75">THE VAULT IS LOCKED!</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/55 p-4 relative overflow-hidden">
          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 text-center relative overflow-hidden" style={{ minHeight: 150 }}>
            {!showQuestionText ? (
              <>
                <div className="absolute inset-0 backdrop-blur-[2px]" />
                <div className="relative flex items-center justify-center" style={{ minHeight: 130 }}>
                  <div
                    className="text-[90px] font-black"
                    style={{
                      color: "rgba(255,215,110,0.95)",
                      textShadow: "0 0 22px rgba(255,215,110,0.25)",
                    }}
                  >
                    ?
                  </div>
                </div>
              </>
            ) : (
              <div className="relative flex flex-col items-center justify-center text-center" style={{ minHeight: 130 }}>
                <div className="text-[15px] font-extrabold text-white/95">{q.question}</div>
              </div>
            )}
          </div>

          {!isRevealTime && matchStartMs ? (
            <div className="mt-4 text-center">
              <div className="text-[12px] font-black tracking-[0.22em]" style={{ color: "rgba(255,46,77,0.95)" }}>
                REVEAL IN: <span className="text-white/90 font-black">see timer</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center">
              <div className="text-[12px] font-black tracking-[0.22em] text-white/70">REVEALED</div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={locked || isSaving}
              className={`h-14 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                locked || isSaving ? "opacity-50 cursor-not-allowed" : ""
              } ${yesSelected ? "btn-yes btn-yes--selected" : "btn-yes"}`}
              onClick={onSetPickYes}
            >
              BLIND YES
            </button>

            <button
              type="button"
              disabled={locked || isSaving}
              className={`h-14 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                locked || isSaving ? "opacity-50 cursor-not-allowed" : ""
              } ${noSelected ? "btn-no btn-no--selected" : "btn-no"}`}
              onClick={onSetPickNo}
            >
              BLIND NO
            </button>
          </div>

          <div className="mt-3 text-center text-[12px] text-white/70 font-semibold">
            Correct pick goes into the draw to win a <span className="text-white/90 font-black">$250 {sponsorName} voucher</span>.
          </div>
        </div>

        <div className="mt-3 text-center text-[11px] text-white/45">* One sponsor question per round. Hidden until lock.</div>
      </div>
    </div>
  );
});

export default function MatchPicksClient({ gameId }: { gameId: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [game, setGame] = useState<ApiGame | null>(null);
  const lastGameRef = useRef<ApiGame | null>(null);

  const [picks, setPicks] = useState<Record<string, LocalPick>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [panicUsed, setPanicUsed] = useState(false);
  const [personalVoids, setPersonalVoids] = useState<Record<string, true>>({});
  const [panicModal, setPanicModal] = useState<PanicModalState>(null);
  const [panicBusy, setPanicBusy] = useState(false);
  const [panicErr, setPanicErr] = useState<string | null>(null);

  const [freeKickUsedSeason, setFreeKickUsedSeason] = useState(false);
  const [freeKickModal, setFreeKickModal] = useState<FreeKickModalState>(null);
  const [freeKickErr, setFreeKickErr] = useState<string | null>(null);

  // ✅ stop whole-page 1s rerenders (prevents avatar flashing)
  const [matchIsLocked, setMatchIsLocked] = useState(false);

  const roundNumber = useMemo(() => roundNumberFromGameId(gameId), [gameId]);
  const uidForStorage = user?.uid || "anon";

  const picksStorageKey = useMemo(() => `torpie:picks:${uidForStorage}:${gameId}`, [uidForStorage, gameId]);
  const panicUsedKey = useMemo(() => `torpie:panicUsed:${uidForStorage}:R${roundNumber}`, [uidForStorage, roundNumber]);
  const personalVoidsKey = useMemo(() => `torpie:personalVoids:${uidForStorage}:R${roundNumber}`, [uidForStorage, roundNumber]);
  const freeKickUsedSeasonKey = useMemo(() => `torpie:freeKickUsed:${uidForStorage}:S${SEASON}`, [uidForStorage]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(picksStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, LocalPick>;
      if (parsed && typeof parsed === "object") setPicks(parsed);
    } catch {}
  }, [picksStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(picksStorageKey, JSON.stringify(picks));
    } catch {}
  }, [picks, picksStorageKey]);

  useEffect(() => {
    try {
      const rawUsed = localStorage.getItem(panicUsedKey);
      setPanicUsed(rawUsed === "1");
    } catch {}

    try {
      const rawVoids = localStorage.getItem(personalVoidsKey);
      if (!rawVoids) setPersonalVoids({});
      else {
        const parsed = JSON.parse(rawVoids) as Record<string, true>;
        if (parsed && typeof parsed === "object") setPersonalVoids(parsed);
      }
    } catch {
      setPersonalVoids({});
    }

    try {
      const rawFK = localStorage.getItem(freeKickUsedSeasonKey);
      setFreeKickUsedSeason(rawFK === "1");
    } catch {}
  }, [panicUsedKey, personalVoidsKey, freeKickUsedSeasonKey]);

  useEffect(() => {
    try {
      localStorage.setItem(personalVoidsKey, JSON.stringify(personalVoids));
    } catch {}
  }, [personalVoids, personalVoidsKey]);

  async function fetchMatch(mode: "initial" | "refresh" = "refresh") {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    setErr(null);

    try {
      const headers: Record<string, string> = {};
      if (user) {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/picks?round=${roundNumber}`, { cache: "no-store", headers });
      if (!res.ok) throw new Error(`API error (${res.status})`);

      const data = (await res.json()) as PicksApiResponse;

      const gamesArr = normalizeGames(data.games);
      const found = gamesArr.find((g: any) => String(g?.id) === String(gameId));
      if (!found) throw new Error("Game not found for this gameId");

      const fixed: ApiGame = {
        ...found,
        questions: normalizeQuestions(found.questions),
      };

      setGame(fixed);
      lastGameRef.current = fixed;

      const seeded: Record<string, LocalPick> = {};
      for (const q of normalizeQuestions(fixed.questions)) {
        if (q?.userPick === "yes" || q?.userPick === "no") seeded[q.id] = q.userPick;
      }

      setPicks((prev) => ({ ...prev, ...seeded }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load picks";
      setErr(msg);
    } finally {
      if (mode === "initial") setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchMatch("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.uid]);

  const stableGame = game ?? lastGameRef.current;

  const matchStartMs = useMemo(() => {
    const iso = stableGame?.startTime;
    const t = iso ? new Date(iso).getTime() : Number.NaN;
    return Number.isFinite(t) ? t : null;
  }, [stableGame?.startTime]);

  // ✅ match lock state updates ONCE at bounce, not every second
  useEffect(() => {
    if (!matchStartMs) {
      setMatchIsLocked(false);
      return;
    }

    const remaining = matchStartMs - Date.now();
    if (remaining <= 0) {
      setMatchIsLocked(true);
      return;
    }

    setMatchIsLocked(false);
    const id = window.setTimeout(() => setMatchIsLocked(true), remaining + 50);
    return () => window.clearTimeout(id);
  }, [matchStartMs]);

  const questions = useMemo(() => {
    const qs = normalizeQuestions(stableGame?.questions);
    const clean = qs.filter((q) => q && typeof q === "object" && typeof q.id === "string");
    return [...clean].sort((a, b) => (a.quarter ?? 0) - (b.quarter ?? 0) || String(a.id).localeCompare(String(b.id)));
  }, [stableGame]);

  const selectedCount = useMemo(() => Object.values(picks).filter((v) => v === "yes" || v === "no").length, [picks]);
  const totalQuestions = questions.length || 0;

  const lockedCount = useMemo(() => {
    return questions.filter((q) => {
      if (personalVoids[q.id]) return true;
      return safeStatus(q.status) !== "open";
    }).length;
  }, [questions, personalVoids]);

  const selectedPct = useMemo(() => {
    if (totalQuestions <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((selectedCount / totalQuestions) * 100)));
  }, [selectedCount, totalQuestions]);

  async function persistPick(questionId: string, next: LocalPick) {
    if (!user) return;

    setSaving((prev) => ({ ...prev, [questionId]: true }));
    try {
      const ref = doc(db, "picks", `${user.uid}_${questionId}`);

      if (next === "none") {
        await deleteDoc(ref);
      } else {
        await setDoc(
          ref,
          {
            userId: user.uid,
            questionId,
            pick: next,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      void fetchMatch("refresh");
    } catch (e) {
      console.error("[MatchPicksClient] failed to persist pick", e);
    } finally {
      setSaving((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function setPick(questionId: string, value: PickOutcome, status: QuestionStatus) {
    if (status !== "open") return;
    if (personalVoids[questionId]) return;

    setPicks((prev) => {
      const current = prev[questionId] || "none";
      const next: LocalPick = current === value ? "none" : value;
      void persistPick(questionId, next);
      return { ...prev, [questionId]: next };
    });
  }

  async function clearPick(questionId: string, status: QuestionStatus) {
    if (status !== "open") return;
    if (personalVoids[questionId]) return;

    setPicks((prev) => {
      void persistPick(questionId, "none");
      return { ...prev, [questionId]: "none" };
    });
  }

  function canShowPanic(q: ApiQuestion, displayStatus: QuestionStatus, selected: LocalPick) {
    if (!user) return false;
    if (!matchIsLocked) return false;
    if (q.isSponsorQuestion) return false;
    if (panicUsed) return false;
    if (personalVoids[q.id]) return false;
    if (displayStatus === "final" || displayStatus === "void") return false;
    if (!(selected === "yes" || selected === "no")) return false;
    return true;
  }

  async function triggerPanic(questionId: string) {
    if (!user) return;
    setPanicErr(null);
    setPanicBusy(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/panic", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roundNumber,
          questionId,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Panic failed (${res.status})`);
      }

      setPanicUsed(true);
      try {
        localStorage.setItem(panicUsedKey, "1");
      } catch {}

      setPersonalVoids((prev) => ({ ...prev, [questionId]: true }));
      void fetchMatch("refresh");
    } catch (e: unknown) {
      console.error("[MatchPicksClient] panic failed", e);
      const msg = e instanceof Error ? e.message : "Panic failed";
      setPanicErr(msg);
    } finally {
      setPanicBusy(false);
      setPanicModal(null);
    }
  }

  const freeKickEligibleForThisGame = useMemo(() => {
    if (!user) return false;
    if (!stableGame) return false;
    if (freeKickUsedSeason) return false;

    const qArr = normalizeQuestions(stableGame.questions);

    const answered = qArr.filter((q) => {
      const pick = picks[q.id];
      return pick === "yes" || pick === "no";
    });

    if (answered.length === 0) return false;

    const allSettled = answered.every((q) => {
      const st = safeStatus(q.status);
      return st === "final" || st === "void";
    });
    if (!allSettled) return false;

    const anyWrong = answered.some((q) => {
      const st = safeStatus(q.status);
      if (st === "void") return false;
      if (personalVoids[q.id]) return false;

      const out = q.correctOutcome ?? q.outcome;
      if (out !== "yes" && out !== "no") return false;

      const pick = picks[q.id];
      return pick === "yes" || pick === "no" ? pick !== out : false;
    });

    return anyWrong;
  }, [user, stableGame, freeKickUsedSeason, picks, personalVoids]);

  function triggerFreeKickSeasonUse() {
    setFreeKickErr(null);
    try {
      localStorage.setItem(freeKickUsedSeasonKey, "1");
    } catch {}
    setFreeKickUsedSeason(true);
    setFreeKickModal(null);
  }

  // ---------- RENDER GUARDS ----------
  if (loading && !stableGame) {
    return (
      <div className="min-h-[70vh] text-white px-4 py-8" style={{ background: BRAND_BG }}>
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-72 rounded bg-white/10 animate-pulse" />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((err && !stableGame) || !stableGame) {
    return (
      <div className="min-h-[70vh] text-white px-4 py-10" style={{ background: BRAND_BG }}>
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black tracking-wide">Couldn’t load match</div>
          <div className="mt-2 text-white/70 text-sm">{err || "Unknown error"}</div>
          <div className="mt-4 text-white/40 text-xs">
            GameId: <span className="font-mono">{gameId}</span>
          </div>
          <button
            type="button"
            className="mt-5 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
            onClick={() => void fetchMatch("initial")}
          >
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  // ✅ stableGame is non-null from here
  const sg: ApiGame = stableGame as ApiGame;

  const { home } = parseTeams(sg.match);
  const matchTitle = `${home.toUpperCase()}`;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: BRAND_BG,
        opacity: refreshing ? 0.78 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      <style>{`
        .screamr-card{
          position: relative;
          border-radius: 28px;
          overflow: hidden;
          background: rgba(10,10,12,0.92);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow:
            0 26px 90px rgba(0,0,0,0.82),
            0 0 0 1px rgba(255,46,77,0.06);
        }
        .screamr-card::before{
          content:"";
          position:absolute;
          inset:0;
          border-radius: 28px;
          padding: 2px;
          background: linear-gradient(180deg, rgba(255,46,77,0.95), rgba(255,46,77,0.10));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events:none;
          opacity:0.80;
        }
        .screamr-card::after{
          content:"";
          position:absolute;
          inset:-46px;
          background: radial-gradient(680px 280px at 50% 0%, rgba(255,46,77,0.24), rgba(0,0,0,0) 64%);
          pointer-events:none;
        }

        .screamr-sparks{
          position:absolute;
          inset:0;
          pointer-events:none;
          opacity:0.22;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(circle at 12% 78%, rgba(0,229,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 22%, rgba(255,46,77,0.38) 0 2px, transparent 3px),
            radial-gradient(circle at 55% 62%, rgba(255,255,255,0.22) 0 1px, transparent 2px);
          background-size: 220px 220px;
          animation: sparksMove 6.5s linear infinite;
        }
        @keyframes sparksMove{
          0%{ transform: translate3d(0,0,0); }
          100%{ transform: translate3d(-220px, -220px, 0); }
        }

        .screamr-chip{
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          padding: 8px 10px;
          border-radius: 14px;
          border: 1px solid rgba(255,46,77,0.40);
          background: rgba(0,0,0,0.60);
          color: rgba(255,255,255,0.92);
          box-shadow: 0 0 18px rgba(255,46,77,0.18);
          min-width: 160px;
          text-align:center;
        }

        .btn-yes {
          border: 1px solid rgba(0,229,255,0.55);
          background: rgba(0,229,255,0.14);
          box-shadow: 0 0 28px rgba(0,229,255,0.18);
          color: rgba(255,255,255,0.96);
        }
        .btn-yes--selected {
          background: linear-gradient(180deg, rgba(0,229,255,0.98), rgba(0,229,255,0.40));
          border-color: rgba(0,229,255,0.85);
          box-shadow: 0 0 40px rgba(0,229,255,0.26);
          color: rgba(0,0,0,0.92);
        }
        .btn-no {
          border: 1px solid rgba(255,46,77,0.55);
          background: rgba(255,46,77,0.14);
          box-shadow: 0 0 28px rgba(255,46,77,0.16);
          color: rgba(255,255,255,0.96);
        }
        .btn-no--selected {
          background: linear-gradient(180deg, rgba(255,46,77,0.98), rgba(255,46,77,0.35));
          border-color: rgba(255,46,77,0.85);
          box-shadow: 0 0 40px rgba(255,46,77,0.22);
          color: rgba(255,255,255,0.98);
        }
      `}</style>

      {/* Panic confirm modal */}
      {panicModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => (panicBusy ? null : setPanicModal(null))} />
          <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0b0e] p-5 shadow-2xl">
            <div className="text-[12px] font-black tracking-[0.24em] text-white/55">PANIC BUTTON</div>
            <div className="mt-2 text-[18px] font-black text-white leading-snug">This will void this question for this round.</div>
            <div className="mt-3 text-[13px] text-white/75 leading-relaxed">
              No point earned, streak won’t break. You only get <span className="text-white font-black">ONE</span> per round.
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

      {/* Free kick modal */}
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

      {/* Top app bar */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-[28px] md:text-[34px] font-black tracking-wide">{matchTitle}</div>

          <button
            type="button"
            className="rounded-xl border px-4 py-2 font-black tracking-[0.10em]"
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

        <div className="mt-4 flex items-center justify-between text-[13px] text-white/75">
          <div>
            Picks selected:{" "}
            <span className="text-white font-black">
              {selectedCount} / {totalQuestions}
            </span>
          </div>
          <div>
            Locks: <span className="text-white font-black">{lockedCount}</span>
          </div>
        </div>

        <div className="mt-2 h-[8px] w-full overflow-hidden rounded-full bg-white/10 border border-white/10">
          <div
            className="h-full"
            style={{
              width: `${selectedPct}%`,
              background: `linear-gradient(90deg, rgba(255,46,77,0.95), rgba(255,46,77,0.45))`,
              boxShadow: "0 0 18px rgba(255,46,77,0.18)",
            }}
          />
        </div>

        <div className="mt-3 text-[12px] text-white/55">
          {!matchStartMs ? "Auto-locks at bounce" : matchIsLocked ? "LOCKED" : "Locks in… see card timers"}
        </div>

        {err ? (
          <div className="mt-3 text-sm text-rose-200/80 bg-rose-500/10 border border-rose-400/20 rounded-2xl px-4 py-2">{err}</div>
        ) : null}
      </div>

      {/* ✅ 3 columns on desktop */}
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
