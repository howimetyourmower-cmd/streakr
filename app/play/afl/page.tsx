// /app/play/afl/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any; // API may send "Open"/"Final" etc
  match: string;
  venue: string;
  startTime: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

const COLORS = {
  bg: "#000000",
  panel: "rgba(255,255,255,0.035)",
  panel2: "rgba(255,255,255,0.02)",
  stroke: "rgba(255,255,255,0.10)",
  textDim: "rgba(255,255,255,0.70)",
  textFaint: "rgba(255,255,255,0.50)",

  // Torpie red (fire engine-ish)
  red: "#FF2E4D",
  redSoft: "rgba(255,46,77,0.28)",
  redSoft2: "rgba(255,46,77,0.18)",

  cyan: "rgba(0,229,255,0.95)",
  white: "rgba(255,255,255,0.98)",
};

function normalizeStatus(v: any): QuestionStatus {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("pend")) return "pending";
  if (s.includes("void")) return "void";
  return "open";
}

function formatAedt(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    return d.toLocaleString("en-AU", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return dateIso;
  }
}

function msToCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = (x: number) => String(x).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function PlayAflPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      // Reuse the same API your Picks page uses, so it always matches.
      // This also avoids having to maintain a separate /api/play/afl endpoint.
      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const res = await fetch("/api/picks", {
        headers: { ...authHeader },
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("Play AFL load error:", t);
        throw new Error("Failed to load games");
      }

      const data = (await res.json()) as PicksApiResponse;

      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      console.error(e);
      setErr("Could not load AFL right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const upcomingLockMs = useMemo(() => {
    const future = games
      .map((g) => new Date(g.startTime).getTime())
      .filter((t) => Number.isFinite(t) && t > nowMs)
      .sort((a, b) => a - b);
    if (!future.length) return 0;
    return future[0] - nowMs;
  }, [games, nowMs]);

  // Home-style match card (same vibe as Picks dashboard)
  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const gameLocked = lockMs <= 0;

    const totalQuestions = g.questions?.length ?? 0;

    // Optional: /public/matches/<gameId>.jpg
    const matchImg = `/matches/${encodeURIComponent(g.id)}.jpg`;

    return (
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push(`/picks?game=${encodeURIComponent(g.id)}`)}
          className="relative w-full h-[150px] sm:h-[170px] block text-left"
          title="Open Picks"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,46,77,0.20) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          <Image
            src={matchImg}
            alt={g.match}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            style={{ objectFit: "cover", opacity: 0.55 }}
            onError={() => {}}
          />

          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0.00) 10%, rgba(0,0,0,0.88) 100%)",
            }}
          />

          <div className="absolute left-4 right-4 bottom-3">
            <div className="text-[11px] text-white/70 font-semibold">{formatAedt(g.startTime)}</div>
            <div className="mt-1 text-[18px] font-black text-white truncate">{g.match}</div>

            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {totalQuestions} questions
              </span>

              {gameLocked ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  LIVE / Locked
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,46,77,0.28)",
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  Locks in {msToCountdown(lockMs)}
                </span>
              )}
            </div>
          </div>
        </button>

        <div
          className="px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "rgba(0,0,0,0.92)",
          }}
        >
          <div className="text-[12px] font-semibold" style={{ color: "rgba(0,0,0,0.70)" }}>
            {g.venue}
          </div>

          <div className="mt-1 text-[12px]" style={{ color: "rgba(0,0,0,0.55)" }}>
            Pick any amount (0, 1, 5 or all 12).
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/picks?game=${encodeURIComponent(g.id)}`)}
              className="rounded-xl px-4 py-2 text-[12px] font-black border active:scale-[0.99]"
              style={{
                borderColor: "rgba(0,0,0,0.10)",
                background: `linear-gradient(180deg, ${COLORS.red} 0%, rgba(255,46,77,0.82) 100%)`,
                color: "rgba(255,255,255,0.98)",
                boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
              }}
            >
              PLAY NOW
            </button>

            <span className="text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
              Opens Picks (tunnel view)
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black">Play AFL</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: COLORS.redSoft,
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm" style={{ color: COLORS.textDim }}>
              Choose a match — we’ll drop you straight into Picks for that game.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              How to play
            </Link>

            <Link
              href="/picks"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,46,77,0.30)",
                background: "rgba(255,46,77,0.10)",
              }}
            >
              Go to Picks
            </Link>
          </div>
        </div>

        {/* Compact strip */}
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: COLORS.redSoft,
            background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
            boxShadow: "0 18px 55px rgba(0,0,0,0.80)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/55">Next lock</div>
                <div className="mt-1 text-[18px] font-black" style={{ color: COLORS.red }}>
                  {upcomingLockMs > 0 ? msToCountdown(upcomingLockMs) : "—"}
                </div>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/55">Matches</div>
                <div className="mt-1 text-[18px] font-black" style={{ color: COLORS.cyan }}>
                  {games.length}
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-white/55">
              <div className="font-black text-white/80">Tap a match card to start picking.</div>
              <div className="text-white/45">This page is just the AFL lobby.</div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err}{" "}
            <button
              type="button"
              onClick={load}
              className="underline font-black"
              style={{ color: COLORS.cyan }}
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Grid */}
        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-white/55">Featured Matches</div>
              <div className="mt-1 text-[14px] text-white/75">Pick any amount — one miss resets your streak.</div>
            </div>
            <div className="text-[12px] text-white/45 hidden sm:block">Opens /picks?game=</div>
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="h-[170px] bg-white/5" />
                  <div className="h-[120px]" style={{ background: "rgba(255,255,255,0.92)" }} />
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <div
              className="mt-4 rounded-2xl border p-4 text-sm text-white/70"
              style={{
                borderColor: COLORS.redSoft,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              No games found.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((g) => (
                <MatchCard key={g.id} g={g} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center text-[11px] text-white/45">
            <span className="font-black" style={{ color: COLORS.red }}>
              Torpie
            </span>{" "}
            — Lobby → Picks (match view) → Slip → Lock.
          </div>
        </div>
      </div>
    </div>
  );
}
