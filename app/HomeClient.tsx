// /app/HomeClient.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";

type Tile = {
  title: string;
  subtitle: string;
  href?: string;
  badge?: string;
  status?: "live" | "soon";
  icon: React.ReactNode;
};

function IconAfl() {
  return (
    <svg viewBox="0 0 120 80" className="h-12 w-12 text-[#FF7A00]" fill="none">
      <ellipse
        cx="60"
        cy="40"
        rx="46"
        ry="30"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        d="M40 27c8 6 32 6 40 0M40 53c8-6 32-6 40 0"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M60 18v44"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function IconCricket() {
  return (
    <svg viewBox="0 0 120 80" className="h-12 w-12 text-[#FF7A00]" fill="none">
      <path
        d="M78 12l18 18-44 44H34V56L78 12z"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M32 74h18"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle
        cx="26"
        cy="58"
        r="8"
        stroke="currentColor"
        strokeWidth="6"
        opacity="0.9"
      />
    </svg>
  );
}

function IconMulti() {
  return (
    <svg viewBox="0 0 120 80" className="h-12 w-12 text-[#FF7A00]" fill="none">
      <circle cx="40" cy="28" r="14" stroke="currentColor" strokeWidth="6" />
      <circle cx="78" cy="28" r="14" stroke="currentColor" strokeWidth="6" />
      <circle cx="60" cy="56" r="14" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

function ComingSoonChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
      {label}
    </span>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const inner = (
    <div className="group relative w-full rounded-3xl border border-white/10 bg-[#020617] px-6 py-6 shadow-[0_18px_60px_rgba(0,0,0,0.9)] transition hover:border-orange-400/40 hover:shadow-[0_22px_90px_rgba(0,0,0,0.92)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="shrink-0">{tile.icon}</div>
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-white/55 uppercase">
              Play now
            </div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {tile.title}
            </div>
            <div className="mt-1 text-sm text-white/70 max-w-[34ch]">
              {tile.subtitle}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {tile.status === "live" ? (
            <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-[11px] font-semibold text-green-200">
              Live
            </span>
          ) : tile.status === "soon" ? (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
              Coming soon
            </span>
          ) : null}

          <span className="inline-flex items-center rounded-full bg-[#FF7A00] px-4 py-1.5 text-xs font-bold text-black shadow-[0_0_24px_rgba(255,122,0,0.55)] transition group-hover:shadow-[0_0_28px_rgba(255,122,0,0.75)]">
            Enter →
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-500/0 via-orange-500/0 to-orange-500/0 group-hover:from-orange-500/0 group-hover:via-orange-500/5 group-hover:to-orange-500/0" />
    </div>
  );

  // ✅ Whole tile clickable
  if (tile.href) {
    return (
      <Link href={tile.href} className="block focus:outline-none">
        {inner}
      </Link>
    );
  }

  // Disabled (coming soon)
  return <div className="opacity-70">{inner}</div>;
}

export default function HomeClient() {
  const topTiles: Tile[] = useMemo(
    () => [
      {
        title: "AFL STREAKr",
        subtitle: "Quarter-by-quarter player & team stat picks.",
        href: "/play/afl",
        status: "live",
        icon: <IconAfl />,
      },
      {
        title: "CRICKET STREAKr",
        subtitle: "BBL Yes/No picks. Clean sweep per match.",
        href: "/play/bbl",
        status: "live",
        icon: <IconCricket />,
      },
      {
        title: "MULTI-SPORT",
        subtitle: "Cross-sport streaks & ladders. Built for chaos.",
        href: undefined, // set later when you build it, e.g. "/play/multi"
        status: "soon",
        icon: <IconMulti />,
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Optional: keep your header/nav that already exists in layout */}
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-16 pt-10">
        {/* HERO */}
        <section className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
            STREAKr — Multi-Sport
          </div>

          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold leading-tight">
            <span className="block text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]">
              How long can you last?
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-base sm:text-lg text-white/75">
            Free-to-play, real-time <span className="text-[#FF7A00] font-bold">Yes</span>{" "}
            / <span className="text-[#FF7A00] font-bold">No</span> picks. Clean sweep per match —
            get one wrong, back to zero.
          </p>
        </section>

        {/* TOP ROW (AFL / CRICKET / MULTI) */}
        <section className="grid gap-5 md:grid-cols-3 mb-10">
          {topTiles.map((t) => (
            <TileCard key={t.title} tile={t} />
          ))}
        </section>

        {/* OTHER SPORTS COMING SOON */}
        <section className="rounded-3xl border border-white/10 bg-[#020617] px-6 py-5">
          <div className="text-sm font-semibold text-white/80 mb-3">
            Other sports coming soon
          </div>

          <div className="flex flex-wrap gap-2">
            <ComingSoonChip label="Tennis" />
            <ComingSoonChip label="NBA" />
            <ComingSoonChip label="NRL" />
            <ComingSoonChip label="Olympics" />
            <ComingSoonChip label="Multi-sport" />
          </div>

          <div className="mt-4 text-[11px] text-white/55">
            Built for group chats, pub banter and office comps. Free to play • 18+ • No gambling •
            Just bragging rights.
          </div>
        </section>
      </div>
    </main>
  );
}
