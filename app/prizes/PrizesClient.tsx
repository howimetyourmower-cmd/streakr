"use client";

// /app/prizes/PrizesClient.tsx
import Link from "next/link";
import { useMemo } from "react";

const BRAND_RED = "#FF2E4D";
const BRAND_BG = "#000000";

type PrizeRule = {
  title: string;
  desc: string;
};

export default function PrizesClient() {
  const rules: PrizeRule[] = useMemo(
    () => [
      {
        title: "$1,000 Round Prize",
        desc: "Each round, the player who finishes the round with the highest CURRENT STREAK wins $1,000.",
      },
      {
        title: "What counts as “Current Streak”",
        desc: "Your current streak is the number of consecutive correct picks you’ve made without a single incorrect pick breaking your run.",
      },
      {
        title: "No mercy rule",
        desc: "If you get a pick wrong, your streak drops to 0 (like a multi — one leg fails and the run is over).",
      },
      {
        title: "Locks at bounce",
        desc: "Questions lock when the match begins (so make your picks before the first bounce).",
      },
      {
        title: "Ties",
        desc: "If multiple players finish with the same highest current streak, the tiebreak is applied (see below).",
      },
      {
        title: "Sponsor Questions",
        desc: "Some rounds include sponsor questions and bonus promos. They still count toward your streak unless marked VOID.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen text-white" style={{ background: BRAND_BG }}>
      {/* top sponsor strip */}
      <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
        <div className="text-[11px] tracking-[0.18em] font-semibold text-white/50">OFFICIAL PARTNER</div>
        <div className="text-[11px] tracking-[0.12em] text-white/35">Proudly supporting Torpie all season long</div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-6 md:p-8">
          <div
            className="pointer-events-none absolute -top-24 -right-24 h-[360px] w-[360px] rounded-full"
            style={{
              background: `radial-gradient(circle at center, rgba(255,46,77,0.35), rgba(0,0,0,0.0) 70%)`,
              filter: "blur(2px)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
            {/* If you have a crowd/hero image, drop it in /public and swap src */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/afl1.png" alt="" className="h-full w-full object-cover object-center" />
          </div>

          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="text-[11px] font-black tracking-[0.22em] text-white/60">REWARDS & PRIZES</div>
                <h1 className="mt-2 text-4xl md:text-5xl font-black italic tracking-wide">
                  WIN <span style={{ color: BRAND_RED }}>$1,000</span> EACH ROUND
                </h1>
                <p className="mt-3 max-w-2xl text-white/70 text-sm md:text-base font-semibold leading-relaxed">
                  Torpie rewards the sharpest streak builders. Finish the round with the <b>highest current streak</b> and
                  you take home the round prize.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/picks"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-extrabold text-white/85 hover:bg-white/10"
                >
                  GO TO PICKS
                </Link>
                <Link
                  href="/leaderboards"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-extrabold text-white/85 hover:bg-white/10"
                >
                  LEADERBOARDS
                </Link>
                <Link
                  href="/faq"
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-extrabold text-white/85 hover:bg-white/10"
                >
                  FAQ
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiCard label="Round prize" value="$1,000" />
              <KpiCard label="Winner" value="Highest current streak" />
              <KpiCard label="Lock" value="At bounce" />
            </div>
          </div>
        </div>

        {/* Core rule callout */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black tracking-[0.22em] text-white/60">THE RULE</div>
              <div className="mt-2 text-xl md:text-2xl font-black">
                <span style={{ color: BRAND_RED }}>$1,000</span> per round for the{" "}
                <span className="text-white">highest current streak</span>.
              </div>
              <div className="mt-2 text-sm text-white/70 font-semibold">
                Current streak = consecutive correct picks without a miss. Wrong pick = streak resets.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
              <div className="text-[11px] text-white/55 font-black tracking-[0.18em]">PRO TIP</div>
              <div className="mt-1 text-sm text-white/80 font-semibold">
                Don’t chase every question — pick your spots and protect the streak.
              </div>
            </div>
          </div>
        </div>

        {/* Rules grid */}
        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-black tracking-[0.22em] text-white/60">HOW IT WORKS</div>
              <div className="mt-1 text-xl font-black">Prize rules (simple & clear)</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rules.map((r) => (
              <div key={r.title} className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-5">
                <div className="text-[13px] font-black tracking-wide">{r.title}</div>
                <div className="mt-2 text-sm text-white/70 font-semibold leading-relaxed">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tiebreak + eligibility */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-6">
            <div className="text-[11px] font-black tracking-[0.22em] text-white/60">TIEBREAK (DEFAULT)</div>
            <div className="mt-2 text-lg font-black">If two players finish equal…</div>
            <ul className="mt-3 space-y-2 text-sm text-white/70 font-semibold">
              <li>
                <span className="font-black text-white">1)</span> Highest streak achieved earliest in the round (first to reach it).
              </li>
              <li>
                <span className="font-black text-white">2)</span> If still tied: most correct picks for the round.
              </li>
              <li>
                <span className="font-black text-white">3)</span> If still tied: prize split evenly.
              </li>
            </ul>
            <div className="mt-4 text-[11px] text-white/45 font-semibold">
              (If you prefer a different tiebreak, tell me and I’ll lock it in across the app.)
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-6">
            <div className="text-[11px] font-black tracking-[0.22em] text-white/60">ELIGIBILITY</div>
            <div className="mt-2 text-lg font-black">To claim prizes</div>
            <ul className="mt-3 space-y-2 text-sm text-white/70 font-semibold">
              <li>
                <span className="font-black text-white">•</span> Must have a verified account (name + email).
              </li>
              <li>
                <span className="font-black text-white">•</span> One account per person (no duplicate accounts).
              </li>
              <li>
                <span className="font-black text-white">•</span> Picks must be made before locks (bounce).
              </li>
              <li>
                <span className="font-black text-white">•</span> VOID questions don’t help or hurt your streak.
              </li>
            </ul>

            <div
              className="mt-5 rounded-2xl border px-4 py-3"
              style={{ borderColor: "rgba(255,46,77,0.25)", background: "rgba(255,46,77,0.10)" }}
            >
              <div className="text-[12px] font-black tracking-wide">PRIZE PAYOUT</div>
              <div className="mt-1 text-sm text-white/80 font-semibold">
                Paid to the verified winner after round settlement.
              </div>
            </div>
          </div>
        </div>

 <div className="absolute inset-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center">
            <div className="max-w-2xl">
              {/* ✅ FULL-WIDTH MARQUEE (VISIBLE ON MOBILE) */}
              <div
                className="
                  w-screen
                  ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]
                  mb-3
                  rounded-none
                  border-y
                "
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 100%)",
                  boxShadow: `0 0 26px ${rgbaFromHex(COLORS.red, 0.12)}`,
                }}
              >
                <div className="relative">
                  {/* edge fades */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/90 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/90 to-transparent" />

                  <div className="screamr-marquee py-2.5">
                    <div className="screamr-track">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span
                          key={`a-${i}`}
                          className="mx-4 text-[12px] sm:text-[11px] font-black tracking-[0.22em]"
                          style={{
                            color: "rgba(255,255,255,0.92)",
                            textShadow: `0 10px 26px ${rgbaFromHex(COLORS.red, 0.22)}`,
                          }}
                        >
                          * SCREAMR BETA 2026 SEASON - we are testing gameplay and streak tracking - send us your ideas - 2027 will be huge *
                        </span>
                      ))}
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span
                          key={`b-${i}`}
                          className="mx-4 text-[12px] sm:text-[11px] font-black tracking-[0.22em]"
                          style={{
                            color: "rgba(255,255,255,0.92)",
                            textShadow: `0 10px 26px ${rgbaFromHex(COLORS.red, 0.22)}`,
                          }}
                        >
                          * SCREAMR BETA 2026 SEASON - we are testing gameplay and streak tracking - send us your ideas - 2027 will be huge *
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

        
        {/* CTA */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-[11px] font-black tracking-[0.22em] text-white/60">READY?</div>
          <div className="mt-2 text-2xl md:text-3xl font-black">
            Build a streak. <span style={{ color: BRAND_RED }}>Win the round.</span>
          </div>
          <div className="mt-2 text-sm text-white/65 font-semibold">
            Head to Picks and start stacking correct calls.
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <Link
              href="/picks"
              className="rounded-full border px-5 py-2 text-[11px] font-extrabold"
              style={{
                borderColor: "rgba(255,46,77,0.35)",
                background: "rgba(255,46,77,0.18)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              GO TO PICKS
            </Link>
            <Link
              href="/leaderboards"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-[11px] font-extrabold text-white/85 hover:bg-white/10"
            >
              SEE LEADERBOARDS
            </Link>
          </div>
        </div>

        <div className="mt-10 text-center text-[11px] text-white/40 font-semibold">TORPIE © 2026</div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <div className="text-[11px] font-black tracking-[0.22em] text-white/55">{label.toUpperCase()}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[60%]" style={{ background: BRAND_RED }} />
      </div>
    </div>
  );
}
