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

const TeamLogo = memo(function TeamLogo({ teamName, size = 64 }: { teamName: string; size?: number }) {
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
        className="flex items-center justify-center rounded-full border font-black"
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
      className="relative rounded-full border overflow-hidden"
      style={{
        width: size,
        height: size,
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.35)",
      }}
      title={teamName}
    >
      <Image
        src={src}
        alt={teamName}
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
  );
});

const PlayersHeadshot = memo(function PlayersHeadshot({ playerName, width = 92 }: { playerName: string; width?: number }) {
  const [hide, setHide] = useState(false);
  const url = `/afl-players/${playerSlug(playerName)}.jpg`;

  if (hide) return null;

  return (
    <div
      className="relative overflow-hidden rounded-full border-2 border-white/10"
      style={{ width, height: width, background: "rgba(0,0,0,0.35)" }}
      title={playerName}
    >
      <Image
        src={url}
        alt={playerName}
        fill
        sizes={`${width}px`}
        style={{ objectFit: "cover" }}
        onError={() => setHide(true)}
      />
    </div>
  );
});

/* UI helpers */

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

const CommunityPulseInline = memo(function CommunityPulseInline({ yes, no }: { yes: number; no: number }) {
  const y = clampPct(yes);
  const n = clampPct(no);

  if (y <= 0 && n <= 0) return null;

  const total = y + n;
  const yesPct = Math.round(total > 0 ? (y / total) * 100 : 0);
  const noPct = Math.max(0, 100 - yesPct);

  return (
    <div className="mt-3 text-[11px] text-white/50">
      <div className="font-black tracking-[0.18em] text-white/60">COMMUNITY PULSE</div>
      <div className="mt-1 flex items-center justify-center gap-2 text-white/75">
        <div>Yes {yesPct}%</div>
        <div>•</div>
        <div>No {noPct}%</div>
      </div>
    </div>
  );
});

/* Cards (Claude layout merged into your current logic) */

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

  const { home, away } = parseTeams(match);
  const disabled = status !== "open" || isSaving || isPersonallyVoided;

  const yesPercent = typeof q.yesPercent === "number" ? q.yesPercent : 0;
  const noPercent = typeof q.noPercent === "number" ? q.noPercent : 0;

  const playerNameParsed = extractPlayerName(q.question);

  const hasPickOutcome = status === "final" && (q.correctOutcome ?? q.outcome) && (q.correctOutcome ?? q.outcome) !== "void";
  const wasCorrectPick = hasPickOutcome && q.correctPick === true;
  const wasIncorrectPick = hasPickOutcome && q.correctPick === false;

  const remainingMs = matchStartMs ? matchStartMs - Date.now() : null;
  const showCountdown = remainingMs !== null && remainingMs > 0;

  let bottomLine = "";
  if (isPersonallyVoided) {
    bottomLine = "You voided this question (no impact on streak).";
  } else if (status === "void") {
    bottomLine = "Voided (no outcome).";
  } else if (status === "pending") {
    bottomLine = "Awaiting official outcome…";
  } else if (status === "final") {
    const out = q.correctOutcome ?? q.outcome;
    if (out === "void") bottomLine = "Voided (no outcome).";
    else if (wasCorrectPick) bottomLine = "You got this one! +1 point.";
    else if (wasIncorrectPick) bottomLine = "Missed. Your streak resets.";
    else bottomLine = "Final.";
  } else if (status === "open") {
    if (matchIsLocked) bottomLine = "Game locked, check back soon…";
    else if (showCountdown && remainingMs) bottomLine = `Locks in ${msToCountdown(remainingMs)}`;
    else bottomLine = "Auto-locks at bounce.";
  }

  return (
    <div className="relative rounded-3xl border border-white/10 bg-[#0b0b0e] p-5 shadow-xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between text-[12px] font-black tracking-[0.24em] text-white/55">
          <div>
            Q{qNum} — {formatQuarterLabel(q.quarter)}
          </div>
          {isSaving ? <div className="text-[11px] tracking-[0.18em] text-white/35">SAVING…</div> : null}
        </div>

        {panicEnabledHere ? (
          <div className="absolute top-0 right-0">
            <button
              type="button"
              className="relative rounded-xl border border-rose-400/35 bg-gradient-to-br from-rose-500/20 to-rose-600/5 p-3 shadow-lg overflow-hidden group"
              style={{ boxShadow: "0 0 24px rgba(255,46,77,0.12)" }}
              onClick={(e) => {
                e.preventDefault();
                onOpenPanic();
              }}
              aria-label="Panic Button"
              title="Panic Button"
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
            <TeamLogo teamName={away || "AFL"} size={64} />
          </div>

          {playerNameParsed ? (
            <div className="flex-shrink-0">
              <PlayersHeadshot playerName={playerNameParsed} width={92} />
            </div>
          ) : null}
        </div>

        <div className="mt-5 text-[15px] font-extrabold text-white leading-snug">{q.question}</div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-2xl border py-4 font-black tracking-[0.08em] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: selected === "yes" ? "rgba(0,229,255,0.55)" : "rgba(255,255,255,0.10)",
              background:
                selected === "yes"
                  ? "linear-gradient(135deg, rgba(0,229,255,0.22) 0%, rgba(0,229,255,0.08) 100%)"
                  : "rgba(0,0,0,0.35)",
              color: selected === "yes" ? "rgb(0,229,255)" : "rgba(255,255,255,0.70)",
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
              borderColor: selected === "no" ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.10)",
              background:
                selected === "no"
                  ? "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(255,46,77,0.08) 100%)"
                  : "rgba(0,0,0,0.35)",
              color: selected === "no" ? "rgb(255,46,77)" : "rgba(255,255,255,0.70)",
              boxShadow: selected === "no" ? "0 0 24px rgba(255,46,77,0.18)" : "none",
            }}
            disabled={disabled}
            onClick={() => (selected === "no" ? onClearPick() : onSetPick("no"))}
          >
            NO
          </button>
        </div>

        <CommunityPulseInline yes={yesPercent} no={noPercent} />

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

        {bottomLine ? <div className="mt-4 text-[12px] text-white/60">{bottomLine}</div> : null}
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

  const disabled = status !== "open" || isSaving;

  const hasPickOutcome = status === "final" && (q.correctOutcome ?? q.outcome) && (q.correctOutcome ?? q.outcome) !== "void";
  const wasCorrectPick = hasPickOutcome && q.correctPick === true;
  const wasIncorrectPick = hasPickOutcome && q.correctPick === false;

  const remainingMs = matchStartMs ? matchStartMs - Date.now() : null;
  const showCountdown = remainingMs !== null && remainingMs > 0;

  let bottomLine = "";
  if (status === "void") bottomLine = "Voided (no outcome).";
  else if (status === "pending") bottomLine = "Awaiting official outcome…";
  else if (status === "final") {
    const out = q.correctOutcome ?? q.outcome;
    if (out === "void") bottomLine = "Voided (no outcome).";
    else if (wasCorrectPick) bottomLine = "You got this one! +1 point.";
    else if (wasIncorrectPick) bottomLine = "Missed. Your streak resets.";
    else bottomLine = "Final.";
  } else if (status === "open") {
    if (matchIsLocked) bottomLine = "Game locked, check back soon…";
    else if (showCountdown && remainingMs) bottomLine = `Locks in ${msToCountdown(remainingMs)}`;
    else bottomLine = "Auto-locks at bounce.";
  }

  return (
    <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-purple-950/40 to-[#0b0b0e] p-5 shadow-xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between text-[12px] font-black tracking-[0.24em] text-purple-300/75">
          <div>MYSTERY Q — {formatQuarterLabel(q.quarter)}</div>
          {isSaving ? <div className="text-[11px] tracking-[0.18em] text-white/35">SAVING…</div> : null}
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
              borderColor: selected === "yes" ? "rgba(192,132,252,0.55)" : "rgba(255,255,255,0.10)",
              background:
                selected === "yes"
                  ? "linear-gradient(135deg, rgba(192,132,252,0.22) 0%, rgba(192,132,252,0.08) 100%)"
                  : "rgba(0,0,0,0.35)",
              color: selected === "yes" ? "rgb(192,132,252)" : "rgba(255,255,255,0.70)",
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
              borderColor: selected === "no" ? "rgba(192,132,252,0.55)" : "rgba(255,255,255,0.10)",
              background:
                selected === "no"
                  ? "linear-gradient(135deg, rgba(192,132,252,0.22) 0%, rgba(192,132,252,0.08) 100%)"
                  : "rgba(0,0,0,0.35)",
              color: selected === "no" ? "rgb(192,132,252)" : "rgba(255,255,255,0.70)",
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

        {bottomLine ? <div className="mt-4 text-[12px] text-purple-200/60 text-center">{bottomLine}</div> : null}
      </div>
    </div>
  );
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

  // Only needed so the page knows when lock flips from false -> true.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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
      const found = (data.games || []).find((g) => g.id === gameId);
      if (!found) throw new Error("Game not found for this gameId");

      setGame(found);
      lastGameRef.current = found;

      const seeded: Record<string, LocalPick> = {};
      for (const q of found.questions || []) {
        if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
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

  const questions = useMemo(() => {
    const qs = stableGame?.questions || [];
    return [...qs].sort((a, b) => a.quarter - b.quarter || a.id.localeCompare(b.id));
  }, [stableGame]);

  const selectedCount = useMemo(() => Object.values(picks).filter((v) => v === "yes" || v === "no").length, [picks]);
  const totalQuestions = questions.length || 0;

  const lockedCount = useMemo(() => {
    return questions.filter((q) => {
      if (personalVoids[q.id]) return true;
      return safeStatus(q.status) !== "open";
    }).length;
  }, [questions, personalVoids]);

  const matchStartMs = useMemo(() => {
    const iso = stableGame?.startTime;
    const t = iso ? new Date(iso).getTime() : Number.NaN;
    return Number.isFinite(t) ? t : null;
  }, [stableGame?.startTime]);

  const matchIsLocked = useMemo(() => {
    if (!matchStartMs) return false;
    return matchStartMs - nowMs <= 0;
  }, [matchStartMs, nowMs]);

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

  /**
   * ✅ IMPORTANT FIX:
   * pending = locked, so PANIC should be usable on pending (if picked, not sponsor, not used, etc)
   */
  function canShowPanic(q: ApiQuestion, displayStatus: QuestionStatus, selected: LocalPick) {
    if (!user) return false;

    const lockedByStatus = displayStatus === "pending";
    const lockedForPanic = matchIsLocked || lockedByStatus;

    if (!lockedForPanic) return false;
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

    const answered = (stableGame.questions || []).filter((q) => {
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
  const sg: ApiGame = stableGame;
  const matchTitle = `${sg.match.toUpperCase()}`;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: BRAND_BG,
        opacity: refreshing ? 0.78 : 1,
        transition: "opacity 120ms ease",
      }}
    >
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

      {/* ✅ Updated Top Section (Claude layout) */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
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

        <div className="flex items-center justify-between text-[14px] text-white/80 mb-3">
          <div>
            Picks selected:{" "}
            <span className="text-white font-bold">
              {selectedCount} / {totalQuestions}
            </span>
          </div>
          <div>
            Locks: <span className="text-white font-bold">{lockedCount}</span>
          </div>
        </div>

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
          <div className="mt-3 text-sm text-rose-200/80 bg-rose-500/10 border border-rose-400/20 rounded-2xl px-4 py-2">
            {err}
          </div>
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
