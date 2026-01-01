// /app/picks/[matchSlug]/page.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

  isSponsorQuestion?: boolean;
  sponsorName?: string;
  sponsorPrize?: string;

  // optional % stats if your API sends them
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

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

const COLORS = {
  bg: "#0d1117",
  card: "#161b22",
  red: "#FF2E4D",
};

const HOW_TO_PLAY_KEY = "torpie_seen_how_to_play_match_v1";

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

function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

function splitMatch(match: string): { home: string; away: string } | null {
  const m = (match || "").split(/\s+vs\s+/i);
  if (m.length !== 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}

function logoCandidates(teamSlug: TeamSlug): string[] {
  return [
    `/aflteams/${teamSlug}-logo.jpg`,
    `/aflteams/${teamSlug}-logo.jpeg`,
    `/aflteams/${teamSlug}-logo.png`,
  ];
}

const TeamLogo = React.memo(function TeamLogoInner({
  teamName,
  size = 44,
}: {
  teamName: string;
  size?: number;
}) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const initials = (teamName || "AFL")
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
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.75)",
        }}
        title={teamName}
      >
        {initials || "AFL"}
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
        borderColor: "rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
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
});

function HowToPlayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(15,15,15,0.98)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.85)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] uppercase tracking-widest text-white/60">How to play</div>
              <div className="mt-1 text-[22px] font-black text-white">Pick. Lock. Survive.</div>
              <div className="mt-1 text-[13px] text-white/70 leading-snug">
                Picks auto-lock at bounce. No lock-in button.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border px-3 py-1.5 text-[12px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">1</div>
              <div className="mt-1 text-[14px] font-black text-white">Pick any amount</div>
              <div className="mt-1 text-[12px] text-white/70">Choose 0–12 questions for this match.</div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">2</div>
              <div className="mt-1 text-[14px] font-black text-white">Locks at bounce</div>
              <div className="mt-1 text-[12px] text-white/70">Once the countdown hits zero, picks are locked.</div>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[12px] uppercase tracking-widest text-white/55">3</div>
              <div className="mt-1 text-[14px] font-black text-white">Clean Sweep</div>
              <div className="mt-1 text-[12px] text-white/70">One wrong pick wipes this match streak. Voids don’t count.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-2xl border px-5 py-4 text-[13px] font-black"
            style={{
              borderColor: "rgba(255,46,77,0.55)",
              background: "rgba(255,46,77,0.18)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "0 10px 30px rgba(255,46,77,0.18)",
            }}
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helpers for "player pick" auto image ---
function extractPlayerName(question: string): string | null {
  // matches "Will Charlie Curnow (Syd) ..." -> "Charlie Curnow"
  const m = (question || "").match(/Will\s+([A-Za-z'\-]+\s+[A-Za-z'\-]+)/i);
  if (!m) return null;
  return m[1].trim();
}
function playerImageCandidates(playerName: string): string[] {
  const base = slugify(playerName);
  // you said you save as "/public/players/Charlie Curnow.jpg" etc; we'll try both
  return [
    `/players/${playerName}.jpg`,
    `/players/${playerName}.png`,
    `/players/${playerName}.jpeg`,
    `/players/${base}.jpg`,
    `/players/${base}.png`,
    `/players/${base}.jpeg`,
  ];
}

function AvatarSquircle({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  // single source of truth for the avatar sizing/shape
  return (
    <div
      className="mx-auto flex items-center justify-center overflow-hidden border"
      style={{
        width: 56,
        height: 56,
        borderRadius: 18, // squircle-ish
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(255,46,77,0.95)", // solid red fill behind player cutout
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
      title={title}
    >
      {children}
    </div>
  );
}

function PlayerAvatar({ question }: { question: string }) {
  const name = extractPlayerName(question);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  if (!name || dead) {
    return (
      <AvatarSquircle title={name || "Player"}>
        <div className="text-[18px] font-black text-white/90">?</div>
      </AvatarSquircle>
    );
  }

  const candidates = playerImageCandidates(name);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <AvatarSquircle title={name}>
      <div className="relative w-full h-full">
        <Image
          src={src}
          alt={name}
          fill
          sizes="56px"
          style={{ objectFit: "cover" }}
          onError={() => {
            setIdx((p) => {
              if (p + 1 < candidates.length) return p + 1;
              setDead(true);
              return p;
            });
          }}
        />
      </div>
    </AvatarSquircle>
  );
}

function InlineTeamLogo({
  teamName,
  size = 22,
}: {
  teamName: string;
  size?: number;
}) {
  const slug = teamNameToSlug(teamName);
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  const initials = (teamName || "AFL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  if (!slug || dead) {
    return (
      <div
        className="flex items-center justify-center font-black"
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: "rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.90)",
          fontSize: 10,
          lineHeight: 1,
        }}
        title={teamName}
      >
        {initials || "AFL"}
      </div>
    );
  }

  const candidates = logoCandidates(slug);
  const src = candidates[Math.min(idx, candidates.length - 1)];

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: 8,
      }}
      title={teamName}
    >
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
  );
}

function GamePickAvatar({ match }: { match: string }) {
  const teams = splitMatch(match);
  const home = teams?.home ?? "";
  const away = teams?.away ?? "";

  return (
    <AvatarSquircle title={match}>
      <div className="flex items-center justify-center gap-1.5 px-1">
        <InlineTeamLogo teamName={home || "AFL"} size={22} />
        <div className="text-[10px] font-black text-white/90 leading-none">VS</div>
        <InlineTeamLogo teamName={away || "AFL"} size={22} />
      </div>
    </AvatarSquircle>
  );
}

export default function MatchPicksPage({ params }: { params: { matchSlug: string } }) {
  const { user } = useAuth();
  const matchSlug = params.matchSlug;

  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [localPicks, setLocalPicks] = useState<Record<string, LocalPick>>({});
  const [revealedSponsor, setRevealedSponsor] = useState<Record<string, boolean>>({});

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [howToOpen, setHowToOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(HOW_TO_PLAY_KEY);
      if (!seen) setHowToOpen(true);
    } catch {}
  }, []);

  const closeHowTo = useCallback(() => {
    try {
      localStorage.setItem(HOW_TO_PLAY_KEY, "1");
    } catch {}
    setHowToOpen(false);
  }, []);

  const savePick = useCallback(
    async (questionId: string, pick: LocalPick) => {
      let authHeader: Record<string, string> = {};
      if (user) {
        try {
          const token = await user.getIdToken();
          authHeader = { Authorization: `Bearer ${token}` };
        } catch {}
      }

      const payload = { questionId, pick: pick === "none" ? null : pick };
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
    },
    [user]
  );

  const load = useCallback(async () => {
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

      const res = await fetch("/api/picks", { headers: authHeader, cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as PicksApiResponse;

      setRoundNumber(typeof data.roundNumber === "number" ? data.roundNumber : null);

      const games: ApiGame[] = Array.isArray(data.games) ? data.games : [];
      const found: ApiGame | null = games.find((g) => slugify(g.match) === matchSlug) || null;

      setGame(found);

      const next: Record<string, LocalPick> = {};
      if (found?.questions?.length) {
        for (const q of found.questions) {
          next[q.id] = q.userPick ? q.userPick : "none";
        }
      }
      setLocalPicks(next);
    } catch (e) {
      console.error(e);
      setErr("Could not load this match right now.");
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [matchSlug, user]);

  useEffect(() => {
    load();
  }, [load]);

  const lockMs = useMemo(() => {
    if (!game) return 0;
    return new Date(game.startTime).getTime() - nowMs;
  }, [game, nowMs]);

  const isLocked = lockMs <= 0;

  const picksSelected = useMemo(() => {
    return Object.values(localPicks).filter((v) => v === "yes" || v === "no").length;
  }, [localPicks]);

  const roundLabel =
    roundNumber === null ? "" : roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`;

  const headerTeams = useMemo(() => {
    if (!game) return { home: "", away: "" };
    const m = splitMatch(game.match);
    return {
      home: m?.home ?? game.match,
      away: m?.away ?? "",
    };
  }, [game]);

  const onPick = useCallback(
    async (questionId: string, nextPick: LocalPick) => {
      if (isLocked) return;

      setLocalPicks((prev) => ({ ...prev, [questionId]: nextPick }));

      try {
        await savePick(questionId, nextPick);
      } catch (e) {
        console.error(e);
        load();
      }
    },
    [isLocked, load, savePick]
  );

  const onClear = useCallback(
    (questionId: string) => {
      onPick(questionId, "none");
    },
    [onPick]
  );

  const revealSponsor = useCallback((qid: string) => {
    setRevealedSponsor((p) => ({ ...p, [qid]: true }));
  }, []);

  const silhouetteSrc = "/afl1.png";

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: COLORS.bg }}>
      <HowToPlayModal open={howToOpen} onClose={closeHowTo} />

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-28">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/picks"
            className="rounded-full border px-4 py-2 text-[12px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.92)",
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            className="rounded-full border px-4 py-2 text-[12px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            How to play
          </button>
        </div>

        <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
          <div
            className="p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.96) 100%)",
            }}
          >
            {loading ? (
              <div className="text-white/70 text-sm">Loading match…</div>
            ) : !game ? (
              <div className="text-white/70 text-sm">Match not found.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <TeamLogo teamName={headerTeams.home} size={46} />
                    <div className="text-white/60 font-black text-[12px] w-[22px] text-center">VS</div>
                    <TeamLogo teamName={headerTeams.away || "AFL"} size={46} />
                  </div>

                  <div className="text-right">
                    {roundLabel ? (
                      <div
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{
                          borderColor: "rgba(255,46,77,0.35)",
                          background: "rgba(255,46,77,0.10)",
                          color: "rgba(255,255,255,0.92)",
                        }}
                      >
                        {roundLabel}
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-white/70 font-semibold">{formatAedt(game.startTime)}</div>
                  </div>
                </div>

                <div className="mt-3 text-[18px] sm:text-[22px] font-black text-white leading-tight italic uppercase">
                  {game.match}
                </div>

                <div className="mt-3 text-[12px] text-white/65">{game.venue}</div>

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                    style={{
                      borderColor: "rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    Picks selected: {picksSelected} / 12
                  </span>

                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
                    style={{
                      borderColor: isLocked ? "rgba(255,46,77,0.55)" : "rgba(255,46,77,0.28)",
                      background: isLocked ? "rgba(255,46,77,0.16)" : "rgba(255,46,77,0.10)",
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {isLocked ? "LOCKED (auto)" : `Locks in ${msToCountdown(lockMs)}`}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {err ? (
          <div className="mt-4 text-sm" style={{ color: COLORS.red }}>
            {err} Try refreshing.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
              >
                <div className="h-[90px] bg-white/5" />
              </div>
            ))
          ) : !game ? null : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {game.questions
                .slice()
                .sort((a, b) => a.quarter - b.quarter)
                .map((q, idx) => {
                  const pick = localPicks[q.id] ?? "none";
                  const sponsor = !!q.isSponsorQuestion;
                  const revealed = !!revealedSponsor[q.id];

                  const sponsorName = (q.sponsorName || "Rebel Sport").trim();
                  const prize = (q.sponsorPrize || "$100 Rebel Sport Gift Card").trim();
                  const sponsorLine = `Proudly sponsored by ${sponsorName}. Get this pick correct and go in the draw to win ${prize}.`;

                  const yes = typeof q.yesPercent === "number" ? Math.max(0, Math.min(100, q.yesPercent)) : 0;
                  const no = typeof q.noPercent === "number" ? Math.max(0, Math.min(100, q.noPercent)) : 0;
                  const hasStats = typeof q.yesPercent === "number" || typeof q.noPercent === "number";

                  const cardStyles =
                    revealed && sponsor
                      ? { borderColor: "rgba(255,46,77,0.55)", background: COLORS.card }
                      : { borderColor: "rgba(255,255,255,0.10)", background: COLORS.card };

                  const isGamePick = !extractPlayerName(q.question);

                  return (
                    <div key={q.id} className="rounded-2xl border overflow-hidden relative" style={cardStyles}>
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 opacity-[0.08]">
                          <Image src={silhouetteSrc} alt="" fill sizes="600px" style={{ objectFit: "cover" }} />
                        </div>
                      </div>

                      <div className="relative p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] uppercase tracking-widest text-white/55 font-black">
                              Q{String(idx + 1).padStart(2, "0")} · QUARTER {q.quarter}
                            </div>

                            <div className="mt-1 text-[12px] text-white/60">
                              Status: <span className="text-white/75">{q.status}</span>
                            </div>
                          </div>

                          {pick !== "none" ? (
                            <button
                              type="button"
                              onClick={() => onClear(q.id)}
                              disabled={isLocked || (sponsor && !revealed)}
                              className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-black"
                              style={{
                                borderColor: "rgba(255,255,255,0.14)",
                                background: "rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.92)",
                                opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                              }}
                              title={isLocked ? "Locked" : "Clear pick"}
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>

                        {/* Avatar + label */}
                        <div className="mt-5">
                          {isGamePick ? <GamePickAvatar match={game.match} /> : <PlayerAvatar question={q.question} />}

                          <div className="mt-2 text-center text-[11px] font-black uppercase tracking-widest text-white/45">
                            {isGamePick ? "GAME PICK" : "PLAYER PICK"}
                          </div>
                        </div>

                        {sponsor ? (
                          <div
                            className="mt-4 rounded-xl border px-3 py-2"
                            style={{
                              borderColor: revealed ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.12)",
                              background: revealed ? "rgba(255,46,77,0.18)" : "rgba(255,255,255,0.05)",
                              color: "rgba(255,255,255,0.92)",
                            }}
                          >
                            <div className="text-[11px] font-black uppercase tracking-widest">
                              Sponsor Question · {sponsorName}
                            </div>
                            <div className="mt-1 text-[12px] text-white/80 leading-snug">{sponsorLine}</div>
                          </div>
                        ) : null}

                        <div className="mt-4 text-[15px] font-black text-white leading-snug">
                          {q.question}
                        </div>

                        {/* Bottom section */}
                        <div
                          className="mt-4 rounded-2xl border px-3 py-3"
                          style={{
                            borderColor: "rgba(0,0,0,0.08)",
                            background: "rgba(255,255,255,0.88)",
                            color: "rgba(0,0,0,0.85)",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onPick(q.id, pick === "yes" ? "none" : "yes")}
                              disabled={isLocked || (sponsor && !revealed)}
                              className="flex-1 rounded-2xl border px-4 py-3 text-[13px] font-black"
                              style={{
                                borderRadius: 16,
                                borderColor: pick === "yes" ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.12)",
                                background: pick === "yes" ? "rgba(255,46,77,0.18)" : "rgba(255,255,255,0.72)",
                                color: "rgba(0,0,0,0.82)",
                                opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                              }}
                            >
                              YES
                            </button>

                            <button
                              type="button"
                              onClick={() => onPick(q.id, pick === "no" ? "none" : "no")}
                              disabled={isLocked || (sponsor && !revealed)}
                              className="flex-1 rounded-2xl border px-4 py-3 text-[13px] font-black"
                              style={{
                                borderRadius: 16,
                                borderColor: pick === "no" ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.12)",
                                background: pick === "no" ? "rgba(255,46,77,0.18)" : "rgba(255,255,255,0.72)",
                                color: "rgba(0,0,0,0.82)",
                                opacity: isLocked || (sponsor && !revealed) ? 0.45 : 1,
                              }}
                            >
                              NO
                            </button>
                          </div>

                          {/* % labels + ultra thin bar */}
                          {hasStats ? (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "rgba(0,0,0,0.45)" }}>
                                <div>Yes {yes}%</div>
                                <div>No {no}%</div>
                              </div>
                              <div className="mt-1 h-[3px] w-full rounded-full" style={{ background: "rgba(0,0,0,0.10)" }}>
                                <div
                                  className="h-[3px] rounded-full"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, yes))}%`,
                                    background: "rgba(255,46,77,0.65)",
                                  }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Sponsor reveal overlay (must cover EVERYTHING) */}
                      {sponsor && !revealed ? (
                        <button
                          type="button"
                          onClick={() => revealSponsor(q.id)}
                          className="absolute inset-0 z-[20] flex items-center justify-center p-4"
                          style={{
                            background: "rgba(255,255,255,0.95)",
                            color: "rgba(0,0,0,0.92)",
                            cursor: "pointer",
                          }}
                          aria-label="Reveal sponsored question"
                        >
                          <div
                            className="w-full max-w-md rounded-2xl border px-5 py-4 text-center"
                            style={{
                              borderColor: "rgba(0,0,0,0.10)",
                              background: "rgba(255,255,255,0.86)",
                              boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
                            }}
                          >
                            <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.55)" }}>
                              Sponsor Question · {sponsorName}
                            </div>

                            <div className="mt-2 text-[16px] font-black">Tap to reveal</div>

                            <div className="mt-2 text-[12px]" style={{ color: "rgba(0,0,0,0.62)" }}>
                              Get this pick correct and go in the draw to win{" "}
                              <span className="font-black">{prize}</span>
                            </div>

                            <div
                              className="mt-3 inline-flex items-center justify-center rounded-xl border px-4 py-2 text-[12px] font-black"
                              style={{
                                borderColor: "rgba(0,0,0,0.12)",
                                background: "rgba(255,46,77,0.12)",
                                color: "rgba(0,0,0,0.82)",
                              }}
                            >
                              Tap to reveal
                            </div>
                          </div>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[90] px-3 pb-3">
        <div className="mx-auto max-w-5xl rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          <div
            className="px-4 py-3 flex items-center justify-between gap-3"
            style={{
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="min-w-0">
              <div className="text-[12px] font-black text-white">Picks selected: {picksSelected} / 12</div>
              <div className="text-[11px] text-white/65">{isLocked ? "LOCKED — Changes disabled" : `Locks in ${msToCountdown(lockMs)}`}</div>
            </div>

            <div
              className="shrink-0 rounded-xl border px-3 py-2 text-[11px] font-black"
              style={{
                borderColor: isLocked ? "rgba(255,46,77,0.55)" : "rgba(255,255,255,0.14)",
                background: isLocked ? "rgba(255,46,77,0.14)" : "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {isLocked ? "LOCKED" : "AUTO-LOCK"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
