/* app/faq/page.tsx */
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate =0;

export const metadata = {
  title: "FAQ • STREAKr AFL",
};

export default function FAQPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24">
      {/* Title */}
      <div className="pt-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-orange-500 tracking-tight">
          Frequently Asked Questions
        </h1>
      </div>

      {/* Sponsor banner */}
      <div className="mt-6 mb-8">
        <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-6 text-center text-white/70 shadow-lg">
          Sponsor Banner • 970×90
        </div>
      </div>

      {/* Content */}
      <div className="space-y-10 text-white/90">
        <Section title="What is STREAKr?">
          <p>
            STREAKr is a free-to-play AFL prediction game. Make simple{" "}
            <strong>Yes/No</strong> picks on live questions for each match and
            build the longest <strong>winning streak</strong>. Longest streaks win prizes.
          </p>
        </Section>

        <Section title="How do I play?">
          <ol className="list-decimal ml-5 space-y-2 text-white/80">
            <li>Go to <Link href="/picks" className="text-orange-400 underline">Make Picks</Link>.</li>
            <li>Select a question and choose <strong>Yes</strong> or <strong>No</strong>.</li>
            <li>Your streak increases by +1 for each correct pick and resets to 0 on a loss.</li>
            <li>You can have only one active pick at a time per question.</li>
          </ol>
        </Section>

        <Section title="Who can play?">
          <ul className="list-disc ml-5 space-y-2 text-white/80">
            <li>Players must be <strong>18+</strong>.</li>
            <li>One account per person. Duplicate or fraudulent accounts may be removed.</li>
          </ul>
        </Section>

        <Section title="What counts as my current streak?">
          <p className="text-white/80">
            Your <strong>current streak</strong> is consecutive wins without a loss. If a pick is{" "}
            <strong>void</strong> (e.g., match abandoned or question invalid), your streak{" "}
            <strong>does not change</strong>.
          </p>
        </Section>

        <Section title="What is my longest streak?">
          <p className="text-white/80">
            The best streak you’ve ever achieved this season (or for the selected round on the leaderboard).
          </p>
        </Section>

        <Section title="When do picks lock?">
          <p className="text-white/80">
            Each question locks at the displayed start time (AEST/AEDT). Once locked, you can’t change the pick.
          </p>
        </Section>

        <Section title="How are questions settled?">
          <ul className="list-disc ml-5 space-y-2 text-white/80">
            <li>
              For now, questions are settled manually by our admins after official stats are confirmed.
            </li>
            <li>
              Statuses: <strong>Open</strong> → <strong>Pending</strong> (awaiting result) →{" "}
              <strong>Final</strong> / <strong>Void</strong>.
            </li>
          </ul>
        </Section>

        <Section title="Leaderboards & prizes">
          <ul className="list-disc ml-5 space-y-2 text-white/80">
            <li>
              <strong>Round leaderboard:</strong> Longest current streak during the round wins the advertised prize.
              If multiple players tie on longest streak, the tiebreakers are:
              <ol className="list-decimal ml-6 mt-2 space-y-1">
                <li>Best current streak (higher wins).</li>
                <li>Best longest streak (season/round best).</li>
                <li>Fewest total picks.</li>
              </ol>
            </li>
            <li>
              Prize pools are split equally among tied winners after tiebreakers, unless otherwise stated.
            </li>
            <li>
              <Link href="/leaderboard" className="text-orange-400 underline">View Leaderboards</Link>
            </li>
          </ul>
        </Section>

        <Section title="What does “Current Pick” mean on Leaderboards?">
          <p className="text-white/80">
            Shows whether you currently have a selection in play: <strong>Pick Selected</strong> or <strong>No Pick</strong>.
          </p>
        </Section>

        <Section title="Can I restart my streak after a loss?">
          <p className="text-white/80">
            Yes—just make another pick. Your streak restarts at 0 after any loss.
          </p>
        </Section>

        <Section title="Do percentages on picks matter?">
          <p className="text-white/80">
            The Yes/No percentages display how other players are picking. They’re community sentiment, not odds.
          </p>
        </Section>

        <Section title="Fair play">
          <ul className="list-disc ml-5 space-y-2 text-white/80">
            <li>No scripts, bots, or automation.</li>
            <li>One account per person.</li>
            <li>We may review and remove results that breach rules.</li>
          </ul>
        </Section>

        <Section title="Notifications">
          <p className="text-white/80">
            Email and in-app reminders may be used for lock times, results, and updates (you can toggle preferences in your account when available).
          </p>
        </Section>

        <Section title="Data & privacy">
          <p className="text-white/80">
            We store your display name, avatar (optional), and gameplay stats. We do not sell personal data.
          </p>
        </Section>

        <Section title="Troubleshooting">
          <ul className="list-disc ml-5 space-y-2 text-white/80">
            <li>Hard refresh the page (Ctrl/Cmd + Shift + R).</li>
            <li>Ensure you’re logged in if you can’t make a pick.</li>
            <li>If a time shows “TBD”, the fixture is missing a valid start time.</li>
          </ul>
        </Section>

        <Section title="Contact us">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = "mailto:support@streakr.afl?subject=STREAKr%20Support%20Request";
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="rounded-lg bg-white/10 text-white placeholder-white/50 px-3 py-2 border border-white/10 focus:outline-none"
                  placeholder="Your name"
                />
                <input
                  className="rounded-lg bg-white/10 text-white placeholder-white/50 px-3 py-2 border border-white/10 focus:outline-none"
                  placeholder="Email address"
                  type="email"
                />
              </div>
              <textarea
                rows={4}
                className="rounded-lg bg-white/10 text-white placeholder-white/50 px-3 py-2 border border-white/10 focus:outline-none"
                placeholder="How can we help?"
              />
              <button
                type="submit"
                className="inline-flex justify-center rounded-xl bg-orange-500 text-black font-semibold px-4 py-2 hover:bg-orange-400"
              >
                Send
              </button>
            </form>
          </div>
        </Section>
      </div>
    </main>
  );
}

/* ---------- Small helper for orange-titled sections ---------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl md:text-2xl font-bold text-orange-500 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
