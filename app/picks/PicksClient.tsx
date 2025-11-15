"use client";

import { useEffect, useState } from "react";
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

export default function PicksClient() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const flat = data.games.flatMap((g) =>
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

  // -------- Filtering --------
  const applyFilter = (f: QuestionStatus | "all") => {
    setActiveFilter(f);
    if (f === "all") setFilteredRows(rows);
    else setFilteredRows(rows.filter((r) => r.status === f));
  };

  // -------- Save Pick --------
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

      setFilteredRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
      );

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, userPick: pick } : r))
      );
    } catch (e) {
      console.error("Pick save error:", e);
    }
  };

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

  return (
    <div className="w-full max-w-7xl mx-auto p-6 text-white">
      <h1 className="text-4xl font-bold mb-4">Picks</h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {/* FILTER BUTTONS */}
      <div className="flex gap-3 mb-6">
        {(["open", "final", "pending", "void", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => applyFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeFilter === f ? "bg-orange-500" : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* HEADER */}
      <div className="grid grid-cols-12 text-gray-300 text-xs mb-2 px-2">
        <div className="col-span-2">START</div>
        <div className="col-span-1">STATUS</div>
        <div className="col-span-3">MATCH • VENUE</div>
        <div className="col-span-1 text-center">Q#</div>
        <div className="col-span-3">QUESTION</div>
        <div className="col-span-2 text-right">PICK • YES% • NO%</div>
      </div>

      {loading && <p>Loading…</p>}

      <div className="space-y-2">
        {filteredRows.map((row) => {
          const { date, time } = formatStartDate(row.startTime);

          return (
            <div
              key={row.id}
              className="grid grid-cols-12 bg-[#101a2a] px-4 py-3 rounded-lg items-center"
            >
              {/* DATE */}
              <div className="col-span-2">
                <div>{date}</div>
                <div className="text-xs text-gray-400">{time} AEDT</div>
              </div>

              {/* STATUS */}
              <div className="col-span-1">
                <span
                  className={`${statusClasses(
                    row.status
                  )} text-[10px] px-2 py-1 rounded-full font-bold`}
                >
                  {row.status.toUpperCase()}
                </span>
              </div>

              {/* MATCH */}
              <div className="col-span-3">
                <div className="text-orange-400 font-semibold">{row.match}</div>
                <div className="text-xs text-gray-400">{row.venue}</div>
              </div>

              {/* Q# */}
              <div className="col-span-1 text-center text-orange-400 font-bold">
                Q{row.quarter}
              </div>

              {/* QUESTION + COMMENTS */}
              <div className="col-span-3">
                <div>{row.question}</div>
                <button className="text-xs text-blue-400 mt-1 underline">
                  Comments (0)
                </button>
              </div>

              {/* PICK BUTTONS */}
              <div className="col-span-2 flex flex-col items-end">
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => handlePick(row, "yes")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 ${
                      row.userPick === "yes"
                        ? "bg-orange-500 text-white"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    Yes
                  </button>

                  <button
                    onClick={() => handlePick(row, "no")}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold w-16 ${
                      row.userPick === "no"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    No
                  </button>
                </div>

                <div className="text-[11px] text-gray-400">
                  Yes: {row.yesPercent ?? 0}% • No: {row.noPercent ?? 0}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
