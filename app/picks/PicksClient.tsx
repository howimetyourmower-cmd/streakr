"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import type { SportType } from "@/lib/sports";

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
  sport: SportType;
};

type PicksApiResponse = { games: ApiGame[] };

type Comment = {
  id: string;
  body: string;
  displayName?: string;
  createdAt?: string;
};

export default function PicksClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // single-active-question selection
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );

  // round label
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // comments state
  const [commentsOpenFor, setCommentsOpenFor] =
    useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // -------- Date formatting ----------
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

  // -------- Load Picks --------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("API error");

        const data: PicksApiResponse = await res.json();

        // Try to infer round from the first game ID (e.g. "round-1_game_0")
        if (data.games && data.games.length > 0) {
          const firstId = data.games[0].id ?? "";
          let match = firstId.match(/round[_-]?(\d+)/i);
          if (!match) match = firstId.match(/(\d+)/);
          if (match) {
            const num = Number(match[1]);
            if (!Number.isNaN(num)) setCurrentRound(num);
          }
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
            // For now treat everything as AFL – can come from API later
            sport: "afl" as SportType,
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

  // Keep filtered rows in sync if rows change (e.g. after % update)
  useEffect(() => {
    applyFilter(activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]); // basic sync – good enough for now

  // -------- Recalculate YES/NO % for a question --------
  const recalcPercentagesForQuestion = async (questionId: string) => {
    try {
      const q = query(
        collection(db, "picks"),
        where("questionId", "==", questionId)
      );
      const snap = await getDocs(q);

      let yesCount = 0;
      let noCount = 0;

      snap.forEach((docSnap) => {
        const d = docSnap.data() as any;
        if (d.pick === "yes") yesCount++;
        else if (d.pick === "no") noCount++;
      });

      const total = yesCount + noCount;
      const yesPercent = total > 0 ? Math.round((yesCount / total) * 100) : 0;
      const noPercent = total > 0 ? 100 - yesPercent : 0;

      setRows((prev) =>
        prev.map((r) =>
          r.id === questionId
            ? { ...r, yesPercent, noPercent }
            : r
        )
      );
      setFilteredRows((prev) =>
        prev.map((r) =>
          r.id === questionId
            ? { ...r, yesPercent, noPercent }
            : r
        )
      );
    } catch (err) {
      console.error("Failed to recalc percentages", err);
    }
  };

  // -------- Save Pick (single active question per user) --------
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    if (!user) {
      router.push("/auth");
      return;
    }

    try {
      // One pick per user per question
      const docId = `${user.uid}_${row.id}`;
      const picksRef = doc(db, "picks", docId);

      await setDoc(
        picksRef,
        {
          userId: user.uid,
          gameId: row.gameId,
          questionId: row.id,
          pick,
          match: row.match,
          question: row.question,
          quarter: row.quarter,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Only one active question at a time
      setSelectedQuestionId(row.id);

      // Update local userPick
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, userPick: pick } : { ...r, userPick: undefined }
        )
      );
      setFilteredRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, userPick: pick } : { ...r, userPick: undefined }
        )
      );

      // Recalculate YES/NO percentages for this question
      await recalcPercentagesForQuestion(row.id);
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Picks</h1>
          {currentRound !== null && (
            <p className="text-sm text-orange-300 mt-1">
              Season 2026 • Round {currentRound}
            </p>
          )}
        </div>
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

      {/* HEADER ROW (desktop) */}
      <div className="hidden sm:grid grid-cols-12 text-gray-300 text-xs mb-2 px-2">
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
          const isActiveQuestion = selectedQuestionId === row.id;

          return (
            <div
              key={row.id}
              className={`rounded-lg bg-gradient-to-r from-[#ff7a00] via-[#cc5e00] to-[#7a3b00] border border-black/30 shadow-sm ${
                isActiveQuestion ? "ring-2 ring-sky-400" : ""
              }`}
            >
              <div className="grid grid-cols-12 items-center px-4 py-2 text-white gap-y-2">
                {/* START */}
                <div className="col-span-6 sm:col-span-2">
                  <div className="text-sm font-semibold">{date}</div>
                  <div className="text-[11px] text-white/80">
                    {time} AEDT
                  </div>
                </div>

                {/* SPORT */}
                <div className="col-span-3 sm:col-span-1 flex items-center">
                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-white/30 text-[11px] font-semibold bg-black/20">
                    AFL
                  </span>
                </div>

                {/* STATUS */}
                <div className="col-span-3 sm:col-span-1">
                  <span
                    className={`${statusClasses(
                      row.status
                    )} text-[10px] px-2 py-0.5 rounded-full font-bold`}
                  >
                    {row.status.toUpperCase()}
                  </span>
                </div>

                {/* MATCH + VENUE */}
                <div className="col-span-12 sm:col-span-3">
                  <div className="text-sm font-semibold">
                    {row.match}
                  </div>
                  <div className="text-[11px] text-white/80">
                    {row.venue}
                  </div>
                </div>

                {/* Q# */}
                <div className="col-span-3 sm:col-span-1 text-left sm:text-center text-sm font-bold">
                  Q{row.quarter}
                </div>

                {/* QUESTION + COMMENTS */}
                <div className="col-span-9 sm:col-span-2">
                  <div className="text-sm leading-snug font-medium">
                    {row.question}
                  </div>
                  <button
                    type="button"
                    onClick={() => openComments(row)}
                    className="text-[11px] text-white/85 mt-0.5 underline"
                  >
                    Comments (0)
                  </button>
                </div>

                {/* PICK / YES / NO */}
                <div className="col-span-12 sm:col-span-2 flex flex-col items-stretch sm:items-end">
                  <div className="flex gap-2 mb-0.5 justify-end">
                    <button
                      type="button"
                      onClick={() => handlePick(row, "yes")}
                      className={`
                        px-4 py-1.5 rounded-full text-xs font-bold w-20 text-white transition
                        ${
                          yesSelected
                            ? "bg-sky-500 ring-2 ring-white"
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
                        px-4 py-1.5 rounded-full text-xs font-bold w-20 text-white transition
                        ${
                          noSelected
                            ? "bg-sky-500 ring-2 ring-white"
                            : "bg-red-600 hover:bg-red-700"
                        }
                      `}
                    >
                      No
                    </button>
                  </div>
                  <div className="text-[11px] text-white/85 text-right">
                    Yes: {row.yesPercent ?? 0}% • No: {row.noPercent ?? 0}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
