// /app/picks/PicksClient.tsx
"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * TORPIE HOMEPAGE (client) — replaces the old Picks UI.
 *
 * ✅ Designed to match your mockup style:
 * - Big stadium hero with headline + CTAs
 * - 3 feature cards (Torpie / Footy Markit / Survivor) — but only Torpie is active
 * - “Join the Tribe” stripe section
 * - Trust icons row
 * - Final CTA + footer links
 *
 * ✅ Drop-in safe: no API calls, no auth dependency, no env vars.
 * ✅ Works on mobile + desktop.
 *
 * Images expected in /public:
 * - /images/torpie-hero.jpg
 * - /images/torpie-card-picks.jpg
 * - /images/torpie-crowd.jpg
 *
 * Routes used (change if you want):
 * - Play button -> /picks  (or /play)
 * - Learn more -> /how-to-play
 * - Leagues -> /leagues
 * - Sign up -> /signup
 * - Log in -> /login
 */

const BRAND = {
  red: "#FF2E4D",
  bg: "#05060A",
  ink: "#0A0A0A",
  white: "#FFFFFF",
  gold: "#FFCC33",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TopNav() {
  return (
    <header className="sticky top-0 z-[60]">
      <div
        className="border-b"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background:
            "linear-gradient(180deg, rgba(5,6,10,0.92) 0%, rgba(5,6,10,0.74) 100%)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
              <div className="relative h-9 w-9 overflow-hidden rounded-xl border"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                {/* Replace with your real Torpie logo if/when you have it */}
                <div className="absolute inset-0 flex items-center justify-center font-black text-white">
                  T
                </div>
              </div>
              <div className="leading-tight">
                <div className="text-white font-black tracking-tight text-[14px] sm:text-[15px]">
                  TORPIE
                </div>
                <div className="text-white/55 text-[11px] font-semibold">
                  Pick the multiplier. Survive the streak.
                </div>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-2">
              <NavPill href="/picks">Play</NavPill>
              <NavPill href="/how-to-play">How to play</NavPill>
              <NavPill href="/leagues">Leagues</NavPill>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,46,77,0.30)",
                  background: `linear-gradient(180deg, ${BRAND.red} 0%, rgba(255,46,77,0.72) 100%)`,
                  color: "rgba(255,255,255,0.98)",
                  boxShadow: "0 14px 34px rgba(255,46,77,0.16)",
                  textDecoration: "none",
                }}
              >
                PLAY NOW
              </Link>

              <Link
                href="/login"
                className="hidden sm:inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                  textDecoration: "none",
                }}
              >
                LOG IN
              </Link>

              <Link
                href="/signup"
                className="hidden sm:inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.95)",
                  textDecoration: "none",
                }}
              >
                SIGN UP
              </Link>

              <button
                type="button"
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                }}
                aria-label="Menu"
                onClick={() => {
                  const el = document.getElementById("torpie-mobile-menu");
                  if (el) el.classList.toggle("hidden");
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div id="torpie-mobile-menu" className="hidden md:hidden pt-3 pb-2">
            <div className="flex flex-col gap-2">
              <MobileLink href="/picks">Play</MobileLink>
              <MobileLink href="/how-to-play">How to play</MobileLink>
              <MobileLink href="/leagues">Leagues</MobileLink>
              <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />
              <MobileLink href="/signup">Sign up</MobileLink>
              <MobileLink href="/login">Log in</MobileLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-[12px] font-black border"
      style={{
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-2xl px-4 py-3 text-[13px] font-black border"
      style={{
        borderColor: "rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function StadiumHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/torpie-hero.jpg"
          alt="Torpie stadium hero"
          fill
          priority
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,10,0.40) 0%, rgba(5,6,10,0.82) 55%, rgba(5,6,10,0.98) 100%)",
          }}
        />
        <div
          className="absolute -top-28 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(255,46,77,0.22) 0%, rgba(255,46,77,0.00) 60%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-10 sm:pb-14">
        <div className="max-w-3xl">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: BRAND.red,
                boxShadow: "0 0 14px rgba(255,46,77,0.55)",
              }}
            />
            LIVE • AFL 2026
          </div>

          <h1 className="mt-5 text-white font-black leading-[0.95] tracking-tight text-[40px] sm:text-[58px]">
            WHERE FANS{" "}
            <span style={{ color: BRAND.gold }}>PLAY TO WIN</span>
          </h1>

          <p className="mt-4 text-white/75 text-[14px] sm:text-[16px] font-semibold max-w-xl">
            Think fast. Pick smart. Own the moment. Torpie turns every round into a
            high-stakes streak chase.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CTAButton href="/picks" variant="primary">
              PLAY TORPIE
            </CTAButton>
            <CTAButton href="/how-to-play" variant="secondary">
              LEARN MORE
            </CTAButton>

            <div className="hidden sm:flex items-center gap-2 text-white/60 text-[12px] font-semibold">
              <Dot /> Free to play
              <Dot /> Skill based
              <Dot /> Leagues with mates
            </div>
          </div>
        </div>

        <div className="mt-10 sm:mt-12">
          <GameCardsRow />
        </div>
      </div>
    </section>
  );
}

function Dot() {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: "rgba(255,255,255,0.35)" }}
    />
  );
}

function CTAButton({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-[12px] font-black border"
      style={{
        borderColor: isPrimary ? "rgba(255,46,77,0.32)" : "rgba(255,255,255,0.16)",
        background: isPrimary
          ? `linear-gradient(180deg, ${BRAND.gold} 0%, rgba(255,204,51,0.80) 100%)`
          : "rgba(255,255,255,0.06)",
        color: isPrimary ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.92)",
        boxShadow: isPrimary ? "0 16px 40px rgba(255,204,51,0.14)" : "none",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function GameCardsRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GameCardTorpie />
      <ComingSoonCard title="FOOTY MARKIT" subtitle="Trade on the game." cta="COMING SOON" />
      <ComingSoonCard title="SURVIVOR" subtitle="Outlast the comp." cta="COMING SOON" />
    </div>
  );
}

function CardFrame({
  children,
  accent = "rgba(255,255,255,0.12)",
}: {
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border"
      style={{
        borderColor: accent,
        background: "rgba(255,255,255,0.04)",
        boxShadow: "0 26px 90px rgba(0,0,0,0.65)",
      }}
    >
      {children}
    </div>
  );
}

function GameCardTorpie() {
  return (
    <CardFrame accent="rgba(255,204,51,0.22)">
      <div className="absolute inset-0">
        <Image
          src="/images/torpie-card-picks.jpg"
          alt="Torpie game card"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.72) 70%, rgba(0,0,0,0.90) 100%)",
          }}
        />
      </div>

      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black"
            style={{
              borderColor: "rgba(255,204,51,0.35)",
              background: "rgba(255,204,51,0.12)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: BRAND.gold }} />
            FEATURED
          </div>

          <span
            className="rounded-full px-3 py-1 text-[11px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            LIVE
          </span>
        </div>

        <div className="mt-4">
          <div className="text-white font-black text-[26px] tracking-tight">TORPIE</div>
          <div className="mt-1 text-white/75 text-[13px] font-semibold">
            Pick the multiplier. Dominate the ladder.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatChip label="Locks at bounce" />
          <StatChip label="Streak based" />
          <StatChip label="Leagues" />
        </div>

        <div className="mt-6">
          <Link
            href="/picks"
            className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,204,51,0.40)",
              background: `linear-gradient(180deg, ${BRAND.gold} 0%, rgba(255,204,51,0.82) 100%)`,
              color: "rgba(10,10,10,0.95)",
              textDecoration: "none",
              boxShadow: "0 14px 34px rgba(255,204,51,0.18)",
            }}
          >
            PLAY TORPIE
          </Link>
        </div>
      </div>
    </CardFrame>
  );
}

function ComingSoonCard({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta: string;
}) {
  return (
    <CardFrame>
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 240px at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.00) 65%)",
          }}
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative p-5 flex flex-col h-full">
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            COMING SOON
          </span>

          <span className="text-white/45 text-[11px] font-black tracking-[0.14em]">
            2026
          </span>
        </div>

        <div className="mt-5">
          <div className="text-white font-black text-[22px] tracking-tight">{title}</div>
          <div className="mt-1 text-white/70 text-[13px] font-semibold">{subtitle}</div>
        </div>

        <div className="mt-4 space-y-2 text-white/65 text-[12px] font-semibold">
          <div className="flex items-center gap-2"><MiniCheck /> Built for mates</div>
          <div className="flex items-center gap-2"><MiniCheck /> Live ladders</div>
          <div className="flex items-center gap-2"><MiniCheck /> Weekly prizes</div>
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-[12px] font-black border"
            style={{
              borderColor: "rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.70)",
            }}
            disabled
          >
            {cta}
          </button>
        </div>
      </div>
    </CardFrame>
  );
}

function MiniCheck() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
      style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)" }}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black border"
      style={{
        borderColor: "rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {label}
    </span>
  );
}

function TribeSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image src="/images/torpie-crowd.jpg" alt="Torpie crowd" fill className="object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,10,0.85) 0%, rgba(5,6,10,0.55) 45%, rgba(5,6,10,0.95) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="text-center">
          <div className="text-white font-black text-[26px] sm:text-[34px] tracking-tight">
            JOIN THE TRIBE. RULE THE LEAGUE.
          </div>
          <div className="mt-3 text-white/75 text-[13px] sm:text-[15px] font-semibold max-w-2xl mx-auto">
            Create or join leagues with your mates, climb the ranks, and flex your streak every week.
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/leagues"
              className="inline-flex items-center justify-center rounded-2xl px-8 py-3 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,204,51,0.40)",
                background: `linear-gradient(180deg, ${BRAND.gold} 0%, rgba(255,204,51,0.82) 100%)`,
                color: "rgba(10,10,10,0.95)",
                textDecoration: "none",
                boxShadow: "0 14px 34px rgba(255,204,51,0.16)",
              }}
            >
              VIEW LEAGUES
            </Link>

            <Link
              href="/picks"
              className="inline-flex items-center justify-center rounded-2xl px-8 py-3 text-[12px] font-black border"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
              }}
            >
              PLAY NOW
            </Link>
          </div>
        </div>

        <TrustRow />
      </div>
    </section>
  );
}

function TrustRow() {
  const items = useMemo(
    () => [
      { title: "WIN WEEKLY PRIZES", sub: "Top streaks win." },
      { title: "COMPETE WITH FRIENDS", sub: "Leagues + bragging rights." },
      { title: "100% SKILL BASED", sub: "No luck wheels." },
      { title: "SAFE & SECURE", sub: "Protected accounts." },
    ],
    []
  );

  return (
    <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-3xl border p-4"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.28)",
            boxShadow: "0 20px 70px rgba(0,0,0,0.55)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-2xl border flex items-center justify-center"
              style={{
                borderColor: "rgba(255,204,51,0.25)",
                background: "rgba(255,204,51,0.10)",
              }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="text-white font-black text-[12px] tracking-wide">{it.title}</div>
              <div className="mt-1 text-white/65 text-[11px] font-semibold">{it.sub}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="relative">
      <div
        className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16"
      >
        <div
          className="relative overflow-hidden rounded-[28px] border"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background:
              "radial-gradient(900px 240px at 50% 0%, rgba(255,46,77,0.20) 0%, rgba(0,0,0,0.00) 65%), rgba(255,255,255,0.03)",
            boxShadow: "0 30px 110px rgba(0,0,0,0.70)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-24 left-1/2 h-[280px] w-[680px] -translate-x-1/2 rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(255,204,51,0.18) 0%, rgba(255,204,51,0.00) 60%)",
              }}
            />
          </div>

          <div className="relative p-6 sm:p-10 text-center">
            <div className="text-white font-black text-[26px] sm:text-[34px] tracking-tight">
              READY FOR GAME DAY?
            </div>
            <div className="mt-3 text-white/75 text-[13px] sm:text-[15px] font-semibold max-w-2xl mx-auto">
              Sign up in 20 seconds. Jump into Torpie. Start building your streak.
            </div>

            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-2xl px-10 py-4 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,204,51,0.40)",
                  background: `linear-gradient(180deg, ${BRAND.gold} 0%, rgba(255,204,51,0.82) 100%)`,
                  color: "rgba(10,10,10,0.95)",
                  textDecoration: "none",
                  boxShadow: "0 16px 44px rgba(255,204,51,0.16)",
                }}
              >
                SIGN UP NOW
              </Link>

              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-2xl px-10 py-4 text-[12px] font-black border"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                  textDecoration: "none",
                }}
              >
                PLAY AS GUEST
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 text-white/45 text-[11px] font-semibold flex-wrap">
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/help">Help</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
            </div>

            <div className="mt-4 text-white/40 text-[11px] font-semibold">
              TORPIE © 2026
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:text-white/70" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}

export default function PicksClient() {
  // Tiny polish: hero “breathes” into place once mounted (no framer-motion needed)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn("min-h-screen text-white", mounted && "opacity-100")}
      style={{
        backgroundColor: BRAND.bg,
        opacity: mounted ? 1 : 0,
        transition: "opacity 220ms ease",
      }}
    >
      <TopNav />

      <main>
        <StadiumHero />
        <TribeSection />
        <FinalCTA />
      </main>
    </div>
  );
}
