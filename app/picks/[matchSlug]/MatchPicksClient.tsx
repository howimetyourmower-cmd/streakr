"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
  question: string;
  status: any;
  match?: string;
  venue?: string;
  startTime?: string;

  // optional stats
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
  games?: ApiGame[];
  roundNumber?: number;
};

function safeLower(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function titleFromSlug(slug: string) {
  const s = decodeSlug(slug).replace(/-/g, " ").trim();
  return s.toUpperCase();
}

function matchNameFromSlug(slug: string) {
  const s = decodeSlug(slug).replace(/-/g, " ").trim();
  return s
    .split(" ")
    .map((w) =>
      w.toLowerCase() === "vs" ? "vs" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, text, json };
}

/** Extract "Charlie Curnow" from "Will Charlie Curnow (Syd) ..." */
function extractPlayerName(q: string): string | null {
  const m = q.match(/^Will\s+(.+?)\s*\(/i);
  if (!m) return null;
  const name = m[1].trim();
  if (!name || name.length < 3) return null;
  // basic guard: if it looks like a non-person question
  if (/\d/.test(name)) return null;
  return name;
}

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** "Sydney vs Carlton" -> { home: "Sydney", away: "Carlton" } */
function parseTeamsFromMatch(match: string): { home: string; away: string } | null {
  const parts = match.split(/\s+vs\s+/i);
  if (parts.length !== 2) return null;
  return { home: parts[0].trim(), away: parts[1].trim() };
}

function teamLogoPath(team: string) {
  // expects /public/teams/<slug>.png (or jpg). Adjust if your folder differs.
  const s = team
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `/teams/${s}.png`;
}

export default function MatchPicksClient({ matchSlug }: { matchSlug: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PicksApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // image fallback maps (so if png fails we try jpg/webp)
  const [brokenPlayers, setBrokenPlayers] = useState<Record<string, boolean>>({});
  const [brokenTeams, setBrokenTeams] = useState<Record<string, boolean>>({});

  const headerTitle = useMemo(() => titleFromSlug(matchSlug), [matchSlug]);
  const matchName = useMemo(() => matchNameFromSlug(matchSlug), [matchSlug]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      setData(null);

      const candidates = [
        `/api/picks?matchSlug=${encodeURIComponent(matchSlug)}`,
        `/api/picks?slug=${encodeURIComponent(matchSlug)}`,
        `/api/picks?match=${encodeURIComponent(matchName)}`,
      ];

      for (const url of candidates) {
        try {
          const out = await fetchJson(url);
          if (out.ok && out.json && typeof out.json === "object") {
            const games = Array.isArray(out.json.games) ? out.json.games : [];
            if (games.length > 0) {
              if (!mounted) return;
              setData(out.json);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      if (!mounted) return;
      setError("No games/questions returned from API for this match.");
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [matchSlug, matchName, user?.uid]);

  const game: ApiGame | null = useMemo(() => {
    const g = data?.games;
    return Array.isArray(g) && g.length ? g[0] : null;
  }, [data]);

  const teams = useMemo(() => {
    const m = game?.match ?? matchName;
    return parseTeamsFromMatch(m);
  }, [game?.match, matchName]);

  const questions = useMemo(() => {
    const qs = game?.questions ?? [];
    return qs
      .map((q) => ({
        ...q,
        status: (safeLower(q.status) as QuestionStatus) || "open",
        quarter: Number(q.quarter || 0),
      }))
      .sort((a, b) => (a.quarter - b.quarter) || a.id.localeCompare(b.id));
  }, [game]);

  // placeholder until you wire real local picks back in
  const picksSelected = 0;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24">
        <div className="mb-6">
          <h1 className="text-4xl font-black tracking-wide italic uppercase">
            {headerTitle}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Picks selected:{" "}
              <span className="text-white/90 font-semibold">{picksSelected} / 12</span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Locks: <span className="text-white/90 font-semibold">—</span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Auto-locks at bounce
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            Loading picks…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <div className="text-lg font-semibold">No picks loaded</div>
            <div className="mt-1 text-sm text-white/75">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* tighter grid = less boring */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {questions.map((q, idx) => {
                const qNo = String(idx + 1).padStart(2, "0");
                const quarterLabel = q.quarter ? `QUARTER ${q.quarter}` : "GAME";
                const status = safeLower(q.status); // keep lowercase

                const playerName = extractPlayerName(q.question);
                const isPlayerPick = !!playerName;
                const isGamePick = !isPlayerPick;

                // Player image path attempts
                const playerSlug = playerName ? slugifyName(playerName) : null;
                const playerBase = playerSlug ? `/players/${playerSlug}` : null;

                // Team logos (game pick)
                const homeLogo = teams?.home ? teamLogoPath(teams.home) : null;
                const awayLogo = teams?.away ? teamLogoPath(teams.away) : null;

                const yesPct =
                  typeof q.yesPercent === "number"
                    ? Math.max(0, Math.min(100, q.yesPercent))
                    : 0;
                const noPct =
                  typeof q.noPercent === "number"
                    ? Math.max(0, Math.min(100, q.noPercent))
                    : 0;

                return (
                  <div
                    key={q.id}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161b22] p-4"
                  >
                    {/* silhouette stays IN the card */}
                    <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
                      <Image
                        src="/afl1.png"
                        alt=""
                        fill
                        className="object-cover object-center"
                        priority={false}
                      />
                    </div>

                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black tracking-wide">
                            {`Q${qNo} - ${quarterLabel}`}
                          </div>
                          <div className="mt-1 text-xs text-white/70">
                            Status: <span className="text-white/70">{status}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                          title="Clear pick"
                          onClick={() => {}}
                        >
                          ×
                        </button>
                      </div>

                      {/* Avatar / Logos block */}
                      <div className="mt-4 flex flex-col items-center">
                        {isPlayerPick ? (
                          <>
                            {/* squircle avatar */}
                            <div className="relative h-14 w-14 overflow-hidden rounded-[18px] bg-[#d94b4b] shadow-sm">
                              {/* try jpg first, then png, then webp by swapping src on error */}
                              {!playerBase ? null : (
                                <>
                                  {!brokenPlayers[`${playerBase}.jpg`] ? (
                                    <Image
                                      src={`${playerBase}.jpg`}
                                      alt={playerName ?? "Player"}
                                      fill
                                      className="object-cover"
                                      onError={() =>
                                        setBrokenPlayers((p) => ({
                                          ...p,
                                          [`${playerBase}.jpg`]: true,
                                        }))
                                      }
                                    />
                                  ) : !brokenPlayers[`${playerBase}.png`] ? (
                                    <Image
                                      src={`${playerBase}.png`}
                                      alt={playerName ?? "Player"}
                                      fill
                                      className="object-cover"
                                      onError={() =>
                                        setBrokenPlayers((p) => ({
                                          ...p,
                                          [`${playerBase}.png`]: true,
                                        }))
                                      }
                                    />
                                  ) : !brokenPlayers[`${playerBase}.webp`] ? (
                                    <Image
                                      src={`${playerBase}.webp`}
                                      alt={playerName ?? "Player"}
                                      fill
                                      className="object-cover"
                                      onError={() =>
                                        setBrokenPlayers((p) => ({
                                          ...p,
                                          [`${playerBase}.webp`]: true,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-white/70 text-xs font-semibold">
                                      ?
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="mt-2 text-[11px] font-semibold tracking-widest text-white/45 uppercase">
                              Player pick
                            </div>
                          </>
                        ) : (
                          <>
                            {/* GAME PICK: two squircles + VS */}
                            <div className="flex items-center gap-2">
                              <div className="relative h-14 w-14 overflow-hidden rounded-[18px] bg-white/5 border border-white/10">
                                {homeLogo && !brokenTeams[homeLogo] ? (
                                  <Image
                                    src={homeLogo}
                                    alt={teams?.home ?? "Home"}
                                    fill
                                    className="object-contain p-2"
                                    onError={() =>
                                      setBrokenTeams((p) => ({ ...p, [homeLogo]: true }))
                                    }
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-white/40 text-xs font-semibold">
                                    {teams?.home?.slice(0, 2).toUpperCase() ?? "H"}
                                  </div>
                                )}
                              </div>

                              <div className="text-xs font-black tracking-widest text-white/50">
                                VS
                              </div>

                              <div className="relative h-14 w-14 overflow-hidden rounded-[18px] bg-white/5 border border-white/10">
                                {awayLogo && !brokenTeams[awayLogo] ? (
                                  <Image
                                    src={awayLogo}
                                    alt={teams?.away ?? "Away"}
                                    fill
                                    className="object-contain p-2"
                                    onError={() =>
                                      setBrokenTeams((p) => ({ ...p, [awayLogo]: true }))
                                    }
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-white/40 text-xs font-semibold">
                                    {teams?.away?.slice(0, 2).toUpperCase() ?? "A"}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 text-[11px] font-semibold tracking-widest text-white/45 uppercase">
                              Game pick
                            </div>
                          </>
                        )}
                      </div>

                      {/* Question */}
                      <div className="mt-3 text-base font-semibold text-white/90">
                        {q.question}
                      </div>

                      {/* bottom light panel */}
                      <div className="mt-4 rounded-2xl bg-[#f2efe9] p-3 text-[#0d1117]">
                        <div className="grid grid-cols-2 gap-3">
                          <button className="h-12 rounded-2xl border border-black/15 bg-white/70 font-semibold">
                            YES
                          </button>
                          <button className="h-12 rounded-2xl border border-black/15 bg-white/70 font-semibold">
                            NO
                          </button>
                        </div>

                        {/* % labels + thin bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-black/50">
                            <span>Yes {yesPct}%</span>
                            <span>No {noPct}%</span>
                          </div>
                          <div className="mt-2 h-[3px] w-full rounded-full bg-black/10 overflow-hidden">
                            <div
                              className="h-[3px] rounded-full bg-[#e85b7a]"
                              style={{ width: `${yesPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* footer */}
            <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0d1117]/90 backdrop-blur">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm text-white/75">
                <div>Picks selected: {picksSelected} / 12</div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  AUTO-LOCK
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-8">
          <Link href="/picks" className="text-sm text-white/70 underline">
            ← Back to Picks
          </Link>
        </div>
      </div>
    </div>
  );
}
