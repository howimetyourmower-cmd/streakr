// /app/screamr/preview/page.tsx
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACCENT = "#FF2E4D";

type Plan = {
  id: "round" | "month" | "season";
  name: string;
  price: string;
  subline: string;
  highlight?: boolean;
  perks: string[];
};

const PLANS: Plan[] = [
  {
    id: "round",
    name: "Per Round",
    price: "$2.99",
    subline: "Pay as you play",
    perks: ["Full Premium access for that round", "1 Free Kick (that round)", "Stats + live insights"],
  },
  {
    id: "month",
    name: "4 Weeks",
    price: "$9.99",
    subline: "Best short-term value",
    highlight: true,
    perks: ["Rolling access for 4 rounds", "1 Free Kick per round", "All questions + trends"],
  },
  {
    id: "season",
    name: "Season",
    price: "$49.99",
    subline: "Commit. Survive. Brag.",
    perks: ["Full season access", "Premium badge + full history", "Season streak chart"],
  },
];

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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/80">
      {children}
    </span>
  );
}

function CheckIcon({ variant }: { variant: "free" | "premium" }) {
  const color = variant === "premium" ? ACCENT : "rgba(255,255,255,0.9)";
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{ backgroundColor: variant === "premium" ? `${ACCENT}1A` : "rgba(255,255,255,0.08)" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6L9 17l-5-5"
          stroke={color}
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
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5"
    >
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

function FeatureRow({
  label,
  free,
  premium,
  subtle,
}: {
  label: string;
  free: React.ReactNode;
  premium: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 border-t border-white/10 py-4">
      <div className={`col-span-12 text-sm md:col-span-6 ${subtle ? "text-white/70" : "text-white"}`}>
        {label}
      </div>
      <div className="col-span-6 flex items-center gap-2 text-sm text-white/80 md:col-span-3">
        {free}
      </div>
      <div className="col-span-6 flex items-center gap-2 text-sm text-white md:col-span-3">
        {premium}
      </div>
    </div>
  );
}

function PressureCTA() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full blur-3xl"
        style={{ backgroundColor: `${ACCENT}22` }}
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-white/60">SCREAMR PREMIUM</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Upgrade. Stay alive.
          </h3>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            SCREAMR is brutal by design — one wrong pick in a match and your streak is gone. Premium
            doesn’t change the rules. It gives you the edge to survive them.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            View pricing
          </Link>
          <Link
            href="/auth?mode=signup&returnTo=%2Fscreamr%2Fpreview"
            className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            style={{ borderColor: `${ACCENT}55` }}
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ScreamrPreviewPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      {/* Top glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-[-140px] z-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: `${ACCENT}22` }}
      />

      {/* Sponsor banner slot (optional) */}
      <div className="relative z-10 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 md:px-8">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
            <p className="text-xs text-white/70">
              Sponsor banner slot — safe area (won’t break layout)
            </p>
          </div>
          <Link href="/" className="text-xs text-white/60 hover:text-white">
            Back to home
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative z-10">
        <div className="relative h-[520px] w-full md:h-[620px]">
          <Image
            src="/screamr/hero-bg.png"
            alt="SCREAMR cinematic AFL hero background"
            fill
            priority
            className="object-cover"
          />
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,46,77,0.35),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_60%,rgba(255,255,255,0.12),transparent_45%)]" />

          {/* Marquee breakout (w-screen technique; always visible on mobile) */}
          <div className="absolute top-0 left-1/2 w-screen -translate-x-1/2">
            <div className="border-b border-white/10 bg-black/50 backdrop-blur">
              <div className="relative overflow-hidden">
                <div className="animate-[marquee_18s_linear_infinite] whitespace-nowrap py-2 text-xs tracking-[0.18em] text-white/80">
                  <span className="mx-6 inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                    WIN $1000 EACH ROUND
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                    NO GAMBLING • GAME OF SKILL
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                    CLEAN SWEEP: 1 WRONG = STREAK RESET
                  </span>
                  <span className="mx-6 inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                    PICKS LOCK AT FIRST BOUNCE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero content */}
          <div className="absolute inset-0">
            <div className="mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10 pt-16 md:px-8 md:pb-14">
              <div className="flex items-end justify-between gap-6">
                <div className="max-w-2xl">
                  {/* Logo bigger on desktop */}
                  <div className="relative h-[44px] w-[160px] md:h-[70px] md:w-[260px]">
                    <Image
                      src="/screamr/screamr-logo.png"
                      alt="SCREAMR logo"
                      fill
                      priority
                      className="object-contain"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Pill>Live YES/NO picks</Pill>
                    <Pill>0–12 picks per match</Pill>
                    <Pill>Brutal streak rules</Pill>
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-tight md:text-5xl">
                    The AFL live picks game where one moment can end you.
                  </h1>

                  <p className="mt-3 text-sm leading-relaxed text-white/75 md:text-base">
                    If someone takes an awesome mark, that’s a <span style={{ color: ACCENT }}>SCREAMR</span>.
                    Make your calls in real time. One wrong in a match and your streak resets to zero.
                    Voids don’t count. Highest current streak each round wins <span className="text-white">$1,000</span>.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="#compare"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      Compare Free vs Premium
                    </Link>
                    <Link
                      href="#pricing"
                      className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      style={{ borderColor: `${ACCENT}55` }}
                    >
                      See pricing
                    </Link>
                  </div>

                  <p className="mt-3 text-xs text-white/55">
                    Preview only — no gating or payments wired yet.
                  </p>
                </div>

                {/* Right-side hero card (desktop) */}
                <div className="hidden w-[360px] shrink-0 md:block">
                  <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur">
                    <div
                      className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
                      style={{ backgroundColor: `${ACCENT}22` }}
                    />
                    <p className="relative text-xs font-medium tracking-[0.22em] text-white/60">
                      HOW IT WORKS
                    </p>
                    <div className="relative mt-4 space-y-3 text-sm text-white/75">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                        <p>Pick YES/NO on live questions during the match.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                        <p>Picks lock automatically at first bounce.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                        <p>Clean Sweep per match: 1 wrong and your streak resets.</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                        <p>Highest current streak each round wins $1,000.</p>
                      </div>
                    </div>
                    <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/60">Positioning</p>
                      <p className="mt-1 text-sm font-semibold">
                        “Free players get the thrill. Premium players get the edge.”
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile hero card */}
              <div className="mt-8 md:hidden">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/55 p-5 backdrop-blur">
                  <div
                    className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl"
                    style={{ backgroundColor: `${ACCENT}22` }}
                  />
                  <p className="relative text-xs font-medium tracking-[0.22em] text-white/60">HOW IT WORKS</p>
                  <div className="relative mt-3 space-y-2 text-sm text-white/75">
                    <p>• Pick YES/NO on live questions.</p>
                    <p>• Locks at first bounce.</p>
                    <p>• 1 wrong in a match = streak resets.</p>
                    <p>• WIN $1000 EACH ROUND.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE VS PREMIUM</p>
            <h2 id="compare" className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Same rules. Different survival tools.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              SCREAMR wins by pressure, not exclusion. Free gets the thrill. Premium gets the edge.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>No gambling • Game of skill</Pill>
            <Pill>Clean Sweep per match</Pill>
            <Pill>Voids don’t count</Pill>
          </div>
        </div>

        <GlowDivider />

        {/* Comparison grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* FREE */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">Everyone starts here</h3>
                <p className="mt-2 text-sm text-white/70">
                  Fun, brutal, competitive — no paywall nonsense.
                </p>
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
                      <CheckIcon variant="free" />
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
                    "No Free Kick",
                    "No streak protection",
                    "Limited pick history (current round only)",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/70">
                      <XIcon />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Positioning</p>
                <p className="mt-1 text-sm font-semibold">
                  “Free players get the thrill. Premium players get the edge.”
                </p>
              </div>
            </div>
          </div>

          {/* PREMIUM */}
          <div className="relative overflow-hidden rounded-3xl border p-6 md:p-8" style={{ borderColor: `${ACCENT}55` }}>
            <div
              className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl"
              style={{ backgroundColor: `${ACCENT}20` }}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="relative">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">PREMIUM</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight">Control. Confidence. Survival.</h3>
                <p className="mt-2 text-sm text-white/70">
                  More information. More tools. Same brutal rules.
                </p>
              </div>
              <span
                className="relative rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${ACCENT}1A`, color: "white", border: `1px solid ${ACCENT}55` }}
              >
                Best experience
              </span>
            </div>

            <div className="relative mt-6 space-y-5">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">Everything in Free, plus</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "All 15 questions per game",
                    "Last 5 games stats per question",
                    "Live YES/NO percentages",
                    "Trend indicators (simple arrows)",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/85">
                      <CheckIcon variant="premium" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium tracking-[0.22em] text-white/60">Signature feature</p>
                  <Pill>1 per round</Pill>
                </div>
                <h4 className="mt-2 text-lg font-semibold" style={{ color: "white" }}>
                  🛡 Free Kick
                </h4>
                <p className="mt-2 text-sm text-white/70">
                  If you lose a streak, Free Kick activates and your streak rolls back to the previous total.
                  Can’t be stacked or spammed. Feels powerful — not pay-to-win.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">History & bragging</p>
                <ul className="mt-3 space-y-2">
                  {[
                    "Full pick history",
                    "Best streak ever",
                    "Season streak chart",
                    "Premium badge on profile",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/80">
                      <CheckIcon variant="premium" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs text-white/60">Premium mindset</p>
                <p className="mt-1 text-sm font-semibold">
                  “I survived that by one pick. Worth it.”
                </p>
              </div>
            </div>
          </div>
        </div>

        <GlowDivider />

        {/* One-screen comparison table (upgrade modal style) */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] text-white/60">ONE-SCREEN COMPARISON</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
                Free gets the thrill. Premium gets the edge.
              </h3>
              <p className="mt-2 text-sm text-white/70">
                This layout can be reused inside an upgrade modal later.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Buttons:</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs">
                YES = <span className="font-semibold text-white">white</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}12` }}
              >
                NO = <span className="font-semibold" style={{ color: "white" }}>red</span>
              </span>
            </div>
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-12 gap-3 pb-3 text-xs font-medium tracking-[0.22em] text-white/60">
              <div className="col-span-12 md:col-span-6">FEATURE</div>
              <div className="col-span-6 md:col-span-3">FREE</div>
              <div className="col-span-6 md:col-span-3">PREMIUM</div>
            </div>

            <FeatureRow
              label="Questions per game"
              free={
                <>
                  <XIcon /> <span>7 of 15</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>15 of 15</span>
                </>
              }
            />
            <FeatureRow
              label="Eligible for weekly prize (WIN $1000 EACH ROUND)"
              free={
                <>
                  <CheckIcon variant="free" /> <span>Yes</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>Yes</span>
                </>
              }
            />
            <FeatureRow
              label="Live YES/NO percentages"
              free={
                <>
                  <XIcon /> <span>No</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>Yes</span>
                </>
              }
            />
            <FeatureRow
              label="Last 5 games stats"
              free={
                <>
                  <XIcon /> <span>No</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>Yes</span>
                </>
              }
            />
            <FeatureRow
              label="Trend indicators"
              free={
                <>
                  <XIcon /> <span>No</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>Yes</span>
                </>
              }
            />
            <FeatureRow
              label="Free Kick (1 per round)"
              free={
                <>
                  <XIcon /> <span>No</span>
                </>
              }
              premium={
                <>
                  <CheckIcon variant="premium" /> <span>Yes</span>
                </>
              }
            />
            <FeatureRow
              label="Pick history"
              free={<span className="flex items-center gap-2"><XIcon /> Current round only</span>}
              premium={<span className="flex items-center gap-2"><CheckIcon variant="premium" /> Full history</span>}
              subtle
            />
            <FeatureRow
              label="Best streak ever + season chart"
              free={<span className="flex items-center gap-2"><XIcon /> Not available</span>}
              premium={<span className="flex items-center gap-2"><CheckIcon variant="premium" /> Included</span>}
              subtle
            />
          </div>

          <div className="mt-6">
            <PressureCTA />
          </div>
        </div>

        <GlowDivider />

        {/* Pricing */}
        <div id="pricing" className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">PRICING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Low-friction upgrade. High-pressure payoff.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              Premium is about control, confidence, and survival — not cheating. Weekly prize eligibility stays for everyone.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill>$2.99 / round</Pill>
            <Pill>$9.99 / 4 weeks</Pill>
            <Pill>$49.99 / season</Pill>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border p-6 ${
                plan.highlight ? "bg-white/8" : "bg-white/5"
              }`}
              style={{ borderColor: plan.highlight ? `${ACCENT}55` : "rgba(255,255,255,0.10)" }}
            >
              {plan.highlight && (
                <div className="absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}12` }}
                >
                  Most popular
                </div>
              )}

              <p className="text-xs font-medium tracking-[0.22em] text-white/60">{plan.name}</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-4xl font-semibold tracking-tight">{plan.price}</p>
                <p className="pb-1 text-sm text-white/60">AUD</p>
              </div>
              <p className="mt-1 text-sm text-white/70">{plan.subline}</p>

              <div className="mt-5 space-y-2">
                {plan.perks.map((perk) => (
                  <div key={perk} className="flex items-start gap-3 text-sm text-white/80">
                    <CheckIcon variant="premium" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl border bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  aria-label={`Preview purchase for ${plan.name}`}
                >
                  Preview upgrade flow
                </button>
                <p className="text-xs text-white/55">
                  (UI preview) Payments not wired yet.
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* What NOT to paywall */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/40 p-6 md:p-8">
          <p className="text-xs font-medium tracking-[0.22em] text-white/60">IMPORTANT</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
            What we won’t put behind Premium
          </h3>
          <p className="mt-2 text-sm text-white/70">
            SCREAMR wins by pressure — not exclusion.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              "Weekly prize eligibility",
              "Core gameplay access",
              "Making picks at all",
            ].map((t) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <XIcon />
                  <div>
                    <p className="text-sm font-semibold">{t}</p>
                    <p className="mt-1 text-xs text-white/60">Not paywalled.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">How this should feel</p>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE MINDSET</p>
                <p className="mt-2 text-sm font-semibold">“This is intense… I wish I had more info.”</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">PREMIUM MINDSET</p>
                <p className="mt-2 text-sm font-semibold">“I survived that by one pick. Worth it.”</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/10 pt-8 text-center">
          <p className="text-xs text-white/55">
            SCREAMR Preview • Cinematic UI only • No gating, no payments, no backend changes
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link href="/picks?sport=AFL" className="text-xs text-white/70 hover:text-white">
              Go to picks (existing)
            </Link>
            <span className="text-xs text-white/40">•</span>
            <Link href="/" className="text-xs text-white/70 hover:text-white">
              Home
            </Link>
          </div>
        </footer>
      </section>

      {/* Local animation keyframes (no Tailwind config required) */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </main>
  );
}
