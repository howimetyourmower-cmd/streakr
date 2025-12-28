// /app/picks/PicksClient.tsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  ChangeEvent,
} from "react";
import Link from "next/link";
import Confetti from "react-confetti";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { collection, onSnapshot, query, where, orderBy, limit, doc } from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;
  sport?: string;
  venue?: string;
  startTime?: string;
  correctOutcome?: "yes" | "no" | "void" | null;
  outcome?: "yes" | "no" | "void" | "lock" | null;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport?: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent: number;
  noPercent: number;
  sport: string;
  commentCount: number;
  isSponsorQuestion?: boolean;
  correctOutcome?: "yes" | "no" | "void" | null;
};

type Comment = {
  id: string;
  body: string;
  displayName?: string;
  createdAt?: string;
};

type PickHistory = Record<string, "yes" | "no">;

type GameLocksResponse = {
  roundNumber: number;
  locks: Record<string, boolean>;
};

const PICK_HISTORY_KEY = "streakr_pick_history_v3";
const HOW_TO_PLAY_KEY = "streakr_picks_seenHowTo_v2";

const COLORS = {
  bg: "#0D1117",
  panel: "#0B1220",
  panel2: "#070B12",
  border: "rgba(255,255,255,0.10)",
  orange: "#FF3D00",
  green: "#76FF03",
  red: "#FF073A",
  cyan: "#00E5FF",
  textDim: "rgba(255,255,255,0.72)",
  textDim2: "rgba(255,255,255,0.55)",
};

const normaliseOutcome = (val: any): "yes" | "no" | "void" | null => {
  if (val == null) return null;
  const s = String(val).trim().toLowerCase();
  if (["yes", "y", "correct", "win", "winner"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss", "loser"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(clamp(n, 0, 100))}%`;
}

function msToParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return { s, hrs, mins, secs };
}

function formatCountdown(ms: number): string {
  const { hrs, mins, secs } = msToParts(ms);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function safeDateMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatAedt(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      timeZone: "Australia/Melbourne",
    }),
    time: d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Australia/Melbourne",
    }),
  };
}

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [roundNumber, setRoundNumber] = useState<number | null>(null);

  const [pickHistory, setPickHistory] = useState<PickHistory>({});

  const [gameLocks, setGameLocks] = useState<Record<string, boolean>>({});

  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">("all");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);

  const [commentsOpenFor, setCommentsOpenFor] = useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [userCurrentStreak, setUserCurrentStreak] = useState<number | null>(null);
  const [leaderCurrentStreak, setLeaderCurrentStreak] = useState<number | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakError, setStreakError] = useState("");

  const [showConfetti, setShowConfetti] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>("");

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PICK_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setPickHistory(parsed);
    } catch (err) {
      console.error("Failed to load pick history", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(HOW_TO_PLAY_KEY);
      if (!seen) setShowHowToModal(true);
    } catch {}
  }, []);

  const closeHowTo = useCallback(() => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(HOW_TO_PLAY_KEY, "true");
    } catch {}
    setShowHowToModal(false);
  }, []);

  const isGameUnlocked = useCallback(
    (gameId: string) => {
      const v = gameLocks[gameId];
      return typeof v === "boolean" ? v : true;
    },
    [gameLocks]
  );

  const persistPickHistory = useCallback((next: PickHistory) => {
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(PICK_HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const flattenApi = useCallback((data: PicksApiResponse, history: PickHistory): QuestionRow[] => {
    return (data.games || []).flatMap((g) =>
      (g.questions || []).map((q) => {
        const histPick = history[q.id];
        const yesPercent = typeof q.yesPercent === "number" ? q.yesPercent : 0;
        const noPercent = typeof q.noPercent === "number" ? q.noPercent : 0;

        const rawOutcome = normaliseOutcome(q.correctOutcome) ?? normaliseOutcome(q.outcome);
        const correctOutcome: QuestionRow["correctOutcome"] =
          q.status === "final" || q.status === "void" ? rawOutcome : null;

        return {
          id: q.id,
          gameId: g.id,
          match: g.match,
          venue: q.venue ?? g.venue ?? "",
          startTime: q.startTime ?? g.startTime ?? "",
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          userPick: q.userPick ?? histPick,
          yesPercent,
          noPercent,
          sport: String(q.sport ?? g.sport ?? "AFL"),
          commentCount: typeof q.commentCount === "number" ? q.commentCount : 0,
          isSponsorQuestion: !!q.isSponsorQuestion,
          correctOutcome,
        };
      })
    );
  }, []);

  const fetchPicks = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data: PicksApiResponse = await res.json();
        if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);

        const flat = flattenApi(data, pickHistory);
        setRows(flat);
      } catch (err) {
        console.error(err);
        if (!silent) setError("Failed to load picks.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [flattenApi, pickHistory]
  );

  useEffect(() => {
    setLoading(true);
    fetchPicks()
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => fetchPicks({ silent: true }), 15000);
    return () => clearInterval(id);
  }, [fetchPicks]);

  useEffect(() => {
    if (roundNumber === null) return;
    const loadLocks = async () => {
      try {
        const res = await fetch(`/api/admin/game-lock?round=${roundNumber}`);
        if (!res.ok) return;
        const json: GameLocksResponse = await res.json();
        setGameLocks(json.locks || {});
      } catch (err) {
        console.error("Failed to load game locks", err);
      }
    };
    loadLocks();
  }, [roundNumber]);

  useEffect(() => {
    const loadServerPicks = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/user-picks", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;

        const json = await res.json();
        const next: PickHistory = {};

        if (Array.isArray(json?.picks)) {
          for (const p of json.picks) {
            const qid = p?.questionId;
            const raw = typeof p?.outcome === "string" ? p.outcome.toLowerCase() : "";
            if (!qid) continue;
            if (raw === "yes" || raw === "no") next[qid] = raw;
          }
        } else if (json?.questionId && json?.outcome) {
          const qid = String(json.questionId);
          const raw = String(json.outcome).toLowerCase();
          if (raw === "yes" || raw === "no") next[qid] = raw;
        }

        if (Object.keys(next).length) {
          setPickHistory((prev) => {
            const merged = { ...prev, ...next };
            persistPickHistory(merged);
            return merged;
          });
        }
      } catch (err) {
        console.error("Failed to load server picks", err);
      }
    };
    loadServerPicks();
  }, [user, persistPickHistory]);

  const questionIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const questionIdsKey = useMemo(() => questionIds.join("|"), [questionIds]);

  useEffect(() => {
    if (!questionIds.length) return;

    const chunk = (arr: string[], size: number) => {
      const out: string[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const chunks = chunk(questionIds, 10);

    let pendingTimer: any = null;
    const pendingCounts: Record<string, number> = {};

    const flush = () => {
      pendingTimer = null;
      const apply = { ...pendingCounts };
      for (const k of Object.keys(pendingCounts)) delete pendingCounts[k];

      setRows((prev) =>
        prev.map((r) => (apply[r.id] !== undefined ? { ...r, commentCount: apply[r.id] } : r))
      );
    };

    const unsubs = chunks.map((ids) => {
      const qRef = query(collection(db, "comments"), where("questionId", "in", ids));
      return onSnapshot(qRef, (snap) => {
        const counts: Record<string, number> = {};
        ids.forEach((id) => (counts[id] = 0));
        snap.forEach((d) => {
          const data = d.data() as any;
          const qid = data?.questionId;
          if (!qid) return;
          counts[qid] = (counts[qid] ?? 0) + 1;
        });

        for (const [qid, c] of Object.entries(counts)) pendingCounts[qid] = c;
        if (!pendingTimer) pendingTimer = setTimeout(flush, 250);
      });
    });

    return () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIdsKey]);

  useEffect(() => {
    setStreakLoading(true);
    setStreakError("");

    const topQ = query(collection(db, "users"), orderBy("currentStreak", "desc"), limit(1));
    const unsub = onSnapshot(
      topQ,
      (snap) => {
        let leader = 0;
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          leader = typeof d.currentStreak === "number" ? d.currentStreak : 0;
        });
        setLeaderCurrentStreak(leader);
        setStreakLoading(false);
      },
      () => {
        setStreakError("Could not load leader streak.");
        setStreakLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserCurrentStreak(null);
      return;
    }

    setStreakLoading(true);
    setStreakError("");

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : {};
        const cur = typeof d.currentStreak === "number" ? d.currentStreak : 0;
        setUserCurrentStreak(cur);
        setStreakLoading(false);
      },
      () => {
        setStreakError("Could not load your streak.");
        setStreakLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const lastMilestoneRef = useRef<number>(0);
  useEffect(() => {
    const s = userCurrentStreak ?? null;
    if (typeof s !== "number") return;

    const milestones = [3, 5, 10, 15, 20];
    const hit = milestones.find((m) => s === m);
    if (hit && lastMilestoneRef.current !== hit) {
      lastMilestoneRef.current = hit;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
    }
  }, [userCurrentStreak]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    return rows.filter((r) => r.status === activeFilter);
  }, [rows, activeFilter]);

  const games = useMemo(() => {
    const map = new Map<
      string,
      {
        gameId: string;
        match: string;
        venue: string;
        startTime: string;
        sport: string;
        rows: QuestionRow[];
      }
    >();

    for (const r of filteredRows) {
      const existing = map.get(r.gameId);
      if (!existing) {
        map.set(r.gameId, {
          gameId: r.gameId,
          match: r.match,
          venue: r.venue,
          startTime: r.startTime,
          sport: r.sport,
          rows: [r],
        });
      } else {
        existing.rows.push(r);
      }
    }

    const out = Array.from(map.values());
    out.sort((a, b) => {
      const ta = safeDateMs(a.startTime) ?? 0;
      const tb = safeDateMs(b.startTime) ?? 0;
      if (ta !== tb) return ta - tb;
      return a.gameId.localeCompare(b.gameId);
    });

    out.forEach((g) => g.rows.sort((a, b) => a.quarter - b.quarter));
    return out;
  }, [filteredRows]);

  const picksMade = useMemo(() => {
    let n = 0;
    for (const r of rows) {
      const p = pickHistory[r.id] ?? r.userPick;
      if (p === "yes" || p === "no") n++;
    }
    return n;
  }, [rows, pickHistory]);

  const totalQuestions = rows.length;

  const accuracy = useMemo(() => {
    let wins = 0;
    let losses = 0;

    for (const r of rows) {
      const pick = pickHistory[r.id] ?? r.userPick;
      if (pick !== "yes" && pick !== "no") continue;

      const out = normaliseOutcome(r.correctOutcome);
      if (r.status === "void" || out === "void") continue;

      if (r.status !== "final" || !out) continue;

      if (pick === out) wins++;
      else losses++;
    }

    const total = wins + losses;
    if (!total) return null;
    return (wins / total) * 100;
  }, [rows, pickHistory]);

  const perGameMeta = useMemo(() => {
    type Meta = {
      total: number;
      picked: number;
      locked: boolean;
      startMs: number | null;
      state: "pre" | "live" | "locked";
      countdownLabel: string;
      countdownMs: number | null;
    };

    const byGame: Record<string, Meta> = {};

    const groupAll: Record<string, QuestionRow[]> = {};
    for (const r of rows) {
      if (!groupAll[r.gameId]) groupAll[r.gameId] = [];
      groupAll[r.gameId].push(r);
    }

    for (const [gameId, gameRows] of Object.entries(groupAll)) {
      const total = gameRows.length;
      let picked = 0;

      for (const r of gameRows) {
        const pick = pickHistory[r.id] ?? r.userPick;
        if (pick === "yes" || pick === "no") picked++;
      }

      const locked = !isGameUnlocked(gameId);
      const startMs = safeDateMs(gameRows[0]?.startTime ?? "") ?? null;

      let state: Meta["state"] = "pre";
      let countdownLabel = "--";
      let countdownMs: number | null = null;

      if (locked) {
        state = "locked";
        countdownLabel = "LOCKED";
      } else if (startMs && nowMs < startMs) {
        state = "pre";
        countdownMs = startMs - nowMs;
        countdownLabel = formatCountdown(countdownMs);
      } else {
        state = "live";
        countdownLabel = "LIVE";
      }

      byGame[gameId] = { total, picked, locked, startMs, state, countdownLabel, countdownMs };
    }

    return byGame;
  }, [rows, pickHistory, isGameUnlocked, nowMs]);

  const nextLock = useMemo(() => {
    let best: number | null = null;
    const seen = new Set<string>();

    for (const r of rows) {
      if (seen.has(r.gameId)) continue;
      seen.add(r.gameId);

      const locked = !isGameUnlocked(r.gameId);
      if (locked) continue;

      const start = safeDateMs(r.startTime);
      if (!start) continue;
      if (start <= nowMs) continue;

      const delta = start - nowMs;
      if (best === null || delta < best) best = delta;
    }

    return best;
  }, [rows, isGameUnlocked, nowMs]);

  const hotCommentCount = useMemo(() => rows.filter((r) => (r.commentCount ?? 0) >= 100).length, [rows]);

  const handlePick = useCallback(
    async (row: QuestionRow, pick: "yes" | "no") => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      if (!isGameUnlocked(row.gameId)) return;
      if (row.status !== "open") return;

      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r)));

      setPickHistory((prev) => {
        const next = { ...prev, [row.id]: pick };
        persistPickHistory(next);
        return next;
      });

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/user-picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId: row.id,
            outcome: pick,
            roundNumber,
            sport: "AFL",
            gameId: row.gameId,
          }),
        });

        if (!res.ok) {
          console.error("Pick save failed:", await res.text());
        }
      } catch (err) {
        console.error("Pick save error:", err);
      }
    },
    [user, isGameUnlocked, persistPickHistory, roundNumber]
  );

  const handleClearPick = useCallback(
    async (row: QuestionRow) => {
      if (!isGameUnlocked(row.gameId)) return;
      if (row.status !== "open") return;

      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, userPick: undefined } : r)));

      setPickHistory((prev) => {
        const next = { ...prev };
        delete next[row.id];
        persistPickHistory(next);
        return next;
      });

      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/user-picks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            questionId: row.id,
            action: "clear",
            outcome: null,
            roundNumber,
            sport: "AFL",
            gameId: row.gameId,
          }),
        });
        if (!res.ok) {
          console.warn("Pick clear not supported or failed:", await res.text());
        }
      } catch (err) {
        console.error("Pick clear error", err);
      }
    },
    [isGameUnlocked, persistPickHistory, user, roundNumber]
  );

  const handleShare = async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "https://streakr.com.au";
      const text = `I’m on a STREAKr streak of ${userCurrentStreak ?? 0}. Back yourself — how long can you last?`;

      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "STREAKr", text, url });
        setShareStatus("Shared!");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Link copied.");
      } else {
        setShareStatus("Share not supported here.");
      }
    } catch {
      setShareStatus("Could not share right now.");
    }
    setTimeout(() => setShareStatus(""), 2500);
  };

  const openComments = async (row: QuestionRow) => {
    setCommentsOpenFor(row);
    setComments([]);
    setCommentText("");
    setCommentsError("");
    setCommentsLoading(true);

    try {
      const res = await fetch(`/api/comments/${row.id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const src = data.items || data.comments || [];
      const list: Comment[] = src.map((c: any) => ({
        id: c.id,
        body: c.body,
        displayName: c.displayName,
        createdAt: c.createdAt,
      }));
      setComments(list);
    } catch (err) {
      console.error(err);
      setCommentsError("Failed to load comments.");
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeComments = () => {
    setCommentsOpenFor(null);
    setComments([]);
    setCommentText("");
    setCommentsError("");
  };

  const submitComment = async () => {
    if (!commentsOpenFor || !commentText.trim()) return;

    setSubmittingComment(true);
    setCommentsError("");

    try {
      const res = await fetch(`/api/comments/${commentsOpenFor.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();

      const newComment: Comment = {
        id: created.id || Math.random().toString(36),
        body: created.body ?? commentText.trim(),
        displayName: created.displayName,
        createdAt: created.createdAt,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentText("");
    } catch (err) {
      console.error(err);
      setCommentsError("Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const statusBadge = (s: QuestionStatus) => {
    if (s === "open") return { label: "OPEN", bg: "rgba(0,229,255,0.12)", br: "rgba(0,229,255,0.45)", tx: COLORS.cyan };
    if (s === "pending") return { label: "PENDING", bg: "rgba(255,61,0,0.10)", br: "rgba(255,61,0,0.40)", tx: COLORS.orange };
    if (s === "final") return { label: "FINAL", bg: "rgba(255,255,255,0.06)", br: "rgba(255,255,255,0.16)", tx: "rgba(255,255,255,0.75)" };
    return { label: "VOID", bg: "rgba(255,7,58,0.10)", br: "rgba(255,7,58,0.45)", tx: COLORS.red };
  };

  const sentimentFor = (r: QuestionRow) => {
    const yes = clamp(r.yesPercent ?? 0, 0, 100);
    const no = clamp(r.noPercent ?? 0, 0, 100);
    const majority: "yes" | "no" = yes >= no ? "yes" : "no";
    const pick = (pickHistory[r.id] ?? r.userPick) as any;
    const hasPick = pick === "yes" || pick === "no";
    const withCrowd = hasPick ? pick === majority : null;

    return { yes, no, majority, hasPick, withCrowd };
  };

  const current = userCurrentStreak ?? 0;
  const leader = leaderCurrentStreak ?? 0;

  const maxBar = Math.max(current, leader, 1);
  const curW = `${(current / maxBar) * 100}%`;
  const leadW = `${(leader / maxBar) * 100}%`;

  const picksLine = `${picksMade}/${totalQuestions || 0}`;
  const accuracyLine = accuracy === null ? "-" : formatPct(accuracy);
  const nextLockLine = nextLock === null ? "-" : formatCountdown(nextLock);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const sponsorExists = rows.some((r) => !!r.isSponsorQuestion);

  return (
    <>
      <style jsx>{`
        @keyframes pulseCyan {
          0% { box-shadow: 0 0 0 rgba(0,229,255,0); }
          50% { box-shadow: 0 0 22px rgba(0,229,255,0.55); }
          100% { box-shadow: 0 0 0 rgba(0,229,255,0); }
        }
        @keyframes pulseOrange {
          0% { box-shadow: 0 0 0 rgba(255,61,0,0); }
          50% { box-shadow: 0 0 22px rgba(255,61,0,0.50); }
          100% { box-shadow: 0 0 0 rgba(255,61,0,0); }
        }
        .pulse-live { animation: pulseCyan 1.3s ease-in-out infinite; }
        .pulse-hot { animation: pulseOrange 1.5s ease-in-out infinite; }
      `}</style>

      {showConfetti && windowSize.width > 0 && (
        <Confetti width={windowSize.width} height={windowSize.height} numberOfPieces={260} recycle={false} />
      )}

      <div className="min-h-screen" style={{ background: COLORS.bg, color: "white" }}>
        {/* Sticky Top Bar */}
        <div
          className="sticky top-0 z-40 border-b"
          style={{
            background: "linear-gradient(180deg, rgba(13,17,23,0.96) 0%, rgba(13,17,23,0.88) 100%)",
            borderColor: COLORS.border,
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      Picks{" "}
                      <span style={{ color: COLORS.cyan }} className="text-sm font-semibold align-middle">
                        {roundLabel ? `• ${roundLabel}` : ""}
                      </span>
                    </div>
                    <div style={{ color: COLORS.textDim2 }} className="text-xs">
                      Clean sweep per match. One wrong in a match = streak nuked.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHowToModal(true)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold border transition"
                    style={{
                      borderColor: "rgba(0,229,255,0.55)",
                      color: COLORS.cyan,
                      background: "rgba(0,229,255,0.06)",
                    }}
                  >
                    How to play
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-full px-3 py-1.5 text-[11px] font-extrabold border transition"
                    style={{
                      borderColor: "rgba(255,61,0,0.65)",
                      color: "black",
                      background: COLORS.orange,
                      boxShadow: "0 0 20px rgba(255,61,0,0.20)",
                    }}
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Streak vs Leader + bars */}
              <div
                className="rounded-2xl border p-3"
                style={{
                  borderColor: "rgba(0,229,255,0.22)",
                  background: `linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(255,61,0,0.06) 55%, rgba(118,255,3,0.05) 100%)`,
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                          Your streak
                        </div>
                        <div className="text-3xl font-extrabold" style={{ color: COLORS.orange }}>
                          {user ? current : "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                          Leader
                        </div>
                        <div className="text-2xl font-extrabold" style={{ color: COLORS.cyan }}>
                          {leader}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 space-y-2">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: curW,
                            background: `linear-gradient(90deg, ${COLORS.orange} 0%, rgba(255,61,0,0.55) 100%)`,
                            boxShadow: "0 0 18px rgba(255,61,0,0.45)",
                          }}
                        />
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: leadW,
                            background: `linear-gradient(90deg, ${COLORS.cyan} 0%, rgba(0,229,255,0.45) 100%)`,
                            boxShadow: "0 0 18px rgba(0,229,255,0.35)",
                          }}
                        />
                      </div>
                    </div>

                    {(streakLoading || streakError) && (
                      <div className="mt-2 text-[11px]" style={{ color: streakError ? COLORS.red : COLORS.textDim2 }}>
                        {streakError ? streakError : "Loading streak…"}
                      </div>
                    )}

                    {shareStatus && (
                      <div className="mt-2 text-[11px]" style={{ color: COLORS.cyan }}>
                        {shareStatus}
                      </div>
                    )}
                  </div>

                  {/* Stats Cards */}
                  <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-2xl border p-3" style={{ background: COLORS.panel2, borderColor: COLORS.border }}>
                      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                        Picks made
                      </div>
                      <div className="mt-1 flex items-end justify-between">
                        <div className="text-2xl font-extrabold" style={{ color: "white" }}>
                          {picksLine}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.textDim2 }}>
                          {hotCommentCount > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="pulse-hot inline-flex h-2 w-2 rounded-full" style={{ background: COLORS.orange }} />
                              {hotCommentCount} hot
                            </span>
                          ) : (
                            "Keep picking"
                          )}
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${totalQuestions ? (picksMade / totalQuestions) * 100 : 0}%`,
                            background: `linear-gradient(90deg, ${COLORS.cyan} 0%, rgba(0,229,255,0.25) 100%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border p-3" style={{ background: COLORS.panel2, borderColor: COLORS.border }}>
                      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                        Accuracy
                      </div>
                      <div className="mt-1 flex items-end justify-between">
                        <div className="text-2xl font-extrabold" style={{ color: accuracy !== null && accuracy >= 60 ? COLORS.green : "white" }}>
                          {accuracyLine}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.textDim2 }}>
                          Settled only
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${accuracy === null ? 0 : clamp(accuracy, 0, 100)}%`,
                            background: `linear-gradient(90deg, ${COLORS.green} 0%, rgba(118,255,3,0.20) 100%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border p-3" style={{ background: COLORS.panel2, borderColor: COLORS.border }}>
                      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                        Next lock
                      </div>
                      <div className="mt-1 flex items-end justify-between">
                        <div className="text-2xl font-extrabold" style={{ color: nextLock !== null ? COLORS.orange : "white" }}>
                          {nextLockLine}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.textDim2 }}>
                          Countdown
                        </div>
                      </div>
                      <div className="mt-2 text-[11px]" style={{ color: COLORS.textDim }}>
                        {sponsorExists ? (
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex px-2 py-0.5 rounded-full font-extrabold"
                              style={{
                                background: "rgba(255,61,0,0.15)",
                                border: `1px solid rgba(255,61,0,0.45)`,
                                color: COLORS.orange,
                              }}
                            >
                              Sponsor Q live
                            </span>
                            Nail it.
                          </span>
                        ) : (
                          "Don’t get caught napping."
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {error && <div className="text-sm" style={{ color: COLORS.red }}>{error}</div>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(["all", "open", "pending", "final", "void"] as const).map((f) => {
              const active = activeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f === "all" ? "all" : f)}
                  className="rounded-full px-4 py-2 text-xs font-extrabold tracking-wide border transition"
                  style={{
                    borderColor: active ? "rgba(0,229,255,0.55)" : COLORS.border,
                    background: active ? "rgba(0,229,255,0.10)" : "rgba(255,255,255,0.03)",
                    color: active ? COLORS.cyan : "rgba(255,255,255,0.78)",
                    boxShadow: active ? "0 0 18px rgba(0,229,255,0.15)" : "none",
                  }}
                >
                  {f.toUpperCase()}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="rounded-2xl border p-6" style={{ borderColor: COLORS.border, background: COLORS.panel }}>
              <div className="text-sm" style={{ color: COLORS.textDim }}>Loading games…</div>
            </div>
          )}

          {!loading && games.length === 0 && (
            <div className="rounded-2xl border p-6" style={{ borderColor: COLORS.border, background: COLORS.panel }}>
              <div className="text-sm" style={{ color: COLORS.textDim }}>No questions in this view yet.</div>
            </div>
          )}

          {!loading && games.length > 0 && (
            <div className="space-y-4">
              {games.map((g) => {
                const meta = perGameMeta[g.gameId];
                const { date, time } = formatAedt(g.startTime);
                const locked = meta?.locked ?? false;
                const picked = meta?.picked ?? 0;
                const total = meta?.total ?? g.rows.length;
                const progress = total ? (picked / total) * 100 : 0;

                const isLive = meta?.state === "live" && !locked;
                const countdownLabel = meta?.countdownLabel ?? "--";

                return (
                  <div
                    key={g.gameId}
                    className="rounded-3xl border overflow-hidden"
                    style={{
                      borderColor: "rgba(255,255,255,0.10)",
                      background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
                      boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
                    }}
                  >
                    {/* Game header */}
                    <div className="p-4 sm:p-5 border-b" style={{ borderColor: COLORS.border }}>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* ✅ CHANGE 1: make game title orange */}
                            <div
                              className="text-lg sm:text-xl font-extrabold truncate"
                              style={{ color: "#FFFFFF" }}
                            >
                              {g.match}
                            </div>

                            {isLive && (
                              <span
                                className="pulse-live inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold border"
                                style={{
                                  background: "rgba(0,229,255,0.10)",
                                  borderColor: "rgba(0,229,255,0.55)",
                                  color: COLORS.cyan,
                                }}
                              >
                                <span className="inline-flex h-2 w-2 rounded-full" style={{ background: COLORS.cyan }} />
                                LIVE
                              </span>
                            )}

                            {locked && (
                              <span
                                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold border"
                                style={{
                                  background: "rgba(255,7,58,0.08)",
                                  borderColor: "rgba(255,7,58,0.45)",
                                  color: COLORS.red,
                                }}
                              >
                                🔒 LOCKED
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-[12px]" style={{ color: COLORS.textDim }}>
                            {g.venue} • {date} {time} AEDT
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold border"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                borderColor: COLORS.border,
                                color: "rgba(255,255,255,0.85)",
                              }}
                            >
                              Picks: {picked}/{total}
                            </span>

                            <span
                              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold border"
                              style={{
                                background: isLive ? "rgba(0,229,255,0.08)" : "rgba(255,61,0,0.08)",
                                borderColor: isLive ? "rgba(0,229,255,0.30)" : "rgba(255,61,0,0.30)",
                                color: isLive ? COLORS.cyan : COLORS.orange,
                              }}
                            >
                              {locked ? "Locked" : isLive ? "In play" : `Locks in ${countdownLabel}`}
                            </span>
                          </div>

                          <div className="mt-3">
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                              <div
                                className="h-full"
                                style={{
                                  width: `${progress}%`,
                                  background: `linear-gradient(90deg, ${COLORS.cyan} 0%, rgba(0,229,255,0.12) 100%)`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-start sm:items-end gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold border"
                            style={{
                              background: "rgba(255,61,0,0.10)",
                              borderColor: "rgba(255,61,0,0.35)",
                              color: COLORS.orange,
                            }}
                          >
                            {g.sport}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Questions list */}
                    <div className="p-3 sm:p-4 space-y-3">
                      {g.rows.map((r) => {
                        const unlocked = isGameUnlocked(r.gameId);
                        const open = r.status === "open";
                        const selectable = unlocked && open;

                        const pick = (pickHistory[r.id] ?? r.userPick) as any;
                        const hasPicked = pick === "yes" || pick === "no";

                        const badge = statusBadge(r.status);
                        const senti = sentimentFor(r);

                        const majorityLabel = senti.majority === "yes" ? "YES" : "NO";
                        const crowdLine =
                          !senti.hasPick
                            ? `Majority is ${majorityLabel}`
                            : senti.withCrowd
                            ? "You’re WITH the crowd"
                            : "You’re AGAINST the crowd";

                        const crowdColor =
                          !senti.hasPick ? "rgba(255,255,255,0.70)"
                          : senti.withCrowd ? COLORS.green
                          : COLORS.red;

                        const hot = (r.commentCount ?? 0) >= 100;

                        return (
                          <div
                            key={r.id}
                            className="rounded-2xl border"
                            style={{
                              borderColor: COLORS.border,
                              background: "rgba(0,0,0,0.18)",
                            }}
                          >
                            {/* ✅ CHANGE 2: reduce height of each pick block (tighten padding) */}
                            <div className="p-3 sm:p-3">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
                                      style={{
                                        background: badge.bg,
                                        borderColor: badge.br,
                                        color: badge.tx,
                                      }}
                                    >
                                      {badge.label}
                                    </span>

                                    <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.70)" }}>
                                      {r.quarter === 0 ? "Match" : `Q${r.quarter}`}
                                    </span>

                                    {r.isSponsorQuestion && (
                                      <span
                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
                                        style={{
                                          background: "rgba(255,61,0,0.12)",
                                          borderColor: "rgba(255,61,0,0.55)",
                                          color: COLORS.orange,
                                        }}
                                      >
                                        Sponsor
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1.5 text-sm sm:text-[14px] font-semibold leading-snug">
                                    {r.question}
                                  </div>

                                  {/* Crowd sentiment bars (tight) */}
                                  <div className="mt-2.5">
                                    <div className="flex items-center justify-between text-[11px] font-semibold">
                                      <span style={{ color: COLORS.textDim }}>Crowd</span>
                                      <span style={{ color: crowdColor }}>{crowdLine}</span>
                                    </div>

                                    <div
                                      className="mt-1 h-2.5 rounded-full overflow-hidden border"
                                      style={{
                                        background: "rgba(255,255,255,0.06)",
                                        borderColor: "rgba(255,255,255,0.10)",
                                      }}
                                    >
                                      <div className="h-full flex">
                                        <div
                                          style={{
                                            width: `${senti.yes}%`,
                                            background: `linear-gradient(90deg, ${COLORS.green} 0%, rgba(118,255,3,0.25) 100%)`,
                                          }}
                                        />
                                        <div
                                          style={{
                                            width: `${senti.no}%`,
                                            background: `linear-gradient(90deg, ${COLORS.red} 0%, rgba(255,7,58,0.20) 100%)`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-0.5 flex items-center justify-between text-[10px]" style={{ color: COLORS.textDim2 }}>
                                      <span>YES {Math.round(senti.yes)}%</span>
                                      <span>NO {Math.round(senti.no)}%</span>
                                    </div>
                                  </div>

                                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => openComments(r)}
                                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold border transition ${
                                        hot ? "pulse-hot" : ""
                                      }`}
                                      style={{
                                        borderColor: hot ? "rgba(255,61,0,0.55)" : "rgba(0,229,255,0.25)",
                                        background: hot ? "rgba(255,61,0,0.10)" : "rgba(0,229,255,0.06)",
                                        color: hot ? COLORS.orange : COLORS.cyan,
                                      }}
                                    >
                                      💬 {r.commentCount ?? 0}
                                      {hot && <span className="ml-1">🔥</span>}
                                    </button>

                                    {!selectable && (
                                      <span
                                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold border"
                                        style={{
                                          borderColor: "rgba(255,255,255,0.12)",
                                          background: "rgba(255,255,255,0.04)",
                                          color: "rgba(255,255,255,0.65)",
                                        }}
                                      >
                                        {unlocked ? "Not open" : "Picks locked"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-stretch md:items-end gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handlePick(r, "yes")}
                                      disabled={!selectable}
                                      className={[
                                        "rounded-2xl px-4 py-2.5 text-sm font-extrabold border transition transform",
                                        "active:scale-[0.98]",
                                        pick === "yes" ? "scale-[1.03]" : "",
                                      ].join(" ")}
                                      style={{
                                        minWidth: 100,
                                        borderColor: pick === "yes" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.10)",
                                        background: pick === "yes"
                                          ? `linear-gradient(135deg, ${COLORS.cyan} 0%, rgba(0,229,255,0.35) 100%)`
                                          : selectable
                                          ? "rgba(255,255,255,0.04)"
                                          : "rgba(255,255,255,0.02)",
                                        color: pick === "yes" ? "#001015" : selectable ? "white" : "rgba(255,255,255,0.35)",
                                        boxShadow: pick === "yes" ? "0 0 20px rgba(0,229,255,0.35)" : "none",
                                        cursor: selectable ? "pointer" : "not-allowed",
                                      }}
                                    >
                                      YES
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handlePick(r, "no")}
                                      disabled={!selectable}
                                      className={[
                                        "rounded-2xl px-4 py-2.5 text-sm font-extrabold border transition transform",
                                        "active:scale-[0.98]",
                                        pick === "no" ? "scale-[1.03]" : "",
                                      ].join(" ")}
                                      style={{
                                        minWidth: 100,
                                        borderColor: pick === "no" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.10)",
                                        background: pick === "no"
                                          ? `linear-gradient(135deg, ${COLORS.orange} 0%, rgba(255,61,0,0.30) 100%)`
                                          : selectable
                                          ? "rgba(255,255,255,0.04)"
                                          : "rgba(255,255,255,0.02)",
                                        color: pick === "no" ? "#120500" : selectable ? "white" : "rgba(255,255,255,0.35)",
                                        boxShadow: pick === "no" ? "0 0 20px rgba(255,61,0,0.30)" : "none",
                                        cursor: selectable ? "pointer" : "not-allowed",
                                      }}
                                    >
                                      NO
                                    </button>

                                    {hasPicked && selectable && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearPick(r)}
                                        className="rounded-2xl px-3 py-2.5 text-sm font-extrabold border transition active:scale-[0.98]"
                                        style={{
                                          borderColor: "rgba(255,255,255,0.12)",
                                          background: "rgba(255,255,255,0.04)",
                                          color: "rgba(255,255,255,0.78)",
                                        }}
                                        title="Clear pick"
                                        aria-label="Clear pick"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>

                                  <div className="text-[10px] text-right" style={{ color: COLORS.textDim2 }}>
                                    {senti.hasPick ? (
                                      senti.withCrowd ? (
                                        <span style={{ color: COLORS.green }}>WITH crowd 🟢</span>
                                      ) : (
                                        <span style={{ color: COLORS.red }}>AGAINST crowd 🔴</span>
                                      )
                                    ) : (
                                      <span>Pick now.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Auth modal */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div
              className="w-full max-w-sm rounded-3xl border p-6"
              style={{
                background: COLORS.panel2,
                borderColor: "rgba(0,229,255,0.22)",
                boxShadow: "0 0 40px rgba(0,229,255,0.12)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-lg font-extrabold">Log in to play</h2>
                <button type="button" onClick={() => setShowAuthModal(false)} className="text-sm font-extrabold" style={{ color: COLORS.textDim }}>
                  ✕
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.textDim }}>
                You need a free STREAKr account to make picks, build your streak and hit the leaderboard.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/auth?mode=login&returnTo=/picks"
                  className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold"
                  style={{ background: COLORS.orange, color: "black", boxShadow: "0 0 24px rgba(255,61,0,0.18)" }}
                  onClick={() => setShowAuthModal(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth?mode=signup&returnTo=/picks"
                  className="flex-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold border"
                  style={{ borderColor: "rgba(0,229,255,0.35)", color: COLORS.cyan, background: "rgba(0,229,255,0.06)" }}
                  onClick={() => setShowAuthModal(false)}
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Comments drawer */}
        {commentsOpenFor && (
          <div className="fixed inset-0 z-40 bg-black/70 flex justify-end">
            <div className="w-full max-w-md h-full p-6 flex flex-col border-l" style={{ background: COLORS.panel2, borderColor: COLORS.border }}>
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold truncate" style={{ color: "white" }}>
                    Comments
                  </div>
                  <div className="text-sm mt-1" style={{ color: COLORS.textDim }}>
                    {commentsOpenFor.question}
                  </div>
                </div>
                <button type="button" onClick={closeComments} className="text-sm font-extrabold" style={{ color: COLORS.textDim }}>
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <textarea
                  value={commentText}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl px-3 py-2 text-sm border focus:outline-none"
                  style={{ background: COLORS.panel, borderColor: "rgba(0,229,255,0.18)", color: "white" }}
                  placeholder="Talk your talk…"
                />
                {commentsError && <p className="text-xs mt-2" style={{ color: COLORS.red }}>{commentsError}</p>}
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={submitComment}
                    disabled={submittingComment || !commentText.trim()}
                    className="rounded-full px-4 py-2 text-sm font-extrabold border transition"
                    style={{
                      background: !commentText.trim() || submittingComment ? "rgba(255,255,255,0.06)" : COLORS.cyan,
                      borderColor: !commentText.trim() || submittingComment ? COLORS.border : "rgba(0,229,255,0.55)",
                      color: !commentText.trim() || submittingComment ? "rgba(255,255,255,0.45)" : "#001015",
                      cursor: !commentText.trim() || submittingComment ? "not-allowed" : "pointer",
                    }}
                  >
                    {submittingComment ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {commentsLoading ? (
                  <div className="text-sm" style={{ color: COLORS.textDim }}>Loading…</div>
                ) : comments.length === 0 ? (
                  <div className="text-sm" style={{ color: COLORS.textDim }}>No comments yet. Be the first villain.</div>
                ) : (
                  <ul className="space-y-3">
                    {comments.map((c) => (
                      <li key={c.id} className="rounded-2xl border p-3" style={{ borderColor: COLORS.border, background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-extrabold" style={{ color: COLORS.cyan }}>
                            {c.displayName || "User"}
                          </span>
                          {c.createdAt && <span className="text-[11px]" style={{ color: COLORS.textDim2 }}>{c.createdAt}</span>}
                        </div>
                        <div className="text-sm" style={{ color: "rgba(255,255,255,0.86)" }}>
                          {c.body}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* How to play modal */}
        {showHowToModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div
              className="w-full max-w-xl rounded-3xl border p-6"
              style={{
                background: COLORS.panel2,
                borderColor: "rgba(0,229,255,0.22)",
                boxShadow: "0 0 44px rgba(0,229,255,0.12)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: COLORS.textDim2 }}>
                    Quick rules
                  </div>
                  <h2 className="text-xl font-extrabold">How to play Picks</h2>
                </div>
                <button type="button" onClick={closeHowTo} className="text-sm font-extrabold" style={{ color: COLORS.textDim }}>
                  ✕
                </button>
              </div>

              <ul className="space-y-2 text-sm" style={{ color: COLORS.textDim }}>
                <li><span style={{ color: COLORS.cyan, fontWeight: 800 }}>•</span> Pick YES/NO on any questions you like.</li>
                <li><span style={{ color: COLORS.cyan, fontWeight: 800 }}>•</span> Your streak is <span style={{ color: "white", fontWeight: 800 }}>per match clean sweep</span>: one wrong in that match resets to 0 at match end.</li>
                <li><span style={{ color: COLORS.cyan, fontWeight: 800 }}>•</span> Void questions don’t count.</li>
                <li><span style={{ color: COLORS.cyan, fontWeight: 800 }}>•</span> Matches lock when they start (or when admin locks them).</li>
              </ul>

              <div className="mt-5 flex justify-end">
                <button type="button" onClick={closeHowTo} className="rounded-full px-5 py-2 text-sm font-extrabold" style={{ background: COLORS.orange, color: "black" }}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
