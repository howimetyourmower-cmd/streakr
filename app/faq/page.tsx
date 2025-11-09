// app/faq/page.tsx
"use client";

import Link from "next/link";

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-zinc-300">
          New to STREAKr? Start here. If you still need a hand,{" "}
          <a href="mailto:hello@streakr.afl" className="underline underline-offset-4">
            email hello@streakr.afl
          </a>
          .
        </p>

        {/* Quick nav */}
        <nav className="mt-8 grid gap-2 md:grid-cols-2">
          {[
            ["Playing the Game", "#playing"],
            ["Picks, Locks & Status", "#picks"],
            ["Scoring & Prizes", "#scoring"],
            ["Eligibility & Accounts", "#accounts"],
            ["Data & Integrity", "#integrity"],
            ["Troubleshooting", "#troubleshooting"],
            ["Privacy", "#privacy"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href as string}
              className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 px-4 py-3 text-sm hover:bg-zinc-900/70"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Playing the Game */}
        <section id="playing" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Playing the Game</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="What is STREAKr?"
              a="A free-to-play AFL prediction game. Make one pick at a time on quarter-based questions. Each correct pick builds your streak; a wrong pick ends it."
            />
            <FAQ
              q="How do I start?"
              a={
                <>
                  Sign up or log in, then visit{" "}
                  <Link href="/picks" className="underline underline-offset-4">
                    the Picks page
                  </Link>{" "}
                  and choose “Yes” or “No” on an open question.
                </>
              }
            />
            <FAQ
              q="Do I need an account to play?"
              a="Yes. You must be logged in to make a pick. Avatar is optional. You can set your favourite team in your profile."
            />
            <FAQ
              q="How many questions can I answer at once?"
              a="One at a time. When your current pick settles as correct, your streak increments and you can make the next pick."
            />
            <FAQ
              q="Which questions show on the home page?"
              a="Six sample questions from the current round. Click any card to go to the full Picks list."
            />
          </div>
        </section>

        {/* Picks, Locks & Status */}
        <section id="picks" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Picks, Locks & Status</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="When does a question lock?"
              a="At the published game start time (local venue time). After lock, you can no longer make or change a pick for that question."
            />
            <FAQ
              q="What do the statuses mean?"
              a={
                <ul className="list-disc pl-6 space-y-1">
                  <li><b>OPEN</b> – You can make a pick.</li>
                  <li><b>PENDING</b> – Game is in progress / awaiting stat confirmation.</li>
                  <li><b>FINAL</b> – Question is settled; your streak will update accordingly.</li>
                  <li><b>VOID</b> – No action taken (e.g., cancelled/abandoned). Voids do not affect your streak.</li>
                </ul>
              }
            />
            <FAQ
              q="Where do the date, time and venue come from?"
              a="From the round data stored in Firestore (each game includes startTime and venue). We display it in local Australian time with the correct timezone label (e.g., AEDT)."
            />
          </div>
        </section>

        {/* Scoring & Prizes */}
        <section id="scoring" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Scoring & Prizes</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="How do I build my streak?"
              a="Each correct pick adds +1 to your current streak. A wrong pick resets your streak to 0."
            />
            <FAQ
              q="What can I win?"
              a="Each round, the player(s) with the longest streak win a share of the prize pool (e.g., $1000 gift card pool)."
            />
            <FAQ
              q="How are ties handled?"
              a="If two or more players share the same longest number, the prize is split equally. If one player’s top streak is unbroken while another’s includes a reset within the round but still reaches the same number, the unbroken streak is deemed the winner."
            />
            <FAQ
              q="When are results final?"
              a="Questions settle shortly after official stats are confirmed. Final decisions may take up to 24 hours if a review is required."
            />
          </div>
        </section>

        {/* Accounts & Eligibility */}
        <section id="accounts" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Eligibility & Accounts</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="Who can play?"
              a="Residents of Australia aged 18+ (or the minimum age required by your state/territory for promotional games). One account per person."
            />
            <FAQ
              q="How do I sign up?"
              a={
                <>
                  Use the{" "}
                  <Link href="/auth" className="underline underline-offset-4">
                    Sign up / Login
                  </Link>{" "}
                  page with email & password. We may require email verification. Favourite team is optional and can be changed in Profile.
                </>
              }
            />
            <FAQ
              q="Can I change my details?"
              a="Yes. Update your display name, avatar and favourite team any time in your Profile."
            />
          </div>
        </section>

        {/* Data & Integrity */}
        <section id="integrity" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Data & Integrity</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="What stats power the results?"
              a="Official match stats (quarter-by-quarter). During beta we may verify some results manually; our goal is fully automated settlement."
            />
            <FAQ
              q="What’s your fair play policy?"
              a="No multi-accounting, botting, scraping, collusion or exploiting bugs. We may void suspect entries, adjust results, or suspend accounts to keep the game fair."
            />
            <FAQ
              q="What if a game is postponed or abandoned?"
              a="Affected questions are marked VOID and do not affect your streak."
            />
          </div>
        </section>

        {/* Troubleshooting */}
        <section id="troubleshooting" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Troubleshooting</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="I can’t make a pick."
              a="You must be logged in. If you are, check that the question is still OPEN and your internet connection is stable. Refresh the page if needed."
            />
            <FAQ
              q="The date/time looks wrong."
              a="We display local Australian time with timezone labels (AEDT/AEST). Clear cache and refresh; if it persists, contact support with a screenshot."
            />
            <FAQ
              q="My pick didn’t save."
              a="If you navigated away or lost connection before the confirmation, it may not have saved. Try again while the question is OPEN."
            />
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Privacy</h2>
          <div className="mt-4 space-y-4">
            <FAQ
              q="What data do you store?"
              a="Account details (email, display name, optional avatar/favourite team) and gameplay data (picks & results). We don’t sell personal data."
            />
            <FAQ
              q="Can I delete my account?"
              a="Yes—contact support and we’ll guide you through account deletion and data removal."
            />
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="mt-12">
          <h2 className="text-2xl md:text-3xl font-bold">Contact</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5">
              <h3 className="text-lg font-semibold">Email</h3>
              <p className="mt-2 text-zinc-300">
                <a href="mailto:hello@streakr.afl" className="underline underline-offset-4">
                  hello@streakr.afl
                </a>
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Response window: Mon–Fri, 9am–5pm AET
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5">
              <h3 className="text-lg font-semibold">Report an Issue</h3>
              <p className="mt-2 text-zinc-300">
                Found a bug or result you disagree with? Email us with a screenshot and your username.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link
            href="/picks"
            className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400"
          >
            Go to Picks
          </Link>
          <Link
            href="/auth"
            className="rounded-xl border border-zinc-600 px-5 py-3 font-semibold hover:bg-zinc-900/60"
          >
            Sign up / Login
          </Link>
        </div>
      </section>
    </main>
  );
}

function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5">
      <summary className="cursor-pointer select-none text-lg font-semibold list-none">
        <span className="mr-2 text-orange-400">Q:</span>
        {q}
      </summary>
      <div className="mt-3 text-zinc-200">
        <span className="mr-2 font-semibold text-emerald-400">A:</span>
        <span className="align-middle">{a}</span>
      </div>
    </details>
  );
}
