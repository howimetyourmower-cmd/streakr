// /app/play/afl/page.tsx
"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

/* ================= TYPES ================= */

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any;
  playerName?: string;
  playerImage?: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  heroImage?: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
};

/* ================= HELPERS ================= */

function normalizeStatus(v: any): QuestionStatus {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("pend")) return "pending";
  if (s.includes("void")) return "void";
  return "open";
}

function formatAEST(dt: string) {
  return new Date(dt).toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ================= PAGE ================= */

export default function PlayAflPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PicksApiResponse | null>(null);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Record<string, LocalPick>>>(
    {}
  );
  const [locked, setLocked] = useState<Record<string, boolean>>({});

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/play/afl", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load AFL games");
        const json = (await res.json()) as PicksApiResponse;
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const games = data?.games ?? [];
  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null;

  const picksForGame = selectedGameId ? draft[selectedGameId] ?? {} : {};

  const picksCount = Object.values(picksForGame).filter(
    (v) => v === "yes" || v === "no"
  ).length;

  /* ================= ACTIONS ================= */

  function setPick(gameId: string, qid: string, pick: LocalPick) {
    setDraft((prev) => ({
      ...prev,
      [gameId]: { ...(prev[gameId] ?? {}), [qid]: pick },
    }));
  }

  async function lockPicks() {
    if (!user || !selectedGame) return;

    const picks = Object.entries(picksForGame)
      .filter(([, v]) => v === "yes" || v === "no")
      .map(([qid, pick]) => ({
        questionId: qid,
        pick,
      }));

    await addDoc(collection(db, "picks"), {
      userId: user.uid,
      gameId: selectedGame.id,
      match: selectedGame.match,
      picks,
      createdAt: serverTimestamp(),
    });

    setLocked((p) => ({ ...p, [selectedGame.id]: true }));
  }

  /* ================= RENDER ================= */

  if (loading) {
    return <div className="container py-10">Loading AFL…</div>;
  }

  if (error) {
    return (
      <div className="container py-10 text-red-500 font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container py-6">

        {/* ================= MATCH GRID ================= */}
        {!selectedGame && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGameId(g.id)}
                className="card text-left"
              >
                <div className="relative h-36">
                  {g.heroImage && (
                    <Image
                      src={g.heroImage}
                      alt={g.match}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-4">
                  <div className="font-black">{g.match}</div>
                  <div className="text-sm text-text-secondary">
                    {formatAEST(g.startTime)}
                  </div>
                  <div className="mt-2 text-xs">
                    {g.questions.length} questions
                  </div>
                  <div className="mt-3">
                    <span className="btn btn-primary btn-sm">PLAY NOW</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ================= PICKS ================= */}
        {selectedGame && (
          <>
            <button
              className="btn btn-ghost mb-4"
              onClick={() => setSelectedGameId(null)}
            >
              ← Back to matches
            </button>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {selectedGame.questions.map((q) => {
                const current = picksForGame[q.id] ?? "none";
                const status = normalizeStatus(q.status);

                return (
                  <div
                    key={q.id}
                    className="rounded-2xl bg-white p-4 text-black"
                  >
                    <div className="text-xs font-black mb-1">
                      Q{q.quarter} • {status.toUpperCase()}
                    </div>
                    <div className="font-black mb-3">{q.question}</div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={status !== "open"}
                        onClick={() =>
                          setPick(
                            selectedGame.id,
                            q.id,
                            current === "yes" ? "none" : "yes"
                          )
                        }
                        className={`btn ${
                          current === "yes"
                            ? "btn-success"
                            : "btn-outline"
                        }`}
                      >
                        YES
                      </button>

                      <button
                        disabled={status !== "open"}
                        onClick={() =>
                          setPick(
                            selectedGame.id,
                            q.id,
                            current === "no" ? "none" : "no"
                          )
                        }
                        className={`btn ${
                          current === "no"
                            ? "btn-error"
                            : "btn-outline"
                        }`}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <button
                disabled={picksCount === 0 || locked[selectedGame.id]}
                onClick={lockPicks}
                className="btn btn-primary"
              >
                LOCK {picksCount} PICKS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
