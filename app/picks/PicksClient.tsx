// /app/picks/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Confetti from "react-confetti";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";

export const dynamic = "force-dynamic";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";

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

type LeaderboardEntry = {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  rank: number;
  currentStreak: number;
};

type LeaderboardApiResponse = {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userLifetime?: any;
};

/**
 * ✅ Fix: CLEAR / UNSELECT that actually works even when API returns userPick:
 * - We store local overrides per question:
 *   - "yes" | "no" => force a selection locally (until server save succeeds)
 *   - null => force-cleared locally (masks q.userPick)
 * - Also adds an "X" button to clear instantly.
 *
 * ✅ Visual requests:
 * - YES button = solid green
 * - NO button = solid red
 * - Sponsored questions: yellow highlighted block background
 * - Quarter label reads "Quarter 1" etc.
 * - Comment button slightly bigger
 *
 * Note: We *attempt* to clear server pick via DELETE /api/user-picks.
 * If your API doesn't support DELETE yet, the UI will still clear (masked locally).
 */

const COLORS = {
  bg: "#0D1117",
  panel: "#0F1623",
  panel2: "#0A0F18",

  // 🟧 Warm orange (matches your “Create league” button vibe)
  orange: "#F4B247",

  // Buttons (solid)
  yesSolidTop: "#23D68E",
  yesSolidBot: "#0FAE70",
  noSolidTop: "#FF4A63",
  noSolidBot: "#E5163D",

  // Accents
  cyan: "#00E5FF",
  white: "#FFFFFF",

  // Sponsor highlight
  sponsorTop: "rgba(244,178,71,0.22)",
  sponsorBot: "rgba(244,178,71,0.08)",
  sponsorBorder: "rgba(244,178,71,0.60)",
};

function clampPct(n: number | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
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

function majorityLabel(yes: number, no: number): { label: string; color: string } {
  if (yes === no) return { label: "Split crowd", color: "rgba(255,255,255,0.70)" };
  if (yes > no) return { label: "Majority is YES", color: "rgba(35,214,142,0.95)" };
  return { label: "Majority is NO", color: "rgba(255,74,99,0.95)" };
}

function safeLocalKey(uid: string | null, roundNumber: number | null) {
  // includes "overrides" so it doesn't clash with older versions
  return `streakr:picks:overrides:v1:${uid || "anon"}:${roundNumber ?? "na"}`;
}

// null means "force cleared" (mask server pick)
type LocalOverrideMap = Record<string, PickOutcome | null>;

export default function PicksPage() {
  const { user } = useAuth();

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string>("");

  const [localOverrides, setLocalOverrides] = useState<LocalOverrideMap>({});

  const [myCurrentStreak, setMyCurrentStreak] = useState<number>(0);
  const [leaderStreak, setLeaderStreak] = useState<number>(0);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [confettiOn, setConfettiOn] = useState(false);
  const confettiTimeoutRef = useRef<any>(null);
  const lastMilestoneRef = useRef<number>(0);

  const hasHydratedLocalRef = useRef(false);

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

      const res = await fetch(`/api/picks`, {
        headers: { ...authHeader },
        cache: "no-store",
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("Picks API error:", t);
        throw new Error("Failed to load picks");
      }

      const data = (await res.json()) as PicksApiResponse;
      const nextRound = typeof data.roundNumber === "number" ? data.roundNumber : null;

      setRoundNumber(nextRound);
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

  // Hydrate local overrides
  useEffect(() => {
    if (hasHydratedLocalRef.current) return;
    if (roundNumber === null) return;

    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalOverrideMap;
        if (parsed && typeof parsed === "object") setLocalOverrides(parsed);
      }
    } catch (e) {
      console.warn("Failed to hydrate local overrides", e);
    } finally {
      hasHydratedLocalRef.current = true;
    }
  }, [user?.uid, roundNumber]);

  useEffect(() => {
    if (roundNumber === null) return;
    try {
      const key = safeLocalKey(user?.uid ?? null, roundNumber);
      localStorage.setItem(key, JSON.stringify(localOverrides));
    } catch {}
  }, [localOverrides, user?.uid, roundNumber]);

  // Live streak from users/{uid}
  useEffect(() => {
    if (!user) {
      setMyCurrentStreak(0);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any;
        const s = typeof d?.currentStreak === "number" ? d.currentStreak : 0;
        setMyCurrentStreak(s);
      },
      (e) => console.warn("users/{uid} snapshot error", e)
    );

    return () => unsub();
  }, [user]);

  const loadLeader = useCallback(
    async (silent?: boolean) => {
      try {
        let authHeader: Record<string, string> = {};
        if (user) {
          try {
            const token = await user.getIdToken();
            authHeader = { Authorization: `Bearer ${token}` };
          } catch {}
        }

        const res = await fetch(`/api/leaderboard?scope=overall`, {
          headers: { ...authHeader },
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = (await res.json()) as LeaderboardApiResponse;
        const top = Array.isArray(data.entries) ? data.entries[0] : null;
        setLeaderStreak(typeof top?.currentStreak === "number" ? top.currentStreak : 0);
      } catch (e) {
        if (!silent) console.warn("Leader load failed", e);
      }
    },
    [user]
  );

  useEffect(() => {
    loadLeader();
  }, [loadLeader]);

  useEffect(() => {
    const id = window.setInterval(() => loadLeader(true), 15000);
    return () => window.clearInterval(id);
  }, [loadLeader]);

  useEffect(() => {
    const s = myCurrentStreak || 0;
    const milestone = Math.floor(s / 5) * 5;

    if (milestone >= 5 && milestone !== lastMilestoneRef.current) {
      lastMilestoneRef.current = milestone;
      setConfettiOn(true);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setConfettiOn(false), 1400);
    }
  }, [myCurrentStreak]);

  // Helper: apply local overrides to decide what the UI shows
  const getEffectivePick = useCallback(
    (q: ApiQuestion): PickOutcome | undefined => {
      if (Object.prototype.hasOwnProperty.call(localOverrides, q.id)) {
        const v = localOverrides[q.id];
        return v === null ? undefined : v;
      }
      return q.userPick;
    },
    [localOverrides]
  );

  // Patch games state so UI updates immediately when server pick changes/clears
  const patchGamePick = useCallback((questionId: string, newPick?: PickOutcome) => {
    setGames((prev) =>
      prev.map((g) => ({
        ...g,
        questions: g.questions.map((q) => {
          if (q.id !== questionId) return q;
          return { ...q, userPick: newPick };
        }),
      }))
    );
  }, []);

  const allQuestions = useMemo(() => {
    const out: ApiQuestion[] = [];
    games.forEach((g) => g.questions.forEach((q) => out.push(q)));
    return out;
  }, [games]);

  const picksMade = useMemo(() => {
    let c = 0;
    allQuestions.forEach((q) => {
      const pick = getEffectivePick(q);
      if (pick === "yes" || pick === "no") c += 1;
    });
    return c;
  }, [allQuestions, getEffectivePick]);

  const totalPickable = useMemo(() => allQuestions.length, [allQuestions]);

  const accuracyPct = useMemo(() => {
    let settledPicked = 0;
    let correct = 0;

    allQuestions.forEach((q) => {
      const pick = getEffectivePick(q);
      if (pick !== "yes" && pick !== "no") return;

      const settled = q.status === "final" || q.status === "void";
      if (!settled) return;
      if (q.status === "void") return;

      settledPicked += 1;
      if (q.correctPick === true) correct += 1;
    });

    if (settledPicked <= 0) return 0;
    return Math.round((correct / settledPicked) * 100);
  }, [allQuestions, getEffectivePick]);

  const nextLockMs = useMemo(() => {
    const future = games
      .map((g) => new Date(g.startTime).getTime())
      .filter((t) => Number.isFinite(t) && t > nowMs)
      .sort((a, b) => a - b);
    if (!future.length) return 0;
    return future[0] - nowMs;
  }, [games, nowMs]);

  const shareStreak = useCallback(async () => {
    const txt = `STREAKr — I’m on a streak of ${myCurrentStreak}. How long can you last?`;
    try {
      if (navigator.share) {
        await navigator.share({ text: txt });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(txt);
      alert("Copied to clipboard ✅");
    } catch {
      alert(txt);
    }
  }, [myCurrentStreak]);

  const myVsLeaderPct = useMemo(() => {
    const denom = Math.max(1, Math.max(myCurrentStreak, leaderStreak));
    const mine = (myCurrentStreak / denom) * 100;
    const lead = (leaderStreak / denom) * 100;
    return { mine, lead };
  }, [myCurrentStreak, leaderStreak]);

  const topLockText = nextLockMs > 0 ? msToCountdown(nextLockMs) : "—";

  // Make pick blocks smaller (tighter) + comment button bigger
  const PICK_CARD_PAD_Y = "py-1";
  const PICK_CARD_PAD_X = "px-3";
  const PICK_BUTTON_PAD_Y = "py-2";
  const SENTIMENT_BAR_H = "h-[6px]";

  const clearPick = useCallback(
    async (q: ApiQuestion) => {
      // 1) instant UI clear (masks server userPick)
      setLocalOverrides((prev) => ({ ...prev, [q.id]: null }));

      // 2) attempt server clear
      if (!user) return;

      try {
        const token = await user.getIdToken();

        const body = {
          questionId: q.id,
          roundNumber: typeof roundNumber === "number" ? roundNumber : null,
          gameId: q.gameId ?? null,
        };

        const res = await fetch("/api/user-picks", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          // server cleared: update local games + remove override entry
          patchGamePick(q.id, undefined);
          setLocalOverrides((prev) => {
            const next = { ...prev };
            delete next[q.id];
            return next;
          });
        } else {
          // If DELETE isn't supported, UI still stays cleared via local override.
          console.warn("Clear pick failed:", await res.text());
        }
      } catch (e) {
        console.warn("Clear pick error", e);
      }
    },
    [user, roundNumber, patchGamePick]
  );

  const savePickToServer = useCallback(
    async (q: ApiQuestion, outcome: PickOutcome) => {
      if (!user) return false;

      try {
        const token = await user.getIdToken();
        const body = {
          questionId: q.id,
          outcome,
          roundNumber: typeof roundNumber === "number" ? roundNumber : null,
          gameId: q.gameId ?? null,
        };

        const res = await fetch("/api/user-picks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          console.error("Failed to save pick:", await res.text());
          return false;
        }
        return true;
      } catch (e) {
        console.error("Pick save error", e);
        return false;
      }
    },
    [user, roundNumber]
  );

  /**
   * ✅ Toggle behaviour:
   * - Click YES when already YES -> clear (same as pressing X)
   * - Click NO when already NO -> clear
   * - Otherwise sets the new pick
   */
  const togglePick = useCallback(
    async (q: ApiQuestion, outcome: PickOutcome) => {
      const current = getEffectivePick(q);

      // Clicking same outcome -> clear
      if (current === outcome) {
        await clearPick(q);
        return;
      }

      // Set locally immediately (optimistic)
      setLocalOverrides((prev) => ({ ...prev, [q.id]: outcome }));

      // Save server, then reconcile
      const ok = await savePickToServer(q, outcome);
      if (ok) {
        patchGamePick(q.id, outcome);
        // remove override since games state now reflects it
        setLocalOverrides((prev) => {
          const next = { ...prev };
          delete next[q.id];
          return next;
        });
      }
    },
    [getEffectivePick, clearPick, savePickToServer, patchGamePick]
  );

  const renderStatusPill = (q: ApiQuestion) => {
    const base =
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border";

    if (q.status === "open") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(0,229,255,0.28)",
            background: "rgba(0,229,255,0.08)",
            color: "rgba(0,229,255,0.92)",
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ background: "rgba(0,229,255,0.85)" }}
            />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: "rgba(0,229,255,0.95)" }} />
          </span>
          LIVE
        </span>
      );
    }

    if (q.status === "pending") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.70)",
          }}
        >
          Locked
        </span>
      );
    }

    if (q.status === "void") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Void
        </span>
      );
    }

    const pick = getEffectivePick(q);
    const isPicked = pick === "yes" || pick === "no";
    const isCorrect = q.correctPick === true;

    if (!isPicked) {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.70)",
          }}
        >
          Final
        </span>
      );
    }

    return (
      <span
        className={base}
        style={{
          borderColor: isCorrect ? "rgba(35,214,142,0.45)" : "rgba(255,74,99,0.45)",
          background: isCorrect ? "rgba(35,214,142,0.10)" : "rgba(255,74,99,0.10)",
          color: isCorrect ? "rgba(35,214,142,0.95)" : "rgba(255,74,99,0.95)",
        }}
      >
        {isCorrect ? "Correct" : "Wrong"}
      </span>
    );
  };

  const renderSentiment = (q: ApiQuestion) => {
    const yes = clampPct(q.yesPercent);
    const no = clampPct(q.noPercent);

    const total = yes + no;
    const yesW = total <= 0 ? 50 : (yes / total) * 100;
    const noW = 100 - yesW;

    const majority = majorityLabel(yes, no);

    const pick = getEffectivePick(q);
    const aligned = pick === "yes" ? yes >= no : pick === "no" ? no > yes : null;

    return (
      <div className="mt-1">
        <div className="flex items-center justify-between text-[11px] text-white/65">
          <span className="uppercase tracking-wide">Crowd</span>
          <span style={{ color: majority.color }} className="font-semibold">
            {majority.label}
          </span>
        </div>

        <div
          className={`mt-1 ${SENTIMENT_BAR_H} rounded-full overflow-hidden border`}
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="h-full flex">
            <div
              className="h-full"
              style={{
                width: `${yesW}%`,
                background: `linear-gradient(90deg, rgba(35,214,142,0.92), rgba(35,214,142,0.22))`,
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${noW}%`,
                background: `linear-gradient(90deg, rgba(255,74,99,0.22), rgba(255,74,99,0.92))`,
              }}
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-[10px] text-white/55">
          <span>
            YES <span className="font-semibold text-white/80">{Math.round(yes)}%</span>
          </span>

          {aligned === null ? (
            <span className="text-white/45">Pick to see if you’re with the crowd</span>
          ) : aligned ? (
            <span style={{ color: "rgba(35,214,142,0.95)" }} className="font-semibold">
              With majority
            </span>
          ) : (
            <span style={{ color: COLORS.orange }} className="font-semibold">
              Against majority
            </span>
          )}

          <span>
            NO <span className="font-semibold text-white/80">{Math.round(no)}%</span>
          </span>
        </div>
      </div>
    );
  };

  /**
   * ✅ Buttons: YES solid green, NO solid red.
   * - Selected adds a cyan ring/glow (still stays green/red).
   * - Clicking selected again clears (toggle).
   */
  const renderPickButtons = (q: ApiQuestion, isLocked: boolean) => {
    const pick = getEffectivePick(q);

    const isYesSelected = pick === "yes";
    const isNoSelected = pick === "no";

    const baseBtn =
      "flex-1 rounded-xl border font-extrabold tracking-wide transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

    const yesStyle = (selected: boolean) =>
      ({
        borderColor: selected ? "rgba(0,229,255,0.55)" : "rgba(255,255,255,0.10)",
        background: selected
          ? `linear-gradient(180deg, ${COLORS.yesSolidTop}, ${COLORS.yesSolidBot})`
          : `linear-gradient(180deg, rgba(35,214,142,0.78), rgba(15,174,112,0.78))`,
        color: "rgba(255,255,255,0.96)",
        boxShadow: selected
          ? "0 0 26px rgba(0,229,255,0.16), 0 0 18px rgba(35,214,142,0.18)"
          : "0 0 14px rgba(35,214,142,0.12)",
        transform: selected ? "translateY(-1px)" : "none",
      }) as const;

    const noStyle = (selected: boolean) =>
      ({
        borderColor: selected ? "rgba(0,229,255,0.55)" : "rgba(255,255,255,0.10)",
        background: selected
          ? `linear-gradient(180deg, ${COLORS.noSolidTop}, ${COLORS.noSolidBot})`
          : `linear-gradient(180deg, rgba(255,74,99,0.78), rgba(229,22,61,0.78))`,
        color: "rgba(255,255,255,0.96)",
        boxShadow: selected
          ? "0 0 26px rgba(0,229,255,0.16), 0 0 18px rgba(255,74,99,0.18)"
          : "0 0 14px rgba(255,74,99,0.12)",
        transform: selected ? "translateY(-1px)" : "none",
      }) as const;

    return (
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={isLocked || q.status === "void" || q.status === "final" || q.status === "pending"}
          onClick={() => togglePick(q, "yes")}
          className={`${baseBtn} px-4 ${PICK_BUTTON_PAD_Y} text-[12px]`}
          style={yesStyle(isYesSelected)}
          aria-pressed={isYesSelected}
          title={isYesSelected ? "Click again to clear" : "Pick YES"}
        >
          {isYesSelected ? "YES ✓" : "YES"}
        </button>

        <button
          type="button"
          disabled={isLocked || q.status === "void" || q.status === "final" || q.status === "pending"}
          onClick={() => togglePick(q, "no")}
          className={`${baseBtn} px-4 ${PICK_BUTTON_PAD_Y} text-[12px]`}
          style={noStyle(isNoSelected)}
          aria-pressed={isNoSelected}
          title={isNoSelected ? "Click again to clear" : "Pick NO"}
        >
          {isNoSelected ? "NO ✓" : "NO"}
        </button>
      </div>
    );
  };

  const pageTitle = `Picks`;
  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      {confettiOn && <Confetti recycle={false} numberOfPieces={220} gravity={0.22} />}

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-black">{pageTitle}</h1>
              {roundLabel ? (
                <span
                  className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold border"
                  style={{
                    borderColor: "rgba(0,229,255,0.28)",
                    background: "rgba(0,229,255,0.08)",
                    color: "rgba(0,229,255,0.92)",
                  }}
                >
                  {roundLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-white/65">
              Pick any questions you want. Use the <span className="font-black text-white/90">X</span> to clear a pick.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/how-to-play"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-bold border"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              How to play STREAKr
            </Link>
          </div>
        </div>

        {/* Persistent Streak Widget */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-white/55">Your streak</p>
                <p className="text-4xl font-black mt-1" style={{ color: COLORS.orange }}>
                  {myCurrentStreak}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[11px] uppercase tracking-widest text-white/55">Leader</p>
                <p className="text-3xl font-black mt-1" style={{ color: COLORS.cyan }}>
                  {leaderStreak}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${myVsLeaderPct.mine}%`,
                    background: `linear-gradient(90deg, ${COLORS.orange}, rgba(244,178,71,0.22))`,
                  }}
                />
              </div>

              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${myVsLeaderPct.lead}%`,
                    background: `linear-gradient(90deg, ${COLORS.cyan}, rgba(0,229,255,0.22))`,
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={shareStreak}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] font-black border transition active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                Share my streak
              </button>

              <div className="text-right text-[11px] text-white/55">
                <div>Current</div>
                <div className="font-bold text-white/80">
                  {myCurrentStreak > leaderStreak
                    ? "You’re leading"
                    : myCurrentStreak === leaderStreak
                    ? "Tied"
                    : `Need ${leaderStreak - myCurrentStreak} to catch`}
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <p className="text-[11px] uppercase tracking-widest text-white/55">Dashboard</p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Picks</p>
                <p className="text-xl font-black mt-1 text-white">
                  {picksMade}/{totalPickable}
                </p>
              </div>

              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Accuracy</p>
                <p className="text-xl font-black mt-1" style={{ color: "rgba(35,214,142,0.95)" }}>
                  {accuracyPct}%
                </p>
              </div>

              <div
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/55">Next lock</p>
                <p className="text-[13px] font-black mt-2" style={{ color: COLORS.cyan }}>
                  {topLockText}
                </p>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-white/55">
              {user ? "Pick what you like — no pressure to do them all." : "Log in to save picks + appear on leaderboards."}
            </div>
          </div>

          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: `linear-gradient(180deg, ${COLORS.panel} 0%, ${COLORS.panel2} 100%)`,
              boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
            }}
          >
            <p className="text-[11px] uppercase tracking-widest text-white/55">Quick</p>

            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/leaderboards"
                className="rounded-xl border px-4 py-3 text-[12px] font-black transition hover:translate-y-[-1px] active:scale-[0.99]"
                style={{
                  borderColor: "rgba(0,229,255,0.24)",
                  background: "rgba(0,229,255,0.07)",
                  color: "rgba(0,229,255,0.95)",
                }}
              >
                View Leaderboards →
              </Link>

              <Link
                href="/how-to-play"
                className="rounded-xl border px-4 py-3 text-[12px] font-black transition hover:translate-y-[-1px] active:scale-[0.99]"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                How it works →
              </Link>

              <div
                className="rounded-xl border px-4 py-3 text-[11px] text-white/70"
                style={{
                  borderColor: "rgba(244,178,71,0.45)",
                  background: "rgba(244,178,71,0.12)",
                }}
              >
                <span className="font-black" style={{ color: COLORS.orange }}>
                  Tip:
                </span>{" "}
                Use the <span className="font-black text-white/90">X</span> to clear any pick before lock.
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: "rgba(255,74,99,0.95)" }}>
            {err} Try refreshing.
          </div>
        ) : null}

        {/* Games */}
        <div className="mt-5 flex flex-col gap-4">
          {loading ? (
            <div
              className="rounded-2xl border p-4 animate-pulse"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            >
              <div className="h-4 w-44 rounded bg-white/10" />
              <div className="mt-3 h-3 w-80 rounded bg-white/10" />
              <div className="mt-5 h-24 rounded bg-white/5" />
            </div>
          ) : games.length === 0 ? (
            <div
              className="rounded-2xl border p-4 text-sm text-white/70"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            >
              No games found.
            </div>
          ) : (
            games.map((g) => {
              const lockMs = new Date(g.startTime).getTime() - nowMs;
              const isLocked = lockMs <= 0;

              const gamePicked = g.questions.reduce((acc, q) => {
                const p = getEffectivePick(q);
                return acc + (p === "yes" || p === "no" ? 1 : 0);
              }, 0);

              const gameTotal = g.questions.length;
              const progressPct = gameTotal > 0 ? (gamePicked / gameTotal) * 100 : 0;

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(244,178,71,0.80)",
                    background: `linear-gradient(180deg, rgba(244,178,71,0.22) 0%, rgba(244,178,71,0.14) 42%, rgba(13,17,23,0.88) 100%)`,
                    boxShadow: "0 0 40px rgba(244,178,71,0.16), inset 0 0 0 1px rgba(244,178,71,0.35)",
                  }}
                >
                  {/* Game info block (orange, game name white) */}
                  <div
                    className="px-4 py-3"
                    style={{
                      background: `linear-gradient(180deg, rgba(244,178,71,0.46) 0%, rgba(244,178,71,0.20) 100%)`,
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg sm:text-xl font-extrabold truncate" style={{ color: COLORS.white }}>
                          {g.match}
                        </div>
                        <div className="mt-0.5 text-[12px] text-white/90 truncate">
                          {g.venue} • {formatAedt(g.startTime)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                            style={{
                              borderColor: "rgba(255,255,255,0.22)",
                              background: "rgba(13,17,23,0.35)",
                              color: "rgba(255,255,255,0.92)",
                            }}
                          >
                            Picks: {gamePicked}/{gameTotal}
                          </span>

                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                            style={{
                              borderColor: isLocked ? "rgba(255,255,255,0.22)" : "rgba(13,17,23,0.55)",
                              background: isLocked ? "rgba(13,17,23,0.35)" : "rgba(13,17,23,0.30)",
                              color: isLocked ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.92)",
                            }}
                          >
                            {isLocked ? "Locked" : `Locks in ${msToCountdown(lockMs)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(13,17,23,0.35)" }}>
                        <div
                          className="h-full"
                          style={{
                            width: `${progressPct}%`,
                            background: `linear-gradient(90deg, rgba(13,17,23,0.10), rgba(0,229,255,0.45))`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="px-3 pb-3">
                    <div className="flex flex-col gap-2">
                      {g.questions.map((q) => {
                        const finalWrong = q.status === "final" && q.correctPick === false;
                        const finalCorrect = q.status === "final" && q.correctPick === true;

                        const pick = getEffectivePick(q);
                        const hasPick = pick === "yes" || pick === "no";

                        // lock per game (also respect question status)
                        const questionLocked = isLocked || q.status === "pending" || q.status === "final" || q.status === "void";

                        const isSponsor = q.isSponsorQuestion === true;

                        return (
                          <div
                            key={q.id}
                            className="rounded-2xl border"
                            style={{
                              borderColor: finalWrong
                                ? "rgba(255,74,99,0.55)"
                                : finalCorrect
                                ? "rgba(35,214,142,0.50)"
                                : isSponsor
                                ? COLORS.sponsorBorder
                                : "rgba(255,255,255,0.10)",
                              background: isSponsor
                                ? `linear-gradient(180deg, ${COLORS.sponsorTop} 0%, ${COLORS.sponsorBot} 100%)`
                                : "rgba(13,17,23,0.78)",
                              boxShadow: finalWrong
                                ? "0 0 24px rgba(255,74,99,0.10)"
                                : finalCorrect
                                ? "0 0 24px rgba(35,214,142,0.08)"
                                : isSponsor
                                ? "0 0 26px rgba(244,178,71,0.16)"
                                : "none",
                            }}
                          >
                            <div className={`${PICK_CARD_PAD_X} ${PICK_CARD_PAD_Y}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {renderStatusPill(q)}
                                  <span className="text-[11px] font-black text-white/80 uppercase tracking-wide">
                                    Quarter {q.quarter}
                                  </span>

                                  {isSponsor ? (
                                    <span
                                      className="text-[10px] font-black rounded-full px-2 py-0.5 border"
                                      style={{
                                        borderColor: "rgba(13,17,23,0.35)",
                                        background: "rgba(244,178,71,0.92)",
                                        color: "rgba(13,17,23,0.92)",
                                        boxShadow: "0 0 18px rgba(244,178,71,0.18)",
                                      }}
                                    >
                                      SPONSORED ⭐
                                    </span>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Clear X button (only when picked) */}
                                  {hasPick ? (
                                    <button
                                      type="button"
                                      disabled={questionLocked}
                                      onClick={() => clearPick(q)}
                                      className="inline-flex items-center justify-center rounded-full border transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderColor: "rgba(255,255,255,0.18)",
                                        background: "rgba(255,255,255,0.06)",
                                        color: "rgba(255,255,255,0.92)",
                                        boxShadow: "0 0 14px rgba(0,0,0,0.25)",
                                      }}
                                      title={questionLocked ? "Locked" : "Clear pick"}
                                      aria-label="Clear pick"
                                    >
                                      ✕
                                    </button>
                                  ) : null}

                                  {/* Comment button (slightly bigger) */}
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-black border transition active:scale-[0.99]"
                                    style={{
                                      borderColor:
                                        q.commentCount && q.commentCount >= 100
                                          ? "rgba(244,178,71,0.65)"
                                          : "rgba(0,229,255,0.32)",
                                      background:
                                        q.commentCount && q.commentCount >= 100
                                          ? "rgba(244,178,71,0.16)"
                                          : "rgba(0,229,255,0.09)",
                                      color: "rgba(255,255,255,0.94)",
                                      boxShadow:
                                        q.commentCount && q.commentCount >= 100
                                          ? "0 0 18px rgba(244,178,71,0.16)"
                                          : "0 0 18px rgba(0,229,255,0.10)",
                                    }}
                                    onClick={() => alert("Comments coming next — wire this to your comments UI.")}
                                  >
                                    💬 {q.commentCount ?? 0}
                                    {q.commentCount && q.commentCount >= 100 ? <span>🔥</span> : null}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-1 text-[13px] font-semibold leading-tight text-white/90">
                                {q.question}
                              </div>

                              {renderSentiment(q)}
                              {renderPickButtons(q, questionLocked)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 pb-8 text-center text-[11px] text-white/45">
          <span className="font-bold" style={{ color: COLORS.orange }}>
            STREAKr
          </span>{" "}
          — Back yourself. One slip and it’s back to zero.
        </div>
      </div>
    </div>
  );
}
