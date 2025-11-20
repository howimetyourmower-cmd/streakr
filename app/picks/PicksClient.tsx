"use client";

import { useEffect, useState, ChangeEvent } from "react";
import Link from "next/link";
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
  sport: string;
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

type ActiveOutcome = "yes" | "no" | null;

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);

  // SINGLE streak pick
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeOutcome, setActiveOutcome] = useState<ActiveOutcome>(null);

  // Comments drawer
  const [commentsOpenFor, setCommentsOpenFor] = useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Date formatting
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

import { useEffect, useState, ChangeEvent } from "react";
import Link from "next/link";
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
  sport: string;
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

type ActiveOutcome = "yes" | "no" | null;

export default function PicksClient() {
  const { user } = useAuth();

  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);

  // SINGLE streak pick
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeOutcome, setActiveOutcome] = useState<ActiveOutcome>(null);

  // Comments drawer
  const [commentsOpenFor, setCommentsOpenFor] = useState<QuestionRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Date formatting
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
  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 bg-black text-slate-50">

      <div className="flex flex-col sm:flex-row justify-between mb-6">
        <h1 className="text-3xl font-bold">Picks</h1>
        {roundNumber && (
          <p className="text-slate-300">
            Current Round: <span className="text-orange-400">Round {roundNumber}</span>
          </p>
        )}
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["open", "final", "pending", "void", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeFilter === f
                ? "bg-orange-500 text-black"
                : "bg-slate-800 hover:bg-slate-700"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* HEADER */}
      <div className="hidden md:grid grid-cols-12 text-slate-400 text-xs mb-2 px-2">
        <div className="col-span-2">START</div>
        <div className="col-span-1">SPORT</div>
        <div className="col-span-1">STATUS</div>
        <div className="col-span-3">MATCH • VENUE</div>
        <div className="col-span-1 text-center">Q#</div>
        <div className="col-span-2">QUESTION</div>
        <div className="col-span-2 text-right">PICK • YES% • NO%</div>
      </div>

      {/* ROWS */}
      <div className="space-y-3">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);
          const isActive = row.id === activeQuestionId;
          const isYesActive = isActive && activeOutcome === "yes";
          const isNoActive = isActive && activeOutcome === "no";
          const { yes: yesPct, no: noPct } = getDisplayPercents(row.id);
          const locked = row.status !== "open";

          return (
            <div
              key={row.id}
              className="rounded-2xl border border-[#1E2A55] bg-[#0F1B3D] shadow-[0_12px_30px_rgba(24,91,255,0.4)]"
            >
              <div className="grid grid-cols-12 items-center px-4 py-3 gap-y-2">

                {/* START */}
                <div className="col-span-12 md:col-span-2">
                  <div className="text-sm font-semibold text-blue-50">{date}</div>
                  <div className="text-[11px] text-blue-200">{time} AEDT</div>
                </div>

                {/* SPORT */}
                <div className="col-span-6 md:col-span-1">
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-blue-200 border border-blue-400/40">
                    AFL
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

                {/* MATCH */}
                <div className="col-span-12 md:col-span-3 text-blue-50">
                  <div className="text-sm font-semibold">{row.match}</div>
                  <div className="text-[11px] text-blue-200">{row.venue}</div>
                </div>

                {/* QUARTER */}
                <div className="col-span-3 md:col-span-1 text-sm font-bold text-blue-50 md:text-center">
                  Q{row.quarter}
                </div>

                {/* QUESTION + COMMENTS */}
                <div className="col-span-9 md:col-span-2 text-blue-50">
                  <div className="text-sm font-medium">{row.question}</div>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => openComments(row)}
                      className="text-[11px] text-blue-200 underline"
                    >
                      Comments ({row.commentCount})
                    </button>

                    {isActive && (
                      <span className="rounded-full bg-sky-500 text-black px-2 py-0.5 text-[10px] font-semibold">
                        Streak Pick
                      </span>
                    )}

                    {locked && (
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-blue-300">
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* PICK BUTTONS */}
                <div className="col-span-12 md:col-span-2 flex flex-col items-end">
                  <div className="flex gap-2 mb-1">
                    <button
                      onClick={() => handlePick(row, "yes")}
                      disabled={locked}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 ${
                        isYesActive
                          ? "bg-sky-500 text-black ring-2 ring-white"
                          : "bg-green-600 hover:bg-green-700"
                      } ${locked ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      Yes
                    </button>

                    <button
                      onClick={() => handlePick(row, "no")}
                      disabled={locked}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 ${
                        isNoActive
                          ? "bg-sky-500 text-black ring-2 ring-white"
                          : "bg-red-600 hover:bg-red-700"
                      } ${locked ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      No
                    </button>
                  </div>

                  <div className="text-[11px] text-blue-200">
                    Yes: {yesPct}% • No: {noPct}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AUTH MODAL + COMMENTS = unchanged from your version */}
    </div>
  );
}
