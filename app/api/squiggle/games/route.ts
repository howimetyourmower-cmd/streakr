// /app/api/squiggle/games/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type SquiggleGame = {
  id: number;
  year: number;
  round: number;
  date: string; // ISO string
  tz?: string; // "+10:00" etc.
  hteam: number;
  ateam: number;
  venue?: string | null;
  complete?: number | null;
  hscore?: number | null;
  ascore?: number | null;
  is_final?: number | null;
};

type SquiggleTeam = {
  id: number;
  name: string;
  abbrev?: string;
};

type SquiggleGamesResponse = {
  games: SquiggleGame[];
};

type SquiggleTeamsResponse = {
  teams: SquiggleTeam[];
};

type NormalizedGame = {
  squiggleId: number;
  year: number;
  round: number;
  startTimeUtc: string; // always UTC ISO
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  status: "scheduled" | "live" | "final";
  homeScore: number | null;
  awayScore: number | null;
  percentComplete: number | null;
};

const SQUIGGLE_BASE = "https://api.squiggle.com.au/";

const CACHE_MS = 30_000;
let cache: { key: string; at: number; data: NormalizedGame[] } | null = null;

function toStatus(g: SquiggleGame): "scheduled" | "live" | "final" {
  if (g.is_final && g.is_final > 0) return "final";
  const pct = typeof g.complete === "number" ? g.complete : null;
  if (pct !== null && pct > 0 && pct < 100) return "live";
  // Some games may not set complete until started; treat 0 as scheduled.
  return "scheduled";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    // No-store + our own in-memory cache prevents stale drift per instance
    cache: "no-store",
    headers: {
      "User-Agent": "SCREAMR/1.0 (+https://example.com)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Squiggle fetch failed ${res.status}`);
  }
  return (await res.json()) as T;
}

function mapTeams(teams: SquiggleTeam[]): Record<number, string> {
  const m: Record<number, string> = {};
  for (const t of teams) m[t.id] = t.name;
  return m;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const year = Number(searchParams.get("year") || "");
    const round = Number(searchParams.get("round") || "");

    if (!Number.isFinite(year) || year < 2000) {
      return NextResponse.json({ error: "year required" }, { status: 400 });
    }
    if (!Number.isFinite(round) || round < -5 || round > 40) {
      return NextResponse.json({ error: "round required" }, { status: 400 });
    }

    const key = `${year}|${round}`;
    const now = Date.now();

    if (cache && cache.key === key && now - cache.at < CACHE_MS) {
      return NextResponse.json(
        { games: cache.data, cached: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Squiggle standard API: ?q=games;year=2026;round=1
    const gamesUrl = `${SQUIGGLE_BASE}?q=games;year=${encodeURIComponent(
      String(year)
    )};round=${encodeURIComponent(String(round))};format=json`;

    const teamsUrl = `${SQUIGGLE_BASE}?q=teams;year=${encodeURIComponent(
      String(year)
    )};format=json`;

    const [gamesJson, teamsJson] = await Promise.all([
      fetchJson<SquiggleGamesResponse>(gamesUrl),
      fetchJson<SquiggleTeamsResponse>(teamsUrl),
    ]);

    const teamMap = mapTeams(Array.isArray(teamsJson.teams) ? teamsJson.teams : []);
    const rawGames = Array.isArray(gamesJson.games) ? gamesJson.games : [];

    const normalized: NormalizedGame[] = rawGames
      .filter((g) => typeof g?.id === "number" && typeof g?.date === "string")
      .map((g) => {
        const startUtc = new Date(g.date).toISOString();

        return {
          squiggleId: g.id,
          year: g.year,
          round: g.round,
          startTimeUtc: startUtc,
          homeTeam: teamMap[g.hteam] ?? String(g.hteam),
          awayTeam: teamMap[g.ateam] ?? String(g.ateam),
          venue: g.venue ?? null,
          status: toStatus(g),
          homeScore: typeof g.hscore === "number" ? g.hscore : null,
          awayScore: typeof g.ascore === "number" ? g.ascore : null,
          percentComplete: typeof g.complete === "number" ? g.complete : null,
        };
      });

    cache = { key, at: now, data: normalized };

    return NextResponse.json(
      { games: normalized, cached: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[squiggle/games] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
