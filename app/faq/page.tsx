// app/faq/page.tsx
"use client";

import { FormEvent, useState } from "react";

type ContactCategory =
  | "general"
  | "account"
  | "prizes"
  | "bugs"
  | "sponsorship"
  | "other";

export default function FAQPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<ContactCategory>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }

    setSubmitting(true);

    // For now we just simulate success.
    // Later you can hook this up to an /api/contact endpoint or a tool like Formspree.
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(
        "Thanks for reaching out. We’ve received your message and will get back to you."
      );
      setName("");
      setEmail("");
      setMessage("");
      setCategory("general");
    }, 600);
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <header className="mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3">
            Frequently asked questions
          </h1>
          <p className="text-slate-300 max-w-2xl text-sm md:text-base">
            New to STREAK<span className="text-orange-500">r</span>? Start
            here. If you can&apos;t find what you&apos;re looking for, send us a
            message using the contact form at the bottom of this page.
          </p>
        </header>

        {/* FAQ sections */}
        <div className="space-y-8 md:space-y-10 mb-10 md:mb-14">
          {/* Getting started */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Getting started
            </h2>
            <div className="space-y-4 text-sm md:text-base text-slate-200">
              <div>
                <h3 className="font-semibold text-white">
                  How do I create a STREAKr account?
                </h3>
                <p className="text-slate-300">
                  Click <span className="font-semibold">Player</span> in the top
                  navigation, then choose <span className="font-semibold">
                    Sign up
                  </span>
                  . You&apos;ll need a valid email address, a password and a
                  username. We&apos;ll send you a verification email so we know
                  you&apos;re real.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  Is STREAKr free to play?
                </h3>
                <p className="text-slate-300">
                  Yes. STREAKr is a{" "}
                  <span className="font-semibold">free game of skill</span>.
                  There are no entry fees and no betting. We may award prizes to
                  top streaks as advertised on the Rewards page.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  Is there an age restriction?
                </h3>
                <p className="text-slate-300">
                  STREAKr is for{" "}
                  <span className="font-semibold">18+ only</span>. By creating
                  an account you confirm you are at least 18 years old.
                </p>
              </div>
            </div>
          </section>

          {/* Picks & streak rules */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Picks &amp; streak rules
            </h2>
            <div className="space-y-4 text-sm md:text-base text-slate-200">
              <div>
                <h3 className="font-semibold text-white">
                  How do the questions work?
                </h3>
                <p className="text-slate-300">
                  Each question is a{" "}
                  <span className="font-semibold">Yes / No prediction</span>{" "}
                  about a real AFL event – for example a player stat or a match
                  outcome in a specific quarter.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  What is a &quot;streak pick&quot;?
                </h3>
                <p className="text-slate-300">
                  At any time you can have{" "}
                  <span className="font-semibold">
                    exactly one active question
                  </span>{" "}
                  as your streak pick. On the Picks page you&apos;ll see a
                  highlight showing &quot;Your streak pick&quot; on the
                  question currently counting towards your streak.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  Can I change my pick?
                </h3>
                <p className="text-slate-300">
                  Yes – you can change your streak pick as many times as you
                  like <span className="font-semibold">until that question
                  locks</span>. When you switch to another question in the same
                  game, your previous one is no longer active and goes back to
                  0% / 0% for your personal pick stats.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  When do questions lock?
                </h3>
                <p className="text-slate-300">
                  Questions lock shortly before the relevant bounce / quarter
                  starts. Once locked, you can&apos;t change that pick. When the
                  outcome is known, the admin team (or automated stats feed)
                  settles the question as <span className="font-semibold">
                    YES
                  </span>
                  , <span className="font-semibold">NO</span> or{" "}
                  <span className="font-semibold">VOID</span>.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  How is my streak calculated?
                </h3>
                <p className="text-slate-300">
                  Every time your active streak pick settles as{" "}
                  <span className="font-semibold">correct</span>, your streak
                  increases by 1. A single incorrect streak pick resets your
                  streak back to 0. Void questions do not affect your streak.
                </p>
              </div>
            </div>
          </section>

          {/* Prizes & rewards */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Prizes &amp; rewards
            </h2>
            <div className="space-y-4 text-sm md:text-base text-slate-200">
              <div>
                <h3 className="font-semibold text-white">
                  What can I win on STREAKr?
                </h3>
                <p className="text-slate-300">
                  Prize details are listed on the{" "}
                  <span className="font-semibold">Rewards</span> page. For
                  example, we may advertise a cash or voucher prize pool for the
                  best streaks in a given round.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  How are winners decided?
                </h3>
                <p className="text-slate-300">
                  At the end of a round, we look at the{" "}
                  <span className="font-semibold">longest active streaks</span>.
                  Ties and any special sponsor promotions will be handled as
                  described on the Rewards page and in the game rules.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  What is a sponsored question?
                </h3>
                <p className="text-slate-300">
                  From time to time you may see a question marked as a{" "}
                  <span className="font-semibold">sponsor question</span>. If
                  you select that as your streak pick and it lands correct, you
                  may go into a separate draw (e.g. a gift card or promo prize)
                  as advertised on the question and Rewards page.
                </p>
              </div>
            </div>
          </section>

          {/* Private leagues */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Private leagues
            </h2>
            <div className="space-y-4 text-sm md:text-base text-slate-200">
              <div>
                <h3 className="font-semibold text-white">
                  What is a private league?
                </h3>
                <p className="text-slate-300">
                  Private leagues let you play STREAKr with your mates, work
                  crew or fantasy league on your own ladder. Your streak still
                  counts towards the global leaderboard at the same time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  How do I create or join a league?
                </h3>
                <p className="text-slate-300">
                  Go to the <span className="font-semibold">Leagues</span> page.
                  Create a league to become the League Manager and share the
                  invite code. If you have a code from a mate, use the{" "}
                  <span className="font-semibold">Join with a code</span> option.
                </p>
              </div>
            </div>
          </section>

          {/* Accounts & email */}
          <section>
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              Accounts, email &amp; security
            </h2>
            <div className="space-y-4 text-sm md:text-base text-slate-200">
              <div>
                <h3 className="font-semibold text-white">
                  I didn&apos;t receive my verification email.
                </h3>
                <p className="text-slate-300">
                  Check your <span className="font-semibold">
                    spam / junk / promotions
                  </span>{" "}
                  folder and search for STREAKr. You can also log in and request
                  a new verification email from the Player area. To help avoid
                  spam filtering, add our from-address to your contacts and mark
                  the email as &quot;Not spam&quot;.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  How do I reset my password?
                </h3>
                <p className="text-slate-300">
                  On the Log in tab, click{" "}
                  <span className="font-semibold">Forgot password</span> and
                  follow the instructions. We&apos;ll send a reset link to your
                  registered email.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white">
                  How do I update my profile details?
                </h3>
                <p className="text-slate-300">
                  Go to the <span className="font-semibold">Player</span> page
                  while logged in. From there you can update your suburb, state,
                  favourite team, avatar and more. Some fields like username,
                  date of birth and email are locked for security reasons.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* CONTACT US */}
        <section className="mb-12 md:mb-16">
          <div className="mb-4">
            <h2 className="text-xl md:text-2xl font-bold mb-2">
              Still need help? Contact us
            </h2>
            <p className="text-slate-300 text-sm md:text-base max-w-2xl">
              Use the form below to send the STREAKr team a message about
              account issues, feedback, bug reports or sponsorship enquiries.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 md:p-6 max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                    placeholder="e.g. Glenn"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  What&apos;s this about?
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ContactCategory)
                  }
                  className="w-full rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                >
                  <option value="general">General question / feedback</option>
                  <option value="account">Account or login issue</option>
                  <option value="prizes">Prizes &amp; rewards</option>
                  <option value="bugs">Bug or technical issue</option>
                  <option value="sponsorship">Sponsorship / partnership</option>
                  <option value="other">Something else</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-md bg-black/40 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                  placeholder="Tell us what’s happening, including any error messages or screenshots if relevant."
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
                  {success}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-6 py-2.5 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Sending..." : "Send message"}
                </button>
                <p className="text-[11px] text-slate-400 max-w-xs text-right">
                  We aim to respond as soon as possible during AFL season.
                </p>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
