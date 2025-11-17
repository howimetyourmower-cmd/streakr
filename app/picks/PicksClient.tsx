"use client";

import { useEffect, useState, ChangeEvent } from "react";
import SportBadge from "@/components/SportBadge";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string; // ISO string from API
  sport?: string;    // optional, defaults to AFL
  questions: ApiQuestion[];
};

type QuestionRow = {
  id: string;              // question id
  gameId: string;
  match: string;
  venue: string;
  startTime: string;       // ISO
  sport: string;           // "afl" | "nrl" | etc
  quarter: number;
  question: string;
  status: QuestionStatus;
  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
};

type PicksApiResponse = { games: ApiGame[] };

type Comment = {
  id: string;
  body: string;
  displayName?: string;
  createdAt?: string;
};

const STATUS_LABELS: Record<QuestionStatus, string> = {
  open: "Open",
  pending: "Pending",
  final: "Final",
  void: "Void",
};

const STATUS_COLORS: Record<QuestionStatus, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  pending: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  final: "bg-blue-500/15 text-blue-200 border border-blue-500/40",
  void: "bg-slate-500/15 text-slate-300 border border-slate-500/40",
};

export default function PicksClient() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [search, setSearch] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // comments
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load picks");
        }
        const data = (await res.json()) as PicksApiResponse;

        const flat: QuestionRow[] = [];
        for (const g of data.games) {
          const sportKey = (g.sport ?? "afl").toLowerCase();
          for (const q of g.questions) {
            flat.push({
              id: q.id,
              gameId: g.id,
              match: g.match,
              venue: g.venue,
              startTime: g.startTime,
              sport: sportKey,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              userPick: q.userPick,
              yesPercent: q.yesPercent,
              noPercent: q.noPercent,
            });
          }
        }

        setRows(flat);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Something went wrong loading picks.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const filteredRows = rows.filter((row) => {
    if (activeFilter !== "all" && row.status !== activeFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.match.toLowerCase().includes(q) ||
      row.venue.toLowerCase().includes(q) ||
      row.question.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    try {
      setSubmittingId(row.id);
      setError(null);

      const res = await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: row.id,
          gameId: row.gameId,
          pick,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to submit pick");
      }

      // Optimistic update
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                userPick: pick,
              }
            : r
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to submit pick.");
    } finally {
      setSubmittingId(null);
    }
  };

  // Comments helpers
  const openComments = async (questionId: string) => {
    setOpenCommentsFor(questionId);
    setComments([]);
    setNewComment("");
    setCommentsError(null);
    setCommentsLoading(true);

    try {
      const res = await fetch(`/api/comments/${questionId}`);
      if (!res.ok) {
        throw new Error("Failed to load comments");
      }
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments ?? []);
    } catch (err: any) {
      console.error(err);
      setCommentsError(err?.message ?? "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!openCommentsFor || !newComment.trim()) return;

    try {
      setCommentsError(null);
      const res = await fetch(`/api/comments/${openCommentsFor}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to post comment");
      }

      const data = (await res.json()) as { comment: Comment };

      setComments((prev) => [data.comment, ...prev]);
      setNewComment("");
    } catch (err: any) {
      console.error(err);
      setCommentsError(err?.message ?? "Failed to post comment");
    }
  };

  const closeComments = () => {
    setOpenCommentsFor(null);
    setComments([]);
    setNewComment("");
    setCommentsError(null);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 md:py-8 px-4 md:px-0">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
            Make your picks
          </h1>
          <p className="text-sm md:text-base text-slate-300/80 mt-1">
            Answer the questions each quarter to keep your streak alive. Your
            streak counts towards the global leaderboard and any private leagues
            you&apos;re in.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex rounded-full border border-slate-700 bg-slate-900/70 p-1 text-xs md:text-sm">
            {(["all", "open", "pending", "final", "void"] as const).map(
              (key) => {
                const isActive = activeFilter === key;
                const label =
                  key === "all"
                    ? "All"
                    : STATUS_LABELS[key as QuestionStatus];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setActiveFilter(key as QuestionStatus | "all")
                    }
                    className={[
                      "px-3 py-1 rounded-full transition-colors",
                      isActive
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-300 hover:bg-slate-800/80",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by team, venue or question…"
            className="w-full md:w-64 rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500"
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <p className="text-slate-300 text-sm">Loading questions…</p>
        </div>
      )}

      {!loading && error && (
        <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div className="py-10 text-center text-slate-300 text-sm">
          No questions match your filters right now.
        </div>
      )}

      <div className="space-y-4">
        {filteredRows.map((row) => {
          const formattedDate = formatDate(row.startTime);
          const statusClass = STATUS_COLORS[row.status];
          const yesActive = row.userPick === "yes";
          const noActive = row.userPick === "no";

          return (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 md:p-5 shadow-sm shadow-black/40"
            >
              {/* Top line: match, venue */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-slate-300/90">
                <div className="font-medium text-slate-100">
                  {row.match}
                  <span className="ml-2 text-slate-400 text-[11px] md:text-xs">
                    • {row.venue}
                  </span>
                </div>
                <div className="text-[11px] md:text-xs text-slate-400">
                  Q{row.quarter}
                </div>
              </div>

              {/* Date + SPORT BADGE + Status */}
              <div className="mt-2 flex items-center justify-between text-[11px] md:text-xs text-slate-300/90 gap-2">
                <span>{formattedDate}</span>

                <div className="flex items-center gap-2">
                  {/* SPORT BADGE lives here – between date and status */}
                  <SportBadge sport={row.sport as any} />

                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] md:text-xs font-medium",
                      statusClass,
                    ].join(" ")}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                </div>
              </div>

              {/* Question text */}
              <p className="mt-3 text-sm md:text-base text-slate-50 font-medium">
                {row.question}
              </p>

              {/* Percentages */}
              <div className="mt-3 flex items-center gap-3 text-[11px] md:text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-6 rounded-full bg-emerald-500/70" />
                  Yes {row.yesPercent ?? 0}%
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-6 rounded-full bg-rose-500/70" />
                  No {row.noPercent ?? 0}%
                </span>
              </div>

              {/* Actions: Yes / No + comments */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submittingId === row.id || row.status !== "open"}
                    onClick={() => handlePick(row, "yes")}
                    className={[
                      "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      row.status !== "open"
                        ? "border-slate-700 bg-slate-900/70 text-slate-500 cursor-not-allowed"
                        : yesActive
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-slate-900/80 text-emerald-300 border-emerald-600/70 hover:bg-emerald-500/10",
                    ].join(" ")}
                  >
                    Yes
                    {submittingId === row.id && yesActive && "…"}
                  </button>

                  <button
                    type="button"
                    disabled={submittingId === row.id || row.status !== "open"}
                    onClick={() => handlePick(row, "no")}
                    className={[
                      "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      row.status !== "open"
                        ? "border-slate-700 bg-slate-900/70 text-slate-500 cursor-not-allowed"
                        : noActive
                        ? "bg-rose-500 text-slate-950 border-rose-400"
                        : "bg-slate-900/80 text-rose-300 border-rose-600/70 hover:bg-rose-500/10",
                    ].join(" ")}
                  >
                    No
                    {submittingId === row.id && noActive && "…"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openComments(row.id)}
                  className="text-[11px] md:text-xs inline-flex items-center gap-1 text-slate-300 hover:text-slate-100"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px]">
                    💬
                  </span>
                  Comments
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comments sheet / dialog */}
      {openCommentsFor && (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full md:w-[480px] max-h-[85vh] rounded-t-2xl md:rounded-2xl bg-slate-950 border border-slate-700/80 shadow-xl shadow-black/60 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-50">
                Comments
              </h2>
              <button
                type="button"
                onClick={closeComments}
                className="text-slate-400 hover:text-slate-100 text-sm"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
              {commentsLoading && (
                <p className="text-slate-300 text-xs">Loading comments…</p>
              )}

              {!commentsLoading && commentsError && (
                <p className="text-rose-300 text-xs">{commentsError}</p>
              )}

              {!commentsLoading &&
                !commentsError &&
                comments.length === 0 && (
                  <p className="text-slate-400 text-xs">
                    No comments yet. Be the first to share a take.
                  </p>
                )}

              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">
                      {c.displayName ?? "Player"}
                    </span>
                    {c.createdAt && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.createdAt).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-line">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 px-4 py-3">
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Drop your thoughts…"
                  className="flex-1 rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!newComment.trim()}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs md:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
