// FULL UPDATED PAGE — OPTIMISED, GRADIENT A, MOBILE-FRIENDLY, NEW YES/NO BUTTONS

"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { db } from "@/lib/firebaseClient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

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
};

type PicksApiResponse = { games: ApiGame[] };

type Comment = {
  id: string;
  body: string;
  displayName?: string;
  createdAt?: string;
};

export default function PicksClient() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Comments
  const [commentsOpenFor, setCommentsOpenFor] =
    useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Date formatting
  const formatStartDate = (iso: string) => {
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

  // Load picks from API
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("API error");

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
            userPick: q.userPick,
            yesPercent: q.yesPercent,
            noPercent: q.noPercent,
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

  // Filters
  const applyFilter = (f: QuestionStatus | "all") => {
    setActiveFilter(f);
    if (f === "all") setFilteredRows(rows);
    else setFilteredRows(rows.filter((r) => r.status === f));
  };

  // Save pick
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
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

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
      );
      setFilteredRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
      );
    } catch (e) {
      console.error("Pick save error:", e);
    }
  };

  // Status pill colours
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

  // Comments
  const openComments = async (row: QuestionRow) => {
    setCommentsOpenFor(row);
    setComments([]);
    setCommentText("");
    setCommentsError("");
    setCommentsLoading(true);

    try {
      const res = await fetch(`/api/comments/${row.id}`);
      const data = await res.json();
      const list: Comment[] = (data.comments || []).map((c: any) => ({
        id: c.id,
        body: c.body,
        displayName: c.displayName,
        createdAt: c.createdAt,
      }));

      setComments(list);
    } catch (e) {
      setCommentsError("Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeComments = () => {
    setCommentsOpenFor(null);
  };

  const submitComment = async () => {
    if (!commentsOpenFor || !commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/comments/${commentsOpenFor.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentText.trim() }),
      });

      if (!res.ok) throw new Error("Failed");

      const created = await res.json();

      setComments((prev) => [
        {
          id: created.id || Math.random().toString(36),
          displayName: created.displayName,
          body: commentText.trim(),
          createdAt: created.createdAt,
        },
        ...prev,
      ]);

      setCommentText("");
    } catch (e) {
      setCommentsError("Failed to post");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ---------------------- UI ----------------------

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 text-white">

      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Picks</h1>

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

      {loading && <p>Loading…</p>}

      {/* LIST OF QUESTIONS */}
      <div className="space-y-4">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);
          const yesSelected = row.userPick === "yes";
          const noSelected = row.userPick === "no";

          return (
            <div
              key={row.id}
              className="
                w-full rounded-xl overflow-hidden shadow-md
                bg-gradient-to-r from-[#ff7a00] via-[#cc5e00] to-[#7a3b00]
                border border-black/20
              "
            >
              {/* CARD CONTENT */}
              <div className="p-4 sm:p-5 text-white space-y-3">

                {/* TOP ROW: TIME + STATUS */}
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{date}</div>
                    <div className="text-white/70 text-xs">{time} AEDT</div>
                  </div>

                  <span
                    className={`${statusClasses(
                      row.status
                    )} text-[10px] px-2 py-1 rounded-full font-bold`}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </div>

                {/* MATCH & QUARTER */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-base">
                      {row.match}
                    </div>
                    <div className="text-xs text-white/70">{row.venue}</div>
                  </div>

                  <div className="font-bold text-lg">Q{row.quarter}</div>
                </div>

                {/* QUESTION */}
                <div className="text-sm sm:text-base font-semibold leading-tight">
                  {row.question}
                </div>

                {/* COMMENTS */}
                <button
                  type="button"
                  onClick={() => openComments(row)}
                  className="text-xs underline text-white/80 hover:text-white"
                >
                  Comments (0)
                </button>

                {/* YES / NO BUTTONS */}
                <div className="flex items-center gap-3 pt-1">
                  
                  <button
                    onClick={() => handlePick(row, "yes")}
                    className={`
                      px-5 py-2 rounded-full font-bold text-white text-sm
                      transition
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
                    onClick={() => handlePick(row, "no")}
                    className={`
                      px-5 py-2 rounded-full font-bold text-white text-sm
                      transition
                      ${
                        noSelected
                          ? "bg-red-700 ring-2 ring-white"
                          : "bg-red-600 hover:bg-red-700"
                      }
                    `}
                  >
                    No
                  </button>

                  <div className="text-xs text-white/80 ml-auto">
                    Yes: {row.yesPercent ?? 0}% • No: {row.noPercent ?? 0}%
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* COMMENTS DRAWER */}
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
                onClick={closeComments}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Textarea */}
            <div className="mb-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-[#0b1220] border border-gray-700 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
              />

              <div className="flex justify-end mt-2">
                <button
                  onClick={submitComment}
                  disabled={submittingComment}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-md text-sm font-semibold"
                >
                  {submittingComment ? "Posting…" : "Post"}
                </button>
              </div>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto border-t border-gray-800 pt-3 space-y-3">
              {commentsLoading ? (
                <p className="text-gray-400">Loading comments…</p>
              ) : comments.length === 0 ? (
                <p className="text-gray-400">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#0b1220] p-3 rounded-md text-sm"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-semibold">
                        {c.displayName || "User"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {c.createdAt}
                      </span>
                    </div>
                    <p>{c.body}</p>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
