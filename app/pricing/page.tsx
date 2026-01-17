// /app/pricing/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACCENT = "#FF2E4D";

type Plan = {
  id: "round" | "month" | "season";
  name: string;
  price: string;
  cadence: string;
  subline: string;
  highlight?: boolean;
};

const PLANS: Plan[] = [
  { id: "round", name: "Per Round", price: "$2.99", cadence: "per round", subline: "Low friction. Instant edge." },
  {
    id: "month",
    name: "4 Weeks",
    price: "$9.99",
    cadence: "per 4 weeks",
    subline: "Best short-term value.",
    highlight: true,
  },
  { id: "season", name: "Season", price: "$49.99", cadence: "per season", subline: "Commit. Survive. Brag." },
];

const PREMIUM_FEATURES = [
  "All 15 questions per match",
  "Last 5 games stats per question",
  "Live YES/NO percentages",
  "Trend indicators (simple arrows)",
  "1 Free Kick per round",
  "Full pick history",
  "Best streak ever",
  "Season streak chart",
  "Premium badge on profile",
];

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/80">
      {children}
    </span>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />;
}

function CheckIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{ backgroundColor: `${ACCENT}1A` }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function XIcon() {
  return (
    <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 6L6 18M6 6l12 12"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function GlowDivider() {
  return (
    <div className="relative my-10">
      <div className="h-px w-full bg-white/10" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-px w-40 -translate-x-1/2 -translate-y-1/2 blur-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
      />
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      {/* Top glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-[-140px] z-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: `${ACCENT}22` }}
      />

      {/* Header (no logo) */}
      <header className="relative z-10 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <Dot />
            <p className="text-xs font-medium tracking-[0.22em] text-white/70">SCREAMR • PRICING</p>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/picks?sport=AFL"
              className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:bg-white/10 md:inline-flex"
            >
              Go to Picks
            </Link>
            <Link
              href="#plans"
              className="inline-flex rounded-full border px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              style={{ borderColor: `${ACCENT}55` }}
            >
              View plans
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="relative h-[440px] w-full md:h-[520px]">
          <Image src="/screamr/hero-bg.png" alt="SCREAMR cinematic AFL background" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/55 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,46,77,0.35),transparent_55%)]" />

          {/* Marquee breakout (full width on mobile) */}
          <div className="absolute left-1/2 top-0 w-screen -translate-x-1/2">
            <div className="border-b border-white/10 bg-black/50 backdrop-blur">
              <div className="relative overflow-hidden">
                <div className="animate-[marquee_18s_linear_infinite] whitespace-nowrap py-2 text-xs tracking-[0.18em] text-white/80">
                  <span className="mx-6 inline-flex items-center gap-2">
                    <Dot />
                    WIN $1000 EACH ROUND
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <Dot />
                    NO GAMBLING • GAME OF SKILL
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <Dot />
                    CLEAN SWEEP: 1 WRONG = STREAK RESET
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <Dot />
                    PICKS LOCK AT FIRST BOUNCE
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <Dot />
                    ALL PREMIUM TIERS = SAME FEATURES
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10 pt-16 md:px-8 md:pb-14">
              <div className="max-w-3xl">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE VS PREMIUM</p>
                <h1 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
                  Free gets the thrill. <span style={{ color: ACCENT }}>Premium</span> gets the edge.
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                  SCREAMR is a live YES/NO AFL picks game. If someone takes an awesome mark, that’s a{" "}
                  <span style={{ color: ACCENT }}>SCREAMR</span>. One wrong pick in a match resets your streak to zero —
                  voids don’t count. Highest current streak each round wins <span className="text-white">$1,000</span>.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="#compare"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Compare plans
                  </Link>
                  <Link
                    href="#plans"
                    className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    style={{ borderColor: `${ACCENT}55` }}
                  >
                    See Premium pricing
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Pill>All Premium tiers = same features</Pill>
                  <Pill>Choose duration only</Pill>
                  <Pill>No gambling</Pill>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">COMPARISON</p>
            <h2 id="compare" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Same rules. Different survival tools.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Premium is about control, confidence, and survival — not cheating. You’re not buying different features per
              tier — you’re choosing <span className="text-white">how long</span> you want Premium for.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>WIN $1000 EACH ROUND</Pill>
            <Pill>Game of skill</Pill>
            <Pill>Clean Sweep</Pill>
          </div>
        </div>

        <GlowDivider />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* FREE */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">Everyone starts here</h3>
                <p className="mt-2 text-sm text-white/70">Fun, brutal, competitive — no paywall nonsense.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/75">
                Default
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">Core gameplay</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Play SCREAMR every round",
                    "Make picks on live Yes / No questions",
                    "Streak rules apply (1 wrong = streak dead)",
                    "Eligible for the $1,000 weekly prize",
                    "Eligible for launch promos (e.g. Grand Final tickets)",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/80">
                      <span className="mt-0.5">
                        <CheckIcon />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">Limits</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Only 7 of 15 questions per game unlocked",
                    "No historical stats",
                    "No live YES/NO percentages",
                    "No trends",
                    "No Free Kick",
                    "No pick history, no charts, no best streak",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="mt-0.5">
                        <XIcon />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Positioning</p>
                <p className="mt-1 text-sm font-semibold">“Free players get the thrill. Premium players get the edge.”</p>
              </div>
            </div>
          </div>

          {/* PREMIUM */}
          <div className="rounded-3xl border p-6 md:p-8" style={{ borderColor: `${ACCENT}55` }}>
            <div
              className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl"
              style={{ backgroundColor: `${ACCENT}18` }}
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">PREMIUM</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">Control. Confidence. Survival.</h3>
                <p className="mt-2 text-sm text-white/70">All Premium tiers include the same feature set.</p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}55` }}
              >
                Same features • any tier
              </span>
            </div>

            <div className="mt-6">
              <p className="text-xs font-medium tracking-[0.22em] text-white/60">Included</p>
              <ul className="mt-3 space-y-2">
                {PREMIUM_FEATURES.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-white/85">
                    <span className="mt-0.5">
                      <CheckIcon />
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">Signature feature</p>
                <Pill>1 per round</Pill>
              </div>
              <h4 className="mt-2 text-lg font-semibold">🛡 Free Kick</h4>
              <p className="mt-2 text-sm text-white/70">
                If you lose a streak, Free Kick activates and your streak rolls back to the previous total. Can’t be
                stacked or spammed. Feels powerful — not pay-to-win.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs text-white/60">Premium mindset</p>
              <p className="mt-1 text-sm font-semibold">“I survived that by one pick. Worth it.”</p>
            </div>
          </div>
        </div>

        <GlowDivider />

        {/* Plans */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">PLANS</p>
            <h2 id="plans" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Choose your duration.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              All Premium plans include the same features — you’re only choosing how long you want the edge for.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>Same features • any tier</Pill>
            <Pill>$2.99 / round</Pill>
            <Pill>$9.99 / 4 weeks</Pill>
            <Pill>$49.99 / season</Pill>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border p-6 ${plan.highlight ? "bg-white/8" : "bg-white/5"}`}
              style={{ borderColor: plan.highlight ? `${ACCENT}55` : "rgba(255,255,255,0.10)" }}
            >
              {plan.highlight && (
                <div
                  className="absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}12` }}
                >
                  Most popular
                </div>
              )}

              <p className="text-xs font-medium tracking-[0.22em] text-white/60">{plan.name}</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-4xl font-semibold tracking-tight">{plan.price}</p>
                <p className="pb-1 text-sm text-white/60">{plan.cadence}</p>
              </div>
              <p className="mt-1 text-sm text-white/70">{plan.subline}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">Included (same for every plan)</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {["All 15 questions", "Stats + live % + trends", "1 Free Kick per round", "History + charts + badge"].map(
                    (t) => (
                      <div key={t} className="flex items-start gap-3 text-sm text-white/80">
                        <span className="mt-0.5">
                          <CheckIcon />
                        </span>
                        <span>{t}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Preview upgrade
              </button>
              <p className="mt-2 text-xs text-white/55">(UI only) Payments not wired yet.</p>
            </div>
          ))}
        </div>

        {/* What NOT to paywall */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/40 p-6 md:p-8">
          <p className="text-xs font-medium tracking-[0.22em] text-white/60">IMPORTANT</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">What we won’t put behind Premium</h3>
          <p className="mt-2 text-sm text-white/70">SCREAMR wins by pressure — not exclusion.</p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {["Weekly prize eligibility", "Core gameplay access", "Making picks at all"].map((t) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">
                    <XIcon />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t}</p>
                    <p className="mt-1 text-xs text-white/60">Not paywalled.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-12 border-t border-white/10 pt-8 text-center">
          <p className="text-xs text-white/55">SCREAMR • Pricing • No gambling. Game of skill.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link href="/picks?sport=AFL" className="text-xs text-white/70 hover:text-white">
              Go to picks
            </Link>
            <span className="text-xs text-white/40">•</span>
            <Link href="/" className="text-xs text-white/70 hover:text-white">
              Home
            </Link>
          </div>
        </footer>
      </section>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
