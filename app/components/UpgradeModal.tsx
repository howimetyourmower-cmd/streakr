// /app/screamr/UpgradeModal.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ACCENT = "#FF2E4D";

export type ScreamrPlanId = "round" | "month" | "season";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;

  /**
   * Used to build auth returnTo param and deep links.
   * Example: "/picks?sport=AFL"
   */
  returnTo?: string;

  /**
   * Optional: show context for what feature triggered the upsell.
   * e.g. "Unlock all 15 questions" or "Free Kick is Premium"
   */
  reason?: string;

  /**
   * If true, show signup/login buttons.
   */
  showAuthActions?: boolean;

  /**
   * Optional: Called when user clicks a plan.
   * If not provided, defaults to routing to /pricing#plans.
   */
  onSelectPlan?: (plan: ScreamrPlanId) => void;
};

const PREMIUM_FEATURES: string[] = [
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

const PLAN_CARDS: Array<{
  id: ScreamrPlanId;
  label: string;
  price: string;
  cadence: string;
  tag?: string;
  blurb: string;
}> = [
  { id: "round", label: "Per Round", price: "$2.99", cadence: "per round", blurb: "Try it for a round. Instant edge." },
  { id: "month", label: "4 Weeks", price: "$9.99", cadence: "per 4 weeks", tag: "Most popular", blurb: "Best value to stay alive." },
  { id: "season", label: "Season", price: "$49.99", cadence: "per season", blurb: "Commit. Survive. Brag." },
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
    <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: `${ACCENT}1A` }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function UpgradeModal({
  open,
  onClose,
  returnTo = "/picks?sport=AFL",
  reason,
  showAuthActions = true,
  onSelectPlan,
}: UpgradeModalProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const encodedReturnTo = useMemo(() => encodeURIComponent(returnTo), [returnTo]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (plan: ScreamrPlanId) => {
    if (onSelectPlan) return onSelectPlan(plan);
    router.push("/pricing#plans");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to SCREAMR Premium"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* cinematic glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: `${ACCENT}22` }}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative w-full overflow-hidden border border-white/10 bg-black text-white",
          "md:max-w-3xl md:rounded-3xl",
          "max-h-[92vh] md:max-h-[86vh]"
        )}
      >
        {/* header */}
        <div className="relative border-b border-white/10 bg-black/60 px-5 py-5 md:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,46,77,0.25),transparent_60%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Dot />
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">SCREAMR PREMIUM</p>
              </div>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Upgrade. Stay alive.</h2>

              <p className="mt-2 max-w-xl text-sm text-white/70">
                One wrong pick in a match resets your streak. Premium doesn’t change the rules — it gives you the edge to survive them.
              </p>

              {reason ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                  <span>{reason}</span>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>All tiers = same features</Pill>
                <Pill>Choose duration only</Pill>
                <Pill>No gambling • Game of skill</Pill>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto px-5 py-6 md:px-8">
          {/* compare */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-medium tracking-[0.22em] text-white/60">FREE</p>
              <p className="mt-2 text-sm text-white/80">7 of 15 questions • no stats • no history • no Free Kick</p>
              <p className="mt-2 text-xs text-white/55">
                Still eligible for <span className="text-white">WIN $1000 EACH ROUND</span>.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-3xl border p-5" style={{ borderColor: `${ACCENT}55` }}>
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full blur-3xl"
                style={{ backgroundColor: `${ACCENT}18` }}
              />
              <p className="relative text-xs font-medium tracking-[0.22em] text-white/60">PREMIUM</p>
              <p className="relative mt-2 text-sm text-white/85">
                15 of 15 questions • stats + live % • history + charts • 1 Free Kick per round
              </p>
              <p className="relative mt-2 text-xs text-white/60">Same feature set on every tier — duration only.</p>
            </div>
          </div>

          {/* features */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">WHAT YOU GET</p>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {PREMIUM_FEATURES.map((f) => (
                <div key={f} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="mt-0.5">
                    <CheckIcon />
                  </span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">SIGNATURE FEATURE</p>
                <Pill>1 per round</Pill>
              </div>
              <p className="mt-2 text-base font-semibold">🛡 Free Kick</p>
              <p className="mt-2 text-sm text-white/70">
                If you lose a streak, Free Kick activates and your streak rolls back to the previous total. Can’t be stacked or spammed.
                Feels powerful — not pay-to-win.
              </p>
            </div>
          </div>

          {/* plans */}
          <div className="mt-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-medium tracking-[0.22em] text-white/60">CHOOSE A PLAN</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">Same features. Choose duration.</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill>$2.99 / round</Pill>
                <Pill>$9.99 / 4 weeks</Pill>
                <Pill>$49.99 / season</Pill>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {PLAN_CARDS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border p-5 text-left transition",
                    "hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-0",
                    p.id === "month" ? "bg-white/8" : "bg-white/5"
                  )}
                  style={{
                    borderColor: p.id === "month" ? `${ACCENT}55` : "rgba(255,255,255,0.10)",
                    boxShadow: p.id === "month" ? `0 0 0 1px ${ACCENT}22` : undefined,
                  }}
                  aria-label={`Select ${p.label} plan`}
                >
                  {p.tag ? (
                    <span
                      className="absolute right-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: `${ACCENT}55`, backgroundColor: `${ACCENT}12` }}
                    >
                      {p.tag}
                    </span>
                  ) : null}

                  <p className="text-xs font-medium tracking-[0.22em] text-white/60">{p.label}</p>

                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-3xl font-semibold tracking-tight">{p.price}</p>
                    <p className="pb-1 text-xs text-white/60">{p.cadence}</p>
                  </div>

                  <p className="mt-2 text-sm text-white/70">{p.blurb}</p>

                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                    Continue
                  </div>

                  <p className="mt-3 text-[11px] text-white/50">
                    UI only for now — checkout wiring comes next.
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* auth */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-medium tracking-[0.22em] text-white/60">NEXT</p>

            {showAuthActions ? (
              <>
                <p className="mt-2 text-sm text-white/70">Create an account to track streaks and unlock Premium when you’re ready.</p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/auth?mode=signup&returnTo=${encodedReturnTo}`}
                    className="inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    style={{ borderColor: `${ACCENT}55` }}
                  >
                    Sign up
                  </Link>

                  <Link
                    href={`/auth?mode=login&returnTo=${encodedReturnTo}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Log in
                  </Link>

                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/40 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                  >
                    View full pricing
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/pricing")}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Not now
                </button>
              </div>
            )}

            <p className="mt-3 text-xs text-white/55">
              Free users stay eligible for <span className="text-white">WIN $1000 EACH ROUND</span>. Premium is an edge — not an exclusion.
            </p>
          </div>
        </div>

        {/* footer bar */}
        <div className="border-t border-white/10 bg-black/80 px-5 py-4 md:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/60">Premium tiers are identical — choose duration only.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Close
              </button>
              <Link
                href="/pricing#plans"
                className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                style={{ borderColor: `${ACCENT}55` }}
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
