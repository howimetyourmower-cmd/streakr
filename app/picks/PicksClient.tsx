// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

/* ================= TYPES ================= */

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: "open" | "final" | "pending" | "void";
  userPick?: "yes" | "no";
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
  currentStreak?: number;
  leaderScore?: number;
};

/* ================= CONSTS ================= */

const COLORS = {
  bg: "#000000",
  red: "#FF2E4D",
  green: "#2DFF7A",
};

/* ================= HELPERS ================= */

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
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitMatch(match: string): { home: string; away: string } | null {
  const m = (match || "").split(/\s+vs\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}

/* ================= AFL SILHOUETTE ================= */

function AflSilhouette() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <Image
        src="/afl1.png"
        alt=""
        fill
        sizes="100vw"
        style={{ objectFit: "contain" }}
        className="opacity-[0.07]"
        priority={false}
      />
    </div>
  );
}

/* ================= COMPONENT ================= */

export default function PicksPage() {
  const { user } = useAuth();

  const [games, setGames] = useState<ApiGame[]>([]);
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [leaderScore, setLeaderScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loadPicks = useCallback(async () => {
    try {
      setLoading(true);
      let headers: Record<string, string> = {};
      if (user) {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/picks", { headers, cache: "no-store" });
      if (!res.ok) throw new Error();

      const data = (await res.json()) as PicksApiResponse;

      setGames(data.games || []);
      setRoundNumber(data.roundNumber ?? null);
      setCurrentStreak(data.currentStreak ?? 0);
      setLeaderScore(data.leaderScore ?? null);
    } catch {
      setErr("Could not load picks.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)),
    [games]
  );

  const nextUp = sortedGames.find((g) => new Date(g.startTime).getTime() > nowMs) || null;

  const MatchCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const m = splitMatch(g.match);

    return (
      <Link
        href={`/picks/${slugify(g.match)}`}
        className="block rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div className="relative p-5 min-h-[190px]">
          <AflSilhouette />

          <div className="relative z-10 text-center">
            <div className="text-sm font-black text-white">{g.match}</div>
            <div className="mt-2 text-[11px] text-white/70">
              {lockMs <= 0 ? "LIVE / Locked" : `Locks in ${msToCountdown(lockMs)}`}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-white text-black">
          <div className="text-xs opacity-70">{g.venue}</div>
          <div className="mt-3">
            <span className="inline-flex rounded-xl px-5 py-2 text-xs font-black bg-red-500 text-white">
              PLAY NOW
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-4xl font-black">Picks</h1>

        {err && <div className="mt-4 text-red-400">{err}</div>}

        {nextUp && (
          <div className="mt-6 rounded-3xl overflow-hidden border relative">
            <AflSilhouette />
            <div className="relative z-10 p-6 text-center">
              <div className="text-sm uppercase tracking-widest text-white/70">Next Up</div>
              <div className="mt-2 text-3xl font-black">{nextUp.match}</div>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? null
            : sortedGames.map((g) => <MatchCard key={g.id} g={g} />)}
        </div>

        <div className="mt-10 text-center text-xs text-white/50">TORPIE © 2026</div>
      </div>
    </div>
  );
}
