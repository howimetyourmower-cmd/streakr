"use client";

import { useEffect, useState, ChangeEvent } from "react";
import Link from "next/link";
import { db } from "@/lib/firebaseClient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

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
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
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
  sport: string; // text-only, e.g. "AFL"
  commentCount: number;
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

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);

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
            userPick: q.userPick,
            yesPercent: q.yesPercent,
            noPercent: q.noPercent,
            sport: "AFL",
            commentCount: q.commentCount ?? 0,
          }))
        );

        setRows(flat);
        setFilteredRows(flat.filter((r) => r.status === "open"));
      } catch (e) {
        console.error(e);
        setError("Failed to load picks");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // -------- Filtering --------
  const applyFilter = (f: QuestionStatus | "all") => {
    setActiveFilter(f);
    if (f === "all") setFilteredRows(rows);
    else setFilteredRows(rows.filter((r) => r.status === f));
  };

  // -------- Save Pick --------
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    // Not logged in → show auth modal instead of saving
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      await addDoc(collection(db, "picks"), {
        gameId: row.gameId,
        questionId: row.id,
        pick,
        match: row.match,
        question: row.question,
        quarter: row.quarter,
        createdAt: serverTimestamp(),
      });

      // Update local state to reflect this pick
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
      const list: Comment[] = (data.comments || []).map((c: any) => ({
        id: c.id,
        body: c.body,
        displayName: c.displayName,
        createdAt: c.createdAt,
      }));

      setComments(list);

      // Update commentCount for this row based on fetched comments
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, commentCount: list.length } : r
        )
      );
      setFilteredRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, commentCount: list.length } : r
        )
      );
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
        body: commentText.trim(),
        displayName: created.displayName,
        createdAt: created.createdAt,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentText("");

      // Increment commentCount for this row
      setRows((prev) =>
        prev.map((r) =>
          r.id === commentsOpenFor.id
            ? { ...r, commentCount: (r.commentCount ?? 0) + 1 }
            : r
        )
      );
      setFilteredRows((prev) =>
        prev.map((r) =>
          r.id === commentsOpenFor.id
            ? { ...r, commentCount: (r.commentCount ?? 0) + 1 }
            : r
        )
      );
    } catch (e) {
      console.error(e);
      setCommentsError("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  // -------- Render --------
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold">Picks</h1>
        {roundNumber !== null && (
          <p className="text-sm text-white/70">
            Current Round:{" "}
            <span className="font-semibold text-orange-400">
              Round {roundNumber}
            </span>
          </p>
        )}
      </div>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["open", "final", "pending", "void", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
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

      {/* HEADER ROW */}
      <div className="hidden md:grid grid-cols-12 text-gray-300 text-xs mb-2 px-2">
        <div className="col-span-2">START</div>
        <div className="col-span-1">SPORT</div>
        <div className="col-span-1">STATUS</div>
        <div className="col-span-3">MATCH • VENUE</div>
        <div className="col-span-1 text-center">Q#</div>
        <div className="col-span-2">QUESTION</div>
        <div className="col-span-2 text-right">PICK • YES% • NO%</div>
      </div>

      {loading && <p>Loading…</p>}

      {/* ROWS */}
      <div className="space-y-2">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);
          const yesSelected = row.userPick === "yes";
          const noSelected = row.userPick === "no";

          return (
            <div
              key={row.id}
              className="rounded-lg bg-gradient-to-r from-[#ff7a00] via-[#cc5e00] to-[#7a3b00] border border-black/30 shadow-sm"
            >
              <div className="grid grid-cols-12 items-center px-4 py-1.5 text-white gap-y-2 md:gap-y-0">
                {/* START */}
                <div className="col-span-12 md:col-span-2">
                  <div className="text-sm font-semibold">{date}</div>
                  <div className="text-[11px] text-white/80">
                    {time} AEDT
                  </div>
                </div>

                {/* SPORT (text-only pill) */}
                <div className="col-span-6 md:col-span-1 flex items-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/30 text-[11px] font-semibold uppercase tracking-wide">
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
                  <div className="text-sm font-semibold">
                    {row.match}
                  </div>
                  <div className="text-[11px] text-white/80">
                    {row.venue}
                  </div>
                </div>

                {/* Q# */}
                <div className="col-span-3 md:col-span-1 text-sm font-bold md:text-center">
                  Q{row.quarter}
                </div>

                {/* QUESTION + COMMENTS */}
                <div className="col-span-9 md:col-span-2">
                  <div className="text-sm leading-snug font-medium">
                    {row.question}
                  </div>
                  <button
                    type="button"
                    onClick={() => openComments(row)}
                    className="text-[11px] text-white/85 mt-0.5 underline"
                  >
                    Comments ({row.commentCount ?? 0})
                  </button>
                </div>

                {/* PICK / YES / NO */}
                <div className="col-span-12 md:col-span-2 flex flex-col items-end">
                  <div className="flex gap-2 mb-0.5">
                    <button
                      type="button"
                      onClick={() => handlePick(row, "yes")}
                      className={`
                        px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition
                        ${
                          yesSelected
                            ? "bg-green-700 ring-2 ring-white"
                            : "bg-green-600 hover:bg-green-700"
                        }
                      `}
                    >
                      Yes
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePick(row, "no")}
                      className={`
                        px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition
                        ${
                          noSelected
                            ? "bg-red-700 ring-2 ring-white"
                            : "bg-red-600 hover:bg-red-700"
                        }
                      `}
                    >
                      No
                    </button>
                  </div>
                  <div className="text-[11px] text-white/85">
                    Yes: {row.yesPercent ?? 0}% • No: {row.noPercent ?? 0}%
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

            {/* New comment */}
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

            {/* Comment list */}
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
