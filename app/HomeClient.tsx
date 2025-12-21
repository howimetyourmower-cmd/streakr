// /app/HomeClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TileStatus = "live" | "soon";

type Tile = {
  key: "AFL" | "BBL" | "MULTI";
  title: string;
  subtitle: string;
  href?: string;
  status: TileStatus;
  icon: React.ReactNode;
  accent: "orange" | "sky" | "violet";
  comingText?: string;
};

type PicksApiResponse = {
  games: Array<{
    id: string;
    match: string;
    venue: string;
    startTime: string;
    questions: Array<{
      id: string;
      status: "open" | "final" | "pending" | "void";
    }>;
  }>;
  roundNumber?: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* =========================
   ICONS (BIG + PREMIUM)
========================= */

function IconWrap({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: Tile["accent"];
}) {
  const accentClasses =
    accent === "orange"
      ? "bg-orange-500/10 border-orange-400/40 shadow-[0_0_44px_rgba(255,122,0,0.30)]"
      : accent === "sky"
      ? "bg-sky-500/10 border-sky-300/35 shadow-[0_0_44px_rgba(56,189,248,0.22)]"
      : "bg-violet-500/10 border-violet-300/35 shadow-[0_0_44px_rgba(167,139,250,0.22)]";

  return (
    <div
      className={cn(
        "relative flex h-20 w-20 items-center justify-center rounded-2xl border",
        "transition-transform duration-300 ease-out",
        "group-hover:scale-[1.06] group-hover:-rotate-1",
        accentClasses
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-40" />
      {children}
    </div>
  );
}

function IconAfl() {
  return (
    <svg viewBox="0 0 120 80" className="h-14 w-14 text-[#FF7A00]" fill="none">
      <ellipse cx="60" cy="40" rx="46" ry="30" stroke="currentColor" strokeWidth="6" />
      <path d="M40 27c8 6 32 6 40 0M40 53c8-6 32-6 40 0" stroke="currentColor" strokeWidth="4" />
      <path d="M60 18v44" stroke="currentColor" strokeWidth="4" opacity="0.6" />
    </svg>
  );
}

function IconCricket() {
  return (
    <svg viewBox="0 0 120 80" className="h-14 w-14 text-[#FF7A00]" fill="none">
      <path d="M78 12l18 18-44 44H34V56L78 12z" stroke="currentColor" strokeWidth="6" />
      <path d="M32 74h18" stroke="currentColor" strokeWidth="6" />
      <circle cx="26" cy="58" r="8" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

function IconMulti() {
  return (
    <svg viewBox="0 0 120 80" className="h-14 w-14 text-[#FF7A00]" fill="none">
      <circle cx="40" cy="28" r="14" stroke="currentColor" strokeWidth="6" />
      <circle cx="78" cy="28" r="14" stroke="currentColor" strokeWidth="6" />
      <circle cx="60" cy="56" r="14" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

/* =========================
   LIVE COUNTS
========================= */

function countLiveGames(data: PicksApiResponse | null): number {
  if (!data?.games?.length) return 0;
  return data.games.filter((g) => g.questions?.some((q) => q.status === "open")).length;
}

/* =========================
   BADGES / PILLS
========================= */

function LivePill({ count }: { count?: number }) {
  const label =
    typeof count === "number"
      ? count === 0
        ? "No live matches"
        : count === 1
        ? "1 live match"
        : `${count} live matches`
      : "Live";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-green-500/35 bg-green-500/10 px-3 py-1 text-[11px] font-semibold text-green-200">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
      </span>
      {label}
    </span>
  );
}

function SoonPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/65">
      {text}
    </span>
  );
}

/* =========================
   TILE CARD
========================= */

function TileCard({
  tile,
  liveCount,
}: {
  tile: Tile;
  liveCount?: number;
}) {
  const accentRing =
    tile.accent === "orange"
      ? "hover:border-orange-400/55 hover:shadow-[0_34px_110px_rgba(255,122,0,0.08)]"
      : tile.accent === "sky"
      ? "hover:border-sky-300/40 hover:shadow-[0_34px_110px_rgba(56,189,248,0.06)]"
      : "hover:border-violet-300/40 hover:shadow-[0_34px_110px_rgba(167,139,250,0.06)]";

  const topGradient =
    tile.key === "AFL"
      ? "from-orange-500/18 via-transparent to-transparent"
      : tile.key === "BBL"
      ? "from-sky-500/14 via-transparent to-transparent"
      : "from-violet-500/14 via-transparent to-transparent";

  const isClickable = Boolean(tile.href) && tile.status === "live";

  const card = (
    <div
      className={cn(
        "group relative flex min-h-[270px] flex-col justify-between overflow-hidden",
        "rounded-3xl border border-white/10 bg-[#020617]",
        "px-6 py-6",
        "shadow-[0_22px_80px_rgba(0,0,0,0.92)]",
        "transition-all duration-300 ease-out",
        accentRing,
        isClickable && "cursor-pointer hover:-translate-y-1"
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-100">
        <div className={cn("absolute inset-0 bg-gradient-to-br", topGradient)} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
        <div className="absolute -left-1/2 top-0 h-full w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/7 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 animate-shimmer" />
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[radial-gradient(circle_at_20%_30%,white,transparent_40%),radial-gradient(circle_at_80%_70%,white,transparent_35%)]" />
      </div>

      <div className="relative flex items-start gap-5">
        <IconWrap accent={tile.accent}>{tile.icon}</IconWrap>

        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-white/50 mb-1">
            Play now
          </div>

          <h3 className="text-2xl font-extrabold text-white leading-tight">
            {tile.title}
          </h3>

          <p className="mt-2 text-sm text-white/70 max-w-[38ch]">
            {tile.subtitle}
          </p>
        </div>
      </div>

      <div className="relative pt-6">
        <div className="flex items-center justify-between gap-3">
          {tile.status === "live" ? (
            <LivePill count={liveCount} />
          ) : (
            <SoonPill text={tile.comingText || "Coming soon"} />
          )}

          {tile.status === "live" ? (
            <span className="rounded-full bg-[#FF7A00] px-5 py-2 text-xs font-extrabold text-black shadow-[0_0_30px_rgba(255,122,0,0.55)] transition group-hover:shadow-[0_0_42px_rgba(255,122,0,0.85)]">
              Enter →
            </span>
          ) : (
            <span className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-bold text-white/55">
              Locked
            </span>
          )}
        </div>

        {tile.status === "live" ? (
          <p className="mt-3 text-[11px] text-white/45">
            Free to play • 18+ • No gambling • Just bragging rights
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-white/40">
            Multi-sport ladders + cross-streak madness. Built for chaos.
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 rounded-3xl ring-1 ring-white/10" />
      </div>
    </div>
  );

  if (isClickable && tile.href) {
    return (
      <Link href={tile.href} className="block">
        {card}
      </Link>
    );
  }

  return <div className="block opacity-90">{card}</div>;
}

/* =========================
   MOBILE PICKER
========================= */

function MobilePickerModal({
  open,
  tiles,
  aflLiveCount,
  bblLiveCount,
  onClose,
}: {
  open: boolean;
  tiles: Tile[];
  aflLiveCount?: number;
  bblLiveCount?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="absolute inset-0 bg-black/75"
      />

      {/* Sheet */}
      <div className="absolute left-0 right-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-[#050816] shadow-[0_-30px_100px_rgba(0,0,0,0.85)]">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-[0.22em]">
                Choose a sport
              </p>
              <p className="text-lg font-extrabold">Play STREAKr</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/75"
            >
              Close
            </button>
          </div>

          <div className="mt-3 h-1 w-12 rounded-full bg-white/15 mx-auto" />
        </div>

        <div className="px-5 pb-6">
          <div className="grid gap-4">
            {tiles.map((t) => {
              const liveCount =
                t.key === "AFL" ? aflLiveCount : t.key === "BBL" ? bblLiveCount : undefined;

              const isClickable = Boolean(t.href) && t.status === "live";

              const row = (
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-white/10 bg-[#020617] px-4 py-4",
                    "shadow-[0_18px_60px_rgba(0,0,0,0.7)]",
                    isClickable && "active:scale-[0.99]"
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 via-white/6 to-white/0 opacity-60" />

                  <div className="relative flex items-center gap-4">
                    <IconWrap accent={t.accent}>{t.icon}</IconWrap>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/55 uppercase tracking-wide">
                        {t.status === "live" ? "Live now" : "Coming soon"}
                      </p>
                      <p className="text-lg font-extrabold text-white leading-tight">
                        {t.title}
                      </p>
                      <p className="mt-1 text-sm text-white/70 line-clamp-2">
                        {t.subtitle}
                      </p>

                      <div className="mt-3">
                        {t.status === "live" ? (
                          <LivePill count={liveCount} />
                        ) : (
                          <SoonPill text={t.comingText || "Coming soon"} />
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {t.status === "live" ? (
                        <span className="rounded-full bg-[#FF7A00] px-4 py-2 text-xs font-extrabold text-black shadow-[0_0_26px_rgba(255,122,0,0.6)]">
                          Play →
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/55">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              if (isClickable && t.href) {
                return (
                  <Link
                    key={t.key}
                    href={t.href}
                    className="block"
                    onClick={onClose}
                  >
                    {row}
                  </Link>
                );
              }

              return (
                <div key={t.key} className="opacity-90">
                  {row}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] text-white/45">
            Free to play • 18+ • No gambling • Just bragging rights
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */

export default function HomeClient() {
  const [aflLiveCount, setAflLiveCount] = useState<number | undefined>(undefined);
  const [bblLiveCount, setBblLiveCount] = useState<number | undefined>(undefined);

  // Mobile picker
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const [aflRes, bblRes] = await Promise.allSettled([
          fetch("/api/picks?sport=AFL", { cache: "no-store" }),
          fetch("/api/picks?sport=BBL", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (aflRes.status === "fulfilled" && aflRes.value.ok) {
          const aflData: PicksApiResponse = await aflRes.value.json();
          setAflLiveCount(countLiveGames(aflData));
        }

        if (bblRes.status === "fulfilled" && bblRes.value.ok) {
          const bblData: PicksApiResponse = await bblRes.value.json();
          setBblLiveCount(countLiveGames(bblData));
        }
      } catch {
        // silent
      }
    };

    loadCounts();
    const t = window.setInterval(loadCounts, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const tiles: Tile[] = useMemo(
    () => [
      {
        key: "AFL",
        title: "AFL STREAKr",
        subtitle: "Quarter-by-quarter player & team stat picks.",
        href: "/play/afl",
        status: "live",
        icon: <IconAfl />,
        accent: "orange",
      },
      {
        key: "BBL",
        title: "CRICKET STREAKr",
        subtitle: "BBL Yes/No picks. Clean sweep per match.",
        href: "/play/bbl",
        status: "live",
        icon: <IconCricket />,
        accent: "sky",
      },
      {
        key: "MULTI",
        title: "MULTI-SPORT",
        subtitle: "Cross-sport streaks & ladders. Built for chaos.",
        status: "soon",
        icon: <IconMulti />,
        accent: "violet",
        comingText: "Coming March 2027",
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Global background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,122,0,0.12),transparent_40%),radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.10),transparent_42%),radial-gradient(circle_at_40%_85%,rgba(167,139,250,0.10),transparent_45%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        {/* HERO */}
        <div className="mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65 mb-4">
            <span className="h-2 w-2 rounded-full bg-[#FF7A00]" />
            STREAKr — Multi-Sport
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight">
            How long can you last?
          </h1>

          <p className="mt-4 max-w-2xl text-white/70">
            Click a sport to play. Free-to-play, real-time{" "}
            <span className="text-[#FF7A00] font-extrabold">Yes</span> /{" "}
            <span className="text-[#FF7A00] font-extrabold">No</span> picks.
            Clean sweep per match — get one wrong, back to zero.
          </p>

          {/* Mobile primary CTA -> picker */}
          <div className="mt-6 md:hidden">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-2xl bg-[#FF7A00] px-5 py-4 text-black font-extrabold shadow-[0_18px_60px_rgba(0,0,0,0.7)] active:scale-[0.99]"
            >
              Choose a sport to play →
            </button>

            <div className="mt-3 flex items-center justify-between text-[11px] text-white/55">
              <span>Free to play • 18+</span>
              <span>No gambling • Bragging rights</span>
            </div>
          </div>
        </div>

        {/* TILES (desktop & tablet) */}
        <section className="hidden md:grid gap-6 md:grid-cols-3">
          {tiles.map((t) => (
            <TileCard
              key={t.key}
              tile={t}
              liveCount={
                t.key === "AFL" ? aflLiveCount : t.key === "BBL" ? bblLiveCount : undefined
              }
            />
          ))}
        </section>

        {/* “Other sports coming soon” */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="text-sm font-semibold text-white/85 mb-3">
            Other sports coming soon
          </div>
          <div className="flex flex-wrap gap-2">
            {["Tennis", "NBA", "NRL", "Olympics", "Multi-sport"].map((x) => (
              <span
                key={x}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/65"
              >
                {x}
              </span>
            ))}
          </div>
        </div>

        <footer className="mt-12 text-[11px] text-white/45">
          Built for group chats, office comps, pub and venue leagues. Free to play • 18+ • No gambling • Just bragging rights.
        </footer>
      </div>

      {/* MOBILE PICKER MODAL */}
      <MobilePickerModal
        open={pickerOpen}
        tiles={tiles}
        aflLiveCount={aflLiveCount}
        bblLiveCount={bblLiveCount}
        onClose={() => setPickerOpen(false)}
      />

      {/* Keyframes for shimmer */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-120%) rotate(12deg);
          }
          100% {
            transform: translateX(260%) rotate(12deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 2.8s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}
