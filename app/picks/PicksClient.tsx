// /app/picks/page.tsx
"use client";

import {
  useEffect,
  useState,
  useMemo,
  useRef,
  ChangeEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import Confetti from "react-confetti";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  orderBy,
  limit,
  setDoc,
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
  correctPick?: boolean;
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
  isUnlockedForPicks?: boolean; // 👈 set from /api/picks using game-lock
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
  isUnlockedForPicks?: boolean;
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

type PickHistory = Record<string, "yes" | "no">;

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
  gws: { name: "GWS Giants", logo: "/afl-logos/gws.jpeg" },
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

// per-device history key
const PICK_HISTORY_KEY = "streakr_pick_history_v2";

const normaliseOutcome = (
  val: any
): "yes" | "no" | "void" | null => {
  if (val == null) return null;
  const s = String(val).toLowerCase();
  if (["yes", "y", "correct", "win"].includes(s)) return "yes";
  if (["no", "n", "wrong", "loss"].includes(s)) return "no";
  if (["void", "cancelled", "canceled"].includes(s)) return "void";
  return null;
};

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

  const [pickHistory, setPickHistory] = useState<PickHistory>({});
  const pickHistoryRef = useRef<PickHistory>({});
  useEffect(() => {
    pickHistoryRef.current = pickHistory;
  }, [pickHistory]);

  const [commentsOpenFor, setCommentsOpenFor] =
    useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);

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

  const [shareStatus, setShareStatus] = useState<string>("");

  const [showConfetti, setShowConfetti] = useState(false);
  const [streakLevelModal, setStreakLevelModal] = useState<
    3 | 5 | 10 | 15 | 20 | null
  >(null);
  const [lastCelebratedStreak, setLastCelebratedStreak] = useState(0);
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  const [unlockedBadges, setUnlockedBadges] = useState<
    Record<string, boolean>
  >({});

  const lastPercentsRef = useRef<
    Record<string, { yes?: number; no?: number }>
  >({});

  const rowsRef = useRef<QuestionRow[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // window size for confetti
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // ---------- FLATTEN + PERSIST MERGE ----------
  const flattenApi = (
    data: PicksApiResponse,
    prevRows: QuestionRow[],
    history: PickHistory
  ): QuestionRow[] =>
    data.games.flatMap((g: ApiGame) =>
      g.questions.map((q: ApiQuestion, index: number) => {
        const prev = prevRows.find((r) => r.id === q.id);
        const historyPick = history[q.id];

        const rawOutcome =
          normaliseOutcome(q.correctOutcome) ??
          normaliseOutcome(q.outcome);

        const correctOutcome: QuestionRow["correctOutcome"] =
          q.status === "final" || q.status === "void"
            ? rawOutcome
            : null;

        if (
          typeof q.yesPercent === "number" ||
          typeof q.noPercent === "number"
        ) {
          const prevPerc = lastPercentsRef.current[q.id] || {};
          lastPercentsRef.current[q.id] = {
            yes:
              typeof q.yesPercent === "number"
                ? q.yesPercent
                : prevPerc.yes,
            no:
              typeof q.noPercent === "number"
                ? q.noPercent
                : prevPerc.no,
          };
        }

        const remembered = lastPercentsRef.current[q.id] || {};

        return {
          id: q.id,
          gameId: g.id,
          match: g.match,
          venue: g.venue ?? q.venue ?? "",
          startTime: g.startTime ?? q.startTime ?? "",
          quarter: q.quarter,
          question: q.question,
          status: q.status,
          // 👇 this is the important merge for persistence
          userPick: q.userPick ?? historyPick ?? prev?.userPick,
          yesPercent:
            typeof q.yesPercent === "number"
              ? q.yesPercent
              : remembered.yes,
          noPercent:
            typeof q.noPercent === "number"
              ? q.noPercent
              : remembered.no,
          sport: q.sport ?? g.sport ?? "AFL",
          commentCount: q.commentCount ?? prev?.commentCount ?? 0,
          isSponsorQuestion: !!q.isSponsorQuestion,
          correctOutcome,
          isUnlockedForPicks: g.isUnlockedForPicks ?? prev?.isUnlockedForPicks,
        };
      })
    );

  const fetchPicks = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError("");
    }

    try {
      const res = await fetch("/api/picks");
      if (!res.ok) throw new Error("API error");

      const data: PicksApiResponse = await res.json();

      if (typeof data.roundNumber === "number") {
        setRoundNumber(data.roundNumber);
      }

      const flat = flattenApi(
        data,
        rowsRef.current,
        pickHistoryRef.current
      );

      setRows(flat);
      setFilteredRows(
        activeFilter === "all"
          ? flat
          : flat.filter((r) => r.status === activeFilter)
      );
    } catch (e) {
      console.error(e);
      if (!opts?.silent) setError("Failed to load picks");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  // ---------- LOAD LOCAL PICK HISTORY ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PICK_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setPickHistory(parsed);
      }
    } catch (err) {
      console.error("Failed to load pick history", err);
    }
  }, []);

  // ---------- INITIAL PICKS ----------
  useEffect(() => {
    fetchPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- AUTO REFRESH ----------
  useEffect(() => {
    const id = setInterval(() => {
      fetchPicks({ silent: true });
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questionIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // ---------- LIVE COMMENT COUNTS ----------
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

  // ---------- SWITCHING USER: CLEAR LOCAL DEVICE HISTORY ----------
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PICK_HISTORY_KEY);
    }
    setPickHistory({});
  }, [user]);

  // ---------- LOAD SERVER-SIDE HISTORY (CROSS DEVICE) ----------
  useEffect(() => {
    const loadServerPicks = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/user-picks", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          console.warn("user-picks GET not ok", await res.text());
          return;
        }

        const json = await res.json();
        const historyFromApi: PickHistory = {};

        if (Array.isArray(json?.picks)) {
          for (const p of json.picks) {
            const qid = p?.questionId;
            if (!qid) continue;
            const raw =
              typeof p.outcome === "string"
                ? p.outcome.toLowerCase()
                : "";
            const outcome =
              raw === "yes" || raw === "no"
                ? (raw as "yes" | "no")
                : null;
            if (!outcome) continue;
            historyFromApi[qid] = outcome;
          }
        }

        if (Object.keys(historyFromApi).length) {
          setPickHistory(() => {
            const merged: PickHistory = { ...historyFromApi };
            try {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(
                  PICK_HISTORY_KEY,
                  JSON.stringify(merged)
                );
              }
            } catch (err) {
              console.error("Failed to persist merged pick history", err);
            }
            return merged;
          });
        }

        if (rowsRef.current.length) {
          fetchPicks({ silent: true });
        }
      } catch (err) {
        console.error("Failed to load picks from API", err);
      }
    };

    loadServerPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- STREAK LISTENERS (leader + user) ----------
  useEffect(() => {
    setStreakLoading(true);
    setStreakError("");

    const usersRef = collection(db, "users");
    const topQ = query(usersRef, orderBy("longestStreak", "desc"), limit(1));

    const unsub = onSnapshot(
      topQ,
      (snapshot) => {
        let leaderVal: number | null = null;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const val =
            typeof data.longestStreak === "number"
              ? data.longestStreak
              : 0;
          leaderVal = val;
        });
        setLeaderLongestStreak(leaderVal);
        setStreakLoading(false);
      },
      (err) => {
        console.error("Leader streak listener error", err);
        setStreakError("Could not load streak tracker.");
        setStreakLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserCurrentStreak(null);
      setUserLongestStreak(null);
      setUnlockedBadges({});
      return;
    }

    setStreakLoading(true);
    setStreakError("");

    const userRef = doc(db, "users", user.uid);

    const unsub = onSnapshot(
      userRef,
      (userSnap) => {
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          const current =
            typeof data.currentStreak === "number"
              ? data.currentStreak
              : 0;
          const longest =
            typeof data.longestStreak === "number"
              ? data.longestStreak
              : 0;
          const badges =
            data.streakBadges && typeof data.streakBadges === "object"
              ? (data.streakBadges as Record<string, boolean>)
              : {};

          setUserCurrentStreak(current);
          setUserLongestStreak(longest);
          setUnlockedBadges(badges);
        } else {
          setUserCurrentStreak(0);
          setUserLongestStreak(0);
          setUnlockedBadges({});
        }
        setStreakLoading(false);
      },
      (err) => {
        console.error("User streak listener error", err);
        setStreakError("Could not load streak tracker.");
        setStreakLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // ---------- STREAK CELEBRATIONS ----------
  useEffect(() => {
    if (!userCurrentStreak || userCurrentStreak <= lastCelebratedStreak)
      return;

    const milestones: Array<3 | 5 | 10 | 15 | 20> = [
      3, 5, 10, 15, 20,
    ];
    const hit = milestones.find((m) => userCurrentStreak === m);
    if (!hit) return;

    let timer: any;

    const run = async () => {
      const key = String(hit);
      const alreadyUnlocked = !!unlockedBadges[key];

      setLastCelebratedStreak(userCurrentStreak);
      setShowConfetti(true);

      if (!alreadyUnlocked && user) {
        setStreakLevelModal(hit);
        try {
          const userRef = doc(db, "users", user.uid);
          await setDoc(
            userRef,
            {
              streakBadges: {
                ...(unlockedBadges || {}),
                [key]: true,
              },
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to persist streak badge", err);
        }
      }

      timer = setTimeout(() => setShowConfetti(false), 5000);
    };

    run();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [userCurrentStreak, lastCelebratedStreak, unlockedBadges, user]);

  // ---------- FILTER ----------
  const applyFilter = (f: QuestionStatus | "all") => {
    setActiveFilter(f);
    if (f === "all") setFilteredRows(rows);
    else setFilteredRows(rows.filter((r) => r.status === f));
  };

  const getDisplayPercents = (row: QuestionRow) => {
    const serverYes =
      typeof row.yesPercent === "number" ? row.yesPercent : undefined;
    const serverNo =
      typeof row.noPercent === "number" ? row.noPercent : undefined;

    if (serverYes !== undefined || serverNo !== undefined) {
      return { yes: serverYes ?? 0, no: serverNo ?? 0 };
    }

    const remembered = lastPercentsRef.current[row.id];
    if (
      remembered &&
      (remembered.yes !== undefined || remembered.no !== undefined)
    ) {
      return { yes: remembered.yes ?? 0, no: remembered.no ?? 0 };
    }

    return { yes: 0, no: 0 };
  };

  // ---------- HANDLE PICK (PERSIST!) ----------
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const isMatchLocked = row.isUnlockedForPicks === false;
    if (row.status !== "open" || isMatchLocked) return;

    // update local rows
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
    );
    setFilteredRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
    );

    // persist in device history
    setPickHistory((prev) => {
      const next: PickHistory = { ...prev, [row.id]: pick };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            PICK_HISTORY_KEY,
            JSON.stringify(next)
          );
        }
      } catch (err) {
        console.error("Failed to persist pick history", err);
      }
      return next;
    });

    // persist in backend (for cross-device + streak calc)
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

  // ---------- COMMENTS ----------
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

  // ---------- STREAK PROGRESS UI ----------
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

    setTimeout(() => setShareStatus(""), 3000);
  };

  const getStreakModalContent = () => {
    if (!streakLevelModal) return null;

    switch (streakLevelModal) {
      case 3:
        return {
          title: "3 in a row!",
          subtitle: "Keep building 😎",
          body: "Nice start. You’re building momentum – keep your head and stack that streak.",
        };
      case 5:
        return {
          title: "Bang! 5 straight!",
          subtitle: "You’re on the money 🔥",
          body: "That’s a serious run. Lock in, stay sharp and push for double digits.",
        };
      case 10:
        return {
          title: "Streak Level 10",
          subtitle: "That’s elite 💪🏻",
          body: "Ten straight is no joke. You’ve earned your first STREAKr badge – make sure your mates know about it.",
        };
      case 15:
        return {
          title: "15 in a row",
          subtitle: "Dominance level unlocked 💪🏻",
          body: "This run is getting ridiculous. You’re in rare air now – every pick is appointment viewing.",
        };
      case 20:
        return {
          title: "20 straight",
          subtitle: "What are we witnessing? GOAT 🏆",
          body: "Twenty in a row is all-time. You’ve unlocked legendary STREAKr status – screenshotted or it didn’t happen.",
        };
      default:
        return null;
    }
  };

  const streakModalContent = getStreakModalContent();

  // ---------- RENDER ----------
  return (
    <>
      {showConfetti && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={350}
          recycle={false}
        />
      )}

      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 min-h-screen bg-black text-white">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold">Picks</h1>
          {roundNumber !== null && (
            <p className="text-sm text-white/70">
              Current Round:{" "}
              <span className="font-semibold text-orange-400">
                {roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`}
              </span>
            </p>
          )}
        </div>

        {/* STREAK PROGRESS TRACKER */}
        <div className="mb-6 rounded-2xl bg-[#020617] border border-sky-500/30 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">
                Streak progress
              </p>
              <p className="text-xs sm:text-sm text-white/80 max-w-md">
                Make as many picks as you like on any{" "}
                <span className="font-semibold text-emerald-300">
                  open match
                </span>
                . Every correct pick this game stacks your streak – one wrong
                and you reset for the next game.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[11px] text-white/60">Current</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-orange-400 drop-shadow-[0_0_16px_rgba(248,113,22,0.8)]">
                    {user ? userCurrentStreak ?? 0 : "-"}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div className="text-right">
                  <p className="text-[11px] text-white/60">Best</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-300">
                    {user ? userLongestStreak ?? 0 : "-"}
                  </p>
                </div>
                <div className="h-10 w-px bg-white/10" />
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

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] text-white/70 mb-1">
                <span>Current streak</span>
                <span className="font-semibold text-orange-300">
                  {user ? userCurrentStreak ?? 0 : 0}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden">
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

        {hasSponsorQuestion && (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border border-amber-500/40 px-4 py-3 text-xs sm:text-sm text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="uppercase tracking-wide text-[11px] font-semibold text-amber-300">
              Sponsor Question
            </span>
            <span className="text-[12px] sm:text-[13px]">
              Look for the{" "}
              <span className="font-semibold">Sponsor Question</span> tag. Get
              it right to go into the draw for this round&apos;s $100 sponsor
              gift card.*
            </span>
          </div>
        )}

        {error && <p className="text-red-500 mb-2">{error}</p>}

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

        <div className="space-y-2">
          {filteredRows.map((row) => {
            const { date, time } = formatStartDate(row.startTime);
            const { yes: yesPct, no: noPct } = getDisplayPercents(row);

            const isMatchLocked = row.isUnlockedForPicks === false;
            const isLocked = row.status !== "open" || isMatchLocked;
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

            type OutcomeKind =
              | "win"
              | "loss"
              | "void"
              | "settled-no-result"
              | null;

            const outcome = normaliseOutcome(
              (row.correctOutcome as any) ?? (row as any).outcome
            );

            let outcomeKind: OutcomeKind = null;

            if (row.status === "void" || outcome === "void") {
              outcomeKind = "void";
            } else if (row.status === "final") {
              if (outcome && row.userPick) {
                outcomeKind =
                  row.userPick === outcome ? "win" : "loss";
              } else {
                outcomeKind = "settled-no-result";
              }
            }

            let outcomeLabel: string | null = null;
            if (outcomeKind === "void") {
              outcomeLabel = "Question voided – no streak change";
            } else if (outcomeKind === "win") {
              outcomeLabel = "You were right!";
            } else if (outcomeKind === "loss") {
              outcomeLabel = "Wrong pick";
            } else if (outcomeKind === "settled-no-result") {
              outcomeLabel = "Finalised";
            }

            const outcomeClasses =
              outcomeKind === "void"
                ? "bg-slate-700/60 border-slate-400/40 text-slate-100"
                : outcomeKind === "win"
                ? "bg-emerald-500/15 border-emerald-400/60 text-emerald-300"
                : outcomeKind === "loss"
                ? "bg-red-500/15 border-red-400/60 text-red-300"
                : "bg-slate-700/60 border-slate-500/60 text-slate-100";

            const isYesPicked = row.userPick === "yes";
            const isNoPicked = row.userPick === "no";

            const yesButtonClasses = [
              "px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition border",
              `bg-green-600 hover:bg-green-700 ${
                isYesPicked ? "border-white shadow-[0_0_12px_rgba(34,197,94,0.7)]" : "border-transparent"
              }`,
              isLocked
                ? "opacity-40 cursor-not-allowed hover:bg-green-600 shadow-none"
                : "",
            ].join(" ");

            const noButtonClasses = [
              "px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition border",
              `bg-red-600 hover:bg-red-700 ${
                isNoPicked ? "border-white shadow-[0_0_12px_rgba(248,113,113,0.7)]" : "border-transparent"
              }`,
              isLocked
                ? "opacity-40 cursor-not-allowed hover:bg-red-600 shadow-none"
                : "",
            ].join(" ");

            return (
              <div
                key={row.id}
                className="rounded-lg bg-gradient-to-r from-[#1E293B] via-[#111827] to-[#020617] border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
              >
                <div className="grid grid-cols-12 items-center px-4 py-1.5 gap-y-2 md:gap-y-0 text-white">
                  <div className="col-span-12 md:col-span-2">
                    <div className="text-sm font-semibold">{date}</div>
                    <div className="text-[11px] text-white/80">
                      {time} AEDT
                    </div>
                  </div>

                  <div className="col-span-6 md:col-span-1 flex items-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/40 text-[11px] font-semibold uppercase tracking-wide">
                      {row.sport}
                    </span>
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <span
                      className={`${statusClasses(
                        row.status
                      )} text-[10px] px-2 py-0.5 rounded-full font-bold`}
                    >
                      {row.status.toUpperCase()}
                    </span>
                  </div>

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

                    {isMatchLocked && (
                      <div className="mt-1 inline-flex items-center rounded-full bg-slate-900/80 border border-slate-500/70 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                        Match locked for picks
                      </div>
                    )}
                  </div>

                  <div className="col-span-3 md:col-span-1 text-sm font-bold md:text-center">
                    <span className="block md:hidden">
                      Quarter {row.quarter}
                    </span>
                    <span className="hidden md:inline">
                      Quarter {row.quarter}
                    </span>
                  </div>

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

                  <div className="col-span-12 md:col-span-2 flex flex-col items-end">
                    <div className="flex gap-2 mb-0.5">
                      <button
                        type="button"
                        onClick={() => handlePick(row, "yes")}
                        disabled={isLocked}
                        className={yesButtonClasses}
                      >
                        Yes
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePick(row, "no")}
                        disabled={isLocked}
                        className={noButtonClasses}
                      >
                        No
                      </button>
                    </div>

                    {outcomeLabel && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${outcomeClasses}`}
                        >
                          {outcomeLabel}
                        </span>
                      </div>
                    )}

                    <div className="text-[11px] text-white/85">
                      Yes: {Math.round(yesPct ?? 0)}% • No:{" "}
                      {Math.round(noPct ?? 0)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AUTH MODAL */}
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
                  className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
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
                  <p className="text-xs text-red-500 mt-1">
                    {commentsError}
                  </p>
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
                  <p className="text-sm text-gray-400">
                    Loading comments…
                  </p>
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

        {/* STREAK LEVEL MODAL */}
        {streakLevelModal && streakModalContent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-md rounded-3xl bg-[#020617] border border-orange-500/60 shadow-[0_0_80px_rgba(248,113,22,0.85)] px-6 py-6 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-orange-400/30 shadow-[0_0_40px_rgba(248,113,22,0.65)]" />

              <div className="relative mx-auto mb-4 mt-2 w-40 h-56 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(15,23,42,0.9)]">
                <div className="absolute inset-x-4 top-4 text-center text-[11px] font-bold uppercase tracking-wide text-slate-200">
                  Streak Level
                </div>
                <div className="mt-4 text-5xl font-extrabold text-orange-400 drop-shadow-[0_0_18px_rgba(248,113,22,0.9)]">
                  {streakLevelModal}
                </div>
                <div className="mt-3 h-10 w-10 rounded-full bg-gradient-to-tr from-orange-500 via-yellow-400 to-amber-500 flex items-center justify-center text-2xl">
                  🏉
                </div>
                <div className="mt-3 px-3 py-1 rounded-full bg-black/40 text-[11px] font-semibold tracking-wide text-slate-100">
                  STREAKr Badge
                </div>
              </div>

              <h2 className="relative text-xl font-extrabold text-white text-center">
                {streakModalContent.title}
              </h2>
              <p className="relative mt-1 text-sm text-orange-200 text-center">
                {streakModalContent.subtitle}
              </p>
              <p className="relative mt-3 text-sm text-slate-100 text-center">
                {streakModalContent.body}
              </p>

              <div className="relative mt-5 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setStreakLevelModal(null)}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400"
                >
                  Keep playing
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white hover:border-orange-400 hover:text-orange-300"
                >
                  Share this streak
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
