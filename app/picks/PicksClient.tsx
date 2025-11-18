"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
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
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type SportType = "afl"; // can expand later

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

type UserProfile = {
  username?: string;
};

const CURRENT_ROUND = 1;

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // comments state
  const [commentsOpenFor, setCommentsOpenFor] =
    useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // single active streak pick per user
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeQuestionPick, setActiveQuestionPick] = useState<
    "yes" | "no" | null
  >(null);

  // basic user profile for comments (username)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

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

  // -------- Load basic user profile for username (for comments) --------
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setUserProfile(null);
        setProfileLoaded(true);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setUserProfile({
            username: data.username ?? "",
          });
        } else {
          setUserProfile(null);
        }
      } catch (e) {
        console.error("Failed to load user profile for comments", e);
        setUserProfile(null);
      } finally {
        setProfileLoaded(true);
      }
    };

    if (!profileLoaded) {
      loadProfile();
    }
  }, [user, profileLoaded]);

  const displayName =
    userProfile?.username && userProfile.username.trim() !== ""
      ? userProfile.username
      : "User";

  // -------- Load Picks --------
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
            // For now treat everything as AFL – can come from API later
            sport: "afl" as SportType,
          }))
        );

        // Find an existing active pick (if backend ever supplies it)
        const existingActive = flat.find(
          (r) => r.userPick === "yes" || r.userPick === "no"
        );

        if (existingActive) {
          setActiveQuestionId(existingActive.id);
          setActiveQuestionPick(existingActive.userPick ?? null);
        } else {
          setActiveQuestionId(null);
          setActiveQuestionPick(null);
        }

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

  // -------- Save Pick (single active streak pick) --------
  const handlePick = async (row: QuestionRow, pick: "yes" | "no") => {
    try {
      await addDoc(collection(db, "picks"), {
        userId: user?.uid ?? null,
        gameId: row.gameId,
        questionId: row.id,
        pick,
        match: row.match,
        question: row.question,
        quarter: row.quarter,
        round: CURRENT_ROUND,
        createdAt: serverTimestamp(),
      });

      // locally enforce one active question per user
      setActiveQuestionId(row.id);
      setActiveQuestionPick(pick);

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, userPick: pick }
            : { ...r, userPick: undefined }
        )
      );

      setFilteredRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, userPick: pick }
            : { ...r, userPick: undefined }
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
        headers: {
          "Content-Type": "application/json",
          "x-uid": user?.uid ?? "",
          "x-username": displayName,
        },
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
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold">Picks</h1>
        <p className="text-sm text-white/70">
          AFL Season 2026 · Round {CURRENT_ROUND}
        </p>
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

      {/* HEADER ROW (desktop-style like your screenshot) */}
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

      {/* ROWS – 12-column layout, orange gradient */}
      <div className="space-y-2">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);
          const isActive = row.id === activeQuestionId;
          const yesSelected = isActive && activeQuestionPick === "yes";
          const noSelected = isActive && activeQuestionPick === "no";

          const yesPercent = isActive
            ? activeQuestionPick === "yes"
              ? 100
              : 0
            : 0;
          const noPercent = isActive
            ? activeQuestionPick === "no"
              ? 100
              : 0
            : 0;

          return (
            <div
              key={row.id}
              className="rounded-lg bg-gradient-to-r from-[#ff7a00] via-[#cc5e00] to-[#7a3b00] border border-black/30 shadow-sm"
            >
              <div className="grid grid-cols-12 gap-y-2 items-center px-4 py-1.5 text-white text-xs sm:text-sm">
                {/* START */}
                <div className="col-span-6 sm:col-span-2">
                  <div className="text-sm font-semibold">{date}</div>
                  <div className="text-[11px] text-white/80">
                    {time} AEDT
                  </div>
                </div>

                {/* SPORT (text pill) */}
                <div className="col-span-3 sm:col-span-1">
                  <span className="inline-flex items-center justify-center rounded-full border border-white/20 bg-black/30 px-3 py-0.5 text-[11px] font-semibold tracking-wide">
                    {row.sport.toUpperCase()}
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

                {/* Q# + streak badge */}
                <div className="col-span-3 sm:col-span-1 flex flex-col items-start sm:items-center gap-1">
                  <div className="text-sm font-bold">
                    Q{row.quarter}
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center rounded-full bg-blue-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Your streak pick
                    </span>
                  )}
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
                <div className="col-span-12 sm:col-span-2 flex flex-col items-end">
                  <div className="flex gap-2 mb-0.5">
                    <button
                      type="button"
                      onClick={() => handlePick(row, "yes")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition ${
                        yesSelected
                          ? "bg-blue-700 ring-2 ring-white"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      Yes
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePick(row, "no")}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 text-white transition ${
                        noSelected
                          ? "bg-blue-700 ring-2 ring-white"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      No
                    </button>
                  </div>
                  <div className="text-[11px] text-white/85">
                    Yes: {yesPercent}% • No: {noPercent}%
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

            {/* Comment list */}
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
                          {c.displayName ?? "User"}
                        </span>
                        {c.createdAt && (
                          <span className="text-[11px] text-gray-400">
                            {c.createdAt}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-100">
                        {c.body}
                      </p>
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
