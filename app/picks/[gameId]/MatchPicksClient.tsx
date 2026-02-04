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
const SEASON = 2026;

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

function safeStatus(s: any): QuestionStatus {
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

function truncateText(s: string, n: number) {
  const t = String(s || "");
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

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
      <div className="text-[11px] font-black tracking-[0.22em] text-white/60 text-center mb-2">COMMUNITY PULSE</div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
        <div className="h-full flex">
          <div
            className="h-full"
            style={{
              width: `${yesPct}%`,
              background: `rgba(0,229,255,0.95)`,
            }}
          />
        </div>
      </div>

      <div className="mt-1.5 text-[11px] font-semibold text-white/70 text-center">
        Yes {yesPct}% <span className="text-white/35">•</span> No {noPct}%
      </div>
    </div>
  );
}

function msToLockTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;

  const hh = Math.floor(rem / 3600);
  const mm = Math.floor((rem % 3600) / 60);
  const ss = rem % 60;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d}d ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

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
  const [panicPickerOpen, setPanicPickerOpen] = useState(false);

  const [freeKickUsedSeason, setFreeKickUsedSeason] = useState(false);
  const [freeKickModal, setFreeKickModal] = useState<FreeKickModalState>(null);
  const [freeKickErr, setFreeKickErr] = useState<string | null>(null);

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
  const totalQuestions = questions.length || 0;

  const lockedCount = useMemo(() => {
    return questions.filter((q) => {
      if (personalVoids[q.id]) return true;
      return safeStatus(q.status) !== "open";
    }).length;
  }, [questions, personalVoids]);

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
    if (personalVoids[questionId]) return;

    setPicks((prev) => {
      const current = prev[questionId] || "none";
      const next: LocalPick = current === value ? "none" : value;
      void persistPick(questionId, next);
      return { ...prev, [questionId]: next };
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
    } catch (e: any) {
      console.error("[MatchPicksClient] panic failed", e);
      setPanicErr(e?.message || "Panic failed");
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

      const out = (q.correctOutcome ?? q.outcome) as any;
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

  const panicEligibleList = useMemo(() => {
    const list: Array<{ q: ApiQuestion; qNum: string }> = [];

    questions.forEach((q, idx) => {
      const baseStatus = safeStatus(q.status);
      const isPersonallyVoided = !!personalVoids[q.id];
      const status: QuestionStatus = isPersonallyVoided ? "void" : baseStatus;

      const selected = picks[q.id] || "none";
      const qNum = String(idx + 1).padStart(2, "0");

      if (canShowPanic(q, status, selected)) list.push({ q, qNum });
    });

    return list;
  }, [questions, personalVoids, picks, matchIsLocked, panicUsed, user]);

  const topPanicEnabled = panicEligibleList.length > 0;

  if (loading && !stableGame) {
    return (
      <div className="min-h-screen" style={{ background: BRAND_BG }}>
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="h-8 w-72 rounded bg-white/10 animate-pulse" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-96 rounded-3xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((err && !stableGame) || !stableGame) {
    return (
      <div className="min-h-screen text-white px-4 py-10" style={{ background: BRAND_BG }}>
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black tracking-wide">Couldn't load match</div>
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

  const { home } = parseTeams(stableGame.match);
  const matchTitle = `${home.toUpperCase()}`;

  function QuestionCard({ q, index }: { q: ApiQuestion; index: number }) {
    const baseStatus = safeStatus(q.status);
    const isPersonallyVoided = !!personalVoids[q.id];
    const status: QuestionStatus = isPersonallyVoided ? "void" : baseStatus;
    
    const selected = picks[q.id] || "none";
    const isSaving = !!saving[q.id];
    const isLocked = status !== "open";

    const playerName = extractPlayerName(q.question);
    const isPlayerPick = !!playerName;
    
    const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
    const no = typeof q.noPercent === "number" ? q.noPercent : 0;

    const lockTimeStr = matchLockMs !== null ? (matchIsLocked ? "LOCKED" : `LOCKS IN: ${msToLockTime(matchLockMs)}`) : "—";

    return (
      <div 
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,20,24,0.95) 0%, rgba(10,10,12,0.98) 100%)",
          border: "1px solid rgba(255,46,77,0.25)",
          boxShadow: "0 0 60px rgba(255,46,77,0.15), 0 20px 60px rgba(0,0,0,0.6)"
        }}
      >
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div 
            className="w-full h-full" 
            style={{
              backgroundImage: "url('/afl1.png')",
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        </div>

        {/* Red glow top */}
        <div 
          className="absolute top-0 left-0 right-0 h-48 opacity-40 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 600px 200px at 50% -50px, rgba(255,46,77,0.45), transparent 70%)"
          }}
        />

        {/* Content */}
        <div className="relative p-6">
          {/* Header with Panic & Free Kick */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              type="button"
              onClick={() => setPanicPickerOpen(true)}
              disabled={!topPanicEnabled}
              className="flex-1 h-20 rounded-2xl border overflow-hidden relative"
              style={{
                borderColor: topPanicEnabled ? "rgba(255,46,77,0.6)" : "rgba(255,46,77,0.25)",
                background: "rgba(10,10,12,0.8)",
                opacity: topPanicEnabled ? 1 : 0.5
              }}
            >
              <div 
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.15) 48%, transparent 52%)"
                }}
              />
              <div className="relative h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-base font-black tracking-wider text-white">PANIC</div>
                  <div className="text-base font-black tracking-wider text-white">BUTTON</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => freeKickEligibleForThisGame && setFreeKickModal({ gameId: stableGame.id, label: stableGame.match })}
              disabled={!freeKickEligibleForThisGame}
              className="flex-1 h-20 rounded-2xl border overflow-hidden relative"
              style={{
                borderColor: freeKickEligibleForThisGame ? "rgba(246,198,75,0.6)" : "rgba(246,198,75,0.25)",
                background: "rgba(10,10,12,0.8)",
                opacity: freeKickEligibleForThisGame ? 1 : 0.5
              }}
            >
              <div className="relative h-full flex flex-col items-center justify-center gap-1">
                <div className="text-center">
                  <div className="text-base font-black tracking-wider" style={{ color: "rgba(246,198,75,0.95)" }}>FREE</div>
                  <div className="text-base font-black tracking-wider" style={{ color: "rgba(246,198,75,0.95)" }}>KICK</div>
                </div>
                <div 
                  className="w-6 h-6 rounded-lg border flex items-center justify-center"
                  style={{
                    borderColor: "rgba(246,198,75,0.5)",
                    background: "rgba(0,0,0,0.4)"
                  }}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: "rgba(246,198,75,0.9)" }}
                  />
                </div>
              </div>
            </button>
          </div>

          {/* Quarter header */}
          <div 
            className="rounded-2xl p-4 mb-5"
            style={{
              background: "rgba(255,46,77,0.12)",
              border: "1px solid rgba(255,46,77,0.25)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-black tracking-wider text-white">
                Q{String(index + 1).padStart(2, "0")} - {formatQuarterLabel(q.quarter)}
              </div>
              <div className="text-xs font-black tracking-wider text-white/70">
                {lockTimeStr}
              </div>
            </div>
          </div>

          {/* Player/Team visual */}
          <div className="flex justify-center mb-5">
            {isPlayerPick ? (
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "rgba(255,46,77,0.95)",
                      filter: "blur(20px)",
                      opacity: 0.6
                    }}
                  />
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "rgba(255,46,77,0.95)",
                      border: "3px solid rgba(255,255,255,0.1)"
                    }}
                  >
                    <div 
                      className="absolute inset-1 rounded-full bg-black/60 overflow-hidden border border-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/players/${playerSlug(playerName!)}.jpg`}
                        alt={playerName!}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `/players/${encodeURIComponent(playerName!)}.jpg`;
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[10px] font-black tracking-[0.2em] text-white/50">PLAYER PICK</div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                {(() => {
                  const { home, away } = parseTeams(stableGame.match);
                  return (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="relative w-24 h-24">
                          <div 
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: "rgba(255,46,77,0.8)",
                              filter: "blur(18px)",
                              opacity: 0.5
                            }}
                          />
                          <div 
                            className="absolute inset-0 rounded-full flex items-center justify-center"
                            style={{
                              background: "rgba(255,46,77,0.95)",
                              border: "3px solid rgba(255,255,255,0.1)"
                            }}
                          >
                            <div 
                              className="w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full bg-black/60 flex items-center justify-center border border-white/10"
                            >
                              <TeamLogo teamName={home} size={60} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-black tracking-widest text-white/50">VS</div>
                      <div className="flex flex-col items-center">
                        <div className="relative w-24 h-24">
                          <div 
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: "rgba(255,46,77,0.8)",
                              filter: "blur(18px)",
                              opacity: 0.5
                            }}
                          />
                          <div 
                            className="absolute inset-0 rounded-full flex items-center justify-center"
                            style={{
                              background: "rgba(255,46,77,0.95)",
                              border: "3px solid rgba(255,255,255,0.1)"
                            }}
                          >
                            <div 
                              className="w-[calc(100%-8px)] h-[calc(100%-8px)] rounded-full bg-black/60 flex items-center justify-center border border-white/10"
                            >
                              <TeamLogo teamName={away || "AFL"} size={60} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.2em] text-white/50 whitespace-nowrap">
                  GAME PICK
                </div>
              </div>
            )}
          </div>

          {/* Question text */}
          <div className="mb-5 text-center">
            <p className="text-base font-extrabold text-white leading-tight">
              {q.question}
            </p>
          </div>

          {/* Player intel */}
          <div className="mb-5">
            <div className="text-[11px] font-black tracking-wider text-white/70 mb-1">PLAYER INTEL</div>
            <div className="text-[10px] font-black tracking-wide text-white/45 mb-2">LAST 5 GAMES</div>
            <div className="flex items-end gap-1.5 h-9 mb-2">
              {[7, 14, 10, 18, 12].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h * 1.5}px`,
                    background: i === 3 ? "rgba(0,229,255,0.9)" : "rgba(0,229,255,0.5)"
                  }}
                />
              ))}
            </div>
            <div className="text-xs text-white/70">
              Avg: <span className="font-black text-white/85">7.2 Disp</span> / <span className="font-black text-white/85">1.5 Goals</span>
            </div>
          </div>

          {/* YES/NO buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              disabled={isLocked || isSaving}
              onClick={() => void setPick(q.id, "yes", status)}
              className="h-16 rounded-2xl font-black tracking-wider text-lg transition-all"
              style={{
                background: selected === "yes" 
                  ? "linear-gradient(180deg, rgba(0,229,255,1) 0%, rgba(0,229,255,0.7) 100%)"
                  : "rgba(0,229,255,0.15)",
                border: `2px solid ${selected === "yes" ? "rgba(0,229,255,0.9)" : "rgba(0,229,255,0.4)"}`,
                color: selected === "yes" ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.95)",
                opacity: isLocked || isSaving ? 0.5 : 1,
                cursor: isLocked || isSaving ? "not-allowed" : "pointer"
              }}
            >
              YES
            </button>
            <button
              type="button"
              disabled={isLocked || isSaving}
              onClick={() => void setPick(q.id, "no", status)}
              className="h-16 rounded-2xl font-black tracking-wider text-lg transition-all"
              style={{
                background: selected === "no"
                  ? "linear-gradient(180deg, rgba(255,46,77,1) 0%, rgba(255,46,77,0.7) 100%)"
                  : "rgba(255,46,77,0.15)",
                border: `2px solid ${selected === "no" ? "rgba(255,46,77,0.9)" : "rgba(255,46,77,0.4)"}`,
                color: "rgba(255,255,255,0.95)",
                opacity: isLocked || isSaving ? 0.5 : 1,
                cursor: isLocked || isSaving ? "not-allowed" : "pointer"
              }}
            >
              NO
            </button>
          </div>

          {/* Community Pulse */}
          <CommunityPulse yes={yes} no={no} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen pb-20"
      style={{ background: BRAND_BG }}
    >
      {/* Modals */}
      {panicModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => !panicBusy && setPanicModal(null)} />
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0e] p-6 shadow-2xl">
            <div className="text-xs font-black tracking-widest text-white/50 mb-2">PANIC BUTTON</div>
            <div className="text-lg font-black text-white mb-3">Void this question?</div>
            <div className="text-sm text-white/70 mb-4">
              This will void the question. No points, streak protected. ONE use per round.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/50 p-3 mb-4">
              <div className="text-xs font-black text-white/50 mb-1">QUESTION</div>
              <div className="text-sm font-extrabold text-white/90">{panicModal.questionText}</div>
            </div>
            {panicErr && (
              <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                {panicErr}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={panicBusy}
                onClick={() => setPanicModal(null)}
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 font-extrabold text-white/80"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={panicBusy}
                onClick={() => void triggerPanic(panicModal.questionId)}
                className="flex-1 rounded-full border border-rose-400/25 bg-rose-500/15 px-4 py-2.5 font-extrabold text-rose-100"
              >
                {panicBusy ? "VOIDING..." : "VOID"}
              </button>
            </div>
          </div>
        </div>
      )}

      {panicPickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPanicPickerOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b0e] p-6 shadow-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs font-black tracking-widest text-white/50 mb-2">PANIC BUTTON</div>
                <div className="text-lg font-black text-white mb-2">Choose question to void</div>
                <div className="text-sm text-white/70">One use per round.</div>
              </div>
              <button
                type="button"
                onClick={() => setPanicPickerOpen(false)}
                className="w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center"
              >
                <span className="text-white/85 font-black text-xl">×</span>
              </button>
            </div>
            <div className="space-y-2">
              {panicEligibleList.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
                  No eligible questions.
                </div>
              ) : (
                panicEligibleList.map(({ q, qNum }) => (
                  <div key={q.id} className="rounded-2xl border border-white/10 bg-black/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-white/70 mb-1">Q{qNum} — {formatQuarterLabel(q.quarter)}</div>
                        <div className="text-sm font-extrabold text-white/90">{truncateText(q.question, 100)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPanicPickerOpen(false);
                          setPanicModal({ questionId: q.id, questionText: q.question });
                        }}
                        className="rounded-full border border-rose-400/25 bg-rose-500/15 px-3 py-1.5 font-extrabold text-sm text-rose-100 whitespace-nowrap"
                      >
                        VOID
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {freeKickModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setFreeKickModal(null)} />
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0e] p-6 shadow-2xl">
            <div className="text-xs font-black tracking-widest text-white/50 mb-2">FREE KICK</div>
            <div className="text-lg font-black text-white mb-3">Use season insurance?</div>
            <div className="text-sm text-white/70 mb-4">
              Protect your streak for this game. <span className="font-black text-white">ONE use per season.</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/50 p-3 mb-4">
              <div className="text-xs font-black text-white/50 mb-1">GAME</div>
              <div className="text-sm font-extrabold text-white/90">{freeKickModal.label}</div>
            </div>
            {freeKickErr && (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                {freeKickErr}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFreeKickModal(null)}
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 font-extrabold text-white/80"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => triggerFreeKickSeasonUse()}
                className="flex-1 rounded-full border border-amber-400/25 bg-amber-500/15 px-4 py-2.5 font-extrabold text-amber-100"
              >
                USE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10" style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl font-black tracking-wide text-white">{matchTitle}</div>
            <button
              type="button"
              onClick={() => void fetchMatch("refresh")}
              className="rounded-xl border px-3 py-1.5 font-black text-sm tracking-wider"
              style={{
                borderColor: "rgba(0,229,255,0.5)",
                background: "rgba(0,0,0,0.6)",
                color: "rgba(0,229,255,0.95)"
              }}
            >
              REFRESH
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-white/70 mb-2">
            <div>
              Picks selected: <span className="text-white font-black">{selectedCount} / {totalQuestions}</span>
            </div>
            <div>
              Locks: <span className="text-white font-black">{lockedCount}</span>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full"
              style={{
                width: `${totalQuestions > 0 ? Math.round((selectedCount / totalQuestions) * 100) : 0}%`,
                background: "linear-gradient(90deg, rgba(255,46,77,0.95), rgba(255,46,77,0.6))"
              }}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {questions.map((q, index) => (
          <QuestionCard key={q.id} q={q} index={index} />
        ))}
      </div>
    </div>
  );
}
