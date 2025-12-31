// /app/picks/[matchSlug]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Confetti from "react-confetti";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
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

type CommentRow = {
  id: string;
  questionId: string;
  userId?: string | null;
  displayName?: string | null;
  body: string;
  createdAt?: any;
};

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  white: "rgba(255,255,255,0.98)",
};

type FilterTab = "all" | "open" | "pending" | "final" | "void";

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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

function clampPct(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function effectivePick(local: LocalPick | undefined, api: PickOutcome | undefined): PickOutcome | undefined {
  if (local === "none") return undefined;
  if (local === "yes" || local === "no") return local;
  return api;
}

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `torpie:picks:v10:${uid || "anon"}:${roundNumber ?? "na"}`;
}
function safeLockedKey(uid: string | null, roundNumber: number | null) {
  return `torpie:lockedPicks:v2:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function splitMatch(match: string): { home: string; away: string } | null {
  const m = (match || "").split(/\s+vs\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
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
  ];
}

const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 50,
}: {
  teamName: string;
  size?: number;
}) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  if (!slug || dead) {
    const initials = (teamName || "AFL")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("");
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.75)",
        }}
        title={teamName}
      >
        {initials || "AFL"}
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
        borderColor: "rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
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

/** Player detection: "Will Charlie Curnow (Syd) ..." */
function extractPlayerName(qText: string): string | null {
  const t = (qText || "").trim();
  if (!t.toLowerCase().startsWith("will ")) return null;

  const rest = t.slice(5);
  const parenIdx = rest.indexOf("(");
  const candidate = (parenIdx > 0 ? rest.slice(0, parenIdx) : rest).trim();

  const name = candidate.trim();
  if (!name) return null;
  if (name.split(" ").filter(Boolean).length < 2) return null;
  return name;
}

function playerCandidates(playerSlug: string): string[] {
  return [
    `/players/${playerSlug}.jpg`,
    `/players/${playerSlug}.jpeg`,
    `/players/${playerSlug}.png`,
    `/players/${playerSlug}.webp`,
  ];
}

const PlayerHeadshot = React.memo(function PlayerHeadshotInner({
  playerName,
  size = 46,
}: {
  playerName: string;
  size?: number;
}) {
  const playerSlug = slugify(playerName);
  const candidates = playerCandidates(playerSlug);

  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const initials = playerName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black shrink-0"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(0,0,0,0.10)",
          background: "rgba(0,0,0,0.04)",
          color: "rgba(0,0,0,0.35)",
        }}
        title={playerName}
      >
        {initials}
      </div>
    );
  }

  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <div
      className="relative rounded-2xl border overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        borderColor: "rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.04)",
      }}
      title={playerName}
    >
      <Image
        src={src}
        alt={playerName}
        fill
        sizes={`${size}px`}
        style={{ objectFit: "cover" }}
        onError={() => {
          setIdx((p) => {
            if (p + 1 < candidates.length) return p + 1;
            setDead(true); // ✅ stop re-trying every second
            return p;
          });
        }}
      />
    </div>
  );
});

type LocalPickMap = Record<string, LocalPick>;
type LockedGamesMap = Record<string, boolean>;

export default function PicksMatchSlugPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ matchSlug: string }>();
  const matchSlug = (params?.matchSlug || "").toString();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [localPicks, setLocalPicks] = useState<LocalPickMap>({});
  const hasHydratedLocalRef = useRef(false);

  const [lockedGames, setLockedGames] = useState<LockedGamesMap>({});
  const hasHydratedLockedRef = useRef(false);

  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // comments
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsQuestion, setCommentsQuestion] = useState<ApiQuestion | null>(null);
  const [commentsGame, setCommentsGame] = useState<ApiGame | null>(null);
  const [commentsList, setCommentsList] = useState<CommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentErr, setCommentErr] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const commentsUnsubRef = useRef<null | (() => void)>(null);

  const [confettiOn] = useState(false);

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

      const res = await fetch("/api/picks", { headers: authHeader, cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;
      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      console.error(e);
      setErr("Could not load this match right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const activeGame = useMemo(() => {
    return games.find((x) => slugify(x.match) === matchSlug) ?? null;
  }, [games, matchSlug]);

  // hydrate local picks
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
    } catch {
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

  // hydrate locked games
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
    } catch {
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

  const filteredQuestions = useMemo(() => {
    if (!activeGame) return [];
    if (filterTab === "all") return activeGame.questions.slice();
    return activeGame.questions.filter((q) => q.status === filterTab);
  }, [activeGame, filterTab]);

  function isQuestionLocked(q: ApiQuestion, gameLocked: boolean) {
    if (q.status === "final") return true;
    if (q.status === "void") return true;
    if (q.status === "pending") return true;
    if (gameLocked) return true;
    return false;
  }

  const clearPick = useCallback(async (q: ApiQuestion) => {
    setLocalPicks((prev) => ({ ...prev, [q.id]: "none" }));
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const delRes = await fetch(`/api/user-picks?questionId=${encodeURIComponent(q.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (delRes.ok) return;

      await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "clear", questionId: q.id }),
      });
    } catch (e) {
      console.error("Clear pick error", e);
    }
  }, [user]);

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
        await fetch("/api/user-picks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            questionId: q.id,
            outcome,
            roundNumber: typeof roundNumber === "number" ? roundNumber : null,
            gameId: q.gameId ?? activeGame?.id ?? null,
          }),
        });
      } catch (e) {
        console.error("Pick save error", e);
      }
    },
    [user, roundNumber, localPicks, clearPick, activeGame?.id]
  );

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
      try { commentsUnsubRef.current(); } catch {}
      commentsUnsubRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!commentsOpen || !commentsQuestion) return;

    setCommentsLoading(true);
    setCommentErr("");

    if (commentsUnsubRef.current) {
      try { commentsUnsubRef.current(); } catch {}
      commentsUnsubRef.current = null;
    }

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
            return {
              id: d.id,
              questionId: data?.questionId ?? commentsQuestion.id,
              userId: data?.userId ?? null,
              displayName: data?.displayName ?? null,
              body: typeof data?.body === "string" ? data.body : "",
              createdAt: data?.createdAt,
            };
          })
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

        setCommentsList(rows);
        setCommentsLoading(false);
      },
      () => {
        setCommentErr("Could not load comments.");
        setCommentsLoading(false);
      }
    );

    return () => {
      if (commentsUnsubRef.current) {
        try { commentsUnsubRef.current(); } catch {}
        commentsUnsubRef.current = null;
      }
    };
  }, [commentsOpen, commentsQuestion]);

  const postComment = useCallback(async () => {
    setCommentErr("");

    const q = commentsQuestion;
    if (!q) return;

    const txt = commentText.trim();
    if (!txt) { setCommentErr("Write something first."); return; }
    if (!user) { setCommentErr("Log in to comment."); return; }
    if (txt.length > 240) { setCommentErr("Keep it under 240 characters."); return; }

    setCommentPosting(true);
    try {
      await addDoc(collection(db, "comments"), {
        questionId: q.id,
        gameId: q.gameId ?? commentsGame?.id ?? null,
        roundNumber: typeof roundNumber === "number" ? roundNumber : null,
        userId: user.uid,
        displayName: user.displayName ?? null,
        body: txt,
        createdAt: serverTimestamp(),
      });
      setCommentText("");
    } catch {
      setCommentErr("Could not post comment.");
    } finally {
      setCommentPosting(false);
    }
  }, [commentText, commentsQuestion, commentsGame, user, roundNumber]);

  const renderSentimentWhite = (q: ApiQuestion) => {
    const yes = clampPct(q.yesPercent);
    const no = clampPct(q.noPercent);
    const total = yes + no;
    const yesW = total <= 0 ? 50 : (yes / total) * 100;

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const aligned = pick === "yes" ? yes >= no : pick === "no" ? no > yes : null;

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.55)" }}>
            Crowd
          </span>
          <span
            className="font-black"
            style={{ color: yes === no ? "rgba(0,0,0,0.55)" : yes > no ? "rgba(25,195,125,0.95)" : "rgba(255,46,77,0.95)" }}
          >
            {yes === no ? "Split crowd" : yes > no ? "Majority YES" : "Majority NO"}
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
                width: `${100 - yesW}%`,
                background: `linear-gradient(90deg, rgba(255,46,77,0.20), rgba(255,46,77,0.85))`,
              }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "rgba(0,0,0,0.60)" }}>
          <span>
            YES <span className="font-black" style={{ color: "rgba(0,0,0,0.85)" }}>{Math.round(yes)}%</span>
          </span>

          {aligned === null ? (
            <span style={{ color: "rgba(0,0,0,0.35)" }}>Pick to compare</span>
          ) : aligned ? (
            <span style={{ color: "rgba(25,195,125,0.95)" }} className="font-black">With crowd</span>
          ) : (
            <span style={{ color: COLORS.red }} className="font-black">Against crowd</span>
          )}

          <span>
            NO <span className="font-black" style={{ color: "rgba(0,0,0,0.85)" }}>{Math.round(no)}%</span>
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

  const VisualHeader = ({ g, q }: { g: ApiGame; q: ApiQuestion }) => {
    const playerName = extractPlayerName(q.question);

    if (playerName) {
      return (
        <div className="flex items-center gap-3">
          <PlayerHeadshot playerName={playerName} size={46} />
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
        </div>
      );
    }

    const m = splitMatch(g.match);
    const home = m?.home ?? g.match;
    const away = m?.away ?? "AFL";

    return (
      <div className="flex items-center gap-3">
        <TeamLogo teamName={home} size={46} />
        <div className="text-[12px] font-black" style={{ color: "rgba(0,0,0,0.45)" }}>
          vs
        </div>
        <TeamLogo teamName={away} size={46} />

        <div className="min-w-0 flex-1">
          <div className="text-[12px] uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.45)" }}>
            {g.match}
          </div>
          <div className="mt-0.5 text-[11px] truncate" style={{ color: "rgba(0,0,0,0.55)" }}>
            {g.venue} • {formatAedt(g.startTime)}
          </div>
        </div>
      </div>
    );
  };

  const WhitePickCard = ({ g, q, gameLocked }: { g: ApiGame; q: ApiQuestion; gameLocked: boolean }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const locked = isQuestionLocked(q, gameLocked);

    const pick = effectivePick(localPicks[q.id], q.userPick);
    const hasPick = pick === "yes" || pick === "no";

    return (
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.98)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: "rgba(0,0,0,0.55)" }}>
              Q{q.quarter}
            </span>

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
                disabled={!hasPick || locked}
                aria-label="Clear selection"
                title={locked ? "Locked" : "Clear"}
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

          <div className="mt-3">
            <VisualHeader g={g} q={q} />
          </div>

          <div className="mt-3 text-[13px] font-semibold leading-snug" style={{ color: "rgba(0,0,0,0.92)" }}>
            {q.question}
          </div>

          <div>{renderSentimentWhite(q)}</div>
          {renderPickButtonsWhite(q, locked)}

          {locked ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0.06))" }}
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

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const stickyMeta = useMemo(() => {
    if (!activeGame) return { selected: 0, total: 0, gameLocked: false, lockMs: 0 };
    const lockMs = new Date(activeGame.startTime).getTime() - nowMs;
    const gameLocked = lockMs <= 0;

    const selected = activeGame.questions.reduce((acc, q) => {
      const p = effectivePick(localPicks[q.id], q.userPick);
      return acc + (p === "yes" || p === "no" ? 1 : 0);
    }, 0);

    return { selected, total: activeGame.questions.length, gameLocked, lockMs };
  }, [activeGame, nowMs, localPicks]);

  if (loading) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-white/70">Loading match…</div>
        </div>
      </div>
    );
  }

  if (err || !activeGame) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-white/80 font-black text-[18px]">Couldn’t find that match.</div>
          <div className="mt-2 text-white/60">{err || "It may not exist yet."}</div>
          <div className="mt-4">
            <Link
              href="/picks"
              className="inline-flex items-center rounded-full border px-4 py-2 text-[12px] font-black"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
            >
              ← Back to Picks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const m = splitMatch(activeGame.match);
  const home = m?.home ?? activeGame.match;
  const away = m?.away ?? "AFL";

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {confettiOn ? <Confetti recycle={false} numberOfPieces={220} gravity={0.22} /> : null}

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => router.push("/picks")}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.90)",
              }}
            >
              ← Back
            </button>

            <div className="mt-4 flex items-center gap-3">
              <TeamLogo teamName={home} size={50} />
              <div className="text-white/60 font-black">vs</div>
              <TeamLogo teamName={away} size={50} />

              {roundLabel ? (
                <span
                  className="ml-2 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,46,77,0.35)",
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-3 text-[22px] sm:text-[26px] font-black truncate" style={{ color: COLORS.white }}>
              {activeGame.match}
            </div>
            <div className="mt-1 text-[12px] text-white/70 truncate">
              {activeGame.venue} • {formatAedt(activeGame.startTime)}
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
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuestions.map((q) => {
            const lockMs = new Date(activeGame.startTime).getTime() - nowMs;
            const gameLocked = lockMs <= 0;
            return <WhitePickCard key={q.id} g={activeGame} q={q} gameLocked={gameLocked} />;
          })}
        </div>

        <div
          className="fixed left-0 right-0 bottom-0 z-[60]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.00), rgba(0,0,0,0.92) 35%, rgba(0,0,0,0.98) 100%)",
          }}
        >
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-4 pt-10">
            <div
              className="rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                boxShadow: "0 18px 55px rgba(0,0,0,0.85)",
              }}
            >
              <div className="text-white/85">
                <div className="text-[11px] uppercase tracking-widest text-white/55">Picks Selected</div>
                <div className="mt-1 text-[16px] font-black">
                  {stickyMeta.selected} of {stickyMeta.total}
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  {stickyMeta.gameLocked ? "LIVE / Locked" : `Locks in ${msToCountdown(stickyMeta.lockMs)}`}
                </div>
              </div>

              <button
                type="button"
                disabled={stickyMeta.selected <= 0 || stickyMeta.gameLocked || !!lockedGames[activeGame.id]}
                className="rounded-2xl border px-6 py-4 text-[13px] font-black disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "rgba(255,46,77,0.55)",
                  background: "rgba(255,46,77,0.18)",
                  color: "rgba(255,255,255,0.95)",
                  boxShadow: "0 10px 30px rgba(255,46,77,0.18)",
                }}
              >
                LOCK IN PICKS
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 pb-8 text-center text-[11px] text-white/45">
          <span className="font-black" style={{ color: COLORS.red }}>
            Torpie
          </span>{" "}
          — One slip and it’s back to zero.
        </div>
      </div>
    </div>
  );
}
