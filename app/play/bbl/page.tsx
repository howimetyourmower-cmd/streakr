// /app/play/bbl/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
id: string;
quarter?: number;
question: string;
status: QuestionStatus;
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
quarter: number | null;
question: string;
};

const DEFAULT_BBL_DOC_ID = "REPLACE_WITH_CURRENT_BBL_DOC_ID";

export default function BblHubPage() {
const { user } = useAuth();
const router = useRouter();
const params = useSearchParams();

const [questions, setQuestions] = useState<QuestionRow[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [showAuthModal, setShowAuthModal] = useState(false);

const [showPreloader, setShowPreloader] = useState(true);
const [fadePreloader, setFadePreloader] = useState(false);

const docId = useMemo(() => {
const q = params.get("docId");
return (q && q.trim()) || DEFAULT_BBL_DOC_ID;
}, [params]);

const picksHref = useMemo(() => {
const safe = (docId || "").trim();
if (!safe || safe === "REPLACE_WITH_CURRENT_BBL_DOC_ID") return "";
return /picks?sport=BBL&docId=${encodeURIComponent(safe)};
}, [docId]);

useEffect(() => {
document.body.style.overflow = "hidden";
const t1 = window.setTimeout(() => setFadePreloader(true), 3500);
const t2 = window.setTimeout(() => {
setShowPreloader(false);
document.body.style.overflow = "";
}, 4200);
return () => {
window.clearTimeout(t1);
window.clearTimeout(t2);
document.body.style.overflow = "";
};
}, []);

useEffect(() => {
const safe = (docId || "").trim();

if (!safe || safe === "REPLACE_WITH_CURRENT_BBL_DOC_ID") {
  setError("BBL is not configured yet. Add the current docId into DEFAULT_BBL_DOC_ID.");
  setLoading(false);
  return;
}

const load = async () => {
  try {
    setError("");
    setLoading(true);

    const res = await fetch(
      `/api/picks?sport=BBL&docId=${encodeURIComponent(safe)}`,
      { cache: "no-store" }
    );

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
          quarter: typeof q.quarter === "number" ? q.quarter : null,
          question: q.question,
        }))
    );

    flat.sort((a, b) => {
      const da = new Date(a.startTime).getTime();
      const db = new Date(b.startTime).getTime();
      if (da !== db) return da - db;
      const qa = a.quarter ?? 999;
      const qb = b.quarter ?? 999;
      return qa - qb;
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


}, [docId]);

const handlePreviewPick = () => {
if (!picksHref) return;
if (!user) {
setShowAuthModal(true);
return;
}
router.push(picksHref);
};

return (
<main className="min-h-screen bg-black text-white relative">
{showPreloader && (
<div
className={[
"fixed inset-0 z-50 bg-black transition-opacity duration-700",
fadePreloader ? "opacity-0 pointer-events-none" : "opacity-100",
].join(" ")}
>
<div className="relative w-full h-full overflow-hidden bg-black">
<video src="/preloadervideo.mp4" autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain bg-black" />
<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
<div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center px-4">
<p className="text-xs sm:text-sm text-white/70 tracking-[0.25em] uppercase mb-1">
Welcome to
</p>
<p className="text-3xl sm:text-4xl font-extrabold text-[#FF7A00] drop-shadow-[0_0_24px_rgba(255,122,0,0.9)]">
STREAKr
</p>
<p className="mt-1 text-[11px] sm:text-xs text-white/60">
How Long Can You Last?
</p>
</div>
</div>
</div>
)}

  <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-8 sm:pt-10">
    <div className="mb-6">
      <Link href="/" className="text-sm text-white/70 hover:text-white">
        ← Back to sports
      </Link>
    </div>

    <section className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 items-center mb-14">
      <div>
        <div className="mb-4">
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full flex-nowrap">
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                BBL
              </span>

              <span className="min-w-0 flex-1 inline-flex items-center justify-center rounded-full bg-orange-500/10 border border-orange-400/60 px-3 py-1 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase text-orange-200 whitespace-nowrap">
                FREE TO PLAY. AUSSIE AS.
              </span>
            </div>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-3">
          <span className="block text-sm sm:text-base font-semibold text-white/60 mb-2">
            Cricket. Sweat. Bragging rights.
          </span>
          <span className="text-[#FF7A00] drop-shadow-[0_0_20px_rgba(255,122,0,0.8)]">
            How Long Can You Last?
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/80 max-w-xl mb-6">
          Quick Yes/No picks tied to live BBL moments. Clean sweep per match:
          miss one and your streak is cooked — back to zero.
        </p>

        <div className="inline-flex flex-wrap items-center gap-3 mb-6">
          <div className="rounded-full px-4 py-1.5 bg-[#020617] border border-orange-400/70 shadow-[0_0_24px_rgba(255,122,0,0.5)]">
            <span className="text-sm font-semibold text-orange-200">
              Prizes + venue comps coming in hot*
            </span>
          </div>
          <span className="hidden sm:inline text-[11px] text-white/60">
            Free to play • 18+ • No gambling • Just bragging rights
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <button
            type="button"
            disabled={!picksHref}
            onClick={handlePreviewPick}
            className={[
              "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm sm:text-base font-semibold shadow-[0_14px_40px_rgba(0,0,0,0.65)]",
              picksHref
                ? "bg-[#FF7A00] hover:bg-orange-500 text-black"
                : "bg-white/10 text-white/50 cursor-not-allowed",
            ].join(" ")}
          >
            Play now – make your next pick
          </button>

          <Link
            href="/leaderboards"
            className="inline-flex items-center justify-center rounded-full border border-white/25 hover:border-sky-400/80 hover:text-sky-300 px-6 py-3 text-sm sm:text-base text-white/85"
          >
            Check who&apos;s talking big
          </Link>
        </div>

        <p className="text-[11px] text-white/50">
          *Prizes subject to T&amp;Cs. STREAKr is a free game of skill. No
          gambling. 18+ only.
        </p>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="relative">
        <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[360px] rounded-3xl overflow-hidden border border-orange-500/40 shadow-[0_28px_80px_rgba(0,0,0,0.85)] bg-[#020617]">
          <Image
            src="/mcg-hero.jpg"
            alt="Night sport vibes"
            fill
            className="object-cover opacity-85"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1 text-[11px] font-semibold">
              Live BBL Yes/No picks
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-white/60 mb-1">
                Group chats. Pub banter. Venue leagues.
              </p>
              <p className="text-sm font-semibold text-white">
                One streak. Battle your mates. Endless sledging.
              </p>
            </div>
            <div className="rounded-full bg-[#FF7A00] text-black text-xs font-bold px-3 py-1 shadow-[0_0_24px_rgba(255,122,0,0.9)]">
              Make your next pick.
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="mb-10">
      <h2 className="text-xl sm:text-2xl font-bold mb-2">How STREAKr works</h2>
      <p className="text-sm text-white/70 mb-4 max-w-2xl">
        Same STREAKr rules. Different sport. Same heartbreak.
      </p>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
          <p className="text-xs font-semibold text-orange-300 mb-1">
            1 · Pick questions in the match
          </p>
          <p className="text-sm text-white/80">
            Pick as many as you want. Yes or No. Back your gut.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
          <p className="text-xs font-semibold text-orange-300 mb-1">
            2 · Clean sweep per match
          </p>
          <p className="text-sm text-white/80">
            If any pick is wrong when the match finalises, your streak resets
            to zero. If you sweep it, you add +N.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#020617] px-4 py-4">
          <p className="text-xs font-semibold text-orange-300 mb-1">
            3 · Flex on your mates
          </p>
          <p className="text-sm text-white/80">
            Leaderboards, badges and venue comps. Screenshot the heater.
          </p>
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
            A taste of what&apos;s open right now. Jump into Picks to lock yours
            in.
          </p>
        </div>

        {picksHref ? (
          <Link
            href={picksHref}
            className="text-sm text-orange-300 hover:text-orange-200 underline-offset-2 hover:underline"
          >
            Make your next pick →
          </Link>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-white/70">Loading questions…</p> : null}

      {!loading && !error && questions.length === 0 ? (
        <p className="text-sm text-white/60">
          No open questions right now. Check back closer to the first ball.
        </p>
      ) : null}

      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.id}
            className="rounded-2xl bg-gradient-to-r from-[#0B1220] via-[#020617] to-[#020617] border border-orange-500/25 shadow-[0_18px_60px_rgba(0,0,0,0.9)] px-4 py-3 sm:px-5 sm:py-4"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60 mb-1.5">
                  <span className="font-semibold text-orange-200">
                    {q.quarter ? `Q${q.quarter}` : "LIVE"}
                  </span>
                  <span>•</span>
                  <span>{q.match}</span>
                  <span>•</span>
                  <span>{q.venue}</span>
                </div>
                <div className="text-sm sm:text-base font-semibold">{q.question}</div>
              </div>

              <div className="flex items-center gap-3 md:ml-4 shrink-0">
                <button
                  type="button"
                  onClick={handlePreviewPick}
                  disabled={!picksHref}
                  className={[
                    "px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-white transition",
                    picksHref
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-white/10 text-white/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={handlePreviewPick}
                  disabled={!picksHref}
                  className={[
                    "px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-white transition",
                    picksHref
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-white/10 text-white/50 cursor-not-allowed",
                  ].join(" ")}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>

    <footer className="border-t border-white/10 pt-6 mt-4 text-sm text-white/70">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-white/50">
        <p>
          STREAKr is a free game of skill. No gambling. 18+ only. Prizes
          subject to terms and conditions.
        </p>
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
          You need a free STREAKr account to make picks, build your streak
          and appear on the leaderboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/auth?mode=login&returnTo=${encodeURIComponent(picksHref || "/picks?sport=BBL")}`}
            className="flex-1 inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-4 py-2 transition-colors"
            onClick={() => setShowAuthModal(false)}
          >
            Login
          </Link>

          <Link
            href={`/auth?mode=signup&returnTo=${encodeURIComponent(picksHref || "/picks?sport=BBL")}`}
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
