// /app/play/afl/AflPlayClient.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

type ApiQuestion = {
  id: string;
  gameId?: string;
  quarter: number;
  question: string;
  status: any; // API may send "Open"/"Final" etc
  match: string;
  venue: string;
  startTime: string;

  // Optional UI enrichers (safe if absent)
  playerName?: string;
  playerImage?: string; // /players/Charlie Curnow.jpg etc
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string; // /teams/Carlton.png
  awayLogo?: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
  // Optional
  heroImage?: string; // /matches/sydney-v-carlton.jpg
  homeTeam?: string;
  awayTeam?: string;
  homeLogo?: string;
  awayLogo?: string;
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

type MatchLockState = {
  locked: boolean;
  lockedAt?: string;
  picks: Record<string, PickOutcome>;
};

const LS_PREFIX = "torpy:afl";
const LS_LOCKS_KEY = `${LS_PREFIX}:locks`; // per user id is appended
const LS_DRAFT_KEY = `${LS_PREFIX}:draft`; // per user id is appended

function normalizeStatus(v: any): QuestionStatus {
  const s = String(v ?? "").toLowerCase();
  if (s === "open") return "open";
  if (s === "final") return "final";
  if (s === "pending") return "pending";
  if (s === "void") return "void";
  // tolerate older values
  if (s.includes("open")) return "open";
  if (s.includes("final")) return "final";
  if (s.includes("pend")) return "pending";
  if (s.includes("void")) return "void";
  return "open";
}

function formatAest(dtIso: string): string {
  try {
    const d = new Date(dtIso);
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
    return dtIso;
  }
}

function minutesToKickoff(dtIso: string): number | null {
  try {
    const t = new Date(dtIso).getTime();
    const now = Date.now();
    return Math.round((t - now) / 60000);
  } catch {
    return null;
  }
}

function safeBase64UrlEncode(obj: any): string {
  const json = JSON.stringify(obj);
  const b64 =
    typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(json)))
      : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeBase64UrlDecode<T>(s: string): T | null {
  try {
    const b64 =
      s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const json = decodeURIComponent(escape(window.atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function buildShareText(args: {
  match: string;
  venue: string;
  startTime: string;
  picks: Array<{ question: string; pick: PickOutcome; quarter: number }>;
}): string {
  const lines: string[] = [];
  lines.push(`TORPY PICKS`);
  lines.push(`${args.match}`);
  lines.push(`${args.venue}`);
  lines.push(`${formatAest(args.startTime)}`);
  lines.push("");
  lines.push(`My Parlay (${args.picks.length}):`);
  for (const p of args.picks) {
    const tag = p.pick === "yes" ? "YES" : "NO";
    lines.push(`Q${p.quarter}: ${tag} — ${p.question}`);
  }
  lines.push("");
  lines.push(`1 wrong = 0. How long can you last?`);
  return lines.join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

async function readUserProfileStreak(userId: string): Promise<number | null> {
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    const n = Number(data?.currentStreak ?? data?.streak ?? data?.aflStreak);
    if (Number.isFinite(n)) return n;
    return null;
  } catch {
    return null;
  }
}

export default function AflPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PicksApiResponse | null>(null);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const [draftByGame, setDraftByGame] = useState<
    Record<string, Record<string, LocalPick>>
  >({});
  const [locksByGame, setLocksByGame] = useState<Record<string, MatchLockState>>(
    {}
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareReadOnly, setShareReadOnly] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const [currentStreak, setCurrentStreak] = useState<number | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const userKey = useMemo(() => {
    const uid = user?.uid ?? "anon";
    return uid;
  }, [user?.uid]);

  const locksStorageKey = useMemo(
    () => `${LS_LOCKS_KEY}:${userKey}`,
    [userKey]
  );
  const draftStorageKey = useMemo(
    () => `${LS_DRAFT_KEY}:${userKey}`,
    [userKey]
  );

  // Load API
  useEffect(() => {
    let alive = true;

    async function run() {
      setApiLoading(true);
      setApiError(null);

      try {
        const res = await fetch("/api/play/afl", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load AFL games (${res.status})`);
        }
        const data = (await res.json()) as PicksApiResponse;

        const games = (data.games ?? []).map((g) => ({
          ...g,
          questions: (g.questions ?? []).map((q) => ({
            ...q,
            gameId: q.gameId ?? g.id,
          })),
        }));

        if (!alive) return;
        setPayload({ ...data, games });
      } catch (e: any) {
        if (!alive) return;
        setApiError(e?.message ?? "Failed to load games.");
      } finally {
        if (!alive) return;
        setApiLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  // Load streak (optional)
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!user?.uid) {
        setCurrentStreak(null);
        return;
      }
      const s = await readUserProfileStreak(user.uid);
      if (!alive) return;
      setCurrentStreak(s);
    }
    run();
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  // Load local draft + locks
  useEffect(() => {
    try {
      const rawLocks = localStorage.getItem(locksStorageKey);
      if (rawLocks) {
        const parsed = JSON.parse(rawLocks) as Record<string, MatchLockState>;
        setLocksByGame(parsed ?? {});
      }
    } catch {}
    try {
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as Record<
          string,
          Record<string, LocalPick>
        >;
        setDraftByGame(parsed ?? {});
      }
    } catch {}
  }, [locksStorageKey, draftStorageKey]);

  // Persist draft + locks
  useEffect(() => {
    try {
      localStorage.setItem(locksStorageKey, JSON.stringify(locksByGame));
    } catch {}
  }, [locksByGame, locksStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draftByGame));
    } catch {}
  }, [draftByGame, draftStorageKey]);

  // Handle share param (?parlay=...)
  useEffect(() => {
    const parlayParam = searchParams?.get("parlay");
    if (!parlayParam) return;

    const decoded = safeBase64UrlDecode<{
      gameId: string;
      match: string;
      venue: string;
      startTime: string;
      picks: Array<{
        questionId: string;
        question: string;
        pick: PickOutcome;
        quarter: number;
      }>;
    }>(parlayParam);

    if (!decoded?.gameId) return;

    setSelectedGameId(decoded.gameId);

    setShareReadOnly(true);
    setShareOpen(true);

    setDraftByGame((prev) => {
      const existing = prev?.[decoded.gameId];
      if (existing && Object.keys(existing).length > 0) return prev;
      const next = { ...(prev ?? {}) };
      next[decoded.gameId] = {};
      for (const p of decoded.picks ?? []) next[decoded.gameId][p.questionId] = p.pick;
      return next;
    });
  }, [searchParams]);

  const games = payload?.games ?? [];

  const selectedGame = useMemo(() => {
    if (!selectedGameId) return null;
    return games.find((g) => g.id === selectedGameId) ?? null;
  }, [games, selectedGameId]);

  const draftForSelected = useMemo(() => {
    if (!selectedGameId) return {};
    return draftByGame[selectedGameId] ?? {};
  }, [draftByGame, selectedGameId]);

  const lockedForSelected = useMemo(() => {
    if (!selectedGameId) return null;
    return locksByGame[selectedGameId] ?? null;
  }, [locksByGame, selectedGameId]);

  const selectedPicksList = useMemo(() => {
    if (!selectedGame) return [];
    const out: Array<{ questionId: string; question: string; quarter: number; pick: PickOutcome }> = [];
    const draft = draftForSelected ?? {};
    for (const q of selectedGame.questions ?? []) {
      const lp = draft[q.id];
      if (lp === "yes" || lp === "no") {
        out.push({ questionId: q.id, question: q.question, quarter: q.quarter, pick: lp });
      }
    }
    return out;
  }, [selectedGame, draftForSelected]);

  const picksCount = selectedPicksList.length;

  function setPick(gameId: string, questionId: string, pick: LocalPick) {
    setDraftByGame((prev) => {
      const next = { ...(prev ?? {}) };
      const g = { ...(next[gameId] ?? {}) };
      g[questionId] = pick;
      next[gameId] = g;
      return next;
    });
  }

  function clearAllPicks(gameId: string) {
    setDraftByGame((prev) => {
      const next = { ...(prev ?? {}) };
      next[gameId] = {};
      return next;
    });
  }

  function openConfirm() {
    if (!selectedGameId || !selectedGame) return;
    if (lockedForSelected?.locked) return;
    setConfirmOpen(true);
    setShareReadOnly(false);
  }

  function closeAllModals() {
    setConfirmOpen(false);
    setShareOpen(false);
    setShareReadOnly(false);
  }

  async function confirmLock() {
    if (!selectedGame || !selectedGameId) return;
    if (lockedForSelected?.locked) return;

    const uid = user?.uid ?? null;

    const lockPayload: MatchLockState = {
      locked: true,
      lockedAt: new Date().toISOString(),
      picks: {},
    };
    for (const p of selectedPicksList) {
      lockPayload.picks[p.questionId] = p.pick;
    }

    setLocksByGame((prev) => ({
      ...(prev ?? {}),
      [selectedGameId]: lockPayload,
    }));

    if (uid) {
      try {
        const picksCol = collection(db, "picks");
        await addDoc(picksCol, {
          userId: uid,
          sport: "AFL",
          gameId: selectedGameId,
          match: selectedGame.match,
          venue: selectedGame.venue,
          startTime: selectedGame.startTime,
          picks: selectedPicksList.map((p) => ({
            questionId: p.questionId,
            pick: p.pick,
            quarter: p.quarter,
            question: p.question,
          })),
          createdAt: serverTimestamp(),
        });
      } catch {}
    }

    setConfirmOpen(false);
    setShareOpen(true);
    setShareReadOnly(false);
  }

  function buildShareUrl(game: ApiGame) {
    const picks = selectedPicksList.map((p) => ({
      questionId: p.questionId,
      question: p.question,
      pick: p.pick,
      quarter: p.quarter,
    }));

    const parlay = {
      gameId: game.id,
      match: game.match,
      venue: game.venue,
      startTime: game.startTime,
      picks,
    };

    const encoded = safeBase64UrlEncode(parlay);
    const url = new URL(window.location.href);
    url.searchParams.set("parlay", encoded);
    return url.toString();
  }

  async function shareParlay() {
    if (!selectedGame) return;

    const text = buildShareText({
      match: selectedGame.match,
      venue: selectedGame.venue,
      startTime: selectedGame.startTime,
      picks: selectedPicksList.map((p) => ({
        question: p.question,
        pick: p.pick,
        quarter: p.quarter,
      })),
    });

    const url = buildShareUrl(selectedGame);

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Torpy Parlay",
          text,
          url,
        });
        setShareToast("Shared ✅");
        setTimeout(() => setShareToast(null), 1800);
        return;
      }
    } catch {}

    const ok = await copyToClipboard(`${text}\n\n${url}`);
    setShareToast(ok ? "Copied ✅" : "Copy failed");
    setTimeout(() => setShareToast(null), 1800);
  }

  // Close modal with ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAllModals();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showMatchView = !!selectedGame;

  return (
    <div className="min-h-screen">
      <div className="container py-6">
        {/* Top row: Mission Control */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wide text-text-secondary">
                Dashboard
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-lg font-black">Current Streak</div>
                {/* REMOVED: animate-streak (was causing pulsing) */}
                <div className="streak-glow text-lg font-black">
                  {currentStreak ?? 0}
                </div>
              </div>
              <div className="mt-1 text-xs text-text-tertiary">
                1 wrong = 0 (Clean Sweep)
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wide text-text-secondary">
                How it works
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                Pick any amount — 0, 1, 5 or all 12. Use the{" "}
                <span className="font-black">X</span> to clear.
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                Click a match to enter{" "}
                <span className="font-black">Tunnel Vision</span>.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push("/picks")}
              type="button"
            >
              Go to Picks
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/")}
              type="button"
            >
              Home
            </button>
          </div>
        </div>

        {/* Sponsor placeholder */}
        <div
          className="sponsor-banner mb-6"
          aria-label="Sponsor banner placeholder"
        />

        {/* Loading / Error */}
        {apiLoading ? (
          <div className="card p-5">
            <div className="text-sm font-black">Loading matches…</div>
            <div className="mt-1 text-sm text-text-secondary">
              Pulling live questions and match cards.
            </div>
          </div>
        ) : apiError ? (
          <div className="card p-5">
            <div className="text-sm font-black">Couldn’t load AFL matches</div>
            <div className="mt-2 text-sm text-text-secondary">{apiError}</div>
            <div className="mt-4">
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {/* MATCH CARDS GRID (Home-style portal) */}
        {!apiLoading && !apiError && !showMatchView && (
          <div>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-xl font-black">Featured Matches</div>
                <div className="text-sm text-text-secondary">
                  Click a match card to enter picks (reduces decision paralysis).
                </div>
              </div>
              <div className="chip chip-open">
                {payload?.roundNumber ? `Round ${payload.roundNumber}` : "AFL"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {games.map((g) => {
                const lock = locksByGame[g.id];
                const draft = draftByGame[g.id] ?? {};
                const draftCount = Object.values(draft).filter(
                  (v) => v === "yes" || v === "no"
                ).length;

                const mins = minutesToKickoff(g.startTime);
                const kickoffLabel =
                  mins === null
                    ? formatAest(g.startTime)
                    : mins > 0
                    ? `Starts in ${mins}m`
                    : mins === 0
                    ? "Starting now"
                    : "LIVE / In progress";

                const hero = g.heroImage;

                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGameId(g.id)}
                    className="group card overflow-hidden text-left"
                  >
                    <div className="relative h-36 w-full">
                      {hero ? (
                        <Image
                          src={hero}
                          alt={g.match}
                          fill
                          className="object-cover opacity-80"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          priority={false}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-bg-card" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 to-transparent" />
                      <div className="absolute left-4 top-4 flex items-center gap-2">
                        <span className="chip chip-final">AFL</span>
                        <span className="chip chip-open">
                          {mins !== null && mins < 0 ? "LIVE" : "UPCOMING"}
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-4 right-4">
                        <div className="text-base font-black leading-tight">
                          {g.match}
                        </div>
                        <div className="mt-1 text-xs text-text-secondary">
                          {formatAest(g.startTime)}
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black">{g.venue}</div>
                          <div className="mt-0.5 text-xs text-text-secondary">
                            {kickoffLabel}
                          </div>
                          <div className="mt-2 text-xs text-text-tertiary">
                            {g.questions?.length ?? 0} questions (pick any
                            amount)
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {lock?.locked ? (
                            <span className="chip chip-final">PICKS LOCKED</span>
                          ) : draftCount > 0 ? (
                            // REMOVED: blink-warning (was causing pulsing)
                            <span className="chip chip-pending">
                              {draftCount} selected
                            </span>
                          ) : (
                            <span className="chip chip-void">No picks</span>
                          )}

                          <span className="btn btn-primary btn-sm">
                            {lock?.locked ? "VIEW" : "PLAY NOW"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DEDICATED MATCH PICKS VIEW */}
        {!apiLoading && !apiError && showMatchView && selectedGame && (
          <div>
            {/* Match header */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedGameId(null)}
                >
                  ← Back to Matches
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xl font-black">{selectedGame.match}</div>
                    <span className="chip chip-final">{selectedGame.venue}</span>
                    <span className="chip chip-open">
                      {lockedForSelected?.locked ? "LOCKED" : "OPEN"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {formatAest(selectedGame.startTime)}
                  </div>
                  <div className="mt-1 text-sm text-text-tertiary">
                    Tunnel Vision mode: focus on this match only.
                  </div>
                </div>
              </div>

              {/* Right side: summary */}
              <div className="card p-4 md:w-[420px]">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black">Your Parlay</div>
                  <div className="text-sm text-text-secondary">
                    {picksCount} pick{picksCount === 1 ? "" : "s"} selected
                  </div>
                </div>
                <div className="mt-2 text-xs text-text-secondary">
                  Moment of Truth: confirm before you commit (1 wrong = 0).
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {!lockedForSelected?.locked ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => clearAllPicks(selectedGame.id)}
                        disabled={picksCount === 0}
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (picksCount === 0) return;
                          openConfirm();
                        }}
                        disabled={picksCount === 0}
                      >
                        LOCK IN {picksCount} PICK{picksCount === 1 ? "" : "S"}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="chip chip-final">Locked</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShareOpen(true);
                          setShareReadOnly(false);
                        }}
                      >
                        View / Share
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* (rest of your component continues unchanged) */}
            {/* NOTE: I’m keeping the rest exactly as you pasted to avoid accidental logic changes */}
            {/* If you want, I can paste the remaining bottom half too, but the only required edits were above */}
          </div>
        )}
      </div>
    </div>
  );
}
