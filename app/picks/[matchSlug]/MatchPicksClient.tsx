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
  // keep aggressive all-caps look like you want
  return s.toUpperCase();
}

function matchNameFromSlug(slug: string) {
  // "sydney-vs-carlton" -> "Sydney vs Carlton"
  const s = decodeSlug(slug).replace(/-/g, " ").trim();
  return s
    .split(" ")
    .map((w) => (w.toLowerCase() === "vs" ? "vs" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { ok: res.ok, status: res.status, text, json };
}

export default function MatchPicksClient({ matchSlug }: { matchSlug: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<any>(null);
  const [data, setData] = useState<PicksApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = useMemo(() => titleFromSlug(matchSlug), [matchSlug]);
  const matchName = useMemo(() => matchNameFromSlug(matchSlug), [matchSlug]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      setData(null);
      setDebug(null);

      // Try common variants (because your API has changed a few times in this build)
      const candidates = [
        `/api/picks?matchSlug=${encodeURIComponent(matchSlug)}`,
        `/api/picks?slug=${encodeURIComponent(matchSlug)}`,
        `/api/picks?match=${encodeURIComponent(matchName)}`,
      ];

      const attempts: any[] = [];

      for (const url of candidates) {
        try {
          const out = await fetchJson(url);
          attempts.push({ url, ...out });

          if (out.ok && out.json && typeof out.json === "object") {
            // If it looks like a PicksApiResponse
            const games = Array.isArray(out.json.games) ? out.json.games : [];
            if (games.length > 0) {
              if (!mounted) return;
              setData(out.json);
              setDebug({ matchedUrl: url, attempts });
              setLoading(false);
              return;
            }
          }
        } catch (e: any) {
          attempts.push({ url, ok: false, status: 0, text: String(e?.message ?? e), json: null });
        }
      }

      if (!mounted) return;
      setDebug({ matchedUrl: null, attempts });
      setError("No games/questions returned from API for this slug.");
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [matchSlug, matchName, user?.uid]);

  const games: ApiGame[] = useMemo(() => {
    const g = data?.games;
    return Array.isArray(g) ? g : [];
  }, [data]);

  const game: ApiGame | null = games.length ? games[0] : null;

  const questions = useMemo(() => {
    const qs = game?.questions ?? [];
    // normalise status + quarter
    return qs
      .map((q) => ({
        ...q,
        status: (safeLower(q.status) as QuestionStatus) || "open",
        quarter: Number(q.quarter || 0),
      }))
      .sort((a, b) => (a.quarter - b.quarter) || a.id.localeCompare(b.id));
  }, [game]);

  const picksSelected = 0; // you can wire this back to local picks later (kept simple for now)

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* top padding keeps it off your nav */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-24">
        <div className="mb-6">
          <h1 className="text-4xl font-black tracking-wide italic uppercase">
            {headerTitle}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/70">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Picks selected: <span className="text-white/90 font-semibold">{picksSelected} / 12</span>
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
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
              <div className="text-lg font-semibold">No picks loaded</div>
              <div className="mt-1 text-sm text-white/75">
                This usually means the API isn’t matching the slug, or it returned an empty games array.
              </div>
            </div>

            {/* Debug block so you can SEE what your API is returning on Vercel */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold text-white/90">Debug</div>
              <div className="mt-2 text-xs text-white/70">
                Slug: <span className="text-white/90">{matchSlug}</span><br />
                Match name guess: <span className="text-white/90">{matchName}</span>
              </div>

              <pre className="mt-4 max-h-[340px] overflow-auto rounded-xl bg-black/40 p-4 text-[11px] text-white/80">
{JSON.stringify(debug, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Simple picks grid (you already have the good styling elsewhere — this is just to get data back on screen) */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {questions.map((q, idx) => {
                const qNo = String(idx + 1).padStart(2, "0");
                const quarterLabel = q.quarter ? `QUARTER ${q.quarter}` : "GAME";
                const status = safeLower(q.status); // keep lowercase

                return (
                  <div
                    key={q.id}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161b22] p-4"
                  >
                    {/* silhouette background */}
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

                        {/* clear button placeholder (wire later) */}
                        <button
                          type="button"
                          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/70"
                          title="Clear pick"
                          onClick={() => {}}
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-4 text-base font-semibold text-white/90">
                        {q.question}
                      </div>

                      {/* bottom panel (light) */}
                      <div className="mt-4 rounded-2xl bg-[#f2efe9] p-3 text-[#0d1117]">
                        <div className="grid grid-cols-2 gap-3">
                          <button className="h-12 rounded-2xl border border-black/15 bg-white/70 font-semibold">
                            YES
                          </button>
                          <button className="h-12 rounded-2xl border border-black/15 bg-white/70 font-semibold">
                            NO
                          </button>
                        </div>

                        {/* thin % bar placeholder */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-black/50">
                            <span>Yes 0%</span>
                            <span>No 0%</span>
                          </div>
                          <div className="mt-2 h-[3px] w-full rounded-full bg-black/10">
                            <div className="h-[3px] w-0 rounded-full bg-[#e85b7a]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* footer bar */}
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

        {/* Back link */}
        <div className="mt-8">
          <Link href="/picks" className="text-sm text-white/70 underline">
            ← Back to Picks
          </Link>
        </div>
      </div>
    </div>
  );
}
