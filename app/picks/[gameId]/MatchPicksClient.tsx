"use client";

// /app/picks/[gameId]/MatchPicksClient.tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";
type QuestionOutcome = "yes" | "no" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any;

  match?: string;
  venue?: string;
  startTime?: string;

  userPick?: "yes" | "no";
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;

  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorBlurb?: string;

  // ✅ comes from /api/picks
  correctOutcome?: QuestionOutcome;
  outcome?: QuestionOutcome;
  correctPick?: boolean | null;
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

const BRAND_RED = "#FF2E4D";
const BRAND_BG = "#000000";

// ✅ derive roundNumber from gameId ("OR-G2", "R1-G3", etc)
function roundNumberFromGameId(gameId: string): number {
  const s = String(gameId || "").toUpperCase().trim();
  if (s.startsWith("OR-")) return 0;
  if (s.startsWith("R")) {
    const dash = s.indexOf("-");
    const prefix = dash === -1 ? s : s.slice(0, dash); // "R12"
    const n = Number(prefix.replace("R", ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function extractPlayerName(question: string) {
  const q = question.trim();
  if (!q.toLowerCase().startsWith("will ")) return null;

  const start = 5;
  const parenIdx = q.indexOf(" (", start);
  const stopIdx = parenIdx !== -1 ? parenIdx : q.length;
  const name = q.slice(start, stopIdx).trim();

  if (!name) return null;
  if (!name.includes(" ")) return null;

  if (/\b(goals?|behinds?|disposals?|marks?|tackles?|kicks?|handballs?)\b/i.test(name)) return null;

  return name;
}

function playerSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

function safeStatus(s: any): QuestionStatus {
  const v = String(s || "").toLowerCase().trim();
  if (v === "open") return "open";
  if (v === "final") return "final";
  if (v === "pending") return "pending";
  if (v === "void") return "void";
  return "open";
}

function formatQuarterLabel(q: number) {
  return `QUARTER ${q}`;
}

function parseTeams(match: string) {
  const parts = match.split(" vs ");
  if (parts.length === 2) return { home: parts[0].trim(), away: parts[1].trim() };
  const parts2 = match.split(/\s+vs\s+/i);
  if (parts2.length === 2) return { home: parts2[0].trim(), away: parts2[1].trim() };
  return { home: match.trim(), away: "" };
}

/* ✅ MATCH PicksClient team slug + logo candidates logic */

type TeamSlug =
  | "adelaide"
  | "brisbane"
  | "carlton"
  | "collingwood"
  | "essendon"
  | "fremantle"
  | "geelong"
  | "goldcoast"
  | "gws"
  | "hawthorn"
  | "melbourne"
  | "northmelbourne"
  | "portadelaide"
  | "richmond"
  | "stkilda"
  | "sydney"
  | "westcoast"
  | "westernbulldogs";

function teamNameToSlug(nameRaw: string): TeamSlug | null {
  const n = (nameRaw || "").toLowerCase().trim();

  if (n.includes("greater western sydney") || n === "gws" || n.includes("giants")) return "gws";
  if (n.includes("gold coast") || n.includes("suns")) return "goldcoast";
  if (n.includes("west coast") || n.includes("eagles")) return "westcoast";
  if (n.includes("western bulldogs") || n.includes("bulldogs") || n.includes("footscray")) return "westernbulldogs";
  if (n.includes("north melbourne") || n.includes("kangaroos")) return "northmelbourne";
  if (n.includes("port adelaide") || n.includes("power")) return "portadelaide";
  if (n.includes("st kilda") || n.includes("saints") || n.replace(/\s/g, "") === "stkilda") return "stkilda";

  if (n.includes("adelaide")) return "adelaide";
  if (n.includes("brisbane")) return "brisbane";
  if (n.includes("carlton")) return "carlton";
  if (n.includes("collingwood")) return "collingwood";
  if (n.includes("essendon")) return "essendon";
  if (n.includes("fremantle")) return "fremantle";
  if (n.includes("geelong")) return "geelong";
  if (n.includes("hawthorn")) return "hawthorn";
  if (n.includes("melbourne")) return "melbourne";
  if (n.includes("richmond")) return "richmond";
  if (n.includes("sydney") || n.includes("swans")) return "sydney";

  return null;
}

function logoCandidates(teamSlug: TeamSlug): string[] {
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
    `/afllogos/${teamSlug}-logo.jpg`,
    `/afllogos/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = ({
  teamName,
  size = 72,
}: {
  teamName: string;
  size?: number;
}) => {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const fallbackInitials = (teamName || "AFL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (!slug || dead) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border font-black"
        style={{
          width: size,
          height: size,
          borderColor: "rgba(255,255,255,0.14)",
          background: "rgba(0,0,0,0.35)",
          color: "rgba(255,255,255,0.90)",
        }}
        title={teamName}
      >
        {fallbackInitials || "AFL"}
      </div>
    );
  }

  const candidates = logoCandidates(slug);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        width: size,
        height: size,
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.35)",
      }}
      title={teamName}
    >
      <div className="absolute inset-0 p-2">
        <Image
          src={src}
          alt={`${teamName} logo`}
          fill
          sizes={`${size}px`}
          style={{ objectFit: "contain" }}
          onError={() => {
            setIdx((p) => {
              if (p + 1 < candidates.length) return p + 1;
              setDead(true);
              return p;
            });
          }}
        />
      </div>
    </div>
  );
};

/* UI bits */

function PlayerAvatar({ name }: { name: string }) {
  const exact = `/players/${encodeURIComponent(name)}.jpg`;
  const slug = `/players/${playerSlug(name)}.jpg`;
  const [src, setSrc] = useState(exact);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-20 w-20 rounded-[18px] p-[3px] shadow-sm" style={{ background: BRAND_RED }}>
        <div className="h-full w-full overflow-hidden rounded-[15px]" style={{ background: BRAND_RED }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => {
              if (src === exact) setSrc(slug);
            }}
          />
        </div>
      </div>

      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45">PLAYER PICK</div>
    </div>
  );
}

function TeamLogoSquircle({ teamName }: { teamName: string }) {
  return (
    <div className="h-20 w-20 rounded-[18px] p-[3px] shadow-sm" style={{ background: BRAND_RED }}>
      <div
        className="h-full w-full overflow-hidden rounded-[15px] flex items-center justify-center"
        style={{ background: BRAND_RED }}
      >
        <TeamLogo teamName={teamName} size={72} />
      </div>
    </div>
  );
}

function GamePickHeader({ match }: { match: string }) {
  const { home, away } = parseTeams(match);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <TeamLogoSquircle teamName={home} />
        <div className="text-[12px] font-black tracking-[0.25em] text-white/60">VS</div>
        <TeamLogoSquircle teamName={away || "AFL"} />
      </div>

      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45">GAME PICK</div>
    </div>
  );
}

function PercentBar({ yes, no }: { yes: number; no: number }) {
  const yesPct = Math.max(0, Math.min(100, Math.round(yes)));
  const noPct = Math.max(0, Math.min(100, Math.round(no)));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-black/45">
        <span>Yes {yesPct}%</span>
        <span>No {noPct}%</span>
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
        <div className="h-full" style={{ width: `${yesPct}%`, background: BRAND_RED }} />
      </div>
    </div>
  );
}

function ResultPill({
  status,
  selected,
  correctPick,
  outcome,
}: {
  status: QuestionStatus;
  selected: LocalPick;
  correctPick: boolean | null | undefined;
  outcome: QuestionOutcome | undefined;
}) {
  const isDone = status === "final" || status === "void";
  if (!isDone) return null;

  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black tracking-[0.14em]";

  if (status === "void" || outcome === "void") {
    return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>VOID</span>;
  }

  if (selected === "none") {
    return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>NO PICK</span>;
  }

  if (correctPick === true) {
    return <span className={`${base} border-emerald-400/30 bg-emerald-400/10 text-emerald-200`}>✅ CORRECT</span>;
  }

  if (correctPick === false) {
    return <span className={`${base} border-rose-400/30 bg-rose-400/10 text-rose-200`}>❌ WRONG</span>;
  }

  return <span className={`${base} border-white/15 bg-white/5 text-white/70`}>FINAL</span>;
}

export default function MatchPicksClient({ gameId }: { gameId: string }) {
  const { user } = useAuth();

  // ✅ FIX: separate initial-load vs background refresh (prevents “black flash”)
  const [loading, setLoading] = useState(true); // first load only
  const [refreshing, setRefreshing] = useState(false); // background refresh, keep UI
  const [err, setErr] = useState<string | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);
  const lastGameRef = useRef<ApiGame | null>(null);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [picks, setPicks] = useState<Record<string, LocalPick>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const roundNumber = useMemo(() => roundNumberFromGameId(gameId), [gameId]);

  const picksStorageKey = useMemo(() => {
    const uid = user?.uid || "anon";
    return `torpie:picks:${uid}:${gameId}`;
  }, [user?.uid, gameId]);

  // localStorage (anon/offline fallback)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(picksStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, LocalPick>;
      if (parsed && typeof parsed === "object") setPicks(parsed);
    } catch {}
  }, [picksStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(picksStorageKey, JSON.stringify(picks));
    } catch {}
  }, [picks, picksStorageKey]);

  async function fetchMatch(mode: "initial" | "refresh" = "refresh") {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    setErr(null);

    try {
      const headers: Record<string, string> = {};
      if (user) {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/picks?round=${roundNumber}`, {
        cache: "no-store",
        headers,
      });
      if (!res.ok) throw new Error(`API error (${res.status})`);

      const data = (await res.json()) as PicksApiResponse;
      const found = (data.games || []).find((g) => g.id === gameId);
      if (!found) throw new Error("Game not found for this gameId");

      setGame(found);
      lastGameRef.current = found;

      // ✅ if logged in, merge server userPick into local picks (never wipe)
      if (user) {
        const seeded: Record<string, LocalPick> = {};
        for (const q of found.questions || []) {
          if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
        }
        setPicks((prev) => ({ ...prev, ...seeded }));
      } else {
        // anon: only seed if nothing exists locally
        setPicks((prev) => {
          if (Object.keys(prev || {}).length > 0) return prev;
          const seeded: Record<string, LocalPick> = {};
          for (const q of found.questions || []) {
            if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
          }
          return seeded;
        });
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load picks");
    } finally {
      if (mode === "initial") setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchMatch("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.uid]);

  const stableGame = game ?? lastGameRef.current;

  const questions = useMemo(() => {
    const qs = stableGame?.questions || [];
    return [...qs].sort((a, b) => a.quarter - b.quarter || a.id.localeCompare(b.id));
  }, [stableGame]);

  const selectedCount = useMemo(() => {
    return Object.values(picks).filter((v) => v === "yes" || v === "no").length;
  }, [picks]);

  const lockedCount = useMemo(() => {
    return questions.filter((q) => safeStatus(q.status) !== "open").length;
  }, [questions]);

  async function persistPick(questionId: string, next: LocalPick) {
    if (!user) return;

    setSaving((prev) => ({ ...prev, [questionId]: true }));
    try {
      const ref = doc(db, "picks", `${user.uid}_${questionId}`);

      if (next === "none") {
        await deleteDoc(ref);
      } else {
        await setDoc(
          ref,
          {
            userId: user.uid,
            questionId,
            pick: next,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      void fetchMatch("refresh");
    } catch (e) {
      console.error("[MatchPicksClient] failed to persist pick", e);
    } finally {
      setSaving((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function setPick(questionId: string, value: PickOutcome, status: QuestionStatus) {
    if (status !== "open") return;

    setPicks((prev) => {
      const current = prev[questionId] || "none";
      const next: LocalPick = current === value ? "none" : value;
      void persistPick(questionId, next);
      return { ...prev, [questionId]: next };
    });
  }

  async function clearPick(questionId: string, status: QuestionStatus) {
    if (status !== "open") return;

    setPicks((prev) => {
      void persistPick(questionId, "none");
      return { ...prev, [questionId]: "none" };
    });
  }

  if (loading && !stableGame) {
    return (
      <div className="min-h-[70vh] text-white px-4 py-8" style={{ background: BRAND_BG }}>
        <div className="max-w-6xl mx-auto">
          <div className="h-8 w-72 rounded bg-white/10 animate-pulse" />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if ((err && !stableGame) || !stableGame) {
    return (
      <div className="min-h-[70vh] text-white px-4 py-10" style={{ background: BRAND_BG }}>
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black tracking-wide">Couldn’t load match</div>
          <div className="mt-2 text-white/70 text-sm">{err || "Unknown error"}</div>
          <div className="mt-4 text-white/40 text-xs">
            GameId: <span className="font-mono">{gameId}</span>
          </div>
          <button
            type="button"
            className="mt-5 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
            onClick={() => void fetchMatch("initial")}
          >
            TRY AGAIN
          </button>
        </div>
      </div>
    );
  }

  const { home, away } = parseTeams(stableGame.match);
  const matchTitle = `${home.toUpperCase()} VS ${away.toUpperCase()}`;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: BRAND_BG,
        opacity: refreshing ? 0.78 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <div className="text-[11px] tracking-[0.18em] font-semibold text-white/50">OFFICIAL PARTNER</div>
        <div className="text-[11px] tracking-[0.12em] text-white/35">Proudly supporting Torpie all season long</div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div className="text-4xl md:text-5xl font-black italic tracking-wide">{matchTitle}</div>
            <div className="flex items-center gap-2">
              {refreshing ? (
                <div className="text-[11px] font-black tracking-[0.12em] text-white/35">REFRESHING…</div>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
                onClick={() => void fetchMatch("refresh")}
              >
                REFRESH
              </button>
            </div>
          </div>

          {err ? (
            <div className="text-sm text-rose-200/80 bg-rose-500/10 border border-rose-400/20 rounded-2xl px-4 py-2">
              {err}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected: <span className="font-semibold text-white">{selectedCount}</span> / 12
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Locks: <span className="font-semibold text-white">{lockedCount}</span>
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">Auto-locks at bounce</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {questions.map((q, idx) => {
            const status = safeStatus(q.status);
            const qNum = String(idx + 1).padStart(2, "0");

            const playerName = extractPlayerName(q.question);
            const isSponsored = !!q.isSponsorQuestion;
            const isRevealed = !!revealed[q.id];
            const isPlayerPick = !!playerName;

            const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
            const no = typeof q.noPercent === "number" ? q.noPercent : 0;

            const sponsorName = (q.sponsorName || "REBEL SPORT").toUpperCase();
            const selected = picks[q.id] || "none";

            const isLocked = status !== "open";
            const isSaving = !!saving[q.id];

            const yesBtnClass =
              selected === "yes"
                ? `text-white border-black/10 shadow-[0_0_0_3px_rgba(255,46,77,0.20)]`
                : "bg-white text-black/80 border-black/15 hover:bg-black/[0.03]";
            const noBtnClass =
              selected === "no"
                ? `text-white border-black/10 shadow-[0_0_0_3px_rgba(255,46,77,0.20)]`
                : "bg-white text-black/80 border-black/15 hover:bg-black/[0.03]";

            return (
              <div key={q.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111] p-4">
                <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
                  <Image src="/afl1.png" alt="" fill className="object-cover object-center" />
                </div>

                <div className={`relative ${isSponsored && !isRevealed ? "pointer-events-none select-none blur-[1px]" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-black tracking-wide">
                        Q{qNum} - {formatQuarterLabel(q.quarter)}
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <div className="text-[12px] text-white/60">
                          Status: <span className="text-white/60">{status}</span>
                        </div>

                        <ResultPill
                          status={status}
                          selected={selected}
                          correctPick={q.correctPick}
                          outcome={q.correctOutcome ?? q.outcome}
                        />

                        {isSaving && (
                          <span className="text-[11px] font-black tracking-[0.12em] text-white/35">SAVING…</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`h-9 w-9 rounded-full border border-white/15 bg-white/5 flex items-center justify-center ${
                        isLocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
                      }`}
                      aria-label="Clear pick"
                      disabled={isLocked || isSaving}
                      onClick={() => void clearPick(q.id, status)}
                    >
                      <span className="text-white/80 font-black">×</span>
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center">
                    {isPlayerPick ? <PlayerAvatar name={playerName!} /> : <GamePickHeader match={stableGame.match} />}
                  </div>

                  <div className="mt-4 text-[18px] leading-snug font-extrabold text-white">{q.question}</div>

                  <div className="mt-4 rounded-2xl bg-[#F2F2F2] p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        disabled={isLocked || isSaving}
                        className={`h-12 rounded-2xl border font-extrabold tracking-wide transition ${
                          isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                        } ${yesBtnClass}`}
                        style={selected === "yes" ? { background: BRAND_RED } : undefined}
                        onClick={() => void setPick(q.id, "yes", status)}
                      >
                        YES
                      </button>

                      <button
                        type="button"
                        disabled={isLocked || isSaving}
                        className={`h-12 rounded-2xl border font-extrabold tracking-wide transition ${
                          isLocked || isSaving ? "opacity-50 cursor-not-allowed" : ""
                        } ${noBtnClass}`}
                        style={selected === "no" ? { background: BRAND_RED } : undefined}
                        onClick={() => void setPick(q.id, "no", status)}
                      >
                        NO
                      </button>
                    </div>

                    <PercentBar yes={yes} no={no} />
                  </div>
                </div>

                {isSponsored && !isRevealed && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                    <div className="relative w-full h-full rounded-2xl border border-white/15 bg-white/10 p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black tracking-[0.22em] text-white/80">SPONSOR QUESTION</div>
                          <div className="mt-1 text-[12px] font-semibold text-white/70">
                            Proudly by <span className="font-black text-white">{sponsorName}</span>
                          </div>
                        </div>

                        <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/70">
                          SPONSORED
                        </div>
                      </div>

                      <div className="mt-5 flex-1 rounded-2xl bg-[#F2F2F2] p-4 flex flex-col items-center justify-center text-center">
                        <div className="text-[14px] font-bold text-black/80">
                          {q.sponsorBlurb || "Get this pick correct and go in the draw to win $100 Rebel Sport Gift Card"}
                        </div>

                        <button
                          type="button"
                          className="mt-4 inline-flex items-center justify-center rounded-full border border-black/15 px-6 py-2 text-sm font-extrabold text-black/85"
                          style={{ background: "rgba(255,46,77,0.20)" }}
                          onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: true }))}
                        >
                          Tap to reveal
                        </button>
                      </div>

                      <div className="mt-4 text-[11px] text-white/40">* Tap to reveal to make your pick</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 bg-black/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected: <span className="font-semibold text-white">{selectedCount}</span> / 12
            </div>

            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
              onClick={() => void fetchMatch("refresh")}
            >
              REFRESH
            </button>
          </div>
        </div>

        <div className="h-16" />
      </div>
    </div>
  );
}
