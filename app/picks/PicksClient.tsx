// /app/picks/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none"; // ✅ sentinel for “cleared” so UI won’t fall back to API pick

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
  body: string; // ✅ matches Firestore screenshot (field is "body")
  createdAt?: any;
};

/**
 * ✅ This version:
 * - Layout rebuilt: chalkboard-inspired card hierarchy + grid (3/2/1)
 * - Option A header: two team badges + subtle split glow
 * - Preserves ALL logic (picks, comments, streak, etc.)
 * - No rules/settlement/schema changes
 */
const COLORS = {
  bg: "#0D1117",
  panel: "#0F1623",
  panel2: "#0A0F18",

  orange: "#F4B247",

  yesFill: "#19C37D",
  noFill: "#FF2E4D",

  selectedBlue: "#2F7CFF",
  selectedBlueDeep: "#1D4ED8",

  cyan: "#00E5FF",
  white: "#FFFFFF",
};

const TEAM_COLORS: Record<string, { a: string; b: string }> = {
  adelaide: { a: "rgba(0, 74, 128, 0.95)", b: "rgba(232, 36, 45, 0.90)" },
  brisbane: { a: "rgba(103, 16, 35, 0.95)", b: "rgba(0, 74, 152, 0.85)" },
  carlton: { a: "rgba(10, 30, 60, 0.98)", b: "rgba(10, 30, 60, 0.55)" },
  collingwood: { a: "rgba(15, 15, 18, 0.96)", b: "rgba(240, 240, 240, 0.70)" },
  essendon: { a: "rgba(170, 0, 0, 0.95)", b: "rgba(20, 20, 20, 0.85)" },
  fremantle: { a: "rgba(56, 0, 76, 0.95)", b: "rgba(255, 255, 255, 0.55)" },
  geelong: { a: "rgba(5, 36, 55, 0.95)", b: "rgba(255, 255, 255, 0.65)" },
  goldcoast: { a: "rgba(203, 0, 31, 0.95)", b: "rgba(255, 197, 0, 0.85)" },
  gws: { a: "rgba(244, 113, 33, 0.95)", b: "rgba(30, 30, 30, 0.75)" },
  hawthorn: { a: "rgba(64, 40, 20, 0.95)", b: "rgba(255, 197, 0, 0.85)" },
  melbourne: { a: "rgba(2, 36, 64, 0.95)", b: "rgba(186, 0, 0, 0.88)" },
  northmelbourne: { a: "rgba(0, 92, 172, 0.95)", b: "rgba(255, 255, 255, 0.65)" },
  portadelaide: { a: "rgba(0, 0, 0, 0.92)", b: "rgba(0, 168, 165, 0.80)" },
  richmond: { a: "rgba(20, 20, 20, 0.95)", b: "rgba(255, 205, 0, 0.90)" },
  stkilda: { a: "rgba(20, 20, 20, 0.92)", b: "rgba(186, 0, 0, 0.88)" },
  sydney: { a: "rgba(186, 0, 0, 0.95)", b: "rgba(255, 255, 255, 0.65)" },
  westcoast: { a: "rgba(0, 60, 160, 0.95)", b: "rgba(255, 197, 0, 0.85)" },
  westernbulldogs: { a: "rgba(0, 60, 160, 0.95)", b: "rgba(186, 0, 0, 0.88)" },
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
  return { label: "Majority is NO", color: "rgba(255,46,77,0.95)" };
}

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `streakr:picks:v5:${uid || "anon"}:${roundNumber ?? "na"}`;
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

function teamSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "");
}

function prettyTeamName(raw: string): string {
  const t = raw.trim();
  if (!t) return "Team";
  return t;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "T";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function parseMatchTeams(match: string): { home: string; away: string } {
  const m = String(match || "").trim();

  // supports: "Carlton vs Brisbane", "Carlton v Brisbane", "Carlton V Brisbane", "Carlton VS Brisbane"
  const split = m.split(/\s+v(?:s)?\s+/i);
  if (split.length >= 2) {
    return { home: split[0].trim(), away: split.slice(1).join(" v ").trim() };
  }

  // fallback: "Carlton - Brisbane"
  const dash = m.split(/\s*-\s*/);
  if (dash.length >= 2) {
    return { home: dash[0].trim(), away: dash.slice(1).join(" - ").trim() };
  }

  // fallback: unknown
  return { home: m || "Home", away: "Away" };
}

type LocalPickMap = Record<string, LocalPick>;
type SelectPulseMap = Record<string, number>;

export default function PicksPage() {
  const { user } = useAuth();

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

  // Haptic pop trigger per question
  const [selectPulse, setSelectPulse] = useState<SelectPulseMap>({});
  const pulseTimerRef = useRef<Record<string, any>>({});

  // ✅ Comments modal state
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

  useEffect(() => {
    const s = myCurrentStreak || 0;
    const milestone = Math.floor(s / 5) * 5;

    if (milestone >= 5 && milestone !== lastMilestoneRef.current) {
      lastMilestoneRef.current = milestone;
      setConfettiOn(true);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setConfettiOn(false), 1400);
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

  const triggerSelectPop = useCallback((questionId: string) => {
    setSelectPulse((prev) => ({ ...prev, [questionId]: (prev[questionId] ?? 0) + 1 }));
    if (pulseTimerRef.current[questionId]) clearTimeout(pulseTimerRef.current[questionId]);
    pulseTimerRef.current[questionId] = setTimeout(() => {
      setSelectPulse((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }, 260);
  }, []);

  // ✅ Robust clear: UI clears instantly + persists server-side
  const clearPick = useCallback(
    async (q: ApiQuestion) => {
      setLocalPicks((prev) => ({ ...prev, [q.id]: "none" }));
      triggerSelectPop(q.id);

      if (!user) return;

      try {
        const token = await user.getIdToken();

        // 1) Try DELETE
        const delRes = await fetch(`/api/user-picks?questionId=${encodeURIComponent(q.id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (delRes.ok) return;

        // 2) Fallback: POST clear
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
    [user, triggerSelectPop]
  );

  const togglePick = useCallback(
    async (q: ApiQuestion, outcome: PickOutcome) => {
      const current = effectivePick(localPicks[q.id], q.userPick);

      if (current === outcome) {
        await clearPick(q);
        return;
      }

      setLocalPicks((prev) => ({ ...prev, [q.id]: outcome }));
      triggerSelectPop(q.id);

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
    [user, roundNumber, localPicks, clearPick, triggerSelectPop]
  );

  const shareStreak = useCallback(async () => {
    const txt = `STREAKr — I’m on a streak of ${myCurrentStreak}. How long can you last?`;
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

  const topLockText = nextLockMs > 0 ? msToCountdown(nextLockMs) : "—";

  // ✅ Compact cards
  const PICK_CARD_PAD_X = "px-3";
  const PICK_CARD_PAD_Y = "py-3";
  const PICK_BUTTON_PAD_Y = "py-2.5";
  const SENTIMENT_BAR_H = "h-[6px]";

  // ✅ Comments: open modal + subscribe to Firestore
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

  // ESC closes modal
  useEffect(() => {
    if (!commentsOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComments();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentsOpen, closeComments]);

  // Subscribe to comments
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

    // ✅ NO orderBy -> no composite index required
    const qRef = query(
      collection(db, "comments"),
      where("questionId", "==", commentsQuestion.id),
      limit(50)
    );

    commentsUnsubRef.current = onSnapshot(
      qRef,
      (snap) => {
        const rows: CommentRow[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            const body =
              typeof data?.body === "string" ? data.body : typeof data?.text === "string" ? data.text : "";

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
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide border";

   if (q.status === "open") {
  return (
    <span
      className={base}
      style={{
        borderColor: "rgba(0,229,255,0.28)",
        background: "rgba(0,229,255,0.08)",
        color: "rgba(0,229,255,0.92)",
      }}
    >
      <span
        className="relative inline-flex h-1.5 w-1.5 rounded-full"
        style={{ background: "rgba(0,229,255,0.95)" }}
      />
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
          borderColor: isCorrect ? "rgba(25,195,125,0.45)" : "rgba(255,46,77,0.45)",
          background: isCorrect ? "rgba(25,195,125,0.10)" : "rgba(255,46,77,0.10)",
          color: isCorrect ? "rgba(25,195,125,0.95)" : "rgba(255,46,77,0.95)",
        }}
      >
        {isCorrect ? "Correct" : "Wrong"}
      </span>
    );
  };

  const renderSentiment = (q: ApiQuestion) => {
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
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span className="uppercase tracking-wide">Crowd</span>
          <span style={{ color: majority.color }} className="font-semibold">
            {majority.label}
          </span>
        </div>

        <div
          className={`mt-1 ${SENTIMENT_BAR_H} rounded-full overflow-hidden border`}
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
                background: `linear-gradient(90deg, rgba(25,195,125,0.85), rgba(25,195,125,0.18))`,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${noW}%`,
                background: `linear-gradient(90deg, rgba(255,46,77,0.18), rgba(255,46,77,0.85))`,
              }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px] text-white/55">
          <span>
            YES <span className="font-semibold text-white/80">{Math.round(yes)}%</span>
          </span>

          {aligned === null ? (
            <span className="text-white/45">Pick to see if you’re with the crowd</span>
          ) : aligned ? (
            <span style={{ color: "rgba(25,195,125,0.95)" }} className="font-semibold">
              With majority
            </span>
          ) : (
            <span style={{ color: COLORS.orange }} className="font-semibold">
              Against majority
            </span>
          )}

          <span>
            NO <span className="font-semibold text-white/80">{Math.round(no)}%</span>
          </span>
        </div>
      </div>
    );
  };

  const renderPickButtons = (q: ApiQuestion, isLocked: boolean) => {
    const pick = effectivePick(localPicks[q.id], q.userPick);
    const isYesSelected = pick === "yes";
    const isNoSelected = pick === "no";

    const baseBtn =
      "flex-1 rounded-xl font-extrabold tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed";

    const pressClasses = "active:scale-[0.985]";

    const makeBtnStyle = (variant: "yes" | "no") => {
      const selected = variant === "yes" ? isYesSelected : isNoSelected;

      if (selected) {
        return {
          borderColor: "rgba(47,124,255,0.85)",
          background: `linear-gradient(180deg, rgba(47,124,255,0.92), rgba(29,78,216,0.88))`,
          color: "rgba(255,255,255,0.98)",
          boxShadow: "0 0 22px rgba(47,124,255,0.26), inset 0 0 0 1px rgba(255,255,255,0.10)",
        } as const;
      }

      if (variant === "yes") {
        return {
          borderColor: "rgba(25,195,125,0.75)",
          background: `linear-gradient(180deg, rgba(25,195,125,0.95), rgba(16,140,92,0.92))`,
          color: "rgba(255,255,255,0.98)",
          boxShadow: "0 0 18px rgba(25,195,125,0.14)",
        } as const;
      }

      return {
        borderColor: "rgba(255,46,77,0.78)",
        background: `linear-gradient(180deg, rgba(255,46,77,0.95), rgba(190,22,50,0.92))`,
        color: "rgba(255,255,255,0.98)",
        boxShadow: "0 0 18px rgba(255,46,77,0.14)",
      } as const;
    };

    const yesLabel = isYesSelected ? "YES" : "YES";
    const noLabel = isNoSelected ? "NO" : "NO";

    const pulseKey = selectPulse[q.id] ?? 0;
    const pulseClass = pulseKey ? "streakr-select-pop" : "";

    return (
      <div className="mt-3 flex gap-2">
        <button
          key={`yes-${q.id}-${pulseKey}`}
          type="button"
          disabled={isLocked || q.status === "void"}
          onClick={() => togglePick(q, "yes")}
          className={`${baseBtn} ${pressClasses} ${pulseClass} px-4 ${PICK_BUTTON_PAD_Y} text-[12px] border`}
          style={makeBtnStyle("yes")}
          aria-pressed={isYesSelected}
          title={isYesSelected ? "Click again to unselect" : "Pick YES"}
        >
          {yesLabel}
        </button>

        <button
          key={`no-${q.id}-${pulseKey}`}
          type="button"
          disabled={isLocked || q.status === "void"}
          onClick={() => togglePick(q, "no")}
          className={`${baseBtn} ${pressClasses} ${pulseClass} px-4 ${PICK_BUTTON_PAD_Y} text-[12px] border`}
          style={makeBtnStyle("no")}
          aria-pressed={isNoSelected}
          title={isNoSelected ? "Click again to unselect" : "Pick NO"}
        >
          {noLabel}
        </button>
      </div>
    );
  };

  const TeamBadge = ({ name, side }: { name: string; side: "home" | "away" }) => {
    const label = prettyTeamName(name);
    const slug = teamSlug(label);
    const logoSrc = `/teams/${slug}.png`;

    // We use <img> so missing assets won’t crash like next/image can in prod.
    return (
      <div className={`flex items-center gap-2 min-w-0 ${side === "away" ? "justify-end" : ""}`}>
        {side === "home" ? (
          <>
            <div className="relative h-6 w-6 shrink-0">
              <img
                src={logoSrc}
                alt={label}
                className="h-6 w-6 rounded-md object-contain"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                onError={(e) => {
                  // fallback to initials chip
                  const el = e.currentTarget;
                  el.style.display = "none";
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center rounded-md text-[10px] font-black text-white/85"
                style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
              >
                {initials(label)}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-white/75 truncate">{label}</span>
          </>
        ) : (
          <>
            <span className="text-[11px] font-semibold text-white/75 truncate">{label}</span>
            <div className="relative h-6 w-6 shrink-0">
              <img
                src={logoSrc}
                alt={label}
                className="h-6 w-6 rounded-md object-contain"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center rounded-md text-[10px] font-black text-white/85"
                style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
              >
                {initials(label)}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const PickCard = ({ g, q, isGameLocked }: { g: ApiGame; q: ApiQuestion; isGameLocked: boolean }) => {
    const finalWrong = q.status === "final" && q.correctPick === false;
    const finalCorrect = q.status === "final" && q.correctPick === true;

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const hasPick = pick === "yes" || pick === "no";

    const sponsor = q.isSponsorQuestion === true;

    const { home, away } = parseMatchTeams(g.match);
    const homeSlug = teamSlug(home);
    const awaySlug = teamSlug(away);
    const homeColors = TEAM_COLORS[homeSlug] ?? { a: "rgba(20, 35, 60, 0.95)", b: "rgba(20, 35, 60, 0.55)" };
    const awayColors = TEAM_COLORS[awaySlug] ?? { a: "rgba(90, 10, 25, 0.90)", b: "rgba(90, 10, 25, 0.55)" };

    const isLocked = isGameLocked || q.status === "pending";

    // Card chrome
    const border = sponsor
      ? "rgba(244,178,71,0.95)"
      : finalWrong
      ? "rgba(255,46,77,0.55)"
      : finalCorrect
      ? "rgba(25,195,125,0.50)"
      : "rgba(255,255,255,0.10)";

    const glow = sponsor
      ? "0 0 28px rgba(244,178,71,0.18), inset 0 0 0 1px rgba(244,178,71,0.20)"
      : finalWrong
      ? "0 0 24px rgba(255,46,77,0.10)"
      : finalCorrect
      ? "0 0 24px rgba(25,195,125,0.08)"
      : "0 0 0 rgba(0,0,0,0)";

    // Jersey hero area background (split glow)
    const heroBg = `linear-gradient(135deg,
      ${homeColors.a} 0%,
      rgba(255,255,255,0.02) 46%,
      rgba(255,255,255,0.02) 54%,
      ${awayColors.a} 100%)`;

    const heroInner = `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`;

    return (
      <div
        className="group rounded-2xl border overflow-hidden transition"
        style={{
          borderColor: border,
          background: `linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(13,17,23,0.78) 100%)`,
          boxShadow: glow,
        }}
      >
        {/* Match header strip (Option A) */}
        <div
          className="px-3 py-2 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <TeamBadge name={home} side="home" />
            <span className="text-[10px] font-black text-white/35 uppercase tracking-widest shrink-0">vs</span>
            <TeamBadge name={away} side="away" />
          </div>
        </div>

        {/* Hero jersey zone */}
        <div className={`${PICK_CARD_PAD_X} pt-3`}>
          <div
            className="rounded-2xl border overflow-hidden relative"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: heroBg,
              boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(600px 240px at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.00) 60%)",
                opacity: 0.9,
              }}
            />
            <div className="relative px-4 py-4">
              <div
                className="mx-auto h-[88px] w-[88px] rounded-[22px] border flex items-center justify-center"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: heroInner,
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
                }}
                aria-hidden="true"
              >
                {/* Abstract jersey silhouette */}
                <div className="relative h-[66px] w-[66px]">
                  <div
                    className="absolute inset-0 rounded-[18px]"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
                      clipPath:
                        "polygon(18% 8%, 35% 0%, 65% 0%, 82% 8%, 95% 20%, 88% 35%, 78% 28%, 78% 100%, 22% 100%, 22% 28%, 12% 35%, 5% 20%)",
                    }}
                  />
                  <div
                    className="absolute left-1/2 top-[14px] -translate-x-1/2 h-[2px] w-[24px] rounded-full"
                    style={{ background: "rgba(255,255,255,0.22)" }}
                  />
                </div>
              </div>

              {/* Top row: status + meta + actions */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {renderStatusPill(q)}
                  <span className="text-[10px] font-black text-white/55 uppercase tracking-wide">
                    Q{q.quarter}
                  </span>
                  {sponsor ? (
                    <span
                      className="text-[10px] font-black rounded-full px-2 py-0.5 border"
                      style={{
                        borderColor: "rgba(244,178,71,0.85)",
                        background: "rgba(244,178,71,0.22)",
                        color: "rgba(13,17,23,0.95)",
                        boxShadow: "0 0 14px rgba(244,178,71,0.22)",
                      }}
                    >
                      SPONSORED
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Clear X */}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border h-8 w-8 text-[13px] font-black transition active:scale-[0.99]"
                    style={{
                      borderColor: hasPick ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                      background: hasPick ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                      color: hasPick ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearPick(q);
                    }}
                    disabled={!hasPick || isLocked || q.status === "void"}
                    title={hasPick ? "Clear selection" : "No selection to clear"}
                    aria-label="Clear selection"
                  >
                    ✕
                  </button>

                  {/* Comments */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border h-8 px-3 text-[12px] font-black transition active:scale-[0.99]"
                    style={{
                      borderColor:
                        q.commentCount && q.commentCount >= 100
                          ? "rgba(244,178,71,0.45)"
                          : "rgba(0,229,255,0.26)",
                      background:
                        q.commentCount && q.commentCount >= 100
                          ? "rgba(244,178,71,0.12)"
                          : "rgba(0,229,255,0.06)",
                      color: "rgba(255,255,255,0.92)",
                      boxShadow:
                        q.commentCount && q.commentCount >= 100
                          ? "0 0 18px rgba(244,178,71,0.12)"
                          : "0 0 18px rgba(0,229,255,0.08)",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openComments(g, q);
                    }}
                    title="Open comments"
                  >
                    💬 {q.commentCount ?? 0}
                    {q.commentCount && q.commentCount >= 100 ? <span>🔥</span> : null}
                  </button>
                </div>
              </div>

              {/* Player + Question (clean hierarchy) */}
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-widest text-white/45">Player</div>
                <div className="mt-1 text-[14px] font-black text-white/92 truncate">
                  {/* Placeholder until you wire player names into API */}
                  {/* Keeping layout-only — no schema changes */}
                  {(() => {
                    // If you later embed player in question string, this at least doesn’t crash now.
                    // For now we show a strong generic label so the card still feels "player-first".
                    return "AFL Player";
                  })()}
                </div>

                <div className="mt-2 text-[13px] font-semibold leading-snug text-white/88">
                  {q.question}
                </div>

                {/* Crowd stays (still useful), but visually calmer now */}
                {renderSentiment(q)}

                {/* Buttons */}
                {renderPickButtons(q, isLocked)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom pad */}
        <div className={`${PICK_CARD_PAD_X} ${PICK_CARD_PAD_Y}`} />
      </div>
    );
  };

  const pageTitle = `Picks`;
  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <style>{`
        .streakr-select-pop{
          animation: streakrPop 220ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
          will-change: transform;
        }
        @keyframes streakrPop{
          0% { transform: scale(1); }
          55% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
      `}</style>

      {confettiOn && <Confetti recycle={false} numberOfPieces={220} gravity={0.22} />}

      {/* ✅ Comments Modal */}
      {commentsOpen && commentsQuestion ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeComments();
          }}
          style={{
            background: "rgba(0,0,0,0.62)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border overflow-hidden"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 24px 80px rgba(0,0,0,0.72)",
            }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
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
                  style={{ borderColor: "rgba(244,178,71,0.35)", background: "rgba(244,178,71,0.10)" }}
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
                <div className="mt-2 text-[12px]" style={{ color: COLORS.noFill }}>
                  {commentErr}
                </div>
              ) : null}

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-white/55">
                  <div className="uppercase tracking-widest">
                    Latest {commentsList.length ? `(${commentsList.length})` : ""}
                  </div>
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
                            <div className="text-[11px] text-white/45 shrink-0">
                              {formatCommentTime(c.createdAt)}
                            </div>
                          </div>
                          <div className="mt-1 text-[13px] text-white/85 whitespace-pre-wrap break-words">
                            {c.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-[11px] text-white/45">
                  Keep it civil. Banter is good — abuse gets binned.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black">{pageTitle}</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold border"
                  style={{
                    borderColor: "rgba(0,229,255,0.28)",
                    background: "rgba(0,229,255,0.08)",
                    color: "rgba(0,229,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-white/65">
              Pick any questions you want. Change your mind anytime — click again to unselect, or hit the ✕.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              How to play STREAKr
            </Link>
          </div>
        </div>

        {/* Persistent Streak Widget */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-white/55">Your streak</p>
                <p className="text-4xl font-black mt-1" style={{ color: COLORS.orange }}>
                  {myCurrentStreak}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[11px] uppercase tracking-widest text-white/55">Leader</p>
                <p className="text-3xl font-black mt-1" style={{ color: COLORS.cyan }}>
                  {leaderStreak}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${myVsLeaderPct.mine}%`,
                    background: `linear-gradient(90deg, ${COLORS.orange}, rgba(244,178,71,0.22))`,
                  }}
                />
              </div>

              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${myVsLeaderPct.lead}%`,
                    background: `linear-gradient(90deg, ${COLORS.cyan}, rgba(0,229,255,0.22))`,
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={shareStreak}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                Share my streak
              </button>

              <div className="text-right text-[11px] text-white/55">
                <div>Current</div>
                <div className="font-bold text-white/80">
                  {myCurrentStreak > leaderStreak
                    ? "You’re leading"
                    : myCurrentStreak === leaderStreak
                    ? "Tied"
                    : `Need ${leaderStreak - myCurrentStreak} to catch`}
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <p className="text-[11px] uppercase tracking-widest text-white/55">Dashboard</p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Picks</p>
                <p className="text-xl font-black mt-1 text-white">
                  {picksMade}/{totalPickable}
                </p>
              </div>

              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Accuracy</p>
                <p className="text-xl font-black mt-1" style={{ color: "rgba(25,195,125,0.95)" }}>
                  {accuracyPct}%
                </p>
              </div>

              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Next lock</p>
                <p className="text-[13px] font-black mt-2" style={{ color: COLORS.cyan }}>
                  {topLockText}
                </p>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-white/55">
              {user ? "Pick what you like — no pressure to do them all." : "Log in to save picks + appear on leaderboards."}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <p className="text-[11px] uppercase tracking-widest text-white/55">Quick</p>

            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/leaderboards"
                className="rounded-xl border px-4 py-3 text-[12px] font-black transition hover:translate-y-[-1px] active:scale-[0.99]"
                style={{
                  borderColor: "rgba(0,229,255,0.24)",
                  background: "rgba(0,229,255,0.07)",
                  color: "rgba(0,229,255,0.95)",
                }}
              >
                View Leaderboards →
              </Link>

              <Link
                href="/how-to-play"
                className="rounded-xl border px-4 py-3 text-[12px] font-black transition hover:translate-y-[-1px] active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                How it works →
              </Link>

              <div
                className="rounded-xl border px-4 py-3 text-[11px] text-white/65"
                style={{
                  borderColor: "rgba(244,178,71,0.40)",
                  background: "rgba(244,178,71,0.10)",
                }}
              >
                <span className="font-bold" style={{ color: COLORS.orange }}>
                  Tip:
                </span>{" "}
                Click the same pick again to unselect, or hit the ✕ clear button.
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.noFill }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Games */}
        <div className="mt-6 flex flex-col gap-5">
          {loading ? (
            <div
              className="rounded-2xl border p-4 animate-pulse"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            >
              <div className="h-4 w-44 rounded bg-white/10" />
              <div className="mt-3 h-3 w-80 rounded bg-white/10" />
              <div className="mt-5 h-24 rounded bg-white/5" />
            </div>
          ) : games.length === 0 ? (
            <div
              className="rounded-2xl border p-4 text-sm text-white/70"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            >
              No games found.
            </div>
          ) : (
            games.map((g) => {
              const lockMs = new Date(g.startTime).getTime() - nowMs;
              const isLocked = lockMs <= 0;

              const gamePicked = g.questions.reduce((acc, q) => {
                const p = effectivePick(localPicks[q.id], q.userPick);
                return acc + (p === "yes" || p === "no" ? 1 : 0);
              }, 0);

              const gameTotal = g.questions.length;
              const progressPct = gameTotal > 0 ? (gamePicked / gameTotal) * 100 : 0;

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(244,178,71,0.55)",
                    background: `linear-gradient(180deg, rgba(244,178,71,0.14) 0%, rgba(13,17,23,0.92) 65%, rgba(13,17,23,0.88) 100%)`,
                    boxShadow: "0 0 40px rgba(244,178,71,0.10), inset 0 0 0 1px rgba(244,178,71,0.14)",
                  }}
                >
                  {/* Game header */}
                  <div
                    className="px-4 py-3"
                    style={{
                      background: `linear-gradient(180deg, rgba(244,178,71,0.22) 0%, rgba(244,178,71,0.10) 100%)`,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-extrabold truncate" style={{ color: COLORS.white }}>
                          {g.match}
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/85 truncate">
                          {g.venue} • {formatAedt(g.startTime)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                            style={{
                              borderColor: "rgba(255,255,255,0.18)",
                              background: "rgba(13,17,23,0.35)",
                              color: "rgba(255,255,255,0.92)",
                            }}
                          >
                            Picks: {gamePicked}/{gameTotal}
                          </span>

                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                            style={{
                              borderColor: "rgba(255,255,255,0.18)",
                              background: "rgba(13,17,23,0.30)",
                              color: "rgba(255,255,255,0.90)",
                            }}
                          >
                            {isLocked ? "Locked" : `Locks in ${msToCountdown(lockMs)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(13,17,23,0.35)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${progressPct}%`,
                            background: `linear-gradient(90deg, rgba(0,229,255,0.15), rgba(0,229,255,0.55))`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ✅ Questions grid: 3 cols desktop, 2 tablet, 1 mobile */}
                  <div className="p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {g.questions.map((q) => (
                        <PickCard key={q.id} g={g} q={q} isGameLocked={isLocked} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 pb-8 text-center text-[11px] text-white/45">
          <span className="font-bold" style={{ color: COLORS.orange }}>
            STREAKr
          </span>{" "}
          — Back yourself. One slip and it’s back to zero.
        </div>
      </div>
    </div>
  );
}
