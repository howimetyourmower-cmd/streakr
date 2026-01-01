"use client";

// /app/picks/[matchSlug]/MatchPicksClient.tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any; // API can send Open/Final/etc
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
  // maps "St Kilda" -> "stkilda", "GWS" -> "gws", "North Melbourne" -> "northmelbourne"
  return team
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function extractPlayerName(question: string) {
  // tries to pull "Charlie Curnow" from: "Will Charlie Curnow (Syd) kick..."
  const q = question.trim();

  const willIdx = q.toLowerCase().startsWith("will ") ? 5 : -1;
  if (willIdx === -1) return null;

  // stop at " (" first if present
  const parenIdx = q.indexOf(" (", willIdx);
  const stopIdx = parenIdx !== -1 ? parenIdx : q.length;

  const name = q.slice(willIdx, stopIdx).trim();

  // if it looks like a non-player question, bail
  if (!name) return null;
  if (name.length > 40) return null;
  if (/\b(goals?|behinds?|disposals?|marks?|tackles?|kicks?|handballs?)\b/i.test(name)) return null;

  // must contain at least a space (first + last) to be a "player"
  if (!name.includes(" ")) return null;

  return name;
}

function playerSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

function safeStatus(s: any): QuestionStatus {
  const v = String(s || "")
    .toLowerCase()
    .trim();
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

/**
 * Renders an image that tries:
 * 1) /players/<Exact Name>.jpg  (supports your "Charlie Curnow.jpg" style)
 * 2) /players/<slug>.jpg
 * 3) fallback block
 */
function PlayerAvatar({ name }: { name: string }) {
  const exact = `/players/${encodeURIComponent(name)}.jpg`;
  const slug = `/players/${playerSlug(name)}.jpg`;

  const [src, setSrc] = useState(exact);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-16 w-16 rounded-[18px] bg-[#d11b2f] p-[3px] shadow-sm">
        <div className="h-full w-full overflow-hidden rounded-[15px] bg-[#d11b2f]">
          {/* use plain img to allow easy fallback swapping */}
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

function TeamLogoSquircle({
  teamKey,
  alt,
}: {
  teamKey: string;
  alt: string;
}) {
  // IMPORTANT: your files are in /public/aflteams like "sydney-logo.jpg"
  const src = `/aflteams/${teamKey}-logo.jpg`;

  return (
    <div className="h-16 w-16 rounded-[18px] bg-[#d11b2f] p-[3px] shadow-sm">
      <div className="h-full w-full overflow-hidden rounded-[15px] bg-[#d11b2f] flex items-center justify-center">
        <Image
          src={src}
          alt={alt}
          width={44}
          height={44}
          className="object-contain"
          priority={false}
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
        <div className="text-[12px] font-black tracking-[0.25em] text-white/60">VS</div>
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
        <div className="h-full" style={{ width: `${yesPct}%`, background: "#d11b2f" }} />
      </div>
    </div>
  );
}

export default function MatchPicksClient({ matchSlug }: { matchSlug: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [game, setGame] = useState<ApiGame | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr(null);

      try {
        // Use the SAME endpoint as your /picks list page
        const res = await fetch("/api/picks", { cache: "no-store" });
        if (!res.ok) throw new Error(`API error (${res.status})`);

        const data = (await res.json()) as PicksApiResponse;

        const found = (data.games || []).find((g) => slugifyMatch(g.match) === matchSlug);
        if (!found) throw new Error("Match not found for this slug");

        if (!alive) return;
        setGame(found);
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
    // ensure consistent ordering
    return [...qs].sort((a, b) => (a.quarter - b.quarter) || a.id.localeCompare(b.id));
  }, [game]);

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
      {/* top sponsor strip placeholder */}
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <div className="text-[11px] tracking-[0.18em] font-semibold text-white/50">
          OFFICIAL PARTNER
        </div>
        <div className="text-[11px] tracking-[0.12em] text-white/35">
          Proudly supporting TORPIE all season long
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* header */}
        <div className="flex flex-col gap-3">
          <div className="text-4xl md:text-5xl font-black italic tracking-wide">
            {matchTitle}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected: <span className="font-semibold text-white">{0}</span> / 12
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Locks: <span className="text-white/60">—</span>
            </div>
            <div className="rounded-full border border-white/15 px-3 py-1">
              Auto-locks at bounce
            </div>
          </div>
        </div>

        {/* grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {questions.map((q, idx) => {
            const status = safeStatus(q.status);
            const qNum = String(idx + 1).padStart(2, "0");

            const playerName = extractPlayerName(q.question);
            const isPlayerPick = !!playerName && !q.isSponsorQuestion;
            const isGamePick = !playerName && !q.isSponsorQuestion;

            const yes = typeof q.yesPercent === "number" ? q.yesPercent : 0;
            const no = typeof q.noPercent === "number" ? q.noPercent : 0;

            return (
              <div
                key={q.id}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161b22] p-4"
              >
                {/* silhouette locked INSIDE the card */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
                  <Image
                    src="/afl1.png"
                    alt=""
                    fill
                    className="object-cover object-center"
                    priority={false}
                  />
                </div>

                {/* top row */}
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-black tracking-wide">
                      Q{qNum} - {formatQuarterLabel(q.quarter)}
                    </div>
                    <div className="mt-1 text-[12px] text-white/60">
                      Status: <span className="text-white/60">{status}</span>
                    </div>
                  </div>

                  {/* clear button placeholder */}
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
                    aria-label="Clear pick"
                    onClick={() => {
                      // TODO: wire to clear
                    }}
                  >
                    <span className="text-white/80 font-black">×</span>
                  </button>
                </div>

                {/* icon header */}
                <div className="relative mt-4 flex justify-center">
                  {q.isSponsorQuestion ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-16 w-16 rounded-[18px] bg-[#d11b2f] p-[3px]">
                        <div className="h-full w-full overflow-hidden rounded-[15px] bg-[#d11b2f] flex items-center justify-center">
                          <span className="text-white font-black">?</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/45">
                        SPONSOR QUESTION
                      </div>
                    </div>
                  ) : isPlayerPick ? (
                    <PlayerAvatar name={playerName!} />
                  ) : (
                    <GamePickHeader match={game.match} />
                  )}
                </div>

                {/* question */}
                <div className="relative mt-4 text-[18px] leading-snug font-extrabold text-white">
                  {q.question}
                </div>

                {/* bottom answer panel (light) */}
                <div className="relative mt-4 rounded-2xl bg-[#f3efe6] p-4">
                  {/* sponsor reveal (covers everything) */}
                  {q.isSponsorQuestion ? (
                    <div className="text-center">
                      <div className="text-[14px] font-bold text-black/80">
                        {q.sponsorBlurb || "Get this pick correct and go in the draw to win $100 Rebel Sport Gift Card"}
                      </div>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center justify-center rounded-full border border-black/15 bg-[#d6a6b8] px-5 py-2 text-sm font-extrabold text-black/85"
                        onClick={() => {
                          // TODO: reveal flow
                        }}
                      >
                        Tap to reveal
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* YES/NO buttons */}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          className="h-12 rounded-2xl border border-black/15 bg-white text-black/80 font-extrabold tracking-wide hover:bg-black/[0.03]"
                          onClick={() => {
                            // TODO: pick YES
                          }}
                        >
                          YES
                        </button>
                        <button
                          type="button"
                          className="h-12 rounded-2xl border border-black/15 bg-white text-black/80 font-extrabold tracking-wide hover:bg-black/[0.03]"
                          onClick={() => {
                            // TODO: pick NO
                          }}
                        >
                          NO
                        </button>
                      </div>

                      <PercentBar yes={yes} no={no} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom bar */}
        <div className="fixed left-0 right-0 bottom-0 border-t border-white/10 bg-[#0d1117]/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm text-white/70">
            <div className="rounded-full border border-white/15 px-3 py-1">
              Picks selected: <span className="font-semibold text-white">{0}</span> / 12
            </div>
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-extrabold text-white/80"
            >
              AUTO-LOCK
            </button>
          </div>
        </div>

        {/* spacer so content isn't hidden behind bottom bar */}
        <div className="h-16" />
      </div>
    </div>
  );
}

