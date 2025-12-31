// /app/picks/[matchSlug]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, useParams } from "next/navigation";
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
  stroke: "rgba(255,255,255,0.10)",
  textDim: "rgba(255,255,255,0.70)",
  textFaint: "rgba(255,255,255,0.50)",
  red: "#FF2E4D",
  redSoft: "rgba(255,46,77,0.18)",
  redSoft2: "rgba(255,46,77,0.10)",
  good: "rgba(25,195,125,0.95)",
  white: "rgba(255,255,255,0.98)",
};

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  return `torpie:picks:v9:${uid || "anon"}:${roundNumber ?? "na"}`;
}

function safeLockedKey(uid: string | null, roundNumber: number | null) {
  return `torpie:lockedPicks:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
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

function effectivePick(local: LocalPick | undefined, api: PickOutcome | undefined): PickOutcome | undefined {
  if (local === "none") return undefined;
  if (local === "yes" || local === "no") return local;
  return api;
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Player detection:
 * - If question starts with "Will " → extract likely player name then slugify → /public/players/<slug>.jpg
 * Example: "Will Charlie Curnow kick a goal?" → /players/charlie-curnow.jpg
 */
function extractPlayerName(qText: string): string | null {
  const t = (qText || "").trim();
  if (!t.toLowerCase().startsWith("will ")) return null;

  const rest = t.slice(5);

  const cutPoints = [
    rest.indexOf("("),
    rest.toLowerCase().indexOf(" have "),
    rest.toLowerCase().indexOf(" kick "),
    rest.toLowerCase().indexOf(" score "),
    rest.toLowerCase().indexOf(" get "),
    rest.toLowerCase().indexOf(" record "),
  ].filter((x) => x > 0);

  if (cutPoints.length) {
    const idx = Math.min(...cutPoints);
    return rest.slice(0, idx).trim();
  }

  // fallback: first 2 words (best-effort)
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`.trim();
  return null;
}

function parseTeamsFromMatch(match: string): { home: string | null; away: string | null } {
  const raw = (match || "").trim();
  const parts = raw.split(/\s+vs\s+|\s+v\s+/i);
  if (parts.length >= 2) return { home: parts[0]?.trim() || null, away: parts[1]?.trim() || null };
  return { home: null, away: null };
}

/**
 * Exact mapping to YOUR /public/aflteams filenames.
 * (Based on your screenshot)
 */
function teamToFileKey(name: string): string {
  const n = (name || "").trim().toLowerCase();

  const map: Record<string, string> = {
    "adelaide": "adelaide",
    "adelaide crows": "adelaide",

    "brisbane": "brisbane",
    "brisbane lions": "brisbane",

    "carlton": "carlton",
    "carlton blues": "carlton",

    "collingwood": "collingwood",

    "essendon": "essendon",

    "fremantle": "fremantle",
    "fremantle dockers": "fremantle",

    "geelong": "geelong",
    "geelong cats": "geelong",

    "gold coast": "goldcoast",
    "gold coast suns": "goldcoast",

    "gws": "gws",
    "giants": "gws",
    "greater western sydney": "gws",

    "hawthorn": "hawthorn",

    "melbourne": "melbourne",

    "north melbourne": "northmelbourne",
    "kangaroos": "northmelbourne",

    "port adelaide": "portadelaide",

    "richmond": "richmond",

    "st kilda": "stkilda",
    "saints": "stkilda",

    "sydney": "sydney",
    "sydney swans": "sydney",

    "west coast": "westcoast",
    "west coast eagles": "westcoast",

    "western bulldogs": "westernbulldogs",
    "bulldogs": "westernbulldogs",
  };

  if (map[n]) return map[n];

  // fallback: smash spaces
  return n.replace(/\s+/g, "");
}

type LocalPickMap = Record<string, LocalPick>;
type LockedGamesMap = Record<string, boolean>;

type SlipPick = {
  questionId: string;
  quarter: number;
  question: string;
  outcome: PickOutcome;
};

function TeamLogo({
  teamName,
  fileKey,
}: {
  teamName: string;
  fileKey: string;
}) {
  // Try jpg first, then jpeg (needed for your sydney-logo.jpeg)
  const [useJpeg, setUseJpeg] = useState(false);
  const src = useJpeg ? `/aflteams/${fileKey}-logo.jpeg` : `/aflteams/${fileKey}-logo.jpg`;

  return (
    <div
      className="relative h-[52px] w-[52px] rounded-2xl overflow-hidden border"
      style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
      title={teamName}
    >
      <Image
        src={src}
        alt={`${teamName} logo`}
        fill
        sizes="52px"
        style={{ objectFit: "cover" }}
        onError={() => {
          // if jpg fails, try jpeg once
          if (!useJpeg) setUseJpeg(true);
        }}
      />
    </div>
  );
}

export default function PicksMatchSlugPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ matchSlug: string }>();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [localPicks, setLocalPicks] = useState<LocalPickMap>({});
  const [lockedGames, setLockedGames] = useState<LockedGamesMap>({});

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState("");

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
      setErr("Could not load this match right now.");
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

  const gameIdFromQuery = searchParams.get("game");

  const activeGame = useMemo(() => {
    if (!games.length) return null;

    if (gameIdFromQuery) {
      const byId = games.find((g) => g.id === gameIdFromQuery);
      if (byId) return byId;
    }

    const slug = (params?.matchSlug || "").toString();
    const bySlug = games.find((g) => slugify(g.match) === slug);
    return bySlug ?? null;
  }, [games, gameIdFromQuery, params]);

  const lockMs = useMemo(() => {
    if (!activeGame) return 0;
    return new Date(activeGame.startTime).getTime() - nowMs;
  }, [activeGame, nowMs]);

  const gameLockedByTime = lockMs <= 0;
  const gameLockedByUser = activeGame ? !!lockedGames[activeGame.id] : false;
  const interactionLocked = gameLockedByTime || gameLockedByUser;

  const selectedPicks = useMemo(() => {
    if (!activeGame) return 0;
    return activeGame.questions.reduce((acc, q) => {
      const p = effectivePick(localPicks[q.id], q.userPick);
      return acc + (p === "yes" || p === "no" ? 1 : 0);
    }, 0);
  }, [activeGame, localPicks]);

  const slipPicks = useMemo((): SlipPick[] => {
    if (!activeGame) return [];
    const out: SlipPick[] = [];
    for (const q of activeGame.questions) {
      const p = effectivePick(localPicks[q.id], q.userPick);
      if (p !== "yes" && p !== "no") continue;
      out.push({ questionId: q.id, quarter: q.quarter, question: q.question, outcome: p });
    }
    return out.sort((a, b) => a.quarter - b.quarter || a.question.localeCompare(b.question));
  }, [activeGame, localPicks]);

  const togglePick = useCallback(
    async (q: ApiQuestion, outcome: PickOutcome) => {
      if (interactionLocked) return;

      const current = effectivePick(localPicks[q.id], q.userPick);
      const next: LocalPick = current === outcome ? "none" : outcome;

      setLocalPicks((prev) => ({ ...prev, [q.id]: next }));

      if (!user) return;

      try {
        const token = await user.getIdToken();

        if (next === "none") {
          const delRes = await fetch(`/api/user-picks?questionId=${encodeURIComponent(q.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (delRes.ok) return;

          await fetch("/api/user-picks", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: "clear", questionId: q.id }),
          });
          return;
        }

        await fetch("/api/user-picks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            questionId: q.id,
            outcome: next,
            roundNumber: typeof roundNumber === "number" ? roundNumber : null,
            gameId: q.gameId ?? activeGame?.id ?? null,
          }),
        });
      } catch (e) {
        console.error("Pick save error", e);
      }
    },
    [interactionLocked, localPicks, user, roundNumber, activeGame]
  );

  const openConfirm = useCallback(() => {
    if (!activeGame) return;
    if (interactionLocked) return;
    if (selectedPicks <= 0) return;
    setConfirmOpen(true);
    setToast("");
  }, [activeGame, interactionLocked, selectedPicks]);

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);

  const lockInPicks = useCallback(() => {
    if (!activeGame) return;
    if (selectedPicks <= 0) return;

    setLockedGames((prev) => ({ ...prev, [activeGame.id]: true }));
    setConfirmOpen(false);
    setToast("PICKED & LOCKED ✅");

    window.setTimeout(() => setToast(""), 1400);

    window.setTimeout(() => {
      router.push("/picks");
    }, 650);
  }, [activeGame, selectedPicks, router]);

  // Header visual: player image if any "Will {Player}" question exists, else show team logos side-by-side
  const headerVisual = useMemo(() => {
    if (!activeGame) return { type: "none" as const };

    const firstPlayerQ = activeGame.questions.find((q) => !!extractPlayerName(q.question));
    if (firstPlayerQ) {
      const playerName = extractPlayerName(firstPlayerQ.question)!;
      const playerSlug = slugify(playerName);
      const src = `/players/${playerSlug}.jpg`;
      return { type: "player" as const, playerName, src };
    }

    const teams = parseTeamsFromMatch(activeGame.match);
    const homeKey = teams.home ? teamToFileKey(teams.home) : null;
    const awayKey = teams.away ? teamToFileKey(teams.away) : null;

    return {
      type: "teams" as const,
      homeName: teams.home,
      awayName: teams.away,
      homeKey,
      awayKey,
    };
  }, [activeGame]);

  const matchHero = useMemo(() => {
    if (!activeGame) return "";
    return `/matches/${encodeURIComponent(activeGame.id)}.jpg`;
  }, [activeGame]);

  const ConfirmModal = () => {
    if (!confirmOpen || !activeGame) return null;

    const nextStreakAdd = slipPicks.length;
    const roundLabel =
      roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeConfirm();
        }}
        style={{ background: "rgba(0,0,0,0.74)", backdropFilter: "blur(10px)" }}
      >
        <div
          className="w-full max-w-2xl rounded-2xl border overflow-hidden"
          style={{
            borderColor: COLORS.redSoft,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.85)",
          }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{
              borderColor: "rgba(255,46,77,0.20)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-white/55">
                  Confirm Your Path
                </div>
                <div className="mt-1 text-[16px] font-extrabold text-white truncate">
                  {activeGame.match}
                </div>
                <div className="mt-1 text-[12px] text-white/70 truncate">
                  {roundLabel ? `${roundLabel} • ` : ""}
                  {activeGame.venue} • {formatAedt(activeGame.startTime)}
                </div>
              </div>

              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.90)",
                }}
                aria-label="Close confirm"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div
              className="rounded-xl border p-3 text-[12px]"
              style={{
                borderColor: "rgba(255,46,77,0.35)",
                background: "rgba(255,46,77,0.10)",
                color: "rgba(255,255,255,0.90)",
              }}
            >
              <span className="font-black">The Stakes:</span> WIN = streak becomes{" "}
              <span className="font-black">Current + {nextStreakAdd}</span>. MISS ONE ={" "}
              <span className="font-black">streak resets to 0</span>.
            </div>

            <div className="mt-4 space-y-2 max-h-[52vh] overflow-auto pr-1">
              {slipPicks.map((p) => (
                <div
                  key={p.questionId}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: "rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-white/55">
                        Q{p.quarter}
                      </div>
                      <div className="mt-1 text-[13px] text-white/90">{p.question}</div>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border shrink-0"
                      style={{
                        borderColor:
                          p.outcome === "yes"
                            ? "rgba(25,195,125,0.35)"
                            : "rgba(255,46,77,0.35)",
                        background:
                          p.outcome === "yes"
                            ? "rgba(25,195,125,0.10)"
                            : "rgba(255,46,77,0.10)",
                        color:
                          p.outcome === "yes"
                            ? "rgba(25,195,125,0.95)"
                            : "rgba(255,46,77,0.95)",
                      }}
                    >
                      {p.outcome.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="text-[11px] text-white/55">{slipPicks.length} picks selected</div>
              <button
                type="button"
                onClick={lockInPicks}
                className="rounded-xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "rgba(255,46,77,0.55)",
                  background: "rgba(255,46,77,0.18)",
                  color: "rgba(255,255,255,0.95)",
                  boxShadow: "0 14px 40px rgba(255,46,77,0.15)",
                }}
              >
                I’M ALL IN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !activeGame) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
        <div className="w-full max-w-2xl mx-auto px-4 py-6">
          <div className="h-7 w-44 bg-white/10 rounded" />
          <div className="mt-3 h-4 w-72 bg-white/10 rounded" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border p-4"
                style={{ borderColor: COLORS.stroke, background: "rgba(255,255,255,0.03)" }}
              >
                <div className="h-4 w-24 bg-white/10 rounded" />
                <div className="mt-2 h-5 w-full bg-white/10 rounded" />
                <div className="mt-3 h-10 w-full bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (err || !activeGame) {
    return (
      <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          <button
            type="button"
            onClick={() => router.push("/picks")}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            ← Back
          </button>

          <div className="mt-4 text-[16px] font-black" style={{ color: COLORS.red }}>
            {err || "Match not found."}
          </div>
          <div className="mt-2 text-[13px] text-white/65">
            Try going back and opening the match again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <ConfirmModal />

      <div className="w-full max-w-2xl mx-auto px-4 pt-5 pb-28">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/picks")}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99]"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.90)",
            }}
          >
            ← Dashboard
          </button>

          <div className="text-[11px] text-white/55 font-semibold">
            {interactionLocked ? "LOCKED" : lockMs > 0 ? `Locks in ${msToCountdown(lockMs)}` : "LIVE / Locked"}
          </div>
        </div>

        {/* Hero */}
        <div
          className="mt-4 rounded-2xl border overflow-hidden"
          style={{
            borderColor: COLORS.stroke,
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 18px 55px rgba(0,0,0,0.75)",
          }}
        >
          <div className="relative h-[170px]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
              }}
            />
            <Image
              src={matchHero}
              alt={activeGame.match}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              style={{ objectFit: "cover", opacity: 0.55 }}
              onError={() => {}}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.88) 100%)" }}
            />

            <div className="absolute left-4 right-4 bottom-3">
              <div className="text-[11px] text-white/65 font-semibold">{formatAedt(activeGame.startTime)}</div>
              <div className="mt-1 text-[22px] font-black text-white truncate">{activeGame.match}</div>
              <div className="mt-1 text-[12px] text-white/65 truncate">{activeGame.venue}</div>
            </div>
          </div>

          {/* Visual strip */}
          <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            {headerVisual.type === "player" ? (
              <div className="flex items-center gap-3">
                <div
                  className="relative h-[52px] w-[52px] rounded-2xl overflow-hidden border"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
                  title={headerVisual.playerName}
                >
                  <Image src={headerVisual.src} alt={headerVisual.playerName} fill sizes="52px" style={{ objectFit: "cover" }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-white/55">Featured player</div>
                  <div className="mt-0.5 text-[14px] font-black text-white truncate">{headerVisual.playerName}</div>
                </div>
              </div>
            ) : headerVisual.type === "teams" ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {headerVisual.homeName && headerVisual.homeKey ? (
                    <TeamLogo teamName={headerVisual.homeName} fileKey={headerVisual.homeKey} />
                  ) : (
                    <div className="h-[52px] w-[52px] rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)" }} />
                  )}

                  <div className="text-[12px] font-black text-white/80">vs</div>

                  {headerVisual.awayName && headerVisual.awayKey ? (
                    <TeamLogo teamName={headerVisual.awayName} fileKey={headerVisual.awayKey} />
                  ) : (
                    <div className="h-[52px] w-[52px] rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)" }} />
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-widest text-white/55">Focus Mode</div>
                  <div className="mt-0.5 text-[12px] font-black text-white/85">All-or-nothing streak</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-5 space-y-3">
          {activeGame.questions.map((q) => {
            const pick = effectivePick(localPicks[q.id], q.userPick);
            const yesSelected = pick === "yes";
            const noSelected = pick === "no";

            const playerName = extractPlayerName(q.question);
            const playerSrc = playerName ? `/players/${slugify(playerName)}.jpg` : null;

            const isSettled = q.status === "final" || q.status === "void" || q.status === "pending";
            const locked = interactionLocked || isSettled;

            return (
              <div
                key={q.id}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: yesSelected || noSelected ? "rgba(255,46,77,0.45)" : "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  boxShadow: yesSelected || noSelected ? "0 0 0 1px rgba(255,46,77,0.18)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-3">
                    {/* Auto player image */}
                    {playerSrc ? (
                      <div
                        className="relative h-[44px] w-[44px] rounded-2xl overflow-hidden border shrink-0"
                        style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
                        title={playerName || ""}
                      >
                        <Image src={playerSrc} alt={playerName || "Player"} fill sizes="44px" style={{ objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div
                        className="h-[44px] w-[44px] rounded-2xl border shrink-0"
                        style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)" }}
                        aria-hidden="true"
                      />
                    )}

                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-white/55">Q{q.quarter}</div>
                      <div className="mt-1 text-[14px] font-black text-white/95 break-words">{q.question}</div>
                      <div className="mt-1 text-[11px] text-white/55">
                        Status: <span className="font-black text-white/75">{q.status.toUpperCase()}</span>
                        {locked ? <span className="ml-2 text-white/45">• Locked</span> : null}
                      </div>
                    </div>
                  </div>

                  {/* Clear (X) */}
                  <button
                    type="button"
                    disabled={locked || (!yesSelected && !noSelected)}
                    onClick={() => togglePick(q, yesSelected ? "yes" : "no")}
                    className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[12px] font-black active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: "rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.85)",
                    }}
                    title="Clear pick"
                    aria-label="Clear pick"
                  >
                    ✕
                  </button>
                </div>

                {/* YES/NO */}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => togglePick(q, "yes")}
                    className="flex-1 rounded-xl px-4 py-3 text-[13px] font-black tracking-wide border active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: yesSelected ? "rgba(255,46,77,0.65)" : "rgba(255,255,255,0.12)",
                      background: yesSelected
                        ? "linear-gradient(180deg, rgba(255,46,77,0.95), rgba(255,96,120,0.88))"
                        : "rgba(255,255,255,0.04)",
                      color: yesSelected ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.90)",
                      boxShadow: yesSelected ? "0 0 18px rgba(255,46,77,0.18)" : "none",
                    }}
                    aria-pressed={yesSelected}
                  >
                    YES
                  </button>

                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => togglePick(q, "no")}
                    className="flex-1 rounded-xl px-4 py-3 text-[13px] font-black tracking-wide border active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: noSelected ? "rgba(255,46,77,0.65)" : "rgba(255,255,255,0.12)",
                      background: noSelected
                        ? "linear-gradient(180deg, rgba(255,46,77,0.95), rgba(255,96,120,0.88))"
                        : "rgba(255,255,255,0.04)",
                      color: noSelected ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.90)",
                      boxShadow: noSelected ? "0 0 18px rgba(255,46,77,0.18)" : "none",
                    }}
                    aria-pressed={noSelected}
                  >
                    NO
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky footer */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[70] border-t"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="w-full max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest" style={{ color: COLORS.textFaint }}>
                Picks Selected
              </div>
              <div className="mt-1 text-[16px] font-black" style={{ color: COLORS.white }}>
                {selectedPicks} of {activeGame.questions.length}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: COLORS.textDim }}>
                Potential Streak:{" "}
                <span className="font-black" style={{ color: COLORS.red }}>
                  +{selectedPicks}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={interactionLocked || selectedPicks <= 0}
              onClick={openConfirm}
              className="rounded-xl border px-5 py-3 text-[13px] font-black active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed"
              style={{
                borderColor: "rgba(255,46,77,0.55)",
                background: interactionLocked ? "rgba(255,255,255,0.04)" : "rgba(255,46,77,0.18)",
                color: "rgba(255,255,255,0.95)",
                boxShadow: interactionLocked ? "none" : "0 14px 40px rgba(255,46,77,0.12)",
              }}
              title={interactionLocked ? "Locked" : "Lock in picks"}
            >
              {interactionLocked ? "LOCKED" : "LOCK IN PICKS"}
            </button>
          </div>

          {toast ? (
            <div className="mt-2 text-[12px] font-black" style={{ color: COLORS.good }}>
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
