"use client";

import { useEffect, useState, ChangeEvent } from "react";
import { db } from "@/lib/firebaseClient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import SportBadge from "@/components/SportBadge";
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
  sport?: SportType | string;
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
  sport?: SportType | string;
};

type PicksApiResponse = { games: ApiGame[] };

export default function PicksClient() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<QuestionRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<QuestionStatus | "all">(
    "open"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPickId, setSavingPickId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load picks from API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("Failed to load picks");

        const data: PicksApiResponse = await res.json();

        const flat: QuestionRow[] = [];
        for (const game of data.games) {
          for (const q of game.questions) {
            flat.push({
              id: q.id,
              gameId: game.id,
              match: game.match,
              venue: game.venue,
              startTime: game.startTime,
              quarter: q.quarter,
              question: q.question,
              status: q.status,
              userPick: q.userPick,
              yesPercent: q.yesPercent,
              noPercent: q.noPercent,
              // default to AFL for now – everything is AFL at launch
              sport: q.sport ?? ("afl" as SportType),
            });
          }
        }

        if (!cancelled) {
          setRows(flat);
          setFilteredRows(applyFilters(flat, activeFilter, searchTerm));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load picks. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-apply filters when filter/search changes
  useEffect(() => {
    setFilteredRows(applyFilters(rows, activeFilter, searchTerm));
  }, [rows, activeFilter, searchTerm]);

  function applyFilters(
    allRows: QuestionRow[],
    status: QuestionStatus | "all",
    term: string
  ): QuestionRow[] {
    let out = allRows;

    if (status !== "all") {
      out = out.filter((r) => r.status === status);
    }

    const t = term.trim().toLowerCase();
    if (t) {
      out = out.filter(
        (r) =>
          r.match.toLowerCase().includes(t) ||
          r.venue.toLowerCase().includes(t) ||
          r.question.toLowerCase().includes(t)
      );
    }

    return out;
  }

  function onSearchChange(e: ChangeEvent<HTMLInputElement>) {
    setSearchTerm(e.target.value);
  }

  async function handlePick(row: QuestionRow, pick: "yes" | "no") {
    try {
      setSavingPickId(row.id);

      await addDoc(collection(db, "userPicks"), {
        questionId: row.id,
        gameId: row.gameId,
        match: row.match,
        venue: row.venue,
        startTime: row.startTime,
        quarter: row.quarter,
        pick,
        createdAt: serverTimestamp(),
      });

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
    } catch (err) {
      console.error("Failed to save pick", err);
      alert("Sorry, something went wrong saving your pick.");
    } finally {
      setSavingPickId(null);
    }
  }

  function formatStart(startTime: string) {
    const d = new Date(startTime);
    if (Number.isNaN(d.getTime())) return { day: startTime, time: "" };

    const day = d.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const time = d.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "2-digit",
    });

    return { day, time };
  }

  function statusLabel(status: QuestionStatus) {
    switch (status) {
      case "open":
        return "Open";
      case "pending":
        return "Pending";
      case "final":
        return "Final";
      case "void":
        return "Void";
      default:
        return status;
    }
  }

  function statusClasses(status: QuestionStatus) {
    switch (status) {
      case "open":
        return "inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30";
      case "pending":
        return "inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30";
      case "final":
        return "inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 border border-sky-500/30";
      case "void":
        return "inline-flex items-center rounded-full bg-slate-500/15 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-500/30";
      default:
        return "inline-flex items-center rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100";
    }
  }

  const filters: { key: QuestionStatus | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "pending", label: "Pending" },
    { key: "final", label: "Final" },
    { key: "void", label: "Void" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Make your picks
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            Answer the questions quarter by quarter to keep your streak alive.
            Your streak still counts towards the global leaderboard and any
            private leagues you&apos;re in.
          </p>
        </header>

        {/* Filters + search */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 p-1 shadow-inner shadow-slate-900/70">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium sm:px-4 sm:py-1.5 sm:text-sm ${
                  activeFilter === f.key
                    ? "bg-orange-500 text-slate-950 shadow-md shadow-orange-500/60"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="w-full max-w-xs self-start sm:self-auto">
            <label className="relative block text-xs text-slate-300">
              <span className="sr-only">Search by team, venue or question</span>
              <input
                type="text"
                value={searchTerm}
                onChange={onSearchChange}
                placeholder="Search by team, venue or question…"
                className="w-full rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </label>
          </div>
        </section>

        {/* Body */}
        <section className="mt-2">
          {loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-10 text-center text-sm text-slate-300">
              Loading picks…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-700/60 bg-red-950/40 px-4 py-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && filteredRows.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-10 text-center text-sm text-slate-300">
              No questions match those filters yet. Check back closer to the
              first bounce.
            </div>
          )}

          <div className="mt-2 flex flex-col gap-4">
            {filteredRows.map((row) => {
              const { day, time } = formatStart(row.startTime);
              const isSaving = savingPickId === row.id;

              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/80 px-4 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.65)] sm:px-5 sm:py-5"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: match + venue + meta */}
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-50 sm:text-base">
                        {row.match}
                      </div>
                      <div className="text-xs text-slate-400 sm:text-[13px]">
                        {row.venue}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>
                          {day}
                          {time && `, ${time}`}
                        </span>

                        {/* SPORT BADGE – between date/time and status area */}
                        <SportBadge
                          sport={(row.sport as SportType) ?? ("afl" as SportType)}
                        />
                      </div>
                    </div>

                    {/* Right: Q + status + comments link */}
                    <div className="flex flex-col items-end gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                          Q{row.quarter}
                        </span>
                        <span className={statusClasses(row.status)}>
                          {statusLabel(row.status)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        Comments (0)
                      </button>
                    </div>
                  </div>

                  {/* Question text */}
                  <div className="mt-4 text-sm font-semibold text-slate-50 sm:text-base">
                    {row.question}
                  </div>

                  {/* Yes / No buttons */}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handlePick(row, "yes")}
                        className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold ${
                          row.userPick === "yes"
                            ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/60"
                            : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                        } disabled:opacity-60`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handlePick(row, "no")}
                        className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold ${
                          row.userPick === "no"
                            ? "bg-rose-500 text-slate-950 shadow-md shadow-rose-500/60"
                            : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                        } disabled:opacity-60`}
                      >
                        No
                      </button>
                    </div>

                    {/* Crowd percentages */}
                    <div className="mt-2 flex flex-col items-start gap-1 sm:mt-0 sm:items-end">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">
                        Crowd tips
                      </span>
                      <div className="flex gap-3 text-xs text-slate-200">
                        <span>
                          Yes{" "}
                          <span className="font-semibold">
                            {row.yesPercent ?? 0}%
                          </span>
                        </span>
                        <span>
                          No{" "}
                          <span className="font-semibold">
                            {row.noPercent ?? 0}%
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
