"use client";

import {
  useEffect,
  useMemo,
  useState,
  MouseEvent,
  FormEvent,
} from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO
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
};

type PicksApiResponse = { games: ApiGame[] };

type ActiveOutcome = "yes" | "no" | null;

// Comments types
type CommentItem = {
  id: string;
  uid: string;
  displayName: string;
  body: string;
  createdAt: string;
};

type CommentQuestionMeta = {
  id: string;
  label: string;
  body: string;
};

const STATUS_TABS: { key: QuestionStatus | "all"; label: string }[] = [
  { key: "open", label: "OPEN" },
  { key: "final", label: "FINAL" },
  { key: "pending", label: "PENDING" },
  { key: "void", label: "VOID" },
  { key: "all", label: "ALL" },
];

function formatDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "shortOffset",
  });
}

export default function PicksClient() {
  const { user } = useAuth();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    QuestionStatus | "all"
  >("open");

  // Current round label (for now static – can be wired to admin config later)
  const [currentRoundLabel] = useState("Round 1");

  // Single active streak pick
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    null
  );
  const [activeOutcome, setActiveOutcome] = useState<ActiveOutcome>(null);

  // Login modal
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Comments drawer
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [commentQuestion, setCommentQuestion] =
    useState<CommentQuestionMeta | null>(null);

  // -------- Load questions from /api/picks --------
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("Failed to load picks");

        const data: PicksApiResponse = await res.json();

        const flat: QuestionRow[] = data.games.flatMap((g) =>
          g.questions.map((q) => ({
            id: q.id,
            gameId: g.id,
            match: g.match,
            venue: g.venue,
            startTime: g.startTime,
            quarter: q.quarter,
            question: q.question,
            status: q.status,
          }))
        );

        flat.sort(
          (a, b) =>
            new Date(a.startTime).getTime() -
            new Date(b.startTime).getTime()
        );

        setQuestions(flat);
      } catch (e) {
        console.error(e);
        setError("Failed to load questions. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // -------- Load user’s existing streak pick (if any) --------
  useEffect(() => {
    const loadUserPick = async () => {
      if (!user) {
        setActiveQuestionId(null);
        setActiveOutcome(null);
        return;
      }

      try {
        const res = await fetch("/api/user-picks", { method: "GET" });
        if (!res.ok) return; // no pick yet is fine

        const data = await res.json();
        if (data?.questionId && (data.outcome === "yes" || data.outcome === "no")) {
          setActiveQuestionId(data.questionId);
          setActiveOutcome(data.outcome);
        }
      } catch (err) {
        console.error("Failed to load user pick", err);
      }
    };

    loadUserPick();
  }, [user]);

  // -------- Filtered questions --------
  const filteredQuestions = useMemo(() => {
    if (statusFilter === "all") return questions;
    return questions.filter((q) => q.status === statusFilter);
  }, [questions, statusFilter]);

  // -------- Handle pick click (Yes / No) --------
  const handlePickClick = async (
    q: QuestionRow,
    outcome: "yes" | "no"
  ) => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }

    if (q.status !== "open") return;

    try {
      const res = await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          outcome,
        }),
      });

      if (!res.ok) {
        console.error("Failed to save pick", await res.text());
        return;
      }

      // Only one active question/outcome at a time
      setActiveQuestionId(q.id);
      setActiveOutcome(outcome);
    } catch (err) {
      console.error("Failed to save pick", err);
    }
  };

  // -------- Percents for display (per-user) --------
  function getDisplayPercents(row: QuestionRow) {
    if (!activeQuestionId || !activeOutcome || row.id !== activeQuestionId) {
      return { yes: 0, no: 0 };
    }
    if (activeOutcome === "yes") return { yes: 100, no: 0 };
    return { yes: 0, no: 100 };
  }

  // -------- Comments drawer logic --------
  const openComments = async (q: QuestionRow) => {
    setCommentQuestion({
      id: q.id,
      label: `Q${q.quarter}`,
      body: q.question,
    });
    setShowComments(true);
    setCommentBody("");
    setComments([]);
    setCommentsError("");

    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/comments/${encodeURIComponent(q.id)}`);
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
      setComments(data.items ?? []);
    } catch (err) {
      console.error(err);
      setCommentsError("Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentQuestion || !commentBody.trim()) return;

    if (!user) {
      setShowAuthPrompt(true);
      return;
    }

    try {
      setCommentPosting(true);
      setCommentsError("");

      const res = await fetch(
        `/api/comments/${encodeURIComponent(commentQuestion.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: commentBody.trim() }),
        }
      );

      if (!res.ok) throw new Error("Failed to post comment");

      const created = await res.json();

      setComments((prev) => [
        {
          id: created.id,
          uid: created.uid,
          displayName: created.displayName || "User",
          body: created.body,
          createdAt: created.createdAt,
        },
        ...prev,
      ]);

      setCommentBody("");
    } catch (err) {
      console.error(err);
      setCommentsError("Failed to post comment");
    } finally {
      setCommentPosting(false);
    }
  };

  const closeComments = () => {
    setShowComments(false);
    setCommentQuestion(null);
    setComments([]);
    setCommentsError("");
  };

  // -------- Render --------
  return (
    <div className="py-6 md:py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Picks</h1>
      </div>

      {/* Current round label */}
      <div className="text-sm text-center text-white/80">
        Current Round:{" "}
        <span className="font-semibold text-red-400">
          {currentRoundLabel}
        </span>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mt-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
              statusFilter === tab.key
                ? "bg-orange-500 text-black border-orange-400"
                : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Header row */}
      <div className="hidden md:grid md:grid-cols-[4.5rem,2.6fr,1.3fr] text-xs font-semibold text-white/70 px-1">
        <div>Q#</div>
        <div>QUESTION</div>
        <div className="text-right">PICK • YES% • NO%</div>
      </div>

      {/* Questions list */}
      {loading && (
        <p className="text-sm text-white/70 mt-4">Loading questions…</p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-400 mt-4">{error}</p>
      )}

      {!loading && !error && filteredQuestions.length === 0 && (
        <p className="text-sm text-white/70 mt-4">
          No questions found for this filter.
        </p>
      )}

      <div className="space-y-3 mt-2">
        {filteredQuestions.map((q) => {
          const isActive = q.id === activeQuestionId;
          const { yes, no } = getDisplayPercents(q);

          return (
            <div
              key={q.id}
              className="rounded-xl border border-[#111827] bg-[radial-gradient(circle_at_top_left,_#fb923c_0,_#f97316_35%,_#7c2d12_70%,_#020617_100%)] text-white shadow-md px-3 py-2"
            >
              <div className="grid grid-cols-[3.2rem,minmax(0,2.4fr),minmax(0,1.3fr)] items-center gap-2">
                {/* Q badge & time */}
                <div className="flex flex-col items-start gap-0.5">
                  <span className="inline-flex h-6 items-center justify-center rounded-full bg-black/40 px-2.5 text-[11px] font-semibold">
                    Q{q.quarter}
                  </span>
                  <span className="hidden md:block text-[10px] text-white/80 leading-tight">
                    {formatDateTime(q.startTime)}
                  </span>
                </div>

                {/* Question + comments + streak label */}
                <div className="flex flex-col leading-tight">
                  <p className="text-[13px] font-semibold line-clamp-2">
                    {q.question}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => openComments(q)}
                      className="text-[10px] text-white/85 underline underline-offset-2"
                    >
                      Comments (0)
                    </button>

                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/90 text-black px-2 py-0.5 text-[10px] font-semibold">
                        Your streak pick
                      </span>
                    )}
                  </div>
                </div>

                {/* Picks + percents */}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="inline-flex rounded-full bg-black/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => handlePickClick(q, "yes")}
                      className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition ${
                        isActive && activeOutcome === "yes"
                          ? "bg-sky-500 text-black"
                          : "bg-emerald-500/90 text-black hover:bg-emerald-400"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePickClick(q, "no")}
                      className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition ${
                        isActive && activeOutcome === "no"
                          ? "bg-sky-500 text-black"
                          : "bg-rose-500/90 text-black hover:bg-rose-400"
                      }`}
                    >
                      No
                    </button>
                  </div>

                  <div className="text-[10px] text-white/90">
                    Yes: {yes}% · No: {no}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- Login required modal ---------- */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-[#020617] border border-white/10 rounded-2xl px-6 py-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Log in to play</h2>
              <button
                className="text-white/60 hover:text-white text-sm"
                onClick={() => setShowAuthPrompt(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-white/80 mb-4">
              You need a free STREAKr account to make picks, build your streak
              and appear on the leaderboard.
            </p>
            <div className="flex gap-3">
              <a
                href="/auth?mode=login"
                className="flex-1 inline-flex justify-center rounded-full bg-amber-400 hover:bg-amber-300 text-black font-semibold text-sm px-4 py-2"
              >
                Login
              </a>
              <a
                href="/auth?mode=signup"
                className="flex-1 inline-flex justify-center rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-2 border border-white/15"
              >
                Sign up
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Comments drawer ---------- */}
      {showComments && commentQuestion && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
          <div className="w-full max-w-md bg-[#020617] h-full border-l border-white/10 flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Comments – {commentQuestion.label}
                </h2>
                <p className="text-xs text-white/80">
                  {commentQuestion.body}
                </p>
              </div>
              <button
                className="text-white/60 hover:text-white text-sm"
                onClick={closeComments}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="px-4 py-3 border-b border-white/10 space-y-2"
            >
              <textarea
                className="w-full bg-black/40 border border-white/15 rounded-md px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Add your comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              {commentsError && (
                <p className="text-xs text-red-400">{commentsError}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={commentPosting || !commentBody.trim()}
                  className="px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 text-black text-sm font-semibold disabled:opacity-60"
                >
                  {commentPosting ? "Posting…" : "Post"}
                </button>
              </div>
            </form>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
              {commentsLoading && (
                <p className="text-white/70 text-sm">
                  Loading comments…
                </p>
              )}
              {!commentsLoading && comments.length === 0 && (
                <p className="text-white/70 text-sm">
                  No comments yet. Be the first!
                </p>
              )}
              {!commentsLoading &&
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg bg-black/40 border border-white/10 px-3 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">
                        {c.displayName || "User"}
                      </span>
                      <span className="text-[10px] text-white/60">
                        {new Date(c.createdAt).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-white/90 whitespace-pre-wrap">
                      {c.body}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
