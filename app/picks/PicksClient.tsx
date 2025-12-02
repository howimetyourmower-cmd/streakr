"use client";

import { useEffect, useState, useMemo, ChangeEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  doc,
  orderBy,
  limit,
} from "firebase/firestore";

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
  yesPercent?: number;
  noPercent?: number;
  sport: string;
  commentCount: number;
  isSponsorQuestion?: boolean;
  correctOutcome?: "yes" | "no" | "void" | null;
  resultForUser?: "win" | "loss" | "void" | null;
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

type Comment = {
  id: string;
  body: string;
  displayName?: string;
  createdAt?: string;
};

type ActiveOutcome = "yes" | "no" | null;

// ---------- AFL team logo helpers ----------

type AflTeamKey =
  | "adelaide"
  | "brisbane"
  | "carlton"
  | "collingwood"
  | "essendon"
  | "fremantle"
  | "geelong"
  | "gold-coast"
  | "gws"
  | "hawthorn"
  | "melbourne"
  | "north-melbourne"
  | "port-adelaide"
  | "richmond"
  | "st-kilda"
  | "sydney"
  | "west-coast"
  | "western-bulldogs";

const AFL_TEAM_LOGOS: Record<
  AflTeamKey,
  { name: string; logo: string }
> = {
  adelaide: { name: "Adelaide Crows", logo: "/afl-logos/adelaide.jpeg" },
  brisbane: { name: "Brisbane Lions", logo: "/afl-logos/brisbane.jpeg" },
  carlton: { name: "Carlton", logo: "/afl-logos/carlton.jpeg" },
  collingwood: {
    name: "Collingwood",
    logo: "/afl-logos/collingwood.jpeg",
  },
  essendon: { name: "Essendon", logo: "/afl-logos/essendon.jpeg" },
  fremantle: {
    name: "Fremantle Dockers",
    logo: "/afl-logos/fremantle.jpeg",
  },
  geelong: { name: "Geelong Cats", logo: "/afl-logos/geelong.jpeg" },
  "gold-coast": {
    name: "Gold Coast Suns",
    logo: "/afl-logos/gold-coast.jpeg",
  },
  gws: {
    name: "GWS Giants",
    logo: "/afl-logos/gws.jpeg",
  },
  hawthorn: { name: "Hawthorn Hawks", logo: "/afl-logos/hawthorn.jpeg" },
  melbourne: {
    name: "Melbourne Demons",
    logo: "/afl-logos/melbourne.jpeg",
  },
  "north-melbourne": {
    name: "North Melbourne Kangaroos",
    logo: "/afl-logos/north-melbourne.jpeg",
  },
  "port-adelaide": {
    name: "Port Adelaide Power",
    logo: "/afl-logos/port-adelaide.jpeg",
  },
  richmond: {
    name: "Richmond Tigers",
    logo: "/afl-logos/richmond.jpeg",
  },
  "st-kilda": {
    name: "St Kilda Saints",
    logo: "/afl-logos/st-kilda.jpeg",
  },
  sydney: { name: "Sydney Swans", logo: "/afl-logos/sydney.jpeg" },
  "west-coast": {
    name: "West Coast Eagles",
    logo: "/afl-logos/west-coast.jpeg",
  },
  "western-bulldogs": {
    name: "Western Bulldogs",
    logo: "/afl-logos/western-bulldogs.jpeg",
  },
};

function normaliseSegment(seg: string) {
  return seg.trim().toLowerCase();
}

function getAflTeamKeyFromSegment(seg: string): AflTeamKey | null {
  const s = normaliseSegment(seg);

  if (s.includes("adelaide")) return "adelaide";
  if (s.includes("brisbane")) return "brisbane";
  if (s.includes("carlton")) return "carlton";
  if (s.includes("collingwood") || s === "pies") return "collingwood";
  if (s.includes("essendon") || s.includes("bombers")) return "essendon";
  if (s.includes("fremantle") || s.includes("dockers")) return "fremantle";
  if (s.includes("geelong")) return "geelong";
  if (s.includes("gold coast") || s.includes("gc")) return "gold-coast";
  if (s.includes("gws") || s.includes("giants")) return "gws";
  if (s.includes("hawthorn") || s.includes("hawks")) return "hawthorn";
  if (s.includes("melbourne") && !s.includes("north")) return "melbourne";
  if (s.includes("north melbourne") || s.includes("kangaroos"))
    return "north-melbourne";
  if (s.includes("port adelaide") || s.includes("power"))
    return "port-adelaide";
  if (s.includes("richmond") || s.includes("tigers")) return "richmond";
  if (s.includes("st kilda") || s.includes("stkilda")) return "st-kilda";
  if (s.includes("sydney") || s.includes("swans")) return "sydney";
  if (s.includes("west coast") || s.includes("eagles")) return "west-coast";
  if (s.includes("western bulldogs") || s.includes("bulldogs"))
    return "western-bulldogs";

  return null;
}

function parseAflMatchTeams(match: string): {
  homeKey: AflTeamKey | null;
  awayKey: AflTeamKey | null;
  homeLabel: string | null;
  awayLabel: string | null;
} {
  const lower = match.toLowerCase();
  let parts: string[] = [];

  if (lower.includes(" vs ")) {
    parts = match.split(/vs/i);
  } else if (lower.includes(" v ")) {
    parts = match.split(/ v /i);
  } else if (lower.includes(" - ")) {
    parts = match.split(" - ");
  }

  const homeSeg = (parts[0] ?? "").trim();
  const awaySeg = (parts[1] ?? "").trim();

  const homeKey = getAflTeamKeyFromSegment(homeSeg);
  const awayKey = getAflTeamKeyFromSegment(awaySeg);

  return {
    homeKey,
    awayKey,
    homeLabel: homeSeg || null,
    awayLabel: awaySeg || null,
  };
}

// --------------------------------------------------

// localStorage key for persistence
const ACTIVE_PICK_KEY = "streakr_active_pick_v1";

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "all"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);

  // Single active streak pick
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeOutcome, setActiveOutcome] = useState<ActiveOutcome>(null);

  // comments state
  const [commentsOpenFor, setCommentsOpenFor] =
    useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // streak progress tracker
  const [userCurrentStreak, setUserCurrentStreak] = useState<number | null>(
    null
  );
  const [userLongestStreak, setUserLongestStreak] = useState<number | null>(
    null
  );
  const [leaderLongestStreak, setLeaderLongestStreak] = useState<
    number | null
  >(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const [streakError, setStreakError] = useState("");

  // share button status
  const [shareStatus, setShareStatus] = useState<string>("");

  // -------- Date formatting ----------
  const formatStartDate = (iso: string) => {
    if (!iso) return { date: "", time: "" };
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
  };

  // -------- Load Picks --------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }

        const flat: QuestionRow[] = data.games.flatMap((g: ApiGame) =>
          g.questions.map((q: ApiQuestion) => {
            const rawOutcome =
              q.correctOutcome ??
              (q.outcome === "yes" ||
              q.outcome === "no" ||
              q.outcome === "void"
                ? q.outcome
                : null);

            const correctOutcome: QuestionRow["correctOutcome"] =
              q.status === "final" || q.status === "void"
                ? rawOutcome ?? null
                : null;

            let resultForUser: QuestionRow["resultForUser"] = null;
            if (correctOutcome === "void") {
              resultForUser = "void";
            } else if (correctOutcome && q.userPick) {
              resultForUser =
                q.userPick === correctOutcome ? "win" : "loss";
            }

            return {
              id: q.id,
              gameId: g.id,
              match: g.match,
              venue: g.venue ?? q.venue ?? "",
              startTime: g.startTime ?? q.startTime ?? "",
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              userPick: q.userPick,
              yesPercent: q.yesPercent,
              noPercent: q.noPercent,
              sport: q.sport ?? g.sport ?? "AFL",
              commentCount: q.commentCount ?? 0,
              isSponsorQuestion: !!q.isSponsorQuestion,
              correctOutcome,
              resultForUser,
            };
          })
        );

        setRows(flat);
        setFilteredRows(flat); // default "all"
      } catch (e) {
        console.error(e);
        setError("Failed to load picks");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // -------- Live comment counts from Firestore --------
  const questionIds = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    if (!questionIds.length) return;

    const chunkArray = (arr: string[], size: number): string[][] => {
      const chunks: string[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const chunks = chunkArray(questionIds, 10);

    const unsubs = chunks.map((ids) => {
      const commentsRef = collection(db, "comments");
      const qRef = query(commentsRef, where("questionId", "in", ids));

      return onSnapshot(qRef, (snapshot) => {
        const counts: Record<string, number> = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const qid = data.questionId as string;
          counts[qid] = (counts[qid] ?? 0) + 1;
        });

        setRows((prev) =>
          prev.map((r) =>
            counts[r.id] !== undefined
              ? { ...r, commentCount: counts[r.id] }
              : r
          )
        );

        setFilteredRows((prev) =>
          prev.map((r) =>
            counts[r.id] !== undefined
              ? { ...r, commentCount: counts[r.id] }
              : r
          )
        );
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [questionIds]);

  // -------- Local persistence from localStorage --------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!rows.length) return;

    try {
      const raw = window.localStorage.getItem(ACTIVE_PICK_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const questionId: string | undefined = parsed?.questionId;
      const outcome: "yes" | "no" | undefined = parsed?.outcome;

      if (
        questionId &&
        (outcome === "yes" || outcome === "no") &&
        rows.some((r) => r.id === questionId)
      ) {
        setActiveQuestionId(questionId);
        setActiveOutcome(outcome);

        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            userPick: r.id === questionId ? outcome : r.userPick,
          }))
        );
        setFilteredRows((prev) =>
          prev.map((r) => ({
            ...r,
            userPick: r.id === questionId ? outcome : r.userPick,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to restore pick from localStorage", err);
    }
  }, [rows.length]);

  // -------- Optional: also try to load from /api/user-picks (server copy) --------
  useEffect(() => {
    const loadServerPick = async () => {
      if (!user) {
        setActiveQuestionId(null);
        setActiveOutcome(null);
        return;
      }

      if (!rows.length) return;

      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/user-picks", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (!res.ok) return;

        const data = await res.json();
        const questionId: string | undefined = data?.questionId;
        const outcome: "yes" | "no" | undefined = data?.outcome;

        if (
          questionId &&
          (outcome === "yes" || outcome === "no") &&
          rows.some((r) => r.id === questionId)
        ) {
          setActiveQuestionId(questionId);
          setActiveOutcome(outcome);

          setRows((prev) =>
            prev.map((r) => ({
              ...r,
              userPick: r.id === questionId ? outcome : r.userPick,
            }))
          );
          setFilteredRows((prev) =>
            prev.map((r) => ({
              ...r,
              userPick: r.id === questionId ? outcome : r.userPick,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load user pick from API", err);
      }
    };

    if (user) {
      loadServerPick();
    }
  }, [user, rows.length]);

  // -------- Load streak progress (user vs leader, current/longest) --------
  useEffect(() => {
    const loadStreaks = async () => {
      try {
        setStreakLoading(true);
        setStreakError("");

        const usersRef = collection(db, "users");
        const topQ = query(
          usersRef,
          orderBy("longestStreak", "desc"),
          limit(1)
        );
        const topSnap = await getDocs(topQ);

        let leaderVal: number | null = null;
        topSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const val =
            typeof data.longestStreak === "number" ? data.longestStreak : 0;
          leaderVal = val;
        });
        setLeaderLongestStreak(leaderVal);

        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data() as any;
            const current =
              typeof data.currentStreak === "number" ? data.currentStreak : 0;
            const longest =
              typeof data.longestStreak === "number" ? data.longestStreak : 0;
            setUserCurrentStreak(current);
            setUserLongestStreak(longest);
          } else {
            setUserCurrentStreak(0);
            setUserLongestStreak(0);
          }
        } else {
          setUserCurrentStreak(null);
          setUserLongestStreak(null);
        }
      } catch (err) {
        console.error("Failed to load streak progress", err);
        setStreakError("Could not load streak tracker.");
      } finally {
        setStreakLoading(false);
      }
    };

    loadStreaks();
  }, [user]);

  // -------- Filtering --------
  const applyFilter = (f: QuestionStatus | "all") => {
    setActiveFilter(f);
    if (f === "all") setFilteredRows(rows);
    else setFilteredRows(rows.filter((r) => r.status === f));
  };

  // -------- Local Yes/No % based on streak pick only --------
  const getDisplayPercents = (row: QuestionRow) => {
    if (row.status === "final" || row.status === "void") {
      if (!row.resultForUser || row.correctOutcome === "void") {
        return { yes: 0, no: 0 };
      }
      if (row.resultForUser === "win") {
        return row.correctOutcome === "yes"
          ? { yes: 100, no: 0 }
          : { yes: 0, no: 100 };
      }
      if (row.resultForUser === "loss") {
        return row.correctOutcome === "yes"
          ? { yes: 0, no: 100 }
          : { yes: 100, no: 0 };
      }
      return { yes: 0, no: 0 };
    }

    if (!activeQuestionId || !activeOutcome || row.id !== activeQuestionId) {
      return { yes: 0, no: 0 };
    }
    return activeOutcome === "yes"
      ? { yes: 100, no: 0 }
      : { yes: 0, no: 100 };
  };

  // -------- Save Pick via /api/user-picks + localStorage --------
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (row.status !== "open") return;

    setActiveQuestionId(row.id);
    setActiveOutcome(pick);

    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, userPick: pick } : r
      )
    );
    setFilteredRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, userPick: pick } : r
      )
    );

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          ACTIVE_PICK_KEY,
          JSON.stringify({ questionId: row.id, outcome: pick })
        );
      }
    } catch (err) {
      console.error("Failed to save pick to localStorage", err);
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user-picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          questionId: row.id,
          outcome: pick,
          roundNumber,
        }),
      });

      if (!res.ok) {
        console.error("user-picks error:", await res.text());
      }
    } catch (e) {
      console.error("Pick save error:", e);
    }
  };

  // -------- Status pill styling --------
  const statusClasses = (status: QuestionStatus) => {
    switch (status) {
      case "open":
        return "bg-green-600";
      case "pending":
        return "bg-yellow-500";
      case "final":
        return "bg-gray-600";
      case "void":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  // -------- Comment drawer logic --------
  const openComments = async (row: QuestionRow) => {
    setCommentsOpenFor(row);
    setComments([]);
    setCommentText("");
    setCommentsError("");
    setCommentsLoading(true);

    try {
      const res = await fetch(`/api/comments/${row.id}`);
      if (!res.ok) throw new Error("Failed to load comments");

      const data = await res.json();
      const source = data.items || data.comments || [];
      const list: Comment[] = source.map((c: any) => ({
        id: c.id,
        body: c.body,
        displayName: c.displayName,
        createdAt: c.createdAt,
      }));

      setComments(list);
    } catch (e) {
      console.error(e);
      setCommentsError("Failed to load comments");
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

  const handleCommentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
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

      if (!res.ok) throw new Error("Failed to post comment");

      const created = await res.json();
      const newComment: Comment = {
        id: created.id || Math.random().toString(36),
        body: created.body ?? commentText.trim(),
        displayName: created.displayName,
        createdAt: created.createdAt,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentText("");
    } catch (e) {
      console.error(e);
      setCommentsError("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  // --- helper for streak bar widths ---
  const maxBarValue = Math.max(
    userCurrentStreak ?? 0,
    userLongestStreak ?? 0,
    leaderLongestStreak ?? 0,
    1
  );
  const barWidth = (val: number | null) =>
    `${Math.max(0, Math.min(1, (val ?? 0) / maxBarValue)) * 100}%`;

  const hasSponsorQuestion = useMemo(
    () => rows.some((r) => r.isSponsorQuestion),
    [rows]
  );

  // -------- Share handler --------
  const handleShare = async () => {
    try {
      const shareUrl =
        typeof window !== "undefined"
          ? window.location.href
          : "https://streakr.com.au";

      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "STREAKr – How long can you last?",
          text: "I’m playing STREAKr. See if you can beat my streak!",
          url: shareUrl,
        });
        setShareStatus("Shared!");
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("Link copied to clipboard.");
      } else {
        setShareStatus("Share not supported in this browser.");
      }
    } catch (err) {
      console.error("Share error", err);
      setShareStatus("Could not share right now.");
    }

    if (shareStatus) {
      setTimeout(() => setShareStatus(""), 3000);
    }
  };

  // -------- Render --------
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 text:white min-h-screen bg-black text-white">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold">Picks</h1>
        {roundNumber !== null && (
          <p className="text-sm text:white/70">
            Current Round:{" "}
            <span className="font-semibold text-orange-400">
              {roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`}
            </span>
          </p>
        )}
      </div>

      {/* STREAK PROGRESS TRACKER + SHARE */}
      <div className="mb-6 rounded-2xl bg-[#020617] border border-sky-500/30 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              Streak progress
            </p>
            <p className="text-xs sm:text-sm text-white/80 max-w-md">
              Track your current run, your best ever streak, and how far you
              are behind the season leader.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] text-white/60">Current</p>
                <p className="text-lg sm:text-xl font-bold text-orange-400">
                  {user ? userCurrentStreak ?? 0 : "-"}
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-right">
                <p className="text-[11px] text-white/60">Best</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-300">
                  {user ? userLongestStreak ?? 0 : "-"}
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-right">
                <p className="text-[11px] text-white/60">Leader</p>
                <p className="text-lg sm:text-xl font-bold text-sky-300">
                  {leaderLongestStreak ?? "-"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center rounded-full border border-sky-400/60 px-3 py-1 text-[11px] sm:text-xs font-semibold text-sky-200 hover:bg-sky-500/10 transition"
            >
              Share my streak
            </button>
          </div>
        </div>

        {/* Bars: Current / Longest / Leader */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-white/70 mb-1">
              <span>Current streak</span>
              <span className="font-semibold text-orange-300">
                {user ? userCurrentStreak ?? 0 : 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"
                style={{ width: barWidth(userCurrentStreak) }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-white/70 mb-1">
              <span>Longest streak</span>
              <span className="font-semibold text-emerald-300">
                {user ? userLongestStreak ?? 0 : 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                style={{ width: barWidth(userLongestStreak) }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-white/70 mb-1">
              <span>Leader</span>
              <span className="font-semibold text-sky-300">
                {leaderLongestStreak ?? 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600"
                style={{ width: barWidth(leaderLongestStreak) }}
              />
            </div>
          </div>
        </div>

        {streakLoading && (
          <p className="mt-2 text-[10px] text-white/50">
            Loading streak data…
          </p>
        )}
        {streakError && (
          <p className="mt-2 text-[10px] text-red-400">{streakError}</p>
        )}
        {shareStatus && (
          <p className="mt-2 text-[10px] text-sky-300">{shareStatus}</p>
        )}
      </div>

      {/* SPONSOR QUESTION INFO STRIP */}
      {hasSponsorQuestion && (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border border-amber-500/40 px-4 py-3 text-xs sm:text-sm text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <span className="uppercase tracking-wide text-[11px] font-semibold text-amber-300">
            Sponsor Question
          </span>
          <span className="text-[12px] sm:text-[13px]">
            Look for the{" "}
            <span className="font-semibold">Sponsor Question</span> tag. Get it
            right to go into the draw for this round&apos;s $100 sponsor gift
            card.*
          </span>
        </div>
      )}

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "open", "final", "pending", "void"] as const).map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f === "all" ? "all" : f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeFilter === f
                ? "bg-orange-500"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* HEADER ROW (desktop) */}
      <div className="hidden md:grid grid-cols-12 text-gray-300 text-xs mb-2 px-2">
        <div className="col-span-2">START</div>
        <div className="col-span-1">SPORT</div>
        <div className="col-span-1">STATUS</div>
        <div className="col-span-3">MATCH • VENUE</div>
        <div className="col-span-1 text-center">QUARTER</div>
        <div className="col-span-2">QUESTION</div>
        <div className="col-span-2 text-right">PICK • YES% • NO%</div>
      </div>

      {loading && <p>Loading…</p>}

      {/* ROWS */}
      <div className="space-y-2">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);

          const isActive = row.id === activeQuestionId;
          const isYesActive = isActive && activeOutcome === "yes";
          const isNoActive = isActive && activeOutcome === "no";
          const { yes: yesPct, no: noPct } = getDisplayPercents(row);

          const isLocked = row.status !== "open";
          const isSponsor = !!row.isSponsorQuestion;

          const parsed =
            row.sport.toUpperCase() === "AFL"
              ? parseAflMatchTeams(row.match)
              : null;

          const homeTeam =
            parsed?.homeKey && AFL_TEAM_LOGOS[parsed.homeKey]
              ? AFL_TEAM_LOGOS[parsed.homeKey]
              : null;
          const awayTeam =
            parsed?.awayKey && AFL_TEAM_LOGOS[parsed.awayKey]
              ? AFL_TEAM_LOGOS[parsed.awayKey]
              : null;

          const useAflLayout = !!parsed && (homeTeam || awayTeam);

          return (
            <div
              key={row.id}
              className="rounded-lg bg-gradient-to-r from-[#1E293B] via-[#111827] to-[#020617] border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
            >
              <div className="grid grid-cols-12 items-center px-4 py-1.5 gap-y-2 md:gap-y-0 text-white">
                {/* START */}
                <div className="col-span-12 md:col-span-2">
                  <div className="text-sm font-semibold">{date}</div>
                  <div className="text-[11px] text-white/80">
                    {time} AEDT
                  </div>
                </div>

                {/* SPORT */}
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/40 text-[11px] font-semibold uppercase tracking-wide">
                    {row.sport}
                  </span>
                </div>

                {/* STATUS */}
                <div className="col-span-6 md:col-span-1">
                  <span
                    className={`${statusClasses(
                      row.status
                    )} text-[10px] px-2 py-0.5 rounded-full font-bold`}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </div>

                {/* MATCH + VENUE */}
                <div className="col-span-12 md:col-span-3">
                  {useAflLayout ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 min-w-0">
                          {homeTeam && (
                            <Image
                              src={homeTeam.logo}
                              alt={homeTeam.name}
                              width={32}
                              height={32}
                              className="rounded-full border border-white/20 bg-black/60"
                            />
                          )}
                          <span className="text-sm font-semibold truncate">
                            {parsed?.homeLabel || homeTeam?.name || ""}
                          </span>
                        </div>

                        <span className="text-xs uppercase tracking-wide text-white/70">
                          vs
                        </span>

                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm font-semibold truncate">
                            {parsed?.awayLabel || awayTeam?.name || ""}
                          </span>
                          {awayTeam && (
                            <Image
                              src={awayTeam.logo}
                              alt={awayTeam.name}
                              width={32}
                              height={32}
                              className="rounded-full border border-white/20 bg-black/60"
                            />
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-white/80 mt-0.5">
                        {row.venue}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold">
                        {row.match}
                      </div>
                      <div className="text-[11px] text-white/80">
                        {row.venue}
                      </div>
                    </>
                  )}
                </div>

                {/* QUARTER */}
                <div className="col-span-3 md:col-span-1 text-sm font-bold md:text-center">
                  <span className="block md:hidden">
                    Quarter {row.quarter}
                  </span>
                  <span className="hidden md:inline">
                    Quarter{row.quarter}
                  </span>
                </div>

                {/* QUESTION + COMMENTS + pills */}
                <div className="col-span-9 md:col-span-2">
                  <div className="text-sm leading-snug font-medium">
                    {row.question}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => openComments(row)}
                      className="text-[11px] text-sky-300 underline"
                    >
                      Comments ({row.commentCount ?? 0})
                    </button>
                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/90 text-black px-2 py-0.5 text-[10px] font-semibold">
                        Streak Pick
                      </span>
                    )}
                    {isLocked && (
                      <span className="inline-flex items-center rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                        Locked
                      </span>
                    )}
                    {isSponsor && (
                      <span className="inline-flex items-center rounded-full bg-amber-400 text-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Sponsor Question
                      </span>
                    )}
                  </div>
                </div>

                {/* PICK / YES / NO / RESULT PILL */}
                <div className="col-span-12 md:col-span-2 flex flex-col items-end">
                  <div className="flex gap-2 mb-0.5">
                    <button
                      type="button"
                      onClick={() => handlePick(row, "yes")}
                      disabled={isLocked}
                      className={`
                        px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition
                        ${
                          isYesActive
                            ? "bg-sky-500 text-black ring-2 ring-white"
                            : "bg-green-600 hover:bg-green-700"
                        }
                        ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed hover:bg-green-600"
                            : ""
                        }
                      `}
                    >
                      Yes
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePick(row, "no")}
                      disabled={isLocked}
                      className={`
                        px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition
                        ${
                          isNoActive
                            ? "bg-sky-500 text-black ring-2 ring-white"
                            : "bg-red-600 hover:bg-red-700"
                        }
                        ${
                          isLocked
                            ? "opacity-40 cursor-not-allowed hover:bg-red-600"
                            : ""
                        }
                      `}
                    >
                      No
                    </button>
                  </div>

                 {/* Outcome pill under YES/NO buttons when question is final/void */}
{(row.status === "final" || row.status === "void") &&
  row.correctOutcome &&
  row.userPick && (
    <div className="mt-2">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
          row.correctOutcome === "void"
            ? "bg-slate-700/60 border-slate-400/40 text-slate-100"
            : row.userPick === row.correctOutcome
            ? "bg-emerald-500/15 border-emerald-400/60 text-emerald-300"
            : "bg-red-500/15 border-red-400/60 text-red-300"
        }`}
      >
        {row.correctOutcome === "void"
          ? "Question voided"
          : row.userPick === row.correctOutcome
          ? "You were right!"
          : "Wrong pick"}
      </span>
    </div>
  )}

                  <div className="text-[11px] text-white/85">
                    Yes: {yesPct}% • No: {noPct}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AUTH REQUIRED MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-semibold">Log in to play</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-white/70 mb-4">
              You need a free STREAKr account to make picks, build your streak
              and appear on the leaderboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/auth?mode=login&returnTo=/picks"
                className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text:black font-semibold text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Login
              </Link>

              <Link
                href="/auth?mode=signup&returnTo=/picks"
                className="flex-1 inline-flex items-center justify-center rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-400 text-sm px-4 py-2 transition-colors"
                onClick={() => setShowAuthModal(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* COMMENT DRAWER */}
      {commentsOpenFor && (
        <div className="fixed inset-0 z-40 bg-black/60 flex justify-end">
          <div className="w-full max-w-md h-full bg-[#050816] p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  Comments – Q{commentsOpenFor.quarter}
                </h2>
                <p className="text-sm text-gray-300">
                  {commentsOpenFor.question}
                </p>
              </div>
              <button
                type="button"
                onClick={closeComments}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <textarea
                value={commentText}
                onChange={handleCommentChange}
                rows={3}
                className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Add your comment…"
              />
              {commentsError && (
                <p className="text-xs text-red-500 mt-1">{commentsError}</p>
              )}
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-1.5 rounded-md text-sm font-semibold bg-orange-500 disabled:bg-gray-600"
                >
                  {submittingComment ? "Posting…" : "Post"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border-t border-gray-800 pt-3">
              {commentsLoading ? (
                <p className="text-sm text-gray-400">Loading comments…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No comments yet. Be the first!
                </p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li
                      key={c.id}
                      className="bg-[#0b1220] rounded-md px-3 py-2 text-sm"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="font-semibold">
                          {c.displayName || "User"}
                        </span>
                        {c.createdAt && (
                          <span className="text-[11px] text-gray-400">
                            {c.createdAt}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-100">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
