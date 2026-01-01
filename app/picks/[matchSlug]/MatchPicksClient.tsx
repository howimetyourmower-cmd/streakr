// /app/picks/[matchSlug]/MatchPicksClient.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

  match?: string;
  venue?: string;
  startTime?: string;

  userPick?: PickOutcome;
  yesPercent?: number;
  noPercent?: number;
  commentCount?: number;
  isSponsorQuestion?: boolean;

  sponsorName?: string;
  sponsorPrize?: string;
};

type ApiGame = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type MatchApiResponse = {
  game?: ApiGame;
  questions?: ApiQuestion[];
  roundNumber?: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function slugifyTeamName(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parseMatchTeams(match: string): { leftName: string; rightName: string; leftSlug: string; rightSlug: string } {
  const parts = (match || "").split(/\s+vs\s+/i);
  const leftName = (parts[0] || "").trim();
  const rightName = (parts[1] || "").trim();
  return {
    leftName,
    rightName,
    leftSlug: slugifyTeamName(leftName),
    rightSlug: slugifyTeamName(rightName),
  };
}

// Extract "Player Name" and "(Abbr)" like: "Will Charlie Curnow (Syd) kick..."
function extractPlayerFromQuestion(q: string): { playerName?: string; teamAbbr?: string } {
  const m = (q || "").match(/Will\s+(.+?)\s+\(([A-Za-z]{2,4})\)/i);
  if (!m) return {};
  return { playerName: (m[1] || "").trim(), teamAbbr: (m[2] || "").trim() };
}

// Heuristic: if we can extract a player name => player pick, else game pick (non-player question)
function isPlayerPick(q: string) {
  const { playerName } = extractPlayerFromQuestion(q);
  return Boolean(playerName);
}

// ---------- Robust image candidate logic (prevents “was working then disappeared”) ----------
function playerImageCandidates(name: string): string[] {
  const clean = (name || "").trim().replace(/\s+/g, " ");
  if (!clean) return [];
  const encoded = encodeURIComponent(clean);
  const dashed = encodeURIComponent(
    clean
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
  );

  return [
    `/players/${encoded}.jpg`,
    `/players/${encoded}.jpeg`,
    `/players/${encoded}.png`,
    `/players/${dashed}.jpg`,
    `/players/${dashed}.jpeg`,
    `/players/${dashed}.png`,
  ];
}

function logoCandidates(teamSlug: string): string[] {
  const s = (teamSlug || "").trim();
  if (!s) return [];
  return [
    `/aflteams/${s}-logo.png`,
    `/aflteams/${s}-logo.jpg`,
    `/aflteams/${s}-logo.jpeg`,
    `/aflteams/${s}.png`,
    `/aflteams/${s}.jpg`,
    `/aflteams/${s}.jpeg`,
  ];
}

function useCyclingImageSrc(candidates: string[]) {
  const [idx, setIdx] = useState(0);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    setIdx(0);
    setDead(false);
  }, [candidates.join("|")]);

  const src = candidates.length ? candidates[Math.min(idx, candidates.length - 1)] : "";

  const onError = () => {
    setIdx((p) => {
      const next = p + 1;
      if (next < candidates.length) return next;
      setDead(true);
      return p;
    });
  };

  return { src, dead, onError };
}

// ---------- UI atoms ----------
function Squircle({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={cn(
        "flex items-center justify-center",
        "bg-[#b21f2d]",
        "shadow-sm",
        "border border-white/10",
        "overflow-hidden",
        "rounded-[18px]",
        className
      )}
      style={{
        width: 44,
        height: 44,
      }}
    >
      {children}
    </div>
  );
}

function PlayerAvatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");

  const candidates = useMemo(() => playerImageCandidates(name), [name]);
  const { src, dead, onError } = useCyclingImageSrc(candidates);

  return (
    <Squircle title={name} className="bg-[#c51f2f]">
      {!dead && src ? (
        <div className="relative w-[44px] h-[44px]">
          <Image
            src={src}
            alt={name}
            fill
            sizes="44px"
            style={{ objectFit: "cover" }}
            onError={onError}
            priority={false}
          />
        </div>
      ) : (
        <div className="text-white font-black text-sm">{initials || "?"}</div>
      )}
    </Squircle>
  );
}

function TeamLogo({ teamSlug, label }: { teamSlug: string; label?: string }) {
  const candidates = useMemo(() => logoCandidates(teamSlug), [teamSlug]);
  const { src, dead, onError } = useCyclingImageSrc(candidates);

  return (
    <Squircle title={label || teamSlug} className="bg-[#0d1117]">
      {!dead && src ? (
        <div className="relative w-[44px] h-[44px]">
          <Image
            src={src}
            alt={label || teamSlug}
            fill
            sizes="44px"
            style={{ objectFit: "contain", padding: 6 }}
            onError={onError}
          />
        </div>
      ) : (
        <div className="text-white/80 font-black text-xs">{(label || "?").slice(0, 3).toUpperCase()}</div>
      )}
    </Squircle>
  );
}

function formatAedt(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  // keep it simple; your backend already seems to pass AEDT labels elsewhere
  return d.toLocaleString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function msToCountdown(ms: number) {
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${days}d ${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function calcYesNo(yes?: number, no?: number): { yes: number; no: number } {
  const y = typeof yes === "number" ? yes : 0;
  const n = typeof no === "number" ? no : 0;
  const sum = y + n;
  if (sum <= 0) return { yes: 0, no: 0 };
  const yesPct = Math.round((y / sum) * 100);
  const noPct = 100 - yesPct;
  return { yes: yesPct, no: noPct };
}

export default function MatchPicksClient({ matchSlug }: { matchSlug: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [game, setGame] = useState<ApiGame | null>(null);
  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [now, setNow] = useState(Date.now());

  // local picks (simple)
  const [localPicks, setLocalPicks] = useState<Record<string, LocalPick>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Auth gate (keep consistent with rest of app)
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/picks/match?matchSlug=${encodeURIComponent(matchSlug)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load match");
        const data = (await res.json()) as MatchApiResponse;

        if (cancelled) return;

        const g = data.game || null;
        const qs = (g?.questions || data.questions || []).map((q) => ({
          ...q,
          status: (q.status || "open") as QuestionStatus,
        }));

        setGame(g);
        setQuestions(qs);
      } catch (e) {
        if (!cancelled) {
          setGame(null);
          setQuestions([]);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [matchSlug]);

  const header = useMemo(() => {
    const match = game?.match || matchSlug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const venue = game?.venue || "";
    const start = game?.startTime ? formatAedt(game.startTime) + " AEDT" : "";
    const { leftName, rightName, leftSlug, rightSlug } = parseMatchTeams(match);
    return { match, venue, start, leftName, rightName, leftSlug, rightSlug };
  }, [game, matchSlug]);

  const lockMs = useMemo(() => {
    const start = game?.startTime ? new Date(game.startTime).getTime() : 0;
    if (!start) return null;
    return Math.max(0, start - now);
  }, [game?.startTime, now]);

  const selectedCount = useMemo(() => {
    return Object.values(localPicks).filter((v) => v === "yes" || v === "no").length;
  }, [localPicks]);

  function setPick(questionId: string, pick: LocalPick) {
    setLocalPicks((prev) => ({ ...prev, [questionId]: pick }));
  }

  function clearPick(questionId: string) {
    setLocalPicks((prev) => ({ ...prev, [questionId]: "none" }));
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-6">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] sm:text-[34px] font-black italic tracking-wide uppercase">
                {header.match}
              </h1>
              {header.venue ? <div className="text-white/60 mt-1">{header.venue}</div> : null}
              {header.start ? <div className="text-white/60 mt-1">{header.start}</div> : null}
            </div>

            <Link
              href="/picks"
              className="text-white/70 hover:text-white text-sm border border-white/10 rounded-xl px-3 py-2"
            >
              Back to Picks
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">
              Picks selected: {selectedCount} / {questions.length || 12}
            </div>

            <div className="rounded-full border border-[#b21f2d]/40 bg-[#b21f2d]/10 px-4 py-2 text-sm font-semibold">
              {lockMs === null ? "Locks: —" : `Locks in ${msToCountdown(lockMs)}`}
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
              Auto-locks at bounce
            </div>
          </div>
        </div>

        {/* Grid */}
        <div
          className={cn(
            "grid gap-3",
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            // keep desktop from looking too “spread out”
            "justify-items-stretch"
          )}
        >
          {questions.map((q, idx) => {
            const qNum = String(idx + 1).padStart(2, "0");
            const quarterLabel = `QUARTER ${q.quarter}`;
            const status = q.status || "open";

            const picked = localPicks[q.id] || "none";
            const pct = calcYesNo(q.yesPercent, q.noPercent);

            const player = extractPlayerFromQuestion(q.question || "");
            const playerPick = isPlayerPick(q.question || "");
            const sponsor = Boolean(q.isSponsorQuestion);

            const revealOn = revealed[q.id] === true;

            return (
              <div
                key={q.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl",
                  "border border-white/10",
                  "bg-[#161b22]", // slightly lighter than page bg
                  "shadow-sm"
                )}
              >
                {/* silhouette background */}
                <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
                  <Image
                    src="/afl1.png"
                    alt=""
                    fill
                    sizes="400px"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="absolute inset-0 bg-[#161b22]/60" />
                </div>

                {/* content */}
                <div className="relative p-4">
                  {/* top meta */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-white/85 font-black tracking-wide">
                        Q{qNum} - {quarterLabel}
                      </div>
                      <div className="text-white/55 text-sm">Status: {status}</div>
                    </div>

                    <button
                      type="button"
                      className="h-9 w-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                      onClick={() => clearPick(q.id)}
                      aria-label="Clear pick"
                      title="Clear pick"
                    >
                      <span className="text-white/70 font-black">×</span>
                    </button>
                  </div>

                  {/* avatar area */}
                  <div className="mt-3 flex flex-col items-center">
                    {playerPick ? (
                      <>
                        <PlayerAvatar name={player.playerName || "Player"} />
                        <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/45 text-center">
                          PLAYER PICK
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <TeamLogo teamSlug={header.leftSlug} label={header.leftName} />
                          <div className="text-white/55 font-black">VS</div>
                          <TeamLogo teamSlug={header.rightSlug} label={header.rightName} />
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/45 text-center">
                          GAME PICK
                        </div>
                      </>
                    )}
                  </div>

                  {/* question */}
                  <div className="mt-3 text-[18px] leading-snug font-extrabold">
                    {q.question}
                  </div>

                  {/* bottom choice panel */}
                  <div className="mt-4 rounded-2xl bg-white/[0.92] border border-black/5 p-3">
                    {/* sponsor overlay (fully covered until reveal) */}
                    {sponsor && !revealOn ? (
                      <div className="relative">
                        <div className="text-center text-black/70 font-semibold text-sm">
                          Get this pick correct and go in the draw to win
                        </div>
                        <div className="text-center text-black font-black mt-1">
                          {q.sponsorPrize || "$100 Rebel Sport Gift Card"}
                        </div>
                        <div className="mt-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setRevealed((p) => ({ ...p, [q.id]: true }))}
                            className="rounded-full px-5 py-2 font-black border border-black/10 bg-[#e7c3cf] text-black hover:brightness-95"
                          >
                            Tap to reveal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* buttons */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPick(q.id, picked === "yes" ? "none" : "yes")}
                            className={cn(
                              "rounded-2xl px-4 py-4 font-black",
                              "border",
                              picked === "yes"
                                ? "bg-[#e7c3cf] text-black border-black/10"
                                : "bg-transparent text-black/70 border-black/10 hover:bg-black/5"
                            )}
                          >
                            YES
                          </button>

                          <button
                            type="button"
                            onClick={() => setPick(q.id, picked === "no" ? "none" : "no")}
                            className={cn(
                              "rounded-2xl px-4 py-4 font-black",
                              "border",
                              picked === "no"
                                ? "bg-[#e7c3cf] text-black border-black/10"
                                : "bg-transparent text-black/70 border-black/10 hover:bg-black/5"
                            )}
                          >
                            NO
                          </button>
                        </div>

                        {/* pct labels */}
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <div className="text-black/45 font-semibold">Yes {pct.yes}%</div>
                          <div className="text-black/45 font-semibold">No {pct.no}%</div>
                        </div>

                        {/* ultra thin bar */}
                        <div className="mt-1 h-[3px] w-full rounded-full bg-black/10 overflow-hidden">
                          <div
                            className="h-full bg-[#b21f2d]"
                            style={{ width: `${clamp(pct.yes, 0, 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer lock pill */}
        <div className="fixed bottom-4 left-0 right-0 px-4">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur px-4 py-3">
              <div className="text-sm text-white/70">
                Picks selected: <span className="text-white font-bold">{selectedCount}</span> /{" "}
                <span className="text-white/80">{questions.length || 12}</span>{" "}
                {lockMs === null ? null : (
                  <span className="ml-3 text-white/60">Locks in {msToCountdown(lockMs)}</span>
                )}
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black tracking-wide text-white/70">
                AUTO-LOCK
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
