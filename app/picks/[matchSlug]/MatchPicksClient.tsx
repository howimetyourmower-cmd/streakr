"use client";

// /app/picks/[matchSlug]/MatchPicksClient.tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";
type PickOutcome = "yes" | "no";
type LocalPick = PickOutcome | "none";

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
  sponsorName?: string; // e.g. "REBEL SPORT"
  sponsorBlurb?: string;
};

type ApiGame = {
  id: string;
  match: string; // "Sydney vs Carlton"
  venue: string;
  startTime: string;
  questions: ApiQuestion[];
};

type PicksApiResponse = {
  games: ApiGame[];
  roundNumber?: number;
};

function slugifyMatch(match: string) {
  return match
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normaliseTeamKey(team: string) {
  return team
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function extractPlayerName(question: string) {
  // "Will Errol Gulden (Syd) have..." => "Errol Gulden"
  const q = question.trim();
  if (!q.toLowerCase().startsWith("will ")) return null;

  const start = 5;
  const parenIdx = q.indexOf(" (", start);
  const stopIdx = parenIdx !== -1 ? parenIdx : q.length;
  const name = q.slice(start, stopIdx).trim();

  if (!name) return null;
  if (!name.includes(" ")) return null;

  if (
    /\b(goals?|behinds?|disposals?|marks?|tackles?|kicks?|handballs?)\b/i.test(
      name
    )
  )
    return null;

  return name;
}

function playerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
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
  if (parts.length === 2) {
    return { home: parts[0].trim(), away: parts[1].trim() };
  }
  return { home: match.trim(), away: "" };
}

function PlayerAvatar({ name }: { name: string }) {
  const exact = `/players/${encodeURIComponent(name)}.jpg`;
  const slug = `/players/${playerSlug(name)}.jpg`;
  const [src, setSrc] = useState(exact);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-16 w-16 rounded-[18px] bg-[#d11b2f] p-[3px] shadow-sm">
        <div className="h-full w-full overflow-hidden rounded-[15px] bg-[#d11b2f]">
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

      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45">
        PLAYER PICK
      </div>
    </div>
  );
}

function TeamLogoSquircle({ teamKey, alt }: { teamKey: string; alt: string }) {
  // ✅ your folder is /public/afllogos (per screenshots)
  const primary = `/afllogos/${teamKey}-logo.jpg`;
  const fallback = `/aflteams/${teamKey}-logo.jpg`; // just in case you still have older path
  const [src, setSrc] = useState(primary);

  return (
    <div className="h-16 w-16 rounded-[18px] bg-[#d11b2f] p-[3px] shadow-sm">
      <div className="h-full w-full overflow-hidden rounded-[15px] bg-[#d11b2f] flex items-center justify-center">
        <Image
          src={src}
          alt={alt}
          width={44}
          height={44}
          className="object-contain"
          onError={() => {
            if (src === primary) setSrc(fallback);
          }}
        />
      </div>
    </div>
  );
}

function GamePickHeader({ match }: { match: string }) {
  const { home, away } = parseTeams(match);
  const homeKey = normaliseTeamKey(home);
  const awayKey = normaliseTeamKey(away);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3">
        <TeamLogoSquircle teamKey={homeKey} alt={home} />
        <div className="text-[12px] font-black tracking-[0.25em] text-white/60">
          VS
        </div>
        <TeamLogoSquircle teamKey={awayKey} alt={away} />
      </div>

      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45">
        GAME PICK
      </div>
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
        <div
          className="h-full"
          style={{ width: `${yesPct}%`, background: "#d11b2f" }}
        />
      </div>
    </div>
  );
}

export default function MatchPicksClient({ matchSlug }: { matchSlug: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);

  // sponsor reveal state per question
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // ✅ local pick state (YES/NO working)
  const [picks, setPicks] = useState<Record<string, LocalPick>>({});

  const picksStorageKey = useMemo(() => {
    const uid = user?.uid || "anon";
    return `torpie:picks:${uid}:${matchSlug}`;
  }, [user?.uid, matchSlug]);

  useEffect(() => {
    // load saved picks
    try {
      const raw = localStorage.getItem(picksStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, LocalPick>;
      if (parsed && typeof parsed === "object") setPicks(parsed);
    } catch {
      // ignore
    }
  }, [picksStorageKey]);

  useEffect(() => {
    // persist picks
    try {
      localStorage.setItem(picksStorageKey, JSON.stringify(picks));
    } catch {
      // ignore
    }
  }, [picks, picksStorageKey]);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) throw new Error(`API error (${res.status})`);

        const data = (await res.json()) as PicksApiResponse;
        const found = (data.games || []).find(
          (g) => slugifyMatch(g.match) === matchSlug
        );
        if (!found) throw new Error("Match not found for this slug");

        if (!alive) return;
        setGame(found);

        // seed picks from API userPick if local has none yet
        setPicks((prev) => {
          if (Object.keys(prev || {}).length > 0) return prev;
          const seeded: Record<string, LocalPick> = {};
          for (const q of found.questions || []) {
            if (q.userPick === "yes" || q.userPick === "no") seeded[q.id] = q.userPick;
          }
          return seeded;
        });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load picks");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [matchSlug]);

  const questions = useMemo(() => {
    const qs = game?.questions || [];
    return [...qs].sort(
      (a, b) => a.quarter - b.quarter || a.id.localeCompare(b.id)
    );
  }, [game]);

  const selectedCount = useMemo(() => {
    return Object.values(picks).filter((v) => v === "yes" || v === "no").length;
  }, [picks]);

  function setPick(questionId: string, value: PickOutcome) {
    setPicks((prev) => {
      const current = prev[questionId] || "none";
      // tap same choice again = clear (you said you like X to clear, but this is a nice bonus)
      const next: LocalPick = current === value ? "none" : value;
      return { ...prev, [questionId]: next };
    });
  }

  function clearPick(questionId: string) {
    setPicks((prev) => ({ ...prev, [questionId]: "none" }));
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-[#0d1117] text-white px-4 py-8">
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

  if (err || !game) {
    return (
      <div className="min-h-[70vh] bg-[#0d1117] text-white px-4 py-10">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black tracking-wide">Couldn’t load match</div>
          <div className="mt-2 text-white/70 text-sm">{err || "Unknown error"}</div>
          <div className="mt-4 text-white/40 text-xs">
            Slug: <span className="font-mono">{matchSlug}</span>
          </div>
        </div>
      </div>
    );
  }

  const { home, away } = parseTeams(game.match);
  const matchTitle = `${home.toUpperCase()} VS ${away.toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <div className="text-[11px] tracking-[0.18em] font-semibold text-white/50">
          OFFICIAL PARTNER
        </div>
        <div className="text-[11px] tracking-[0.12em] text-white/35">
          Proudly supporting TORPIE all season long
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3">
          <div className="text-4xl md:text-5xl font-black italic tracking-wide">
            {matchTitle}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected:{" "}
              <span className="font-semibold text-white">{selectedCount}</span> / 12
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Locks: <span className="text-white/60">—</span>
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Auto-locks at bounce
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {questions.map((q, idx) => {
            const status = safeStatus(q.status);
            const qNum = String(idx + 1).padStart(2, "0");

            const playerName = extractPlayerName(q.question);
            const isSponsored = !!q.isSponsorQuestion;
            const isRevealed = !!revealed[q.id];

            // pick type is based on content (NOT sponsorship)
            const isPlayerPick = !!playerName;

            const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
            const no = typeof q.noPercent === "number" ? q.noPercent : 0;

            const sponsorName = (q.sponsorName || "REBEL SPORT").toUpperCase();

            const selected = picks[q.id] || "none";
            const disabledByStatus = status !== "open"; // keep simple

            const yesBtnClass =
              selected === "yes"
                ? "bg-[#d11b2f] text-white border-black/10 shadow-[0_0_0_3px_rgba(209,27,47,0.20)]"
                : "bg-white text-black/80 border-black/15 hover:bg-black/[0.03]";
            const noBtnClass =
              selected === "no"
                ? "bg-[#d11b2f] text-white border-black/10 shadow-[0_0_0_3px_rgba(209,27,47,0.20)]"
                : "bg-white text-black/80 border-black/15 hover:bg-black/[0.03]";

            return (
              <div
                key={q.id}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161b22] p-4"
              >
                <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
                  <Image
                    src="/afl1.png"
                    alt=""
                    fill
                    className="object-cover object-center"
                  />
                </div>

                {/* CONTENT (always rendered underneath) */}
                <div
                  className={`relative ${
                    isSponsored && !isRevealed ? "pointer-events-none select-none blur-[1px]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-black tracking-wide">
                        Q{qNum} - {formatQuarterLabel(q.quarter)}
                      </div>
                      <div className="mt-1 text-[12px] text-white/60">
                        Status: <span className="text-white/60">{status}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="h-9 w-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                      aria-label="Clear pick"
                      onClick={() => clearPick(q.id)}
                    >
                      <span className="text-white/80 font-black">×</span>
                    </button>
                  </div>

                  <div className="mt-4 flex justify-center">
                    {isPlayerPick ? (
                      <PlayerAvatar name={playerName!} />
                    ) : (
                      <GamePickHeader match={game.match} />
                    )}
                  </div>

                  <div className="mt-4 text-[18px] leading-snug font-extrabold text-white">
                    {q.question}
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#f3efe6] p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        disabled={disabledByStatus}
                        className={`h-12 rounded-2xl border font-extrabold tracking-wide transition ${
                          disabledByStatus ? "opacity-50 cursor-not-allowed" : ""
                        } ${yesBtnClass}`}
                        onClick={() => setPick(q.id, "yes")}
                      >
                        YES
                      </button>

                      <button
                        type="button"
                        disabled={disabledByStatus}
                        className={`h-12 rounded-2xl border font-extrabold tracking-wide transition ${
                          disabledByStatus ? "opacity-50 cursor-not-allowed" : ""
                        } ${noBtnClass}`}
                        onClick={() => setPick(q.id, "no")}
                      >
                        NO
                      </button>
                    </div>

                    <PercentBar yes={yes} no={no} />
                  </div>
                </div>

                {/* SPONSOR OVERLAY (covers whole card until revealed) */}
                {isSponsored && !isRevealed && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0d1117]/55 backdrop-blur-[2px]" />

                    <div className="relative w-full h-full rounded-2xl border border-white/15 bg-white/10 p-5 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black tracking-[0.22em] text-white/80">
                            SPONSOR QUESTION
                          </div>
                          <div className="mt-1 text-[12px] font-semibold text-white/70">
                            Proudly by{" "}
                            <span className="font-black text-white">{sponsorName}</span>
                          </div>
                        </div>

                        <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/70">
                          SPONSORED
                        </div>
                      </div>

                      <div className="mt-5 flex-1 rounded-2xl bg-[#f3efe6] p-4 flex flex-col items-center justify-center text-center">
                        <div className="text-[14px] font-bold text-black/80">
                          {q.sponsorBlurb ||
                            "Get this pick correct and go in the draw to win $100 Rebel Sport Gift Card"}
                        </div>

                        <button
                          type="button"
                          className="mt-4 inline-flex items-center justify-center rounded-full border border-black/15 bg-[#d6a6b8] px-6 py-2 text-sm font-extrabold text-black/85"
                          onClick={() => setRevealed((prev) => ({ ...prev, [q.id]: true }))}
                        >
                          Tap to reveal
                        </button>
                      </div>

                      <div className="mt-4 text-[11px] text-white/40">
                        * Tap to reveal to make your pick
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 bg-[#0d1117]/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected:{" "}
              <span className="font-semibold text-white">{selectedCount}</span> / 12
            </div>
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
            >
              AUTO-LOCK
            </button>
          </div>
        </div>

        <div className="h-16" />
      </div>
    </div>
  );
}
