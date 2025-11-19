"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO
  questions: ApiQuestion[];
};

type PicksApiResponse = { games: ApiGame[] };

type QuestionRow = {
  id: string;
  gameId: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  yesPercent: number;
  noPercent: number;
  commentCount: number;
};

type Comment = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

/** Small helper to format the match start time */
function formatDateTime(iso: string) {
  if (!iso) return { dateLabel: "", timeLabel: "" };
  const d = new Date(iso);
  const dateLabel = d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { dateLabel, timeLabel };
}

/** Modal used when a non-logged in user tries to pick */
function LoginRequiredModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/15 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Log in to play</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-white/70 mb-4">
          You need a free STREAKr account to make picks, build your streak and
          appear on the leaderboard.
        </p>
        <div className="flex gap-3">
          <a
            href="/auth?mode=login"
            className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm py-2"
          >
            Login
          </a>
          <a
            href="/auth?mode=signup"
            className="flex-1 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm py-2 border border-white/20"
          >
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}

/** Slide-over comments panel */
function CommentsDrawer({
  open,
  onClose,
  question,
}: {
  open: boolean;
  onClose: () => void;
  question: QuestionRow | null;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open || !question) return;

    const load = async () => {
      setLoading(true);
      setLoadingError("");
      try {
        const res = await fetch(`/api/comments/${encodeURIComponent(
          question.id
        )}`);
        if (!res.ok) throw new Error("Failed to load comments");
        const data: Comment[] = await res.json();
        setComments(data);
      } catch (err) {
        console.error(err);
        setLoadingError("Failed to load comments");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, question?.id]);

  const handlePost = async () => {
    if (!question || !body.trim()) return;
    if (!user) {
      setPostError("You must be logged in to comment.");
      return;
    }

    setPosting(true);
    setPostError("");

    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(
        question.id
      )}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });

      if (!res.ok) throw new Error("Failed to post comment");
      const created: Comment = await res.json();
      setComments((prev) => [created, ...prev]);
      setBody("");
    } catch (err) {
      console.error(err);
      setPostError("Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  if (!open || !question) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <div className="w-full max-w-md h-full bg-[#020617] border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold">
              Comments – Q{question.quarter}
            </h2>
            <p className="text-xs text-white/70 line-clamp-1">
              {question.question}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <textarea
              className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder={
                user
                  ? "Add your comment…"
                  : "Log in or sign up to add a comment."
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={!user || posting}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              {postError && (
                <p className="text-xs text-red-400">{postError}</p>
              )}
              <button
                type="button"
                onClick={handlePost}
                disabled={!user || posting || !body.trim()}
                className="ml-auto inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-xs px-4 py-1.5 disabled:opacity-60"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            {loading && (
              <p className="text-xs text-white/70">Loading comments…</p>
            )}
            {loadingError && (
              <p className="text-xs text-red-400">{loadingError}</p>
            )}
            {!loading && !loadingError && comments.length === 0 && (
              <p className="text-xs text-white/70">
                No comments yet. Be the first!
              </p>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-lg bg-black/30 border border-white/10 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold">{c.author}</span>
                  <span className="text-[10px] text-white/50">
                    {new Date(c.createdAt).toLocaleString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-white/80 break-words">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PicksClient() {
  const { user } = useAuth();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Single active streak pick per round
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeOutcome, setActiveOutcome] = useState<"yes" | "no" | null>(null);

  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsQuestion, setCommentsQuestion] = useState<QuestionRow | null>(
    null
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
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
            yesPercent:
              typeof q.yesPercent === "number" ? q.yesPercent : 0,
            noPercent: typeof q.noPercent === "number" ? q.noPercent : 0,
            commentCount:
              typeof q.commentCount === "number" ? q.commentCount : 0,
          }))
        );

        // sort by start time then quarter
        flat.sort((a, b) => {
          const da = new Date(a.startTime).getTime();
          const db = new Date(b.startTime).getTime();
          if (da !== db) return da - db;
          return a.quarter - b.quarter;
        });

        setQuestions(flat);
      } catch (err) {
        console.error(err);
        setError("Failed to load picks. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredQuestions = questions.filter((q) =>
    statusFilter === "all" ? true : q.status === statusFilter
  );

  const handlePickClick = async (
    question: QuestionRow,
    outcome: "yes" | "no"
  ) => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    if (question.status !== "open") return;

    // Update local streak pick selection:
    //  – Only this question keeps a 100/0 split.
    //  – All others reset to 0/0.
    setActiveQuestionId(question.id);
    setActiveOutcome(outcome);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === question.id) {
          return {
            ...q,
            yesPercent: outcome === "yes" ? 100 : 0,
            noPercent: outcome === "no" ? 100 : 0,
          };
        }
        return { ...q, yesPercent: 0, noPercent: 0 };
      })
    );

    // Persist to backend (streak logic etc.)
    try {
      await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          outcome,
        }),
      });
    } catch (err) {
      console.error("Failed to save pick", err);
      // (Optional) show toast/error – for now we just log
    }
  };

  const openComments = (question: QuestionRow) => {
    setCommentsQuestion(question);
    setCommentsOpen(true);
  };

  return (
    <div className="py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Picks</h1>
          <p className="mt-1 text-sm text-white/70 max-w-2xl">
            One streak, one question at a time. Lock in your pick before the
            quarter starts. Correct = streak goes up. Wrong = back to zero.
          </p>
        </div>

        {/* Status filter buttons */}
        <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1 text-xs">
          {(["open", "final", "pending", "void", "all"] as const).map((key) => {
            const labels: Record<typeof key, string> = {
              open: "OPEN",
              final: "FINAL",
              pending: "PENDING",
              void: "VOID",
              all: "ALL",
            };
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setStatusFilter(
                    key === "all" ? "all" : (key as QuestionStatus)
                  )
                }
                className={`px-3 py-1 rounded-full font-semibold ${
                  active
                    ? "bg-orange-500 text-black"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current round label */}
      <div className="text-sm text-white/80">
        AFL Season 2026 •{" "}
        <span className="text-white/60">Current Round:</span>{" "}
        <span className="font-semibold text-orange-400">Round 1</span>
      </div>

      {/* Error / loading */}
      {loading && (
        <p className="text-sm text-white/70">Loading questions…</p>
      )}
      {error && !loading && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Table header */}
      {!loading && !error && filteredQuestions.length > 0 && (
        <div className="hidden md:grid grid-cols-[5rem,1.8fr,7rem,auto] text-xs text-white/60 px-2">
          <div>Q#</div>
          <div>QUESTION</div>
          <div>PICK · YES% + NO%</div>
          <div className="text-right pr-4">MATCH · VENUE</div>
        </div>
      )}

      {/* Question rows – Layout A (wide orange cards) */}
      <div className="space-y-3">
        {!loading &&
          !error &&
          filteredQuestions.map((q) => {
            const { dateLabel, timeLabel } = formatDateTime(q.startTime);
            const isActive = activeQuestionId === q.id;
            return (
              <div
                key={q.id}
                className="relative rounded-2xl border border-[#111827] bg-[radial-gradient(circle_at_top_left,_#fb923c_0,_#7c2d12_35%,_#020617_80%)] text-white shadow-md overflow-hidden"
              >
                {/* Left stripe with date/time (desktop) */}
                <div className="hidden md:flex absolute left-0 top-0 bottom-0 w-40 flex-col justify-center items-start pl-4 border-r border-black/40 bg-black/10">
                  <div className="text-xs font-semibold">
                    {dateLabel || "TBA"}
                  </div>
                  <div className="text-[11px] text-white/70">
                    {timeLabel || ""}
                  </div>
                </div>

                {/* Content */}
                <div className="pl-0 md:pl-44 pr-4 py-3 md:py-4">
                  {/* Top line: Q#, match, venue */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 mb-1">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-6 items-center justify-center rounded-full bg-black/40 px-3 text-xs font-semibold">
                        Q{q.quarter}
                      </span>
                      <div className="text-xs md:text-sm">
                        <div className="font-semibold">{q.match}</div>
                        <div className="text-[11px] text-white/70">
                          {q.venue}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/90 text-black px-3 py-1 text-[11px] font-semibold">
                        Your streak pick
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  <div className="mb-2">
                    <p className="text-sm md:text-base font-semibold leading-snug">
                      {q.question}
                    </p>
                    <button
                      type="button"
                      onClick={() => openComments(q)}
                      className="mt-1 text-[11px] text-white/80 underline underline-offset-2"
                    >
                      Comments ({q.commentCount})
                    </button>
                  </div>

                  {/* Pick buttons + percentages */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="inline-flex rounded-full bg-black/40 p-1">
                      <button
                        type="button"
                        onClick={() => handlePickClick(q, "yes")}
                        className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
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
                        className={`px-5 py-1.5 rounded-full text-sm font-semibold transition ${
                          isActive && activeOutcome === "no"
                            ? "bg-sky-500 text-black"
                            : "bg-rose-500/90 text-black hover:bg-rose-400"
                        }`}
                      >
                        No
                      </button>
                    </div>

                    <div className="text-[11px] text-white/80 md:text-right">
                      Yes: {q.yesPercent.toFixed(0)}% · No:{" "}
                      {q.noPercent.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {!loading && !error && filteredQuestions.length === 0 && (
          <p className="text-sm text-white/70">
            No questions with this status right now.
          </p>
        )}
      </div>

      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        question={commentsQuestion}
      />
    </div>
  );
}
