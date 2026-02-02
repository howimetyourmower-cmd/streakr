// /app/picks/[gameId]/MatchPicksClient.tsx
"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  status: any;

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

const BRAND_RED = "#FF2E4D";
const BRAND_BG = "#000000";
const BRAND_CYAN = "#00E5FF";

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

function safeStatus(s: any): QuestionStatus {
  const v = String(s || "").toLowerCase().trim();
  if (v === "open") return "open";
  if (v === "final") return "final";
  if (v === "pending") return "pending";
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
  if (n.includes("gold coast")) return "goldcoast";
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

const TeamLogo = ({ teamName, size = 72 }: { teamName: string; size?: number }) => {
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
};

/* UI bits */

function PlayerAvatar({ name }: { name: string }) {
  const exact = `/players/${encodeURIComponent(name)}.jpg`;
  const slug = `/players/${playerSlug(name)}.jpg`;
  const [src, setSrc] = useState(exact);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[92px] w-[92px] rounded-[22px] p-[3px]" style={{ background: BRAND_RED }}>
        <div className="absolute inset-0 rounded-[22px] opacity-55 blur-[10px]" style={{ background: BRAND_RED }} />
        <div className="relative h-full w-full overflow-hidden rounded-[19px]" style={{ background: "rgba(0,0,0,0.35)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => {
              if (src === exact) setSrc(slug);
            }}
          />
        </div>
      </div>

      <div className="text-[11px] font-black tracking-[0.20em] text-white/55">PLAYER PICK</div>
    </div>
  );
}

function TeamLogoSquircle({ teamName }: { teamName: string }) {
  return (
    <div className="relative h-[92px] w-[92px] rounded-[22px] p-[3px]" style={{ background: BRAND_RED }}>
      <div className="absolute inset-0 rounded-[22px] opacity-45 blur-[10px]" style={{ background: BRAND_RED }} />
      <div className="relative h-full w-full overflow-hidden rounded-[19px] flex items-center justify-center bg-black/35">
        <TeamLogo teamName={teamName} size={72} />
      </div>
    </div>
  );
}

function GamePickHeader({ match }: { match: string }) {
  const { home, away } = parseTeams(match);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <TeamLogoSquircle teamName={home} />
        <div className="text-[12px] font-black tracking-[0.25em] text-white/65">VS</div>
        <TeamLogoSquircle teamName={away || "AFL"} />
      </div>

      <div className="text-[11px] font-black tracking-[0.20em] text-white/55">GAME PICK</div>
    </div>
  );
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function CommunityPulse({ yes, no }: { yes: number; no: number }) {
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
    <div className="mt-4">
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
}

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

function QuestionText({ text }: { text: string }) {
  return (
    <div
      className="mt-4 text-[18px] font-extrabold text-white break-words text-center"
      style={{
        lineHeight: 1.25,
        minHeight: 72,
        maxHeight: 72,
        display: "-webkit-box",
        WebkitLineClamp: 3 as any,
        WebkitBoxOrient: "vertical" as any,
        overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}

/**
 * ✅ Countdown supports DAYS + HOURS:
 * 31d 09:46:58
 * 0d 02:12:03 (still fine under 24h)
 */
function msToRevealCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;

  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  const ss = rem % 60;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

export default function MatchPicksClient({ gameId }: { gameId: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);
  const lastGameRef = useRef<ApiGame | null>(null);

  const [picks, setPicks] = useState<Record<string, LocalPick>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const roundNumber = useMemo(() => roundNumberFromGameId(gameId), [gameId]);

  const picksStorageKey = useMemo(() => {
    const uid = user?.uid || "anon";
    return `torpie:picks:${uid}:${gameId}`;
  }, [user?.uid, gameId]);

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

      if (user) {
        const seeded: Record<string, LocalPick> = {};
        for (const q of found.questions || []) {
          if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
        }
        setPicks((prev) => ({ ...prev, ...seeded }));
      } else {
        setPicks((prev) => {
          if (Object.keys(prev || {}).length > 0) return prev;
          const seeded: Record<string, LocalPick> = {};
          for (const q of found.questions || []) {
            if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
          }
          return seeded;
        });
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load picks");
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

  const lockedCount = useMemo(() => questions.filter((q) => safeStatus(q.status) !== "open").length, [questions]);

  const matchStartMs = useMemo(() => {
    const iso = stableGame?.startTime;
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  }, [stableGame?.startTime]);

  const matchLockMs = useMemo(() => {
    if (!matchStartMs) return null;
    return matchStartMs - nowMs;
  }, [matchStartMs, nowMs]);

  const matchIsLocked = matchLockMs !== null ? matchLockMs <= 0 : false;

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

    setPicks((prev) => {
      const current = prev[questionId] || "none";
      const next: LocalPick = current === value ? "none" : value;
      void persistPick(questionId, next);
      return { ...prev, [questionId]: next };
    });
  }

  async function clearPick(questionId: string, status: QuestionStatus) {
    if (status !== "open") return;

    setPicks((prev) => {
      void persistPick(questionId, "none");
      return { ...prev, [questionId]: "none" };
    });
  }

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

  const { home, away } = parseTeams(stableGame.match);
  const matchTitle = `${home.toUpperCase()} VS ${away.toUpperCase()}`;

  // ✅ Sponsor “Mystery Gamble” card:
  // - Blind YES/NO visible pre-lock
  // - Question revealed automatically once match locks
  function SponsorMysteryCard({ q, status }: { q: ApiQuestion; status: QuestionStatus }) {
    const sponsorName = (q.sponsorName || "SPONSOR").toUpperCase();
    const selected = picks[q.id] || "none";
    const isSaving = !!saving[q.id];

    // Always hidden until lock
    const isRevealTime = matchIsLocked;
    const showQuestionText = isRevealTime;

    // Can pick up until lock; after lock, disabled
    const locked = status !== "open" || isRevealTime;

    const yesSelected = selected === "yes";
    const noSelected = selected === "no";

    return (
      <div className="screamr-card p-4 flex flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-[0.16]">
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

            <div className="flex items-start gap-2">
              <div className="screamr-timer screamr-timer--final" style={{ minWidth: 110 }}>
                {isRevealTime ? "LOCKED" : "VAULT"}
              </div>

              <button
                type="button"
                className={`h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center ${
                  locked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
                }`}
                aria-label="Clear pick"
                disabled={locked || isSaving}
                onClick={() => void clearPick(q.id, status)}
                title="Clear pick"
              >
                <span className="text-white/85 font-black">×</span>
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.55]"
              style={{ background: "radial-gradient(600px 220px at 50% 0%, rgba(255,46,77,0.35), rgba(0,0,0,0) 65%)" }}
            />
            <div className="relative">
              <div className="text-[13px] font-black tracking-[0.20em] text-white/85">{sponsorName}</div>
              <div
                className="mt-1 inline-block rounded-xl px-4 py-2 border"
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/55 p-4 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.16]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 30%, rgba(255,255,255,0.35) 0 1px, transparent 2px), radial-gradient(circle at 75% 55%, rgba(255,255,255,0.25) 0 1px, transparent 2px)",
                backgroundSize: "240px 240px",
              }}
            />

            <div className="rounded-2xl border border-white/10 bg-black/45 p-4 text-center relative overflow-hidden" style={{ minHeight: 140 }}>
              {!showQuestionText ? (
                <>
                  <div className="absolute inset-0 backdrop-blur-[2px]" />
                  <div className="relative flex items-center justify-center" style={{ minHeight: 120 }}>
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
                <div className="relative flex flex-col items-center justify-center text-center" style={{ minHeight: 120 }}>
                  <div className="text-[15px] font-extrabold text-white/95">{q.question}</div>

                  {status === "final" && (q.correctOutcome === "yes" || q.correctOutcome === "no") ? (
                    <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-black text-white/80">
                      Answer: {q.correctOutcome.toUpperCase()}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {!isRevealTime && matchLockMs !== null ? (
              <div className="mt-4 text-center">
                <div className="text-[12px] font-black tracking-[0.22em]" style={{ color: "rgba(255,46,77,0.95)" }}>
                  REVEAL IN: {msToRevealCountdown(matchLockMs)}
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
                onClick={() => void setPick(q.id, "yes", status)}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="text-[18px] leading-none">🥤</span>
                  <span>{isRevealTime ? "YES" : "BLIND YES"}</span>
                </span>
              </button>

              <button
                type="button"
                disabled={locked || isSaving}
                className={`h-14 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                  locked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                } ${noSelected ? "btn-no btn-no--selected" : "btn-no"}`}
                onClick={() => void setPick(q.id, "no", status)}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="text-[18px] leading-none">🥤</span>
                  <span>{isRevealTime ? "NO" : "BLIND NO"}</span>
                </span>
              </button>
            </div>

            <div className="mt-3 text-center text-[12px] text-white/70 font-semibold">
              Correct pick goes into the draw to win a <span className="text-white/90 font-black">$250 {sponsorName} voucher</span>.
            </div>

            <div
              className="absolute right-3 bottom-3 rounded-2xl border border-white/15 bg-black/55 px-3 py-2"
              style={{ boxShadow: "0 0 22px rgba(0,229,255,0.10)" }}
            >
              <div className="text-[11px] font-black tracking-[0.14em] text-white/65">SPONSOR</div>
              <div className="mt-0.5 text-[22px] font-black" style={{ color: "rgba(255,46,77,0.95)" }}>
                $250
              </div>
            </div>
          </div>

          <div className="mt-3 text-center text-[11px] text-white/45">* One sponsor question per round. Hidden until lock.</div>
        </div>
      </div>
    );
  }

  const MatchTimerPill = ({ status }: { status: QuestionStatus }) => {
    if (status === "final") return <div className="screamr-timer screamr-timer--final">FINAL</div>;
    if (status === "void") return <div className="screamr-timer screamr-timer--final">VOID</div>;
    if (matchLockMs === null) return <div className="screamr-timer">—</div>;
    if (matchIsLocked) return <div className="screamr-timer screamr-timer--live">LOCKED</div>;
    return <div className="screamr-timer">{msToRevealCountdown(matchLockMs)}</div>;
  };

  const totalQuestions = questions.length || 0;

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
        .screamr-card {
          position: relative;
          border-radius: 22px;
          overflow: hidden;
          background: rgba(10,10,12,0.88);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 18px 60px rgba(0,0,0,0.72);
        }
        .screamr-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 22px;
          padding: 2px;
          background: linear-gradient(180deg, rgba(255,46,77,0.85), rgba(255,46,77,0.15));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.65;
        }
        .screamr-card::after {
          content: "";
          position: absolute;
          inset: -40px;
          background: radial-gradient(500px 220px at 50% 0%, rgba(255,46,77,0.22), rgba(0,0,0,0) 65%);
          pointer-events: none;
        }
        .screamr-sparks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.22;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(circle at 12% 78%, rgba(0,229,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 22%, rgba(255,46,77,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 55% 62%, rgba(255,255,255,0.20) 0 1px, transparent 2px);
          background-size: 220px 220px;
          animation: sparksMove 6.5s linear infinite;
        }
        @keyframes sparksMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-220px, -220px, 0); }
        }
        .screamr-timer {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255,46,77,0.35);
          background: rgba(0,0,0,0.55);
          color: rgba(255,255,255,0.92);
          box-shadow: 0 0 18px rgba(255,46,77,0.18);
          min-width: 140px;
          text-align: center;
        }
        .screamr-timer--live{
          border-color: rgba(0,229,255,0.45);
          box-shadow: 0 0 18px rgba(0,229,255,0.18);
        }
        .screamr-timer--final{
          border-color: rgba(255,255,255,0.18);
          box-shadow: none;
          color: rgba(255,255,255,0.70);
        }

        .btn-yes {
          border: 1px solid rgba(0,229,255,0.45);
          background: rgba(0,229,255,0.10);
          box-shadow: 0 0 22px rgba(0,229,255,0.16);
          color: rgba(255,255,255,0.95);
        }
        .btn-yes--selected {
          background: linear-gradient(180deg, rgba(0,229,255,0.95), rgba(0,229,255,0.40));
          border-color: rgba(0,229,255,0.75);
          box-shadow: 0 0 28px rgba(0,229,255,0.22);
          color: rgba(0,0,0,0.92);
        }
        .btn-no {
          border: 1px solid rgba(255,46,77,0.45);
          background: rgba(255,46,77,0.10);
          box-shadow: 0 0 22px rgba(255,46,77,0.14);
          color: rgba(255,255,255,0.95);
        }
        .btn-no--selected {
          background: linear-gradient(180deg, rgba(255,46,77,0.95), rgba(255,46,77,0.35));
          border-color: rgba(255,46,77,0.75);
          box-shadow: 0 0 28px rgba(255,46,77,0.20);
          color: rgba(255,255,255,0.98);
        }
      `}</style>

      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <div className="text-[11px] tracking-[0.18em] font-semibold text-white/50">OFFICIAL PARTNER</div>
        <div className="text-[11px] tracking-[0.12em] text-white/35">Proudly supporting SCREAMR all season long</div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div className="text-4xl md:text-5xl font-black italic tracking-wide">{matchTitle}</div>
            <div className="flex items-center gap-2">
              {refreshing ? <div className="text-[11px] font-black tracking-[0.12em] text-white/35">REFRESHING…</div> : null}
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
                onClick={() => void fetchMatch("refresh")}
              >
                REFRESH
              </button>
            </div>
          </div>

          {err ? (
            <div className="text-sm text-rose-200/80 bg-rose-500/10 border border-rose-400/20 rounded-2xl px-4 py-2">{err}</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected: <span className="font-semibold text-white">{selectedCount}</span> / {totalQuestions}
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Locks: <span className="font-semibold text-white">{lockedCount}</span>
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              {matchLockMs === null ? "Auto-locks at bounce" : matchIsLocked ? "LOCKED — sponsor revealed" : `Locks in ${msToRevealCountdown(matchLockMs)}`}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {questions.map((q, idx) => {
            const status = safeStatus(q.status);
            const qNum = String(idx + 1).padStart(2, "0");

            if (q.isSponsorQuestion) {
              return <SponsorMysteryCard key={q.id} q={q} status={status} />;
            }

            const playerName = extractPlayerName(q.question);
            const isPlayerPick = !!playerName;

            const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
            const no = typeof q.noPercent === "number" ? q.noPercent : 0;

            const selected = picks[q.id] || "none";

            const isLocked = status !== "open";
            const isSaving = !!saving[q.id];

            const yesBtn = selected === "yes" ? "btn-yes btn-yes--selected" : "btn-yes";
            const noBtn = selected === "no" ? "btn-no btn-no--selected" : "btn-no";

            return (
              <div key={q.id} className="screamr-card p-4 flex flex-col">
                <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
                  <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
                </div>
                <div className="screamr-sparks" />

                <div className="relative flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-black tracking-[0.10em] text-white/90">
                        Q{qNum} — {formatQuarterLabel(q.quarter)}
                      </div>

                      <div className="mt-1 text-[12px] text-white/60">
                        Status: <span className="text-white/70">{status}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <ResultPill status={status} selected={selected} correctPick={q.correctPick} outcome={q.correctOutcome ?? q.outcome} />
                        {isSaving ? <span className="text-[11px] font-black tracking-[0.12em] text-white/35">SAVING…</span> : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MatchTimerPill status={status} />

                      <button
                        type="button"
                        className={`h-10 w-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center ${
                          isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
                        }`}
                        aria-label="Clear pick"
                        disabled={isLocked || isSaving}
                        onClick={() => void clearPick(q.id, status)}
                        title="Clear pick"
                      >
                        <span className="text-white/85 font-black">×</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-center">{isPlayerPick ? <PlayerAvatar name={playerName!} /> : <GamePickHeader match={stableGame.match} />}</div>

                  <QuestionText text={q.question} />

                  <div className="mt-auto pt-4">
                    <div className="rounded-2xl border border-white/10 bg-black/55 p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={isLocked || isSaving}
                          className={`h-14 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                            isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                          } ${yesBtn}`}
                          onClick={() => void setPick(q.id, "yes", status)}
                        >
                          YES
                        </button>

                        <button
                          type="button"
                          disabled={isLocked || isSaving}
                          className={`h-14 rounded-2xl font-black tracking-[0.14em] transition active:scale-[0.99] ${
                            isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                          } ${noBtn}`}
                          onClick={() => void setPick(q.id, "no", status)}
                        >
                          NO
                        </button>
                      </div>

                      <CommunityPulse yes={yes} no={no} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
