// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Confetti from "react-confetti";
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

/** ✅ TORPIE palette: Black / Fire Engine Red / White */
const COLORS = {
  bg: "#05060A",
  panel: "rgba(255,255,255,0.04)",
  panel2: "rgba(255,255,255,0.02)",

  stroke: "rgba(255,255,255,0.12)",
  stroke2: "rgba(255,255,255,0.18)",

  textDim: "rgba(255,255,255,0.72)",
  textFaint: "rgba(255,255,255,0.52)",

  red: "#CE2029",
  redSoft: "rgba(206,32,41,0.28)",
  redSoft2: "rgba(206,32,41,0.18)",
  redDeep: "#8B0F16",

  good: "rgba(25,195,125,0.95)",
  bad: "rgba(206,32,41,0.95)",
  cyan: "rgba(0,229,255,0.95)",

  white: "rgba(255,255,255,0.98)",

  sponsorBgA: "rgba(206,32,41,0.95)",
  sponsorBgB: "rgba(255,96,120,0.92)",
  sponsorInk: "rgba(0,0,0,0.92)",
};

const ELIGIBILITY = {
  MIN_STREAK: 5,
  MIN_GAMES: 3,
};

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
  if (yes === no) return { label: "Split crowd", color: "rgba(255,255,255,0.70)" };
  if (yes > no) return { label: "Majority is YES", color: "rgba(25,195,125,0.95)" };
  return { label: "Majority is NO", color: COLORS.bad };
}

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `torpy:picks:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
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

/**
 * UI-only helper: best-effort player extraction from question text.
 */
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

type LocalPickMap = Record<string, LocalPick>;

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string>("");

  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const [localPicks, setLocalPicks] = useState<LocalPickMap>({});

  const [myCurrentStreak, setMyCurrentStreak] = useState<number>(0);
  const [leaderStreak, setLeaderStreak] = useState<number>(0);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [confettiOn, setConfettiOn] = useState(false);
  const confettiTimeoutRef = useRef<any>(null);
  const lastMilestoneRef = useRef<number>(0);

  const hasHydratedLocalRef = useRef(false);

  // ✅ Sponsor reveal state (per-user, per-round, per-question)
  const [sponsorRevealed, setSponsorRevealed] = useState<Record<string, boolean>>({});
  const hasHydratedSponsorRef = useRef(false);

  // “Lock in” CTA feedback (UI-only)
  const [lockToast, setLockToast] = useState<null | { title: string; body: string }>(null);
  const lockToastRef = useRef<any>(null);

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

      const nextGames = Array.isArray(data.games) ? data.games : [];
      setRoundNumber(nextRound);
      setGames(nextGames);

      // default active game
      setActiveGameId((prev) => {
        if (prev && nextGames.some((g) => g.id === prev)) return prev;
        return nextGames[0]?.id ?? null;
      });
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

  // ✅ Hydrate sponsor reveal state
  useEffect(() => {
    if (hasHydratedSponsorRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = `torpy:sponsorReveal:v1:${user?.uid ?? "anon"}:${roundNumber}`;
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
      const key = `torpy:sponsorReveal:v1:${user?.uid ?? "anon"}:${roundNumber}`;
      localStorage.setItem(key, JSON.stringify(sponsorRevealed));
    } catch {}
  }, [sponsorRevealed, user?.uid, roundNumber]);

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

  // Confetti milestone (keep)
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

  const activeGame = useMemo(() => {
    if (!activeGameId) return games[0] ?? null;
    return games.find((g) => g.id === activeGameId) ?? games[0] ?? null;
  }, [games, activeGameId]);

  const activeGameLockMs = useMemo(() => {
    if (!activeGame?.startTime) return 0;
    return new Date(activeGame.startTime).getTime() - nowMs;
  }, [activeGame?.startTime, nowMs]);

  const activeGameLocked = useMemo(() => {
    if (!activeGame) return false;
    return activeGameLockMs <= 0;
  }, [activeGame, activeGameLockMs]);

  const activeQuestions = useMemo(() => (activeGame?.questions ?? []).slice(), [activeGame]);

  const allQuestions = useMemo(() => {
    const out: ApiQuestion[] = [];
    games.forEach((g) => g.questions.forEach((q) => out.push(q)));
    return out;
  }, [games]);

  const picksMadeAll = useMemo(() => {
    let c = 0;
    allQuestions.forEach((q) => {
      const pick = effectivePick(localPicks[q.id], q.userPick);
      if (pick === "yes" || pick === "no") c += 1;
    });
    return c;
  }, [allQuestions, localPicks]);

  const picksMadeActive = useMemo(() => {
    if (!activeGame) return 0;
    let c = 0;
    activeGame.questions.forEach((q) => {
      const pick = effectivePick(localPicks[q.id], q.userPick);
      if (pick === "yes" || pick === "no") c += 1;
    });
    return c;
  }, [activeGame, localPicks]);

  const totalPickableActive = useMemo(() => activeGame?.questions?.length ?? 0, [activeGame]);

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

  // ✅ Phase 2: games played (counts only once the game is locked), and eligibility progress
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

  // ✅ FINAL questions must be locked (cannot change selection)
  function isQuestionLocked(q: ApiQuestion, gameLocked: boolean) {
    if (q.status === "final") return true;
    if (q.status === "void") return true;
    if (q.status === "pending") return true;
    if (gameLocked) return true;
    return false;
  }

  // Robust clear
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

  const clearAllActive = useCallback(async () => {
    if (!activeGame) return;

    // clear local immediately
    setLocalPicks((prev) => {
      const next = { ...prev };
      for (const q of activeGame.questions) next[q.id] = "none";
      return next;
    });

    // best-effort API clears (only if logged in)
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await Promise.all(
        activeGame.questions.map((q) =>
          fetch(`/api/user-picks?questionId=${encodeURIComponent(q.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null)
        )
      );
    } catch {}
  }, [activeGame, user]);

  const shareStreak = useCallback(async () => {
    const txt = `TORPIE — I’m on a streak of ${myCurrentStreak}. How long can you last?`;
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

  const showLockToast = useCallback((title: string, body: string) => {
    setLockToast({ title, body });
    if (lockToastRef.current) window.clearTimeout(lockToastRef.current);
    lockToastRef.current = window.setTimeout(() => setLockToast(null), 1800);
  }, []);

  // Sponsor reveal action
  const revealSponsor = useCallback((questionId: string) => {
    setSponsorRevealed((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  const topLockText = nextLockMs > 0 ? msToCountdown(nextLockMs) : "—";

  const roundLabel = useMemo(() => {
    if (roundNumber === null) return "";
    if (roundNumber === 0) return "Opening Round";
    return `Round ${roundNumber}`;
  }, [roundNumber]);

  // “Potential streak” increases as you toggle picks (active game focus)
  const potentialGain = useMemo(() => picksMadeActive, [picksMadeActive]);
  const potentialStreak = useMemo(() => Math.max(0, (myCurrentStreak || 0) + potentialGain), [
    myCurrentStreak,
    potentialGain,
  ]);

  const lockButtonLabel = useMemo(() => {
    const n = picksMadeActive;
    if (n <= 0) return "LOCK IN PICKS";
    return `LOCK IN ${n} PICK${n === 1 ? "" : "S"}`;
  }, [picksMadeActive]);

  // Comments: open/close
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

  const renderStatusPill = (q: ApiQuestion) => {
    const base =
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide border";

    if (q.status === "open") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(0,229,255,0.26)",
            background: "rgba(0,229,255,0.08)",
            color: "rgba(0,229,255,0.92)",
          }}
        >
          <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "rgba(0,229,255,0.92)" }} />
          LIVE
        </span>
      );
    }

    if (q.status === "pending") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.70)",
          }}
        >
          Locked
        </span>
      );
    }

    if (q.status === "void") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Void
        </span>
      );
    }

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const isPicked = pick === "yes" || pick === "no";
    const isCorrect = q.correctPick === true;

    if (!isPicked) {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.70)",
          }}
        >
          Final
        </span>
      );
    }

    return (
      <span
        className={base}
        style={{
          borderColor: isCorrect ? "rgba(25,195,125,0.45)" : "rgba(206,32,41,0.45)",
          background: isCorrect ? "rgba(25,195,125,0.10)" : "rgba(206,32,41,0.10)",
          color: isCorrect ? "rgba(25,195,125,0.95)" : "rgba(206,32,41,0.95)",
        }}
      >
        {isCorrect ? "Correct" : "Wrong"}
      </span>
    );
  };

  const renderCrowdCompact = (q: ApiQuestion) => {
    const yes = clampPct(q.yesPercent);
    const no = clampPct(q.noPercent);

    const total = yes + no;
    const yesW = total <= 0 ? 50 : (yes / total) * 100;
    const noW = 100 - yesW;

    const majority = majorityLabel(yes, no);

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-white/55">
          <span className="uppercase tracking-widest">Crowd</span>
          <span style={{ color: majority.color }} className="font-black">
            {majority.label}
          </span>
        </div>

        <div
          className="mt-1 h-[7px] rounded-full overflow-hidden border"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
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
                background: `linear-gradient(90deg, rgba(206,32,41,0.20), rgba(206,32,41,0.85))`,
              }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px] text-white/55">
          <span>
            YES <span className="font-black text-white/80">{Math.round(yes)}%</span>
          </span>
          <span>
            NO <span className="font-black text-white/80">{Math.round(no)}%</span>
          </span>
        </div>
      </div>
    );
  };

  const renderPickButtonsSweat = (q: ApiQuestion, locked: boolean) => {
    const pick = effectivePick(localPicks[q.id], q.userPick);
    const isYesSelected = pick === "yes";
    const isNoSelected = pick === "no";

    const btnBase =
      "flex-1 rounded-xl px-4 py-2.5 text-[12px] font-black tracking-wide border transition active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed";

    const selectedStyle = {
      borderColor: "rgba(206,32,41,0.65)",
      background: `linear-gradient(180deg, rgba(206,32,41,0.98), rgba(255,96,120,0.88))`,
      boxShadow: "0 0 26px rgba(206,32,41,0.20), inset 0 0 0 1px rgba(255,255,255,0.10)",
      color: "rgba(0,0,0,0.92)",
    } as const;

    const neutralStyle = {
      borderColor: "rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.04)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
      color: "rgba(255,255,255,0.90)",
    } as const;

    const lockedStyle = {
      borderColor: "rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.03)",
      color: "rgba(255,255,255,0.55)",
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
          title={locked ? "Locked" : isYesSelected ? "Click again to clear" : "Pick YES"}
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
          title={locked ? "Locked" : isNoSelected ? "Click again to clear" : "Pick NO"}
        >
          NO
        </button>
      </div>
    );
  };

  const StrategyLadder = ({ base, gain }: { base: number; gain: number }) => {
    const maxGain = 15;
    const clampedGain = Math.max(0, Math.min(maxGain, gain));
    const top = base + maxGain;
    const current = base;
    const potential = base + clampedGain;

    const steps = Array.from({ length: maxGain + 1 }, (_, i) => top - i); // top down
    const highlightTop = steps.indexOf(potential);
    const highlightCurrent = steps.indexOf(current);

    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="text-[11px] uppercase tracking-widest text-white/55">Streak ladder</div>
          <div className="mt-1 text-[13px] text-white/80">
            <span className="font-black" style={{ color: COLORS.white }}>
              +{clampedGain}
            </span>{" "}
            if all correct
          </div>
        </div>

        <div className="p-4">
          <div className="relative">
            {/* center red line */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[6px] rounded-full"
              style={{
                background: `linear-gradient(180deg, rgba(206,32,41,0.15), rgba(206,32,41,0.95), rgba(206,32,41,0.15))`,
                boxShadow: "0 0 26px rgba(206,32,41,0.18)",
              }}
            />

            <div className="flex flex-col gap-2">
              {steps.map((n, idx) => {
                const isPotential = idx === highlightTop;
                const isCurrent = idx === highlightCurrent;

                return (
                  <div key={n} className="relative flex items-center justify-between gap-3">
                    <div className="w-10 text-right text-[12px] font-black" style={{ color: isPotential ? COLORS.white : "rgba(255,255,255,0.55)" }}>
                      {n}
                    </div>

                    <div className="flex-1" />

                    <div className="w-10 text-left text-[12px] font-black" style={{ color: isPotential ? COLORS.white : "rgba(255,255,255,0.55)" }}>
                      {n}
                    </div>

                    {(isCurrent || isPotential) && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{
                          width: 34,
                          height: 22,
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.16)",
                          background: isPotential
                            ? "rgba(255,255,255,0.92)"
                            : "rgba(255,255,255,0.07)",
                          color: isPotential ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.88)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 900,
                          boxShadow: isPotential ? "0 10px 26px rgba(0,0,0,0.22)" : "none",
                        }}
                      >
                        {isPotential ? "POT" : "NOW"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.25)" }}>
              <div className="text-[10px] uppercase tracking-widest text-white/55">Current</div>
              <div className="mt-0.5 text-[16px] font-black" style={{ color: COLORS.white }}>
                {base}
              </div>
            </div>
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(206,32,41,0.25)", background: "rgba(206,32,41,0.10)" }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.70)" }}>
                Potential
              </div>
              <div className="mt-0.5 text-[16px] font-black" style={{ color: COLORS.white }}>
                {potential}
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-white/55">
            Reminder: <span className="font-black text-white/80">1 miss</span> resets your entire streak to{" "}
            <span className="font-black" style={{ color: COLORS.red }}>
              0
            </span>
            .
          </div>
        </div>
      </div>
    );
  };

  // Single “premium” card: clean, addictive, fast to pick
  const PickCard = ({ g, q, gameLocked }: { g: ApiGame; q: ApiQuestion; gameLocked: boolean }) => {
    const sponsor = q.isSponsorQuestion === true;
    const sponsorName = (q.sponsorName || "Rebel Sport").trim();
    const sponsorPrize = (q.sponsorPrize || "$100 gift card").trim();

    const teamCode = extractTeamCode(q.question);
    const jerseySrc = `/jerseys/${teamCode}.jpg`;

    const playerName = extractPlayerName(q.question) || "AFL Player";

    const locked = isQuestionLocked(q, gameLocked);

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const hasPick = pick === "yes" || pick === "no";

    const revealed = sponsor ? !!sponsorRevealed[q.id] : true;
    const interactionLocked = locked || (sponsor && !revealed);

    const baseBorder = sponsor ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.10)";
    const bg = sponsor
      ? `linear-gradient(180deg, rgba(206,32,41,0.92), rgba(139,15,22,0.75))`
      : `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 55%, rgba(0,0,0,0.40) 100%)`;

    const glow = hasPick
      ? "0 0 34px rgba(206,32,41,0.12)"
      : "0 0 22px rgba(0,0,0,0.35)";

    const ink = sponsor ? COLORS.sponsorInk : "rgba(255,255,255,0.92)";
    const faintInk = sponsor ? "rgba(0,0,0,0.60)" : "rgba(255,255,255,0.55)";

    return (
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          borderColor: baseBorder,
          background: bg,
          boxShadow: glow,
        }}
      >
        {/* subtle top strip */}
        <div
          className="h-1 w-full"
          style={{
            background: sponsor
              ? "linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.00))"
              : "linear-gradient(90deg, rgba(206,32,41,0.30), rgba(206,32,41,0.00))",
          }}
        />

        <div className="p-4">
          {/* compact header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {renderStatusPill(q)}
              <span className="text-[11px] font-black uppercase tracking-wide text-white/60">Q{q.quarter}</span>

              {sponsor ? (
                <span
                  className="text-[10px] font-black rounded-full px-2 py-1 border"
                  style={{
                    borderColor: "rgba(0,0,0,0.22)",
                    background: "rgba(0,0,0,0.10)",
                    color: "rgba(0,0,0,0.88)",
                  }}
                >
                  SPONSORED
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* clear */}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[12px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: sponsor ? "rgba(0,0,0,0.22)" : hasPick ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                  background: sponsor ? "rgba(0,0,0,0.10)" : hasPick ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                  color: sponsor ? "rgba(0,0,0,0.88)" : hasPick ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  clearPick(q);
                }}
                disabled={!hasPick || interactionLocked}
                title={interactionLocked ? "Locked" : hasPick ? "Clear selection" : "No selection to clear"}
                aria-label="Clear selection"
              >
                ✕
              </button>

              {/* comments */}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: sponsor ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.12)",
                  background: sponsor ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.04)",
                  color: sponsor ? "rgba(0,0,0,0.90)" : "rgba(255,255,255,0.90)",
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

          {/* sponsor cover */}
          {sponsor && !revealed ? (
            <div
              className="mt-3 rounded-2xl border p-4"
              style={{
                borderColor: "rgba(0,0,0,0.22)",
                background: "rgba(0,0,0,0.12)",
              }}
            >
              <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.75)" }}>
                Question proudly sponsored by
              </div>

              <div className="mt-1 text-[22px] font-black" style={{ color: "rgba(0,0,0,0.92)" }}>
                {sponsorName}
              </div>

              <div className="mt-2 text-[13px] font-semibold" style={{ color: "rgba(0,0,0,0.80)" }}>
                Get this correct to go in the draw to win a <span className="font-black">{sponsorPrize}</span>.
              </div>

              <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.65)" }}>
                Sponsor question counts in your streak.
              </div>

              <button
                type="button"
                onClick={() => revealSponsor(q.id)}
                className="mt-4 w-full rounded-xl border px-4 py-3 text-[13px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(0,0,0,0.28)",
                  background: "rgba(0,0,0,0.16)",
                  color: "rgba(0,0,0,0.92)",
                }}
                title="Reveal sponsor question"
              >
                🔓 Reveal sponsor question
              </button>
            </div>
          ) : (
            <>
              {/* player strip */}
              <div
                className="mt-3 rounded-2xl border p-3"
                style={{
                  borderColor: sponsor ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.10)",
                  background: sponsor ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.25)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: faintInk }}>
                      Player
                    </div>
                    <div className="mt-1 text-[15px] font-black truncate" style={{ color: ink }}>
                      {playerName}
                    </div>
                    <div className="mt-1 text-[11px] truncate" style={{ color: faintInk }}>
                      {g.match} • {teamCode !== "Generic" ? teamCode.toUpperCase() : "—"}
                    </div>
                  </div>

                  <div
                    className="relative h-[54px] w-[54px] rounded-2xl border overflow-hidden shrink-0"
                    style={{
                      borderColor: sponsor ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)",
                      background: sponsor ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.06)",
                    }}
                    title={teamCode === "Generic" ? "Generic jersey" : `${teamCode} jersey`}
                  >
                    <Image src={jerseySrc} alt={`${teamCode} jersey`} fill sizes="54px" style={{ objectFit: "cover" }} />
                  </div>
                </div>
              </div>

              {/* question */}
              <div className="mt-3 text-[13px] font-semibold leading-snug" style={{ color: ink }}>
                {q.question}
              </div>

              {/* crowd */}
              <div style={{ color: sponsor ? "rgba(0,0,0,0.92)" : "inherit" }}>{renderCrowdCompact(q)}</div>

              {/* pick buttons */}
              {renderPickButtonsSweat(q, interactionLocked)}
            </>
          )}

          {/* lock overlay */}
          {locked ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: sponsor
                  ? "linear-gradient(180deg, rgba(206,32,41,0.02), rgba(0,0,0,0.22))"
                  : "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.55))",
              }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const pageTitle = "Picks";

  // Sticky header “the sweat”
  const StickyHeader = () => {
    const match = activeGame?.match ?? "Match Picks";
    const subtitle = activeGame
      ? `${activeGame.venue} • ${formatAedt(activeGame.startTime)}`
      : "Loading…";

    const locksText = !activeGame
      ? "—"
      : activeGameLocked
      ? "Locked"
      : `Locks in ${msToCountdown(activeGameLockMs)}`;

    return (
      <div
        className="sticky top-0 z-[60] border-b"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background:
            `linear-gradient(180deg, rgba(5,6,10,0.95) 0%, rgba(5,6,10,0.88) 70%, rgba(5,6,10,0.70) 100%)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-xl border flex items-center justify-center font-black"
                  style={{
                    borderColor: "rgba(206,32,41,0.35)",
                    background: "rgba(206,32,41,0.10)",
                    color: COLORS.white,
                    boxShadow: "0 0 26px rgba(206,32,41,0.10)",
                  }}
                  title="Potential streak"
                >
                  {potentialStreak}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-white/55">Potential streak</div>
                  <div className="text-[14px] font-black text-white truncate">{match}</div>
                </div>
              </div>
              <div className="mt-1 text-[12px] text-white/60 truncate">{subtitle}</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="hidden sm:inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.90)",
                }}
              >
                {locksText}
              </span>

              <button
                type="button"
                onClick={() => shareStreak()}
                className="hidden sm:inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
                title="Share"
              >
                Share
              </button>

              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(206,32,41,0.30)",
                  background: "rgba(206,32,41,0.10)",
                  color: "rgba(255,255,255,0.92)",
                }}
                title="Leaderboards"
              >
                Ladder
              </Link>
            </div>
          </div>

          {/* game selector chips */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {games.length === 0 ? (
              <div className="text-[12px] text-white/55">No games</div>
            ) : (
              games.map((g) => {
                const isActive = g.id === activeGameId;
                const lockMs = new Date(g.startTime).getTime() - nowMs;
                const locked = lockMs <= 0;

                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveGameId(g.id)}
                    className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-black transition active:scale-[0.99]"
                    style={{
                      borderColor: isActive ? "rgba(206,32,41,0.55)" : "rgba(255,255,255,0.12)",
                      background: isActive ? "rgba(206,32,41,0.16)" : "rgba(255,255,255,0.04)",
                      color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.82)",
                      boxShadow: isActive ? "0 0 24px rgba(206,32,41,0.12)" : "none",
                    }}
                    title={g.match}
                  >
                    <span className="whitespace-nowrap">{g.match}</span>
                    <span className="ml-2 text-[10px] font-black" style={{ color: locked ? "rgba(255,255,255,0.60)" : "rgba(0,229,255,0.92)" }}>
                      {locked ? "LOCKED" : "LIVE"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const LockInBarMobile = () => {
    // Only show on small screens
    return (
      <div className="fixed inset-x-0 bottom-0 z-[70] sm:hidden">
        <div
          className="mx-auto w-full max-w-6xl px-4 pb-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,10,0.00) 0%, rgba(5,6,10,0.75) 30%, rgba(5,6,10,0.92) 100%)",
          }}
        >
          <div className="rounded-2xl border p-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-white/55">Selected</div>
                <div className="text-[14px] font-black text-white truncate">
                  {picksMadeActive}/{totalPickableActive} picks • <span style={{ color: COLORS.red }}>+{potentialGain}</span> if all correct
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  Reminder: <span className="font-black text-white/80">1 miss</span> resets your streak to{" "}
                  <span className="font-black" style={{ color: COLORS.red }}>
                    0
                  </span>
                  .
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    showLockToast("Log in to play", "Create a free account to save picks + appear on ladders.");
                    return;
                  }
                  if (!activeGame) return;
                  if (picksMadeActive <= 0) {
                    showLockToast("Pick something", "Tap YES/NO on any question.");
                    return;
                  }
                  showLockToast("Locked in ✅", "Your picks are saved instantly.");
                }}
                className="shrink-0 rounded-xl border px-4 py-3 text-[13px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(206,32,41,0.55)",
                  background: `linear-gradient(180deg, rgba(206,32,41,0.95), rgba(139,15,22,0.85))`,
                  color: "rgba(255,255,255,0.98)",
                  boxShadow: "0 16px 40px rgba(206,32,41,0.18)",
                  opacity: activeGameLocked ? 0.55 : 1,
                }}
                disabled={activeGameLocked}
                title={activeGameLocked ? "Game locked" : "Lock in picks"}
              >
                {lockButtonLabel}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => clearAllActive()}
                className="text-[12px] font-black underline underline-offset-2"
                style={{ color: "rgba(255,255,255,0.70)" }}
                disabled={activeGameLocked || picksMadeActive <= 0}
                title="Clear all picks for this match"
              >
                Clear all
              </button>

              <div className="text-[12px] font-black" style={{ color: "rgba(0,229,255,0.92)" }}>
                Next lock: {topLockText}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Comments Modal (unchanged core, slight branding copy)
  const CommentsModal = () => {
    if (!commentsOpen || !commentsQuestion) return null;

    return (
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
            borderColor: "rgba(206,32,41,0.30)",
            background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.80)",
          }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{
              borderColor: "rgba(206,32,41,0.20)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-white/55">Locker room</div>
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
                  borderColor: "rgba(206,32,41,0.35)",
                  background: "rgba(206,32,41,0.10)",
                }}
              >
                Log in to post. You can still read the chirps.
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
                  <div className="rounded-xl border p-3 text-[12px] text-white/70" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                    Loading…
                  </div>
                ) : commentsList.length === 0 ? (
                  <div className="rounded-xl border p-3 text-[12px] text-white/70" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                    No comments yet. Be the first to chirp.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {commentsList.map((c) => (
                      <div key={c.id} className="rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-black text-white/90 truncate">{c.displayName || c.username || "Anonymous"}</div>
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
    );
  };

  // Sidebar “strategy”
  const StrategySidebar = () => {
    const leaderDiff =
      myCurrentStreak > leaderStreak ? "You’re leading" : myCurrentStreak === leaderStreak ? "Tied" : `Need ${leaderStreak - myCurrentStreak} to catch`;

    return (
      <div className="lg:sticky lg:top-[92px] space-y-3">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))`,
            boxShadow: "0 18px 55px rgba(0,0,0,0.60)",
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] uppercase tracking-widest text-white/55">Strategy</div>
            <div className="mt-1 text-[14px] font-black text-white">The Ladder</div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.25)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/55">Your streak</div>
                <div className="mt-1 text-[22px] font-black" style={{ color: COLORS.white }}>
                  {myCurrentStreak}
                </div>
                <div className="mt-1 text-[11px] text-white/55">{leaderDiff}</div>
              </div>

              <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(0,229,255,0.18)", background: "rgba(0,229,255,0.06)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/55">Leader</div>
                <div className="mt-1 text-[22px] font-black" style={{ color: "rgba(0,229,255,0.95)" }}>
                  {leaderStreak}
                </div>
                <div className="mt-1 text-[11px] text-white/55">Overall top</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/55">Picks</div>
                <div className="mt-1 text-[16px] font-black text-white">{picksMadeAll}</div>
              </div>
              <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/55">Accuracy</div>
                <div className="mt-1 text-[16px] font-black" style={{ color: COLORS.good }}>
                  {accuracyPct}%
                </div>
              </div>
              <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/55">Next lock</div>
                <div className="mt-1 text-[13px] font-black" style={{ color: "rgba(0,229,255,0.92)" }}>
                  {topLockText}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    showLockToast("Log in to play", "Create a free account to save picks + appear on ladders.");
                    return;
                  }
                  if (!activeGame) return;
                  if (picksMadeActive <= 0) {
                    showLockToast("Pick something", "Tap YES/NO on any question.");
                    return;
                  }
                  showLockToast("Locked in ✅", "Your picks are saved instantly.");
                }}
                className="flex-1 rounded-xl border px-4 py-3 text-[13px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(206,32,41,0.55)",
                  background: `linear-gradient(180deg, rgba(206,32,41,0.95), rgba(139,15,22,0.85))`,
                  color: "rgba(255,255,255,0.98)",
                  boxShadow: "0 16px 40px rgba(206,32,41,0.18)",
                  opacity: activeGameLocked ? 0.55 : 1,
                }}
                disabled={activeGameLocked}
                title={activeGameLocked ? "Game locked" : "Lock in picks"}
              >
                {lockButtonLabel}
              </button>

              <button
                type="button"
                onClick={() => clearAllActive()}
                className="rounded-xl border px-4 py-3 text-[13px] font-black transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.85)",
                  opacity: activeGameLocked ? 0.55 : 1,
                }}
                disabled={activeGameLocked || picksMadeActive <= 0}
                title="Clear all picks for this match"
              >
                Clear
              </button>
            </div>

            <div className="mt-2 text-[11px] text-white/55">
              Reminder: <span className="font-black text-white/80">1 miss</span> resets your entire streak to{" "}
              <span className="font-black" style={{ color: COLORS.red }}>
                0
              </span>
              .
            </div>
          </div>
        </div>

        <StrategyLadder base={myCurrentStreak || 0} gain={potentialGain} />

        {/* Eligibility (compact) */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] uppercase tracking-widest text-white/55">Round eligibility</div>
            <div className="mt-1 text-[13px] text-white/80">
              Need <span className="font-black" style={{ color: COLORS.red }}>{ELIGIBILITY.MIN_STREAK}+</span> streak and{" "}
              <span className="font-black" style={{ color: COLORS.red }}>{ELIGIBILITY.MIN_GAMES}</span> locked games.
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-black text-white/85">Streak target</div>
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: eligibility.streakOk ? "rgba(25,195,125,0.45)" : "rgba(255,255,255,0.12)",
                  background: eligibility.streakOk ? "rgba(25,195,125,0.10)" : "rgba(255,255,255,0.04)",
                  color: eligibility.streakOk ? "rgba(25,195,125,0.95)" : "rgba(255,255,255,0.80)",
                }}
              >
                {eligibility.streakOk ? "✅ Met" : `Need ${eligibility.streakNeed}`}
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full"
                style={{
                  width: `${eligibility.streakProg}%`,
                  background: `linear-gradient(90deg, rgba(206,32,41,0.25), rgba(206,32,41,0.95))`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-black text-white/85">Games played</div>
              <div
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: eligibility.gamesOk ? "rgba(25,195,125,0.45)" : "rgba(255,255,255,0.12)",
                  background: eligibility.gamesOk ? "rgba(25,195,125,0.10)" : "rgba(255,255,255,0.04)",
                  color: eligibility.gamesOk ? "rgba(25,195,125,0.95)" : "rgba(255,255,255,0.80)",
                }}
              >
                {eligibility.gamesOk ? "✅ Met" : `Need ${eligibility.gamesNeed}`}
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full"
                style={{
                  width: `${eligibility.gamesProg}%`,
                  background: `linear-gradient(90deg, rgba(206,32,41,0.25), rgba(206,32,41,0.95))`,
                }}
              />
            </div>

            <div className="text-[11px] text-white/55">
              Status:{" "}
              <span className="font-black" style={{ color: eligibility.eligibleNow ? COLORS.good : "rgba(255,255,255,0.85)" }}>
                {eligibility.eligibleNow ? "Eligible (so far)" : "Not eligible yet"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {confettiOn && <Confetti recycle={false} numberOfPieces={220} gravity={0.22} />}

      <style>{`
        @keyframes torpyGlow {
          0% { box-shadow: 0 0 0 rgba(206,32,41,0.0); }
          50% { box-shadow: 0 0 34px rgba(206,32,41,0.22); }
          100% { box-shadow: 0 0 0 rgba(206,32,41,0.0); }
        }
      `}</style>

      {/* Sticky header (The Sweat) */}
      <StickyHeader />

      {/* Toast */}
      {lockToast ? (
        <div className="fixed inset-x-0 top-[78px] z-[90] px-4 sm:px-6">
          <div className="w-full max-w-6xl mx-auto">
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: "rgba(206,32,41,0.25)",
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
              }}
            >
              <div className="text-[13px] font-black text-white">{lockToast.title}</div>
              <div className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.70)" }}>
                {lockToast.body}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Comments Modal */}
      <CommentsModal />

      {/* Page content */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24 sm:pb-10">
        {/* Top line / title */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black">{pageTitle}</h1>
              {roundLabel ? (
                <span
                  className="mt-0.5 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(206,32,41,0.35)",
                    background: "rgba(206,32,41,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-[13px]" style={{ color: COLORS.textDim }}>
              Pick <span className="font-black text-white">0, 1, 5 or all</span> — your call. Use ✕ to clear.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.88)",
              }}
            >
              How to play
            </Link>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.bad }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Main split layout */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Left: The picks grid */}
          <div>
            {/* “match header card” */}
            <div
              className="rounded-3xl border overflow-hidden"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: `linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.35) 100%)`,
                boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
              }}
            >
              <div className="relative h-[150px] sm:h-[190px]">
                <Image
                  src="/afl1.png"
                  alt="Torpie picks"
                  fill
                  priority
                  className="object-cover opacity-80"
                  sizes="(max-width: 768px) 100vw, 70vw"
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-white/55">Current match</div>
                      <div className="mt-1 text-[18px] sm:text-[22px] font-black text-white truncate">
                        {activeGame?.match ?? "Loading…"}
                      </div>
                      <div className="mt-1 text-[12px] text-white/70 truncate">
                        {activeGame ? `${picksMadeActive} picked • ${activeGameLocked ? "Locked" : `Locks in ${msToCountdown(activeGameLockMs)}`}` : "—"}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end">
                      <div className="text-[11px] uppercase tracking-widest text-white/55">Potential</div>
                      <div className="mt-1 text-[24px] font-black" style={{ color: COLORS.white }}>
                        {potentialStreak}
                      </div>
                      <div className="text-[11px] text-white/70">+{potentialGain} if all correct</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                    <span className="inline-flex items-center rounded-full px-3 py-1 border" style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" }}>
                      {activeGame?.venue ?? "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full px-3 py-1 border" style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" }}>
                      {activeGame?.startTime ? formatAedt(activeGame.startTime) : "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full px-3 py-1 border" style={{ borderColor: "rgba(206,32,41,0.25)", background: "rgba(206,32,41,0.10)" }}>
                      Reminder: 1 miss = streak to <span className="ml-1 font-black" style={{ color: COLORS.red }}>0</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* quick actions row */}
              <div className="p-4 sm:p-5 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] font-black text-white/85">
                      {picksMadeActive}/{totalPickableActive} selected
                    </div>
                    <div className="text-[12px] text-white/55">•</div>
                    <div className="text-[12px] font-black" style={{ color: COLORS.red }}>
                      +{potentialGain} streak if all correct
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => clearAllActive()}
                      className="rounded-xl border px-4 py-2 text-[12px] font-black transition active:scale-[0.99]"
                      style={{
                        borderColor: "rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.85)",
                        opacity: activeGameLocked ? 0.55 : 1,
                      }}
                      disabled={activeGameLocked || picksMadeActive <= 0}
                    >
                      Clear all
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          showLockToast("Log in to play", "Create a free account to save picks + appear on ladders.");
                          return;
                        }
                        if (!activeGame) return;
                        if (picksMadeActive <= 0) {
                          showLockToast("Pick something", "Tap YES/NO on any question.");
                          return;
                        }
                        showLockToast("Locked in ✅", "Your picks are saved instantly.");
                      }}
                      className="rounded-xl border px-5 py-2 text-[12px] font-black transition active:scale-[0.99]"
                      style={{
                        borderColor: "rgba(206,32,41,0.55)",
                        background: `linear-gradient(180deg, rgba(206,32,41,0.95), rgba(139,15,22,0.85))`,
                        color: "rgba(255,255,255,0.98)",
                        boxShadow: "0 16px 40px rgba(206,32,41,0.16)",
                        opacity: activeGameLocked ? 0.55 : 1,
                        animation: picksMadeActive > 0 && !activeGameLocked ? "torpyGlow 1.6s ease-in-out infinite" : "none",
                      }}
                      disabled={activeGameLocked}
                    >
                      {lockButtonLabel}
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-[11px]" style={{ color: COLORS.textFaint }}>
                  Picks save instantly as you tap. “Lock in” is just a confidence button 😈
                </div>
              </div>
            </div>

            {/* Questions grid */}
            <div className="mt-4">
              {loading ? (
                <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                  <div className="h-4 w-48 rounded bg-white/10" />
                  <div className="mt-3 h-3 w-80 rounded bg-white/10" />
                  <div className="mt-5 h-24 rounded bg-white/5" />
                </div>
              ) : !activeGame ? (
                <div className="rounded-2xl border p-4 text-sm text-white/70" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
                  No games found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeQuestions.map((q) => (
                    <PickCard key={q.id} g={activeGame} q={q} gameLocked={activeGameLocked} />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 text-[11px] text-white/45">
              <span className="font-black" style={{ color: COLORS.red }}>
                TORPIE
              </span>{" "}
              — Back yourself. One slip and it’s back to zero.
            </div>
          </div>

          {/* Right: Strategy sidebar (desktop/tablet large) */}
          <div className="hidden lg:block">
            <StrategySidebar />
          </div>
        </div>
      </div>

      {/* Mobile lock bar */}
      <LockInBarMobile />

      {/* Footer spacing on desktop */}
      <div className="hidden sm:block h-6" />
    </div>
  );
}
