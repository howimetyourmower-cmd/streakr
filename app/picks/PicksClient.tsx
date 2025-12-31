// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Confetti from "react-confetti";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: QuestionStatus;

  userPick?: PickOutcome;
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;

  sponsorName?: string;
  sponsorPrize?: string;
  sponsorExcludeFromStreak?: boolean;

  venue?: string;
  startTime?: string;
  correctPick?: boolean;
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

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime?: any;
};

type CommentRow = {
  id: string;
  questionId: string;
  gameId?: string | null;
  roundNumber?: number | null;
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  body: string;
  createdAt?: any;
};

const COLORS = {
  bg: "#000000",

  panel: "rgba(255,255,255,0.035)",
  panel2: "rgba(255,255,255,0.02)",

  stroke: "rgba(255,255,255,0.10)",
  stroke2: "rgba(255,255,255,0.14)",

  textDim: "rgba(255,255,255,0.70)",
  textFaint: "rgba(255,255,255,0.50)",

  // Torpie red (fire engine-ish)
  orange: "#FF2E4D",
  orangeSoft: "rgba(255,46,77,0.28)",
  orangeSoft2: "rgba(255,46,77,0.18)",

  good: "rgba(25,195,125,0.95)",
  bad: "rgba(255,46,77,0.95)",
  cyan: "rgba(0,229,255,0.95)",
  white: "rgba(255,255,255,0.98)",
};

const ELIGIBILITY = {
  MIN_STREAK: 5,
  MIN_GAMES: 3,
};

type FilterTab = "all" | "open" | "pending" | "final" | "void";

function clampPct(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

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

function majorityLabel(yes: number, no: number): { label: string; color: string } {
  if (yes === no) return { label: "Split crowd", color: "rgba(0,0,0,0.55)" };
  if (yes > no) return { label: "Majority YES", color: "rgba(25,195,125,0.95)" };
  return { label: "Majority NO", color: "rgba(255,46,77,0.95)" };
}

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `torpie:picks:v9:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function safeLockedKey(uid: string | null, roundNumber: number | null) {
  return `torpie:lockedPicks:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function safeSponsorKey(uid: string | null, roundNumber: number | null) {
  return `torpie:sponsorReveal:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function effectivePick(local: LocalPick | undefined, api: PickOutcome | undefined): PickOutcome | undefined {
  if (local === "none") return undefined;
  if (local === "yes" || local === "no") return local;
  return api;
}

function formatCommentTime(createdAt: any): string {
  try {
    if (createdAt?.toDate) {
      const d = createdAt.toDate() as Date;
      return d.toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Extracts team code like (Syd) or (Car) from question text.
 * Map to /public/jerseys/<Code>.jpg
 */
function extractTeamCode(qText: string): "Syd" | "Car" | "GC" | "Gee" | "Generic" {
  const t = (qText || "").toLowerCase();
  const m = qText.match(/\(([A-Za-z]{2,3})\)/);
  const raw = (m?.[1] || "").toLowerCase();

  if (raw === "syd") return "Syd";
  if (raw === "car") return "Car";
  if (raw === "gc") return "GC";
  if (raw === "gee") return "Gee";

  if (t.includes("(syd)") || t.includes(" sydney ")) return "Syd";
  if (t.includes("(car)") || t.includes(" carlton ")) return "Car";
  if (t.includes("(gc)") || t.includes(" gold coast ")) return "GC";
  if (t.includes("(gee)") || t.includes(" geelong ")) return "Gee";

  return "Generic";
}

function extractPlayerName(qText: string): string | null {
  const t = (qText || "").trim();
  if (!t.toLowerCase().startsWith("will ")) return null;
  const rest = t.slice(5);
  const parenIdx = rest.indexOf("(");
  if (parenIdx > 0) return rest.slice(0, parenIdx).trim();
  const haveIdx = rest.toLowerCase().indexOf(" have ");
  if (haveIdx > 0) return rest.slice(0, haveIdx).trim();
  const kickIdx = rest.toLowerCase().indexOf(" kick ");
  if (kickIdx > 0) return rest.slice(0, kickIdx).trim();
  const scoreIdx = rest.toLowerCase().indexOf(" score ");
  if (scoreIdx > 0) return rest.slice(0, scoreIdx).trim();
  return null;
}

function base64UrlEncode(obj: any): string {
  const json = JSON.stringify(obj);
  const b64 =
    typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode<T = any>(s: string): T | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);

    const json =
      typeof window !== "undefined"
        ? decodeURIComponent(escape(window.atob(b64)))
        : Buffer.from(b64, "base64").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

type LocalPickMap = Record<string, LocalPick>;
type LockedGamesMap = Record<string, boolean>;

type ShareSlipPayload = {
  v: 1;
  roundNumber: number | null;
  gameId: string;
  match: string;
  venue?: string;
  startTime?: string;
  picks: Array<{
    questionId: string;
    quarter: number;
    question: string;
    outcome: PickOutcome;
  }>;
};

export default function PicksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string>("");

  const [localPicks, setLocalPicks] = useState<LocalPickMap>({});

  const [myCurrentStreak, setMyCurrentStreak] = useState<number>(0);
  const [leaderStreak, setLeaderStreak] = useState<number>(0);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [confettiOn, setConfettiOn] = useState(false);
  const confettiTimeoutRef = useRef<any>(null);
  const lastMilestoneRef = useRef<number>(0);

  const hasHydratedLocalRef = useRef(false);

  // Sponsor reveal state
  const [sponsorRevealed, setSponsorRevealed] = useState<Record<string, boolean>>({});
  const hasHydratedSponsorRef = useRef(false);

  // Locked games
  const [lockedGames, setLockedGames] = useState<LockedGamesMap>({});
  const hasHydratedLockedRef = useRef(false);

  // Dedicated match view
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // Comments modal
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsQuestion, setCommentsQuestion] = useState<ApiQuestion | null>(null);
  const [commentsGame, setCommentsGame] = useState<ApiGame | null>(null);
  const [commentsList, setCommentsList] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentErr, setCommentErr] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const commentsUnsubRef = useRef<null | (() => void)>(null);

  // Slip modal (shareable)
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipPayload, setSlipPayload] = useState<ShareSlipPayload | null>(null);
  const [slipReadOnly, setSlipReadOnly] = useState(false);
  const [slipConfirmMode, setSlipConfirmMode] = useState(false);
  const [slipToast, setSlipToast] = useState<string>("");

  // NOTE: no pulsing / ping animations anywhere in this file.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadPicks = useCallback(async () => {
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

      const res = await fetch(`/api/picks`, {
        headers: { ...authHeader },
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("Picks API error:", t);
        throw new Error("Failed to load picks");
      }

      const data = (await res.json()) as PicksApiResponse;
      const nextRound = typeof data.roundNumber === "number" ? data.roundNumber : null;

      setRoundNumber(nextRound);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      console.error(e);
      setErr("Could not load picks right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  // Hydrate local picks
  useEffect(() => {
    if (hasHydratedLocalRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalPickMap;
        if (parsed && typeof parsed === "object") setLocalPicks(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate local picks", e);
    } finally {
      hasHydratedLocalRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(localPicks));
    } catch {}
  }, [localPicks, user?.uid, roundNumber]);

  // Hydrate sponsor reveal
  useEffect(() => {
    if (hasHydratedSponsorRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeSponsorKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") setSponsorRevealed(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate sponsor reveal state", e);
    } finally {
      hasHydratedSponsorRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeSponsorKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(sponsorRevealed));
    } catch {}
  }, [sponsorRevealed, user?.uid, roundNumber]);

  // Hydrate locked games state
  useEffect(() => {
    if (hasHydratedLockedRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeLockedKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LockedGamesMap;
        if (parsed && typeof parsed === "object") setLockedGames(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate locked picks state", e);
    } finally {
      hasHydratedLockedRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeLockedKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(lockedGames));
    } catch {}
  }, [lockedGames, user?.uid, roundNumber]);

  // Live streak from users/{uid}
  useEffect(() => {
    if (!user) {
      setMyCurrentStreak(0);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any;
        const s = typeof d?.currentStreak === "number" ? d.currentStreak : 0;
        setMyCurrentStreak(s);
      },
      (e) => console.warn("users/{uid} snapshot error", e)
    );

    return () => unsub();
  }, [user]);

  const loadLeader = useCallback(
    async (silent?: boolean) => {
      try {
        let authHeader: Record<string, string> = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          } catch {}
        }

        const res = await fetch(`/api/leaderboard?scope=overall`, {
          headers: { ...authHeader },
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as LeaderboardApiResponse;
        const top = Array.isArray(data.entries) ? data.entries[0] : null;
        setLeaderStreak(typeof top?.currentStreak === "number" ? top.currentStreak : 0);
      } catch (e) {
        if (!silent) console.warn("Leader load failed", e);
      }
    },
    [user]
  );

  useEffect(() => {
    loadLeader();
  }, [loadLeader]);

  useEffect(() => {
    const id = window.setInterval(() => loadLeader(true), 15000);
    return () => window.clearInterval(id);
  }, [loadLeader]);

  // Confetti milestone (not a pulse; short celebration)
  useEffect(() => {
    const s = myCurrentStreak || 0;
    const milestone = Math.floor(s / 5) * 5;

    if (milestone >= 5 && milestone !== lastMilestoneRef.current) {
      lastMilestoneRef.current = milestone;
      setConfettiOn(true);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setConfettiOn(false), 1200);
    }
  }, [myCurrentStreak]);

  const allQuestions = useMemo(() => {
    const out: ApiQuestion[] = [];
    games.forEach((g) => g.questions.forEach((q) => out.push(q)));
    return out;
  }, [games]);

  const picksMade = useMemo(() => {
    let c = 0;
    allQuestions.forEach((q) => {
      const pick = effectivePick(localPicks[q.id], q.userPick);
      if (pick === "yes" || pick === "no") c += 1;
    });
    return c;
  }, [allQuestions, localPicks]);

  const totalPickable = useMemo(() => allQuestions.length, [allQuestions]);

  const accuracyPct = useMemo(() => {
    let settledPicked = 0;
    let correct = 0;

    allQuestions.forEach((q) => {
      const pick = effectivePick(localPicks[q.id], q.userPick);
      if (pick !== "yes" && pick !== "no") return;

      const settled = q.status === "final" || q.status === "void";
      if (!settled) return;
      if (q.status === "void") return;

      settledPicked += 1;
      if (q.correctPick === true) correct += 1;
    });

    if (settledPicked <= 0) return 0;
    return Math.round((correct / settledPicked) * 100);
  }, [allQuestions, localPicks]);

  const nextLockMs = useMemo(() => {
    const future = games
      .map((g) => new Date(g.startTime).getTime())
      .filter((t) => Number.isFinite(t) && t > nowMs)
      .sort((a, b) => a - b);

    if (!future.length) return 0;
    return future[0] - nowMs;
  }, [games, nowMs]);

  // Games played (once locked)
  const gamesPlayedLocked = useMemo(() => {
    let count = 0;

    for (const g of games) {
      const lockMs = new Date(g.startTime).getTime() - nowMs;
      const gameLocked = Number.isFinite(lockMs) && lockMs <= 0;
      if (!gameLocked) continue;

      const hasAnyPick = g.questions.some((q) => {
        const p = effectivePick(localPicks[q.id], q.userPick);
        return p === "yes" || p === "no";
      });

      if (hasAnyPick) count += 1;
    }

    return count;
  }, [games, nowMs, localPicks]);

  const eligibility = useMemo(() => {
    const streakOk = (myCurrentStreak || 0) >= ELIGIBILITY.MIN_STREAK;
    const gamesOk = gamesPlayedLocked >= ELIGIBILITY.MIN_GAMES;

    const streakNeed = Math.max(0, ELIGIBILITY.MIN_STREAK - (myCurrentStreak || 0));
    const gamesNeed = Math.max(0, ELIGIBILITY.MIN_GAMES - gamesPlayedLocked);

    const streakProg = Math.max(0, Math.min(100, ((myCurrentStreak || 0) / ELIGIBILITY.MIN_STREAK) * 100));
    const gamesProg = Math.max(0, Math.min(100, (gamesPlayedLocked / ELIGIBILITY.MIN_GAMES) * 100));

    return {
      streakOk,
      gamesOk,
      eligibleNow: streakOk && gamesOk,
      streakNeed,
      gamesNeed,
      streakProg,
      gamesProg,
    };
  }, [myCurrentStreak, gamesPlayedLocked]);

  function isQuestionLocked(q: ApiQuestion, gameLocked: boolean) {
    if (q.status === "final") return true;
    if (q.status === "void") return true;
    if (q.status === "pending") return true;
    if (gameLocked) return true;
    return false;
  }

  const clearPick = useCallback(
    async (q: ApiQuestion) => {
      setLocalPicks((prev) => ({ ...prev, [q.id]: "none" }));

      if (!user) return;

      try {
        const token = await user.getIdToken();

        const delRes = await fetch(`/api/user-picks?questionId=${encodeURIComponent(q.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (delRes.ok) return;

        const postRes = await fetch("/api/user-picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "clear", questionId: q.id }),
        });

        if (!postRes.ok) {
          console.error("Failed to clear pick:", await postRes.text());
        }
      } catch (e) {
        console.error("Clear pick error", e);
      }
    },
    [user]
  );

  const togglePick = useCallback(
    async (q: ApiQuestion, outcome: PickOutcome, locked: boolean) => {
      if (locked) return;

      const current = effectivePick(localPicks[q.id], q.userPick);

      if (current === outcome) {
        await clearPick(q);
        return;
      }

      setLocalPicks((prev) => ({ ...prev, [q.id]: outcome }));

      if (!user) return;

      try {
        const token = await user.getIdToken();
        const body = {
          questionId: q.id,
          outcome,
          roundNumber: typeof roundNumber === "number" ? roundNumber : null,
          gameId: q.gameId ?? null,
        };

        const res = await fetch("/api/user-picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) console.error("Failed to save pick:", await res.text());
      } catch (e) {
        console.error("Pick save error", e);
      }
    },
    [user, roundNumber, localPicks, clearPick]
  );

  const shareStreak = useCallback(async () => {
    const txt = `Torpie — I’m on a streak of ${myCurrentStreak}. How long can you last?`;
    try {
      if (navigator.share) {
        await navigator.share({ text: txt });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copied to clipboard ✅");
    } catch {
      alert(txt);
    }
  }, [myCurrentStreak]);

  const myVsLeaderPct = useMemo(() => {
    const denom = Math.max(1, Math.max(myCurrentStreak, leaderStreak));
    const mine = (myCurrentStreak / denom) * 100;
    const lead = (leaderStreak / denom) * 100;
    return { mine, lead };
  }, [myCurrentStreak, leaderStreak]);

  // Sponsor reveal action
  const revealSponsor = useCallback((questionId: string) => {
    setSponsorRevealed((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  // Match selection (tunnel vision)
  const selectMatch = useCallback((gameId: string) => {
    setActiveGameId(gameId);
    setFilterTab("all");
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("game", gameId);
      url.searchParams.delete("slip");
      window.history.replaceState({}, "", url.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const backToDashboard = useCallback(() => {
    setActiveGameId(null);
    setFilterTab("all");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("game");
      url.searchParams.delete("slip");
      window.history.replaceState({}, "", url.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const activeGame = useMemo(() => {
    if (!activeGameId) return null;
    return games.find((g) => g.id === activeGameId) ?? null;
  }, [games, activeGameId]);

  // If user arrives with ?game=, jump into the match view
  useEffect(() => {
    const g = searchParams.get("game");
    if (!g) return;
    if (games.length === 0) return;
    const exists = games.some((x) => x.id === g);
    if (exists) setActiveGameId(g);
  }, [searchParams, games]);

  // Shared slip deep-link
  useEffect(() => {
    const slip = searchParams.get("slip");
    if (!slip) return;
    const decoded = base64UrlDecode<ShareSlipPayload>(slip);
    if (!decoded || decoded.v !== 1) return;
    setSlipPayload(decoded);
    setSlipReadOnly(true);
    setSlipConfirmMode(false);
    setSlipOpen(true);
    setActiveGameId(null);
  }, [searchParams]);

  const buildSlipForGame = useCallback(
    (g: ApiGame): ShareSlipPayload | null => {
      const picks: ShareSlipPayload["picks"] = [];
      for (const q of g.questions) {
        const pick = effectivePick(localPicks[q.id], q.userPick);
        if (pick !== "yes" && pick !== "no") continue;
        picks.push({
          questionId: q.id,
          quarter: q.quarter,
          question: q.question,
          outcome: pick,
        });
      }
      if (picks.length === 0) return null;

      return {
        v: 1,
        roundNumber,
        gameId: g.id,
        match: g.match,
        venue: g.venue,
        startTime: g.startTime,
        picks: picks.sort((a, b) => a.quarter - b.quarter || a.question.localeCompare(b.question)),
      };
    },
    [localPicks, roundNumber]
  );

  const openSlip = useCallback(
    (payload: ShareSlipPayload, opts?: { readOnly?: boolean; confirm?: boolean }) => {
      setSlipPayload(payload);
      setSlipReadOnly(!!opts?.readOnly);
      setSlipConfirmMode(!!opts?.confirm);
      setSlipOpen(true);
      setSlipToast("");
    },
    []
  );

  const closeSlip = useCallback(() => {
    setSlipOpen(false);
    setSlipPayload(null);
    setSlipReadOnly(false);
    setSlipConfirmMode(false);
    setSlipToast("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("slip");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  const slipShareText = useMemo(() => {
    if (!slipPayload) return "";
    const lines: string[] = [];
    lines.push(`Torpie Slip — ${slipPayload.match}`);
    if (slipPayload.roundNumber !== null) {
      lines.push(slipPayload.roundNumber === 0 ? `Opening Round` : `Round ${slipPayload.roundNumber}`);
    }
    lines.push("");
    for (const p of slipPayload.picks) {
      lines.push(`Q${p.quarter}: ${p.question} — ${p.outcome.toUpperCase()}`);
    }
    lines.push("");
    lines.push("Reminder: 1 miss resets your entire streak to 0.");
    return lines.join("\n");
  }, [slipPayload]);

  const slipShareLink = useMemo(() => {
    if (!slipPayload) return "";
    try {
      const encoded = base64UrlEncode(slipPayload);
      const url = new URL(window.location.href);
      url.searchParams.delete("game");
      url.searchParams.set("slip", encoded);
      return url.toString();
    } catch {
      return "";
    }
  }, [slipPayload]);

  const shareSlip = useCallback(async () => {
    if (!slipPayload) return;
    const txt = slipShareText;
    const url = slipShareLink;

    try {
      if (navigator.share) {
        await navigator.share({ text: txt, url });
        setSlipToast("Shared ✅");
        setTimeout(() => setSlipToast(""), 1200);
        return;
      }
    } catch {}

    try {
      await navigator.clipboard.writeText(`${txt}\n\n${url}`);
      setSlipToast("Copied ✅");
      setTimeout(() => setSlipToast(""), 1200);
    } catch {
      alert(`${txt}\n\n${url}`);
    }
  }, [slipPayload, slipShareText, slipShareLink]);

  const lockInPicksForGame = useCallback((gameId: string) => {
    setLockedGames((prev) => ({ ...prev, [gameId]: true }));
    setSlipToast("Picks locked ✅");
    setTimeout(() => setSlipToast(""), 1400);
  }, []);

  const roundLabel = roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  // Active match meta
  const activeGameMeta = useMemo(() => {
    if (!activeGame) return null;
    const lockMs = new Date(activeGame.startTime).getTime() - nowMs;
    const gameLocked = lockMs <= 0;

    const selected = activeGame.questions.reduce((acc, q) => {
      const p = effectivePick(localPicks[q.id], q.userPick);
      return acc + (p === "yes" || p === "no" ? 1 : 0);
    }, 0);

    const total = activeGame.questions.length;
    const lockedByUser = !!lockedGames[activeGame.id];

    return {
      lockMs,
      gameLocked,
      selected,
      total,
      lockedByUser,
      potential: selected,
    };
  }, [activeGame, nowMs, localPicks, lockedGames]);

  const filteredQuestions = useMemo(() => {
    if (!activeGame) return [];
    const qs = activeGame.questions.slice();
    if (filterTab === "all") return qs;
    return qs.filter((q) => q.status === filterTab);
  }, [activeGame, filterTab]);

  // ---- WHITE CARD UI HELPERS ----
  const renderSentimentWhite = (q: ApiQuestion) => {
    const yes = clampPct(q.yesPercent);
    const no = clampPct(q.noPercent);

    const total = yes + no;
    const yesW = total <= 0 ? 50 : (yes / total) * 100;
    const noW = 100 - yesW;

    const majority = majorityLabel(yes, no);

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const aligned = pick === "yes" ? yes >= no : pick === "no" ? no > yes : null;

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.55)" }}>
            Crowd
          </span>
          <span style={{ color: majority.color }} className="font-black">
            {majority.label}
          </span>
        </div>

        <div
          className="mt-1 h-[7px] rounded-full overflow-hidden border"
          style={{
            borderColor: "rgba(0,0,0,0.10)",
            background: "rgba(0,0,0,0.05)",
          }}
        >
          <div className="h-full flex">
            <div
              className="h-full"
              style={{
                width: `${yesW}%`,
                background: `linear-gradient(90deg, rgba(25,195,125,0.85), rgba(25,195,125,0.20))`,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${noW}%`,
                background: `linear-gradient(90deg, rgba(255,46,77,0.20), rgba(255,46,77,0.85))`,
              }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "rgba(0,0,0,0.60)" }}>
          <span>
            YES{" "}
            <span className="font-black" style={{ color: "rgba(0,0,0,0.85)" }}>
              {Math.round(yes)}%
            </span>
          </span>

          {aligned === null ? (
            <span style={{ color: "rgba(0,0,0,0.35)" }}>Pick to compare</span>
          ) : aligned ? (
            <span style={{ color: "rgba(25,195,125,0.95)" }} className="font-black">
              With crowd
            </span>
          ) : (
            <span style={{ color: COLORS.orange }} className="font-black">
              Against crowd
            </span>
          )}

          <span>
            NO{" "}
            <span className="font-black" style={{ color: "rgba(0,0,0,0.85)" }}>
              {Math.round(no)}%
            </span>
          </span>
        </div>
      </div>
    );
  };

  const renderPickButtonsWhite = (q: ApiQuestion, locked: boolean) => {
    const pick = effectivePick(localPicks[q.id], q.userPick);
    const isYesSelected = pick === "yes";
    const isNoSelected = pick === "no";

    const btnBase =
      "flex-1 rounded-xl px-4 py-2.5 text-[12px] font-black tracking-wide border transition active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed";

    const selectedStyle = {
      borderColor: "rgba(255,46,77,0.65)",
      background: `linear-gradient(180deg, rgba(255,46,77,0.95), rgba(255,96,120,0.88))`,
      boxShadow: "0 0 22px rgba(255,46,77,0.18)",
      color: "rgba(255,255,255,0.98)",
    } as const;

    const neutralStyle = {
      borderColor: "rgba(0,0,0,0.12)",
      background: "rgba(0,0,0,0.04)",
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)",
      color: "rgba(0,0,0,0.85)",
    } as const;

    const lockedStyle = {
      borderColor: "rgba(0,0,0,0.10)",
      background: "rgba(0,0,0,0.03)",
      color: "rgba(0,0,0,0.45)",
    } as const;

    return (
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() => togglePick(q, "yes", locked)}
          className={btnBase}
          style={locked ? lockedStyle : isYesSelected ? selectedStyle : neutralStyle}
          aria-pressed={isYesSelected}
        >
          YES
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={() => togglePick(q, "no", locked)}
          className={btnBase}
          style={locked ? lockedStyle : isNoSelected ? selectedStyle : neutralStyle}
          aria-pressed={isNoSelected}
        >
          NO
        </button>
      </div>
    );
  };

  const WhitePickCard = ({ g, q, gameLocked }: { g: ApiGame; q: ApiQuestion; gameLocked: boolean }) => {
    const sponsor = q.isSponsorQuestion === true;
    const sponsorName = (q.sponsorName || "Rebel Sport").trim();
    const sponsorPrize = (q.sponsorPrize || "$100 gift card").trim();

    const teamCode = extractTeamCode(q.question);
    const jerseySrc = `/jerseys/${teamCode}.jpg`;

    const playerName = extractPlayerName(q.question) || "AFL Player";
    const playerImgSrc = `/players/${encodeURIComponent(playerName)}.jpg`;

    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const locked = isQuestionLocked(q, gameLocked);

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const hasPick = pick === "yes" || pick === "no";

    const revealed = sponsor ? !!sponsorRevealed[q.id] : true;
    const interactionLocked = locked || (sponsor && !revealed);

    return (
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          borderColor: sponsor ? "rgba(255,46,77,0.55)" : "rgba(0,0,0,0.08)",
          background: sponsor
            ? "linear-gradient(180deg, rgba(255,46,77,0.08), rgba(255,255,255,1))"
            : "rgba(255,255,255,0.98)",
          boxShadow: sponsor ? "0 16px 40px rgba(255,46,77,0.10)" : "0 18px 55px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="h-1 w-full"
          style={{
            background: sponsor
              ? "linear-gradient(90deg, rgba(255,46,77,0.95), rgba(255,96,120,0.80))"
              : "linear-gradient(90deg, rgba(255,46,77,0.55), rgba(0,0,0,0.00))",
          }}
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: "rgba(0,0,0,0.55)" }}>
                Q{q.quarter}
              </span>

              {sponsor ? (
                <span
                  className="text-[10px] font-black rounded-full px-2 py-1 border"
                  style={{
                    borderColor: "rgba(255,46,77,0.35)",
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,46,77,0.95)",
                  }}
                >
                  SPONSORED
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[12px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: hasPick ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.08)",
                  background: hasPick ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.03)",
                  color: hasPick ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.40)",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearPick(q);
                }}
                disabled={!hasPick || interactionLocked}
                aria-label="Clear selection"
                title={interactionLocked ? "Locked" : "Clear"}
              >
                ✕
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(0,0,0,0.10)",
                  background: "rgba(0,0,0,0.03)",
                  color: "rgba(0,0,0,0.85)",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openComments(g, q);
                }}
                title="Open comments"
              >
                💬 {q.commentCount ?? 0}
              </button>
            </div>
          </div>

          {!sponsor || revealed ? (
            <div className="mt-3 flex items-center gap-3">
              <div
                className="relative h-[46px] w-[46px] rounded-2xl border overflow-hidden shrink-0"
                style={{
                  borderColor: "rgba(0,0,0,0.10)",
                  background: "rgba(0,0,0,0.04)",
                }}
                title={playerName}
              >
                <Image src={playerImgSrc} alt={playerName} fill sizes="46px" style={{ objectFit: "cover" }} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[12px] uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.45)" }}>
                  {g.match}
                </div>
                <div className="mt-1 text-[14px] font-black truncate" style={{ color: "rgba(0,0,0,0.92)" }}>
                  {playerName}
                </div>
                <div className="mt-0.5 text-[11px] truncate" style={{ color: "rgba(0,0,0,0.55)" }}>
                  {g.venue} • {formatAedt(g.startTime)}
                </div>
              </div>

              <div
                className="relative h-[46px] w-[46px] rounded-2xl border overflow-hidden shrink-0"
                style={{
                  borderColor: "rgba(0,0,0,0.10)",
                  background: "rgba(0,0,0,0.04)",
                }}
                title={teamCode === "Generic" ? "Generic jersey" : `${teamCode} jersey`}
              >
                <Image src={jerseySrc} alt={`${teamCode} jersey`} fill sizes="46px" style={{ objectFit: "cover" }} />
              </div>
            </div>
          ) : null}

          {sponsor && !revealed ? (
            <div
              className="mt-3 rounded-2xl border p-4"
              style={{
                borderColor: "rgba(255,46,77,0.28)",
                background: "linear-gradient(180deg, rgba(255,46,77,0.10), rgba(0,0,0,0.02))",
              }}
            >
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.60)" }}>
                Question proudly sponsored by
              </div>

              <div className="mt-1 text-[20px] font-black" style={{ color: "rgba(0,0,0,0.92)" }}>
                {sponsorName}
              </div>

              <div className="mt-2 text-[13px] font-semibold" style={{ color: "rgba(0,0,0,0.75)" }}>
                Get this correct to go in the draw to win a <span className="font-black">{sponsorPrize}</span>.
              </div>

              <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
                Sponsor question counts in your streak.
              </div>

              <button
                type="button"
                onClick={() => revealSponsor(q.id)}
                className="mt-4 w-full rounded-xl border px-4 py-3 text-[13px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,46,77,0.30)",
                  background: "rgba(255,46,77,0.10)",
                  color: "rgba(255,46,77,0.95)",
                }}
              >
                🔓 Reveal sponsor question
              </button>
            </div>
          ) : (
            <>
              <div className="mt-3 text-[13px] font-semibold leading-snug" style={{ color: "rgba(0,0,0,0.92)" }}>
                {q.question}
              </div>

              <div>{renderSentimentWhite(q)}</div>

              {renderPickButtonsWhite(q, interactionLocked)}
            </>
          )}

          {locked ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0.06))",
              }}
            />
          ) : null}

          {!locked && lockMs > 0 ? (
            <div className="mt-3 text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.55)" }}>
              Locks in {msToCountdown(lockMs)}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // Home-page style game boxes on Picks dashboard
  const GameBoxHomeStyle = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const gameLocked = lockMs <= 0;

    const picked = g.questions.reduce((acc, q) => {
      const p = effectivePick(localPicks[q.id], q.userPick);
      return acc + (p === "yes" || p === "no" ? 1 : 0);
    }, 0);

    const total = g.questions.length;
    const isLockedByUser = !!lockedGames[g.id];

    const matchImg = `/matches/${encodeURIComponent(g.id)}.jpg`;

    return (
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
        }}
      >
        <button
          type="button"
          onClick={() => selectMatch(g.id)}
          className="relative w-full h-[140px] sm:h-[160px] block"
          title="Open match"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,46,77,0.20) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          <Image
            src={matchImg}
            alt={g.match}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            style={{ objectFit: "cover", opacity: 0.55 }}
          />

          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0.00) 10%, rgba(0,0,0,0.88) 100%)",
            }}
          />

          <div className="absolute left-4 right-4 bottom-3">
            <div className="text-[11px] text-white/70 font-semibold">{formatAedt(g.startTime)}</div>
            <div className="mt-1 text-[18px] font-black text-white truncate">{g.match}</div>

            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {picked}/{total} picks
              </span>

              {isLockedByUser ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(25,195,125,0.35)",
                    background: "rgba(25,195,125,0.10)",
                    color: "rgba(25,195,125,0.95)",
                  }}
                >
                  PICKS LOCKED ✅
                </span>
              ) : gameLocked ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  LIVE / Locked
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,46,77,0.28)",
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  Locks in {msToCountdown(lockMs)}
                </span>
              )}
            </div>
          </div>
        </button>

        <div
          className="px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "rgba(0,0,0,0.92)",
          }}
        >
          <div className="text-[12px] font-semibold" style={{ color: "rgba(0,0,0,0.70)" }}>
            {g.venue}
          </div>

          <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
            {total} questions (pick any amount)
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectMatch(g.id)}
              className="rounded-xl px-4 py-2 text-[12px] font-black border active:scale-[0.99]"
              style={{
                borderColor: "rgba(0,0,0,0.10)",
                background: `linear-gradient(180deg, ${COLORS.orange} 0%, rgba(255,46,77,0.82) 100%)`,
                color: "rgba(255,255,255,0.98)",
                boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
              }}
            >
              PLAY NOW
            </button>

            {picked > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const payload = buildSlipForGame(g);
                  if (payload) openSlip(payload, { readOnly: false, confirm: false });
                }}
                className="rounded-xl px-4 py-2 text-[12px] font-black border active:scale-[0.99]"
                style={{
                  borderColor: "rgba(0,0,0,0.10)",
                  background: "rgba(0,0,0,0.04)",
                  color: "rgba(0,0,0,0.85)",
                }}
                title="View slip"
              >
                View slip
              </button>
            ) : (
              <span className="text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
                Tap Play Now to start picking
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Comments open/close
  const openComments = useCallback((g: ApiGame, q: ApiQuestion) => {
    setCommentsGame(g);
    setCommentsQuestion(q);
    setCommentsOpen(true);
    setCommentText("");
    setCommentErr("");
    setCommentsList([]);
  }, []);

  const closeComments = useCallback(() => {
    setCommentsOpen(false);
    setCommentsQuestion(null);
    setCommentsGame(null);
    setCommentsList([]);
    setCommentText("");
    setCommentErr("");
    setCommentsLoading(false);
    setCommentPosting(false);
    if (commentsUnsubRef.current) {
      try {
        commentsUnsubRef.current();
      } catch {}
      commentsUnsubRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!commentsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComments();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentsOpen, closeComments]);

  useEffect(() => {
    if (!commentsOpen || !commentsQuestion) return;

    setCommentsLoading(true);
    setCommentErr("");

    if (commentsUnsubRef.current) {
      try {
        commentsUnsubRef.current();
      } catch {}
      commentsUnsubRef.current = null;
    }

    const qRef = query(collection(db, "comments"), where("questionId", "==", commentsQuestion.id), limit(50));

    commentsUnsubRef.current = onSnapshot(
      qRef,
      (snap) => {
        const rows: CommentRow[] = snap.docs
          .map((d) => {
            const data = d.data() as any;

            const body =
              typeof data?.body === "string"
                ? data.body
                : typeof data?.text === "string"
                ? data.text
                : "";

            return {
              id: d.id,
              questionId: data?.questionId ?? commentsQuestion.id,
              gameId: data?.gameId ?? null,
              roundNumber: typeof data?.roundNumber === "number" ? data.roundNumber : null,
              userId: data?.userId ?? null,
              displayName: data?.displayName ?? null,
              username: data?.username ?? null,
              body,
              createdAt: data?.createdAt,
            };
          })
          .sort((a, b) => {
            const ams = a.createdAt?.toMillis?.() ?? 0;
            const bms = b.createdAt?.toMillis?.() ?? 0;
            return bms - ams;
          });

        setCommentsList(rows);
        setCommentsLoading(false);
      },
      (e) => {
        console.warn("comments snapshot error", e);
        setCommentErr("Could not load comments.");
        setCommentsLoading(false);
      }
    );

    return () => {
      if (commentsUnsubRef.current) {
        try {
          commentsUnsubRef.current();
        } catch {}
        commentsUnsubRef.current = null;
      }
    };
  }, [commentsOpen, commentsQuestion]);

  const postComment = useCallback(async () => {
    setCommentErr("");

    const q = commentsQuestion;
    if (!q) return;

    const txt = commentText.trim();
    if (!txt) {
      setCommentErr("Write something first.");
      return;
    }

    if (!user) {
      setCommentErr("Log in to comment.");
      return;
    }

    if (txt.length > 240) {
      setCommentErr("Keep it under 240 characters.");
      return;
    }

    setCommentPosting(true);
    try {
      const payload: any = {
        questionId: q.id,
        gameId: q.gameId ?? commentsGame?.id ?? null,
        roundNumber: typeof roundNumber === "number" ? roundNumber : null,
        userId: user.uid,
        displayName: user.displayName ?? null,
        body: txt,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "comments"), payload);
      setCommentText("");
    } catch (e) {
      console.error("postComment error", e);
      setCommentErr("Could not post comment.");
    } finally {
      setCommentPosting(false);
    }
  }, [commentText, commentsQuestion, commentsGame, user, roundNumber]);

  // Slip Modal
  const SlipModal = () => {
    if (!slipOpen || !slipPayload) return null;

    const isConfirm = slipConfirmMode && !slipReadOnly;
    const hasPicks = slipPayload.picks.length > 0;

    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeSlip();
        }}
        style={{
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          className="w-full max-w-2xl rounded-2xl border overflow-hidden"
          style={{
            borderColor: COLORS.orangeSoft,
            background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.80)",
          }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{
              borderColor: "rgba(255,46,77,0.20)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-white/55">
                  {slipReadOnly ? "Shared Slip" : "Your Slip"}
                </div>
                <div className="mt-1 text-[16px] font-extrabold text-white truncate">{slipPayload.match}</div>
                <div className="mt-1 text-[12px] text-white/70 truncate">
                  {slipPayload.venue ?? "—"} • {slipPayload.startTime ? formatAedt(slipPayload.startTime) : "—"}
                </div>
              </div>

              <button
                type="button"
                onClick={closeSlip}
                className="rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.90)",
                }}
                aria-label="Close slip"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div
              className="rounded-xl border p-3 text-[12px]"
              style={{
                borderColor: "rgba(255,46,77,0.35)",
                background: "rgba(255,46,77,0.10)",
                color: "rgba(255,255,255,0.90)",
              }}
            >
              <span className="font-black">Reminder:</span> 1 miss resets your entire streak to 0.
            </div>

            {!hasPicks ? (
              <div className="mt-3 text-[13px] text-white/75">No picks selected yet.</div>
            ) : (
              <div className="mt-4 space-y-2 max-h-[52vh] overflow-auto pr-1">
                {slipPayload.picks.map((p) => (
                  <div
                    key={p.questionId}
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-white/55">Quarter {p.quarter}</div>
                        <div className="mt-1 text-[13px] text-white/90">{p.question}</div>
                      </div>

                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border shrink-0"
                        style={{
                          borderColor: p.outcome === "yes" ? "rgba(25,195,125,0.35)" : "rgba(255,46,77,0.35)",
                          background: p.outcome === "yes" ? "rgba(25,195,125,0.10)" : "rgba(255,46,77,0.10)",
                          color: p.outcome === "yes" ? "rgba(25,195,125,0.95)" : "rgba(255,46,77,0.95)",
                        }}
                      >
                        {p.outcome.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="text-[11px] text-white/55">
                {slipPayload.roundNumber === null
                  ? ""
                  : slipPayload.roundNumber === 0
                  ? "Opening Round"
                  : `Round ${slipPayload.roundNumber}`}{" "}
                • {slipPayload.picks.length} picks
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={shareSlip}
                  className="rounded-xl border px-4 py-3 text-[12px] font-black active:scale-[0.99]"
                  style={{
                    borderColor: "rgba(0,229,255,0.30)",
                    background: "rgba(0,229,255,0.10)",
                    color: "rgba(0,229,255,0.95)",
                  }}
                  title="Share this slip"
                >
                  {slipReadOnly ? "Copy / Share" : "Share"}
                </button>

                {isConfirm ? (
                  <button
                    type="button"
                    onClick={() => {
                      lockInPicksForGame(slipPayload.gameId);
                      setSlipConfirmMode(false);
                      setSlipToast("Locked ✅");
                      setTimeout(() => setSlipToast(""), 1200);
                    }}
                    className="rounded-xl border px-5 py-3 text-[12px] font-black active:scale-[0.99]"
                    style={{
                      borderColor: "rgba(255,46,77,0.55)",
                      background: "rgba(255,46,77,0.18)",
                      color: "rgba(255,255,255,0.95)",
                    }}
                    title="Confirm lock in"
                  >
                    Confirm Lock
                  </button>
                ) : null}
              </div>
            </div>

            {slipToast ? (
              <div className="mt-3 text-[12px] font-black" style={{ color: COLORS.cyan }}>
                {slipToast}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const pageTitle = "Picks";

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {confettiOn && <Confetti recycle={false} numberOfPieces={220} gravity={0.22} />}

      <SlipModal />

      {/* Comments Modal */}
      {commentsOpen && commentsQuestion ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeComments();
          }}
          style={{
            background: "rgba(0,0,0,0.70)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border overflow-hidden"
            style={{
              borderColor: COLORS.orangeSoft,
              background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
              boxShadow: "0 24px 80px rgba(0,0,0,0.80)",
            }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{
                borderColor: "rgba(255,46,77,0.20)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-white/55">Comments</div>
                  <div className="mt-1 text-[14px] font-extrabold text-white truncate">
                    {commentsGame?.match ?? "Game"} • Quarter {commentsQuestion.quarter}
                  </div>
                  <div className="mt-1 text-[13px] text-white/80">{commentsQuestion.question}</div>
                </div>

                <button
                  type="button"
                  onClick={closeComments}
                  className="rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
                  style={{
                    borderColor: "rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.90)",
                  }}
                  aria-label="Close comments"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {!user ? (
                <div
                  className="rounded-xl border p-3 text-[12px] text-white/80"
                  style={{
                    borderColor: "rgba(255,46,77,0.35)",
                    background: "rgba(255,46,77,0.10)",
                  }}
                >
                  Log in to post comments. You can still read the chat.
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={user ? "Say something (max 240 chars)..." : "Log in to comment..."}
                  disabled={!user || commentPosting}
                  className="flex-1 rounded-xl border px-4 py-3 text-[13px] outline-none"
                  style={{
                    borderColor: "rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={postComment}
                  disabled={!user || commentPosting}
                  className="rounded-xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "rgba(0,229,255,0.30)",
                    background: "rgba(0,229,255,0.10)",
                    color: "rgba(0,229,255,0.95)",
                  }}
                >
                  {commentPosting ? "Posting…" : "Post"}
                </button>
              </div>

              {commentErr ? (
                <div className="mt-2 text-[12px]" style={{ color: COLORS.bad }}>
                  {commentErr}
                </div>
              ) : null}

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-white/55">
                  <div className="uppercase tracking-widest">Latest {commentsList.length ? `(${commentsList.length})` : ""}</div>
                  <div className="text-white/45">ESC to close</div>
                </div>

                <div className="mt-2 max-h-[52vh] overflow-auto pr-1">
                  {commentsLoading ? (
                    <div
                      className="rounded-xl border p-3 text-[12px] text-white/70"
                      style={{
                        borderColor: "rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      Loading comments…
                    </div>
                  ) : commentsList.length === 0 ? (
                    <div
                      className="rounded-xl border p-3 text-[12px] text-white/70"
                      style={{
                        borderColor: "rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      No comments yet. Be the first to chirp.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {commentsList.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border p-3"
                          style={{
                            borderColor: "rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[12px] font-black text-white/90 truncate">
                              {c.displayName || c.username || "Anonymous"}
                            </div>
                            <div className="text-[11px] text-white/45 shrink-0">{formatCommentTime(c.createdAt)}</div>
                          </div>
                          <div className="mt-1 text-[13px] text-white/85 whitespace-pre-wrap break-words">{c.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-white/45">Keep it civil. Banter is good — abuse gets binned.</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-6">
        {/* Top header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black">{pageTitle}</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: COLORS.orangeSoft,
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-white/60">
              {activeGame ? "Tunnel vision: focus one match, lock with confidence." : "Pick a match — then pick any amount."}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              How to play
            </Link>

            <button
              type="button"
              onClick={shareStreak}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              Share streak
            </button>
          </div>
        </div>

        {/* Compact mission strip */}
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: COLORS.orangeSoft,
            background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
            boxShadow: "0 18px 55px rgba(0,0,0,0.80)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/55">Current streak</div>
                <div className="mt-1 text-[26px] font-black" style={{ color: COLORS.orange }}>
                  {myCurrentStreak}
                </div>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/55">Leader</div>
                <div className="mt-1 text-[22px] font-black" style={{ color: COLORS.cyan }}>
                  {leaderStreak}
                </div>
              </div>

              <div className="hidden sm:block w-44">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${myVsLeaderPct.mine}%`,
                      background: `linear-gradient(90deg, ${COLORS.orange}, rgba(255,46,77,0.18))`,
                    }}
                  />
                </div>
                <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full"
                    style={{
                      width: `${myVsLeaderPct.lead}%`,
                      background: `linear-gradient(90deg, ${COLORS.cyan}, rgba(0,229,255,0.18))`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-white/55">
              <div className="font-black text-white/80">
                {nextLockMs > 0 ? `Next lock: ${msToCountdown(nextLockMs)}` : "No upcoming locks"}
              </div>
              <div>
                Picks: <span className="font-black text-white/85">{picksMade}</span>/{totalPickable} • Accuracy{" "}
                <span className="font-black" style={{ color: COLORS.good }}>
                  {accuracyPct}%
                </span>
              </div>
              <div className="mt-1 text-white/45">
                Eligibility:{" "}
                <span className="font-black text-white/75">
                  {eligibility.eligibleNow
                    ? "Eligible ✅"
                    : `${Math.max(0, ELIGIBILITY.MIN_STREAK - myCurrentStreak)} streak + ${Math.max(
                        0,
                        ELIGIBILITY.MIN_GAMES - gamesPlayedLocked
                      )} games to go`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.bad }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* MAIN */}
        {!activeGame ? (
          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[12px] uppercase tracking-widest text-white/55">Featured Matches</div>
                <div className="mt-1 text-[14px] text-white/75">Pick any amount — questions live inside Picks.</div>
              </div>

              <div className="text-[12px] text-white/45 hidden sm:block">Tap a card to tunnel in.</div>
            </div>

            {loading ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="h-[160px] bg-white/5" />
                    <div className="h-[120px]" style={{ background: "rgba(255,255,255,0.92)" }} />
                  </div>
                ))}
              </div>
            ) : games.length === 0 ? (
              <div
                className="mt-4 rounded-2xl border p-4 text-sm text-white/70"
                style={{
                  borderColor: COLORS.orangeSoft,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                No games found.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((g) => (
                  <GameBoxHomeStyle key={g.id} g={g} />
                ))}
              </div>
            )}

            <div className="mt-8 text-center text-[11px] text-white/45">
              <span className="font-black" style={{ color: COLORS.orange }}>
                Torpie
              </span>{" "}
              — Dashboard → Match page → Slip → Lock.
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                borderColor: COLORS.orangeSoft,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="px-4 py-4 border-b"
                style={{
                  borderColor: "rgba(255,46,77,0.20)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={backToDashboard}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
                      style={{
                        borderColor: "rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.90)",
                      }}
                    >
                      ← Back
                    </button>

                    <div className="mt-3 text-[22px] sm:text-[26px] font-black truncate" style={{ color: COLORS.white }}>
                      {activeGame.match}
                    </div>
                    <div className="mt-1 text-[12px] text-white/70 truncate">
                      {activeGame.venue} • {formatAedt(activeGame.startTime)}
                    </div>

                    {activeGameMeta ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                          style={{
                            borderColor: "rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.90)",
                          }}
                        >
                          {activeGameMeta.selected} picks selected
                        </span>

                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                          style={{
                            borderColor: "rgba(255,46,77,0.30)",
                            background: "rgba(255,46,77,0.10)",
                            color: "rgba(255,255,255,0.92)",
                          }}
                        >
                          +{activeGameMeta.potential} streak if all correct
                        </span>

                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                          style={{
                            borderColor: activeGameMeta.gameLocked ? "rgba(255,255,255,0.12)" : COLORS.orangeSoft2,
                            background: activeGameMeta.gameLocked ? "rgba(255,255,255,0.04)" : "rgba(255,46,77,0.10)",
                            color: "rgba(255,255,255,0.90)",
                          }}
                        >
                          {activeGameMeta.gameLocked ? "LIVE / Locked" : `Locks in ${msToCountdown(activeGameMeta.lockMs)}`}
                        </span>

                        {activeGameMeta.selected > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const payload = buildSlipForGame(activeGame);
                              if (payload) openSlip(payload, { readOnly: false, confirm: false });
                            }}
                            className="rounded-full border px-4 py-2 text-[12px] font-black active:scale-[0.99]"
                            style={{
                              borderColor: "rgba(255,255,255,0.14)",
                              background: "rgba(255,255,255,0.05)",
                              color: "rgba(255,255,255,0.90)",
                            }}
                          >
                            View slip
                          </button>
                        ) : null}

                        {activeGameMeta.selected > 0 && !activeGameMeta.gameLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              const payload = buildSlipForGame(activeGame);
                              if (payload) openSlip(payload, { readOnly: false, confirm: true });
                            }}
                            className="rounded-full border px-4 py-2 text-[12px] font-black active:scale-[0.99]"
                            style={{
                              borderColor: "rgba(255,46,77,0.50)",
                              background: "rgba(255,46,77,0.12)",
                              color: "rgba(255,255,255,0.95)",
                            }}
                          >
                            Lock in ({activeGameMeta.selected})
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(["all", "open", "pending", "final", "void"] as FilterTab[]).map((t) => {
                    const active = filterTab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterTab(t)}
                        className="rounded-full border px-4 py-2 text-[12px] font-black active:scale-[0.99]"
                        style={{
                          borderColor: active ? "rgba(255,46,77,0.45)" : "rgba(255,255,255,0.12)",
                          background: active ? "rgba(255,46,77,0.12)" : "rgba(255,255,255,0.04)",
                          color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                        }}
                      >
                        {t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredQuestions.map((q) => {
                    const lockMs = new Date(activeGame.startTime).getTime() - nowMs;
                    const gameLocked = lockMs <= 0;
                    return <WhitePickCard key={q.id} g={activeGame} q={q} gameLocked={gameLocked} />;
                  })}
                </div>
              </div>
            </div>

            <div className="mt-10 pb-8 text-center text-[11px] text-white/45">
              <span className="font-black" style={{ color: COLORS.orange }}>
                Torpie
              </span>{" "}
              — Back yourself. One slip and it’s back to zero.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
