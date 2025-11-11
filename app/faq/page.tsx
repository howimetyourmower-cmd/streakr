// app/faq/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* Title */}
      <h1 className="text-center text-4xl font-extrabold tracking-tight text-orange-400 mb-6">
        FAQs
      </h1>

      {/* Sponsor banner */}
      <div className="mx-auto mt-6 w-full rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70 ring-1 ring-white/10">
        Sponsor Banner • 970×90
      </div>

      {/* Intro */}
      <p className="mt-8 text-white/80">
        Welcome to <span className="font-semibold">STREAKr AFL</span>. Build a
        winning streak by answering bite-sized AFL questions. Picks lock when a
        game or quarter begins. Results are settled after games finish.
      </p>

      {/* FAQ groups */}
      <section className="mt-10 space-y-6">
        {/* How it works */}
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="mb-4 text-2xl font-bold text-orange-400">
            How it works
          </h2>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              What is a “pick”?
            </summary>
            <p className="mt-2 text-white/70">
              A pick is your answer to a single question (e.g. “Will Hawthorn
              win by 10+?”). Correct picks extend your streak; an incorrect pick
              breaks it.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              When do picks close?
            </summary>
            <p className="mt-2 text-white/70">
              Picks close at the scheduled start of the game or the quarter
              shown in the table. If timing changes, the lock follows the
              updated official start time.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              What are the statuses (Open, Pending, Final, Void)?
            </summary>
            <ul className="mt-2 list-disc pl-5 text-white/70">
              <li>
                <span className="font-semibold text-white">Open</span> – you can
                still make a pick.
              </li>
              <li>
                <span className="font-semibold text-white">Pending</span> – the
                game/quarter has started; waiting on result.
              </li>
              <li>
                <span className="font-semibold text-white">Final</span> – the
                result is official and graded.
              </li>
              <li>
                <span className="font-semibold text-white">Void</span> – no
                action (e.g., abandoned or data error). Streaks neither increase
                nor break.
              </li>
            </ul>
          </details>
        </div>

        {/* Streaks & prizes */}
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="mb-4 text-2xl font-bold text-orange-400">
            Streaks & Prizes
          </h2>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              What is a streak?
            </summary>
            <p className="mt-2 text-white/70">
              Your streak is the number of consecutive correct picks. A wrong
              pick resets your current streak to zero, but your{" "}
              <span className="font-semibold">longest streak</span> is saved for
              the leaderboards.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              What can I win?
            </summary>
            <p className="mt-2 text-white/70">
              Each round, the player(s) with the longest streak share a{" "}
              <span className="font-semibold">$1,000 gift card pool</span>. If
              multiple players tie on length, the best unbroken streak wins. If
              still tied, prizes are split evenly.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              I lost my streak. Can I restart?
            </summary>
            <p className="mt-2 text-white/70">
              Yes — you can keep making picks. Your current streak restarts at
              0, and you can build it again within the same round.
            </p>
          </details>
        </div>

        {/* Accounts & eligibility */}
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="mb-4 text-2xl font-bold text-orange-400">
            Accounts & Eligibility
          </h2>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              Who can play?
            </summary>
            <p className="mt-2 text-white/70">
              STREAKr is free to play. Players must be{" "}
              <span className="font-semibold">18+</span> and reside in regions
              where contests like these are permitted.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              Do I need an account?
            </summary>
            <p className="mt-2 text-white/70">
              You can browse picks without logging in, but you’ll need an
              account to submit picks and appear on leaderboards.{" "}
              <Link href="/login" className="text-orange-400 underline">
                Sign up / Log in
              </Link>
              .
            </p>
          </details>
        </div>

        {/* Settlements */}
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="mb-4 text-2xl font-bold text-orange-400">
            Question Settlement
          </h2>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              How are results settled?
            </summary>
            <p className="mt-2 text-white/70">
              We use official match stats and timings. During early testing,
              grading may be applied manually and later regraded if data is
              corrected.
            </p>
          </details>

          <details className="group rounded-lg p-4 hover:bg-white/5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-white">
              Can a question be regraded?
            </summary>
            <p className="mt-2 text-white/70">
              Yes. If an official correction changes the outcome, we may
              regrade. Your streak will be updated accordingly.
            </p>
          </details>
        </div>
      </section>

      {/* Contact box */}
      <section className="mt-10 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
        <h2 className="mb-4 text-2xl font-bold text-orange-400">Contact us</h2>
        <p className="mb-4 text-white/70">
          Questions, feedback, or partnership enquiries? Drop us a line:
        </p>
        <form
          action="https://formspree.io/f/your-id"
          method="POST"
          className="grid gap-4 md:grid-cols-2"
        >
          <input
            required
            name="name"
            placeholder="Name"
            className="rounded-xl bg-black/30 p-3 text-white ring-1 ring-white/10 outline-none placeholder-white/40"
          />
          <input
            required
            type="email"
            name="email"
            placeholder="Email"
            className="rounded-xl bg-black/30 p-3 text-white ring-1 ring-white/10 outline-none placeholder-white/40"
          />
          <textarea
            required
            name="message"
            placeholder="Your message"
            className="md:col-span-2 h-32 rounded-xl bg-black/30 p-3 text-white ring-1 ring-white/10 outline-none placeholder-white/40"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black hover:bg-orange-400"
            >
              Send
            </button>
          </div>
        </form>
      </section>

      {/* Footer note */}
      <p className="mt-8 text-center text-xs text-white/40">
        © {new Date().getFullYear()} STREAKr AFL • Terms apply.
      </p>
    </main>
  );
}
