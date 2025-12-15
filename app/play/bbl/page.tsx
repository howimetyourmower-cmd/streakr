"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
id: string;
quarter: number;
question: string;
status: QuestionStatus;
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
games: ApiGame[];
};

type QuestionRow = {
id: string;
match: string;
venue: string;
startTime: string;
quarter: number;
question: string;
};

export default function BblHubPage() {
const { user } = useAuth();
const router = useRouter();
const sp = useSearchParams();

// ✅ Default docId comes from env OR an optional query param (for admin/testing)
const envDocId =
(process.env.NEXT_PUBLIC_BBL_DEFAULT_DOC_ID || "").trim() || "";
const qpDocId = (sp.get("docId") || "").trim();

const docId = useMemo(() => qpDocId || envDocId, [qpDocId, envDocId]);

const [questions, setQuestions] = useState<QuestionRow[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [showAuthModal, setShowAuthModal] = useState(false);

const picksHref = docId ? /picks?sport=BBL&docId=${encodeURIComponent(docId)} : "";
const apiUrl = docId
? /api/picks?sport=BBL&docId=${encodeURIComponent(docId)}
: "";

useEffect(() => {
const load = async () => {
if (!apiUrl) return;

  setLoading(true);
  setError("");

  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("API error");

    const data: PicksApiResponse = await res.json();

    const flat: QuestionRow[] = (data.games || []).flatMap((g) =>
      (g.questions || [])
        .filter((q) => q.status === "open")
        .map((q) => ({
          id: q.id,
          match: g.match,
          venue: g.venue,
          startTime: g.startTime,
          quarter: q.quarter,
          question: q.question,
        }))
    );

    flat.sort((a, b) => {
      const da = new Date(a.startTime).getTime();
      const db = new Date(b.startTime).getTime();
      if (da !== db) return da - db;
      return a.quarter - b.quarter;
    });

    setQuestions(flat.slice(0, 6));
  } catch (e) {
    console.error(e);
    setError("Failed to load BBL preview questions.");
  } finally {
    setLoading(false);
  }
};

load();


}, [apiUrl]);

const formatStartDate = (iso: string) => {
if (!iso) return { date: "", time: "" };
const d = new Date(iso);
if (Number.isNaN(d.getTime())) return { date: "", time: "" };

return {
  date: d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Melbourne",
  }),
  time: d.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Melbourne",
  }),
};


};

const handlePreviewPick = () => {
if (!picksHref) return;

if (!user) {
  setShowAuthModal(true);
  return;
}

router.push(picksHref);


};

return (
<main className="min-h-screen bg-black text-white">
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
<div className="mb-6 flex items-center justify-between gap-4">
<Link href="/" className="text-sm text-white/70 hover:text-white">
← Back to sports
</Link>

      <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
        BBL
      </span>
    </div>

    <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-14">
      <div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
          <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
            Cricket. Chaos. Bragging rights.
          </span>
          <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
            BBL STREAKr
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
          Make live Yes/No picks during the match. Clean sweep rule applies:
          nail every pick you made for the match and you add them to your
          streak. Get one wrong and you&apos;re cooked.
        </p>

        {!docId ? (
          <div className="rounded-2xl border border-orange-500/25 bg-[#020617] p-4 mb-6">
            <p className="text-sm text-white/80 font-semibold">
              BBL is not configured yet.
            </p>
            <p className="mt-1 text-xs text-white/60">
              Admin: set <span className="text-orange-200">NEXT_PUBLIC_BBL_DEFAULT_DOC_ID</span>{" "}
              in Vercel Environment Variables (or open this page with{" "}
              <span className="text-orange-200">?docId=YOUR_DOC_ID</span> for testing).
            </p>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Link
            href={picksHref || "#"}
            aria-disabled={!picksHref}
            className={[
              "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm sm:text-base font-semibold shadow-[0_14px_40px_rgba(0,0,0,0.65)]",
              picksHref
                ? "bg-[#FF7A00] hover:bg-orange-500 text-black"
                : "bg-white/10 text-white/40 cursor-not-allowed",
            ].join(" ")}
          >
            Play now – make your next pick
          </Link>

          <Link
            href="/leaderboards"
            className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85"
          >
            Check who&apos;s talking big
          </Link>
        </div>

        <p className="text-[11px] text-white/50">
          STREAKr is a free game of skill. No gambling.
        </p>
      </div>

      <div className="relative">
        <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,122,0,0.35),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
              Live BBL match picks
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-white/60 mb-1">
                Quick picks. Big swings. No mercy.
              </p>
              <p className="text-sm font-semibold text-white">
                One match can make you. One wrong pick breaks you.
              </p>
            </div>
            <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)]">
              Clean sweep rules
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            Tonight&apos;s live picks preview
          </h2>
          <p className="text-sm text-white/70">
            A taste of what&apos;s open right now. Jump into Picks to lock yours in.
          </p>
        </div>

        <Link
          href={picksHref || "#"}
          aria-disabled={!picksHref}
          className={[
            "text-sm underline-offset-2",
            picksHref
              ? "text-orange-300 hover:text-orange-200 hover:underline"
              : "text-white/30 cursor-not-allowed",
          ].join(" ")}
        >
          Make your next pick →
        </Link>
      </div>

      {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-white/70">Loading questions…</p>
      ) : null}

      {!loading && docId && questions.length === 0 && !error ? (
        <p className="text-sm text-white/60">
          No open questions right now. Check back closer to the first ball.
        </p>
      ) : null}

      <div className="space-y-3">
        {questions.map((q) => {
          const { date, time } = formatStartDate(q.startTime);
          return (
            <div
              key={q.id}
              className="rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-4 py-3 sm:px-5 sm:py-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                    <span className="font-semibold text-orange-200">
                      Q{q.quarter}
                    </span>
                    <span>•</span>
                    <span>
                      {date} • {time} AEDT
                    </span>
                    <span>•</span>
                    <span>{q.match}</span>
                    <span>•</span>
                    <span>{q.venue}</span>
                  </div>
                  <div className="text-sm sm:text-base font-semibold">
                    {q.question}
                  </div>
                </div>

                <div className="flex items-center gap-3 md:ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={handlePreviewPick}
                    disabled={!picksHref}
                    className={[
                      "px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition",
                      picksHref
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-white/10 text-white/30 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewPick}
                    disabled={!picksHref}
                    className={[
                      "px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition",
                      picksHref
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-white/10 text-white/30 cursor-not-allowed",
                    ].join(" ")}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
        <p>BBL hub page. Picks are controlled via URL parameters.</p>
        <Link
          href="/faq"
          className="text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
        >
          FAQ
        </Link>
      </div>
    </footer>
  </div>

  {showAuthModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-[#050816] border border-white/10 p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">Log in to play</h2>
          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            className="text-sm text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-white/70 mb-4">
          You need a free STREAKr account to make picks, build your streak and appear on the leaderboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={picksHref ? `/auth?mode=login&returnTo=${encodeURIComponent(picksHref)}` : "/auth?mode=login"}
            className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
            onClick={() => setShowAuthModal(false)}
          >
            Login
          </Link>

          <Link
            href={picksHref ? `/auth?mode=signup&returnTo=${encodeURIComponent(picksHref)}` : "/auth?mode=signup"}
            className="flex-1 inline-flex items-center justify-center rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-400 text-sm px-4 py-2 transition-colors"
            onClick={() => setShowAuthModal(false)}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )}
</main>


);
}
