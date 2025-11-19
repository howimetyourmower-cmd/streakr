// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type QuestionStatus = "open" | "final" | "pending" | "void";

type ApiQuestion = {
  id: string;
  quarter: number;
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
  roundNumber?: number;
};

type PreviewRow = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  quarter: number;
  question: string;
};

function formatStart(iso: string) {
  if (!iso) return { date: "", time: "" };

  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return { date: "", time: "" };
  }

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
}

export default function HomePage() {
  const [roundNumber, setRoundNumber] = useState<number | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) throw new Error("Failed to load picks");

        const data: PicksApiResponse = await res.json();

        if (typeof data.roundNumber === "number") {
          setRoundNumber(data.roundNumber);
        }

        const flat: PreviewRow[] = data.games
          .flatMap((g) =>
            g.questions
              .filter((q) => q.status === "open")
              .map((q) => ({
                id: q.id,
                match: g.match,
                venue: g.venue,
                startTime: g.startTime,
                quarter: q.quarter,
                question: q.question,
              }))
          )
          .sort((a, b) => {
            const da = new Date(a.startTime).getTime();
            const db = new Date(b.startTime).getTime();
            if (da !== db) return da - db;
            return a.quarter - b.quarter;
          });

        setPreviewRows(flat.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, []);

  return (
    <main className="min-h-screen w-full bg-black text-slate-50">
      {/* SPONSOR STRIP UNDER NAV */}
      <div className="w-full border-b border-white/5 bg-[#0B0F1A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-xs text-slate-200">
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full border border-orange-500/60 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
              Sponsor
            </span>
            <span>Proudly backed by our official partner</span>
          </div>
          <span className="hidden sm:inline text-[11px] text-slate-400">
            Free game of skill • No gambling • 18+ only
          </span>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="border-b border-white/5">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-center md:py-14">
          {/* LEFT: TEXT */}
          <div className="flex-1 space-y-6">
            {roundNumber !== null && (
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-200">
                AFL Season 2026 • Current Round:{" "}
                <span className="text-orange-400">Round {roundNumber}</span>
              </div>
            )}

            <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Real{" "}
              <span className="text-orange-500 drop-shadow-[0_0_14px_rgba(249,115,22,0.7)]">
                STREAKr
              </span>
              s don&apos;t get caught.
            </h1>

            <p className="max-w-xl text-base text-slate-300 sm:text-lg">
              Pick one AFL moment at a time. Each correct pick adds to your
              streak — one wrong call and it&apos;s back to zero. Build the
              longest streak each round to climb the leaderboard.
            </p>

            {/* Prize pill */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-orange-100 border border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.55)]">
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-black">
                  $1,000
                </span>
                in prizes every round*
              </div>
              <span className="text-xs text-slate-500">
                *Prize structure subject to T&Cs.
              </span>
            </div>

            {/* CTA BUTTONS */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-black shadow-[0_14px_45px_rgba(249,115,22,0.7)] transition hover:translate-y-[1px] hover:bg-orange-400"
              >
                Play now – make your streak pick
              </Link>

              <Link
                href="/faq"
                className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-black/80 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900"
              >
                How it works
              </Link>
            </div>

            <p className="text-xs text-slate-500">
              No deposits. No odds. Just your footy IQ and a live streak.
            </p>
          </div>

          {/* RIGHT: HERO IMAGE CARD */}
          <div className="relative flex-1">
            <div className="relative mx-auto h-64 w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/70 shadow-[0_28px_70px_rgba(0,0,0,0.95)]">
              <Image
                src="/mcg-hero.jpg"
                alt="MCG at night"
                fill
                className="object-cover"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-100">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Featured venue
                  </div>
                  <div className="text-sm font-semibold">MCG, Melbourne</div>
                </div>
                <div className="rounded-full bg-black/80 px-3 py-1 text-[11px] font-semibold text-sky-300 border border-sky-500/50">
                  Live streaks in every game
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-white/5 bg-black">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                How STREAKr works
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Simple rules. Pure footy IQ. One active streak at a time.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#1E2A55] bg-[#0F1B3D] p-4 shadow-[0_12px_30px_rgba(24,91,255,0.35)]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                1 · Make your streak pick
              </div>
              <p className="text-sm text-blue-50">
                You can only ride one streak at a time. Choose a single question
                across all games and lock in a Yes/No pick before the quarter
                starts.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1E2A55] bg-[#0F1B3D] p-4 shadow-[0_12px_30px_rgba(24,91,255,0.35)]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                2 · Build the longest run
              </div>
              <p className="text-sm text-blue-50">
                Every correct pick adds +1 to your streak. Wrong pick? Back to
                zero. Your active streak feeds straight into the leaderboard.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1E2A55] bg-[#0F1B3D] p-4 shadow-[0_12px_30px_rgba(24,91,255,0.35)]">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                3 · Climb the ladder
              </div>
              <p className="text-sm text-blue-50">
                Chase the top 10 each round, compare streaks with your mates in
                private leagues, and compete for a share of $1,000 in prizes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TONIGHT'S QUESTIONS PREVIEW */}
      <section className="border-b border-white/5 bg-black">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Tonight&apos;s questions
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                A preview of some open questions. Jump into Picks to lock in
                your streak.
              </p>
            </div>
            <Link
              href="/picks"
              className="hidden text-sm font-semibold text-orange-400 hover:text-orange-300 md:inline-flex"
            >
              View all picks →
            </Link>
          </div>

          {loadingPreview ? (
            <p className="text-sm text-slate-400">Loading questions…</p>
          ) : previewRows.length === 0 ? (
            <p className="text-sm text-slate-400">
              No open questions right now. Check back closer to bounce.
            </p>
          ) : (
            <div className="space-y-3">
              {previewRows.map((row) => {
                const { date, time } = formatStart(row.startTime);

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-[#1E2A55] bg-[#0F1B3D] px-4 py-3 shadow-[0_12px_35px_rgba(24,91,255,0.4)]"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200">
                          <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 border border-sky-500/60">
                            Q{row.quarter}
                          </span>
                          <span>
                            {date} • {time} AEDT
                          </span>
                          <span>•</span>
                          <span>{row.match}</span>
                          <span>•</span>
                          <span>{row.venue}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-blue-50">
                          {row.question}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2 md:mt-0">
                        <span className="text-[11px] text-blue-200/80">
                          Sample view – make your pick on the{" "}
                          <Link
                            href="/picks"
                            className="text-orange-300 hover:text-orange-200"
                          >
                            Picks
                          </Link>{" "}
                          page.
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 md:hidden">
            <Link
              href="/picks"
              className="inline-flex w-full items-center justify-center rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(249,115,22,0.7)] transition hover:bg-orange-400"
            >
              Go to Picks
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} STREAKr. All rights reserved.</div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[11px]">
              STREAKr is a free game of skill. No gambling. 18+ only.
            </span>
            <Link
              href="/faq"
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              FAQ
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
