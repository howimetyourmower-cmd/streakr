// /app/picks/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: QuestionStatus;

  userPick?: PickOutcome;
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;

  sponsorName?: string;
  sponsorPrize?: string;
  sponsorExcludeFromStreak?: boolean;

  venue?: string;
  startTime?: string;
  correctPick?: boolean;
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
  orange: "#FF2E4D",
  orangeSoft: "rgba(255,46,77,0.28)",
  cyan: "rgba(0,229,255,0.95)",
  white: "rgba(255,255,255,0.98)",
};

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

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `torpie:picks:v9:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function safeLockedKey(uid: string | null, roundNumber: number | null) {
  return `torpie:lockedPicks:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function effectivePick(local: LocalPick | undefined, api: PickOutcome | undefined): PickOutcome | undefined {
  if (local === "none") return undefined;
  if (local === "yes" || local === "no") return local;
  return api;
}

function slugifyMatch(match: string): string {
  return (match || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type LocalPickMap = Record<string, LocalPick>;
type LockedGamesMap = Record<string, boolean>;

export default function PicksDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [localPicks, setLocalPicks] = useState<LocalPickMap>({});
  const [lockedGames, setLockedGames] = useState<LockedGamesMap>({});

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const hasHydratedLocalRef = useRef(false);
  const hasHydratedLockedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadPicks = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const res = await fetch("/api/picks", { headers: { ...authHeader }, cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;
      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      console.error(e);
      setErr("Could not load picks right now.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPicks();
  }, [loadPicks]);

  // Hydrate local picks
  useEffect(() => {
    if (hasHydratedLocalRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalPickMap;
        if (parsed && typeof parsed === "object") setLocalPicks(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate local picks", e);
    } finally {
      hasHydratedLocalRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(localPicks));
    } catch {}
  }, [localPicks, user?.uid, roundNumber]);

  // Hydrate locked games
  useEffect(() => {
    if (hasHydratedLockedRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeLockedKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LockedGamesMap;
        if (parsed && typeof parsed === "object") setLockedGames(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate locked games", e);
    } finally {
      hasHydratedLockedRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeLockedKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(lockedGames));
    } catch {}
  }, [lockedGames, user?.uid, roundNumber]);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const GameCard = ({ g }: { g: ApiGame }) => {
    const lockMs = new Date(g.startTime).getTime() - nowMs;
    const gameLocked = lockMs <= 0;

    const picked = g.questions.reduce((acc, q) => {
      const p = effectivePick(localPicks[q.id], q.userPick);
      return acc + (p === "yes" || p === "no" ? 1 : 0);
    }, 0);

    const total = g.questions.length;
    const isLockedByUser = !!lockedGames[g.id];

    const slug = slugifyMatch(g.match);

    // Optional: /public/matches/<gameId>.jpg (if you add later)
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
        {/* Top image (NO PULSE / NO ANIMATION) */}
        <button
          type="button"
          onClick={() => router.push(`/picks/${slug}?game=${encodeURIComponent(g.id)}`)}
          className="relative w-full h-[150px] sm:h-[170px] block"
          title="Open match"
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

          {/* IMPORTANT: Removed the old “Sydney vs Carlton” top strip entirely (no pulsing header). */}
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
                {picked}/{total} picks
              </span>

              {isLockedByUser ? (
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(25,195,125,0.35)",
                    background: "rgba(25,195,125,0.10)",
                    color: "rgba(25,195,125,0.95)",
                  }}
                >
                  PICKED &amp; LOCKED ✅
                </span>
              ) : gameLocked ? (
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

        {/* White bottom panel */}
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
            {total} questions (pick any amount)
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/picks/${slug}?game=${encodeURIComponent(g.id)}`)}
              className="rounded-xl px-4 py-2 text-[12px] font-black border active:scale-[0.99]"
              style={{
                borderColor: "rgba(0,0,0,0.10)",
                background: `linear-gradient(180deg, ${COLORS.orange} 0%, rgba(255,46,77,0.82) 100%)`,
                color: "rgba(255,255,255,0.98)",
                boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
              }}
            >
              PLAY NOW
            </button>

            <span className="text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
              Dedicated match page
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
              <h1 className="text-3xl sm:text-4xl font-black">Picks</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: COLORS.orangeSoft,
                    background: "rgba(255,46,77,0.10)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-white/60">
              Tap a match → focus mode → lock in. No distractions.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/how-to-play")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              How to play
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.orange }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Featured matches */}
        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-white/55">Featured Matches</div>
              <div className="mt-1 text-[14px] text-white/75">Pick any amount — questions live inside the match page.</div>
            </div>
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
                borderColor: COLORS.orangeSoft,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              No games found.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((g) => (
                <GameCard key={g.id} g={g} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center text-[11px] text-white/45">
            <span className="font-black" style={{ color: COLORS.orange }}>
              Torpie
            </span>{" "}
            — One miss and it’s back to zero.
          </div>
        </div>
      </div>
    </div>
  );
}
