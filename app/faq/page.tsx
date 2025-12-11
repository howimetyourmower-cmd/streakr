// /app/faq/page.tsx
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
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-zinc-50">
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:pb-24 md:pt-16">
        {/* HERO */}
        <header className="mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
            </span>
            Help centre
          </div>

          <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
                Frequently asked questions
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">
                New to STREAK<span className="text-orange-500">r</span>? Start
                here. If you can&apos;t find what you&apos;re looking for, hit
                us up using the contact form at the bottom of the page.
              </p>
            </div>

            {/* Quick nav */}
            <nav className="flex flex-wrap gap-2 text-[11px] md:text-xs">
              {[
                { href: "#getting-started", label: "Getting started" },
                { href: "#picks", label: "Picks & streak rules" },
                { href: "#prizes", label: "Prizes & rewards" },
                { href: "#leagues", label: "Private leagues" },
                { href: "#accounts", label: "Accounts & security" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-zinc-700/80 bg-zinc-900/70 px-3 py-1 font-medium text-zinc-200 transition hover:border-orange-500 hover:text-orange-300"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)] md:gap-12">
          {/* LEFT – FAQ CONTENT */}
          <div className="space-y-8 md:space-y-10">
            {/* Getting started */}
            <section
              id="getting-started"
              className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-zinc-800/80 bg-gradient-to-r from-orange-500/15 via-transparent to-transparent px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Getting started
                </h2>
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  The basics of creating an account and jumping into your first
                  streak.
                </p>
              </div>
              <div className="space-y-5 px-5 py-5 text-sm text-zinc-200 md:px-6 md:py-6 md:text-base">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How do I create a STREAKr account?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Click <span className="font-semibold">Player</span> in the
                    top navigation, then choose{" "}
                    <span className="font-semibold">Sign up</span>. You&apos;ll
                    need a valid email address, a password and a username.
                    We&apos;ll send you a verification email so we know
                    you&apos;re real.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    Is STREAKr free to play?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Yes. STREAKr is a{" "}
                    <span className="font-semibold">free game of skill</span>.
                    There are no entry fees and no betting. We may award prizes
                    to top streaks as advertised on the Rewards page.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    Is there an age restriction?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    STREAKr is for{" "}
                    <span className="font-semibold">18+ only</span>. By creating
                    an account you confirm you are at least 18 years old.
                  </p>
                </div>
              </div>
            </section>

            {/* Picks & streak rules */}
            <section
              id="picks"
              className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-zinc-800/80 bg-gradient-to-r from-sky-500/15 via-transparent to-transparent px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Picks &amp; streak rules
                </h2>
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  How questions work, how many picks you can make, and how your
                  streak is calculated.
                </p>
              </div>
              <div className="space-y-5 px-5 py-5 text-sm text-zinc-200 md:px-6 md:py-6 md:text-base">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How do the questions work?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Each question is a{" "}
                    <span className="font-semibold">Yes / No prediction</span>{" "}
                    about a real AFL event – for example a player stat or a
                    match outcome in a specific quarter.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How many picks can I make?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    You can make{" "}
                    <span className="font-semibold">
                      as many picks as you like
                    </span>{" "}
                    on any{" "}
                    <span className="font-semibold">unlocked match</span>. On
                    the Picks page you&apos;ll see which matches are open or
                    closed for picks. If a match is marked{" "}
                    <span className="font-semibold">Match closed for picks</span>
                    , you can&apos;t change or add picks on those questions.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    Can I change or clear a pick?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Yes. For any question in a match that is still{" "}
                    <span className="font-semibold">open for picks</span> you
                    can switch from YES to NO, or clear your selection completely
                    using the{" "}
                    <span className="font-semibold">Clear selection</span>{" "}
                    option (the small × icon next to your pick). Once the match
                    is closed for picks, your choices on those questions are
                    locked in.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    When do matches lock for picks?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Match locks are controlled by the STREAKr admin team. A
                    match will show as{" "}
                    <span className="font-semibold">Match closed for picks</span>{" "}
                    shortly before the bounce or a key cutoff time. Once
                    locked, you can&apos;t add, change or clear picks for any
                    question in that match.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How is my streak calculated now?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Your streak is a simple run of{" "}
                    <span className="font-semibold">consecutive correct picks</span>.
                    Every time a question you&apos;ve answered settles as{" "}
                    <span className="font-semibold">correct</span>, your{" "}
                    <span className="font-semibold">current streak</span>{" "}
                    increases by 1. A single incorrect pick{" "}
                    <span className="font-semibold">resets your streak to 0</span>.
                    Void questions do not affect your streak either way.
                  </p>
                  <p className="mt-2 text-sm text-zinc-400 md:text-[15px]">
                    On the Picks page you&apos;ll see a{" "}
                    <span className="font-semibold">streak tracker</span> at the
                    top, showing your current streak for the round and how close
                    you are to streak badges and rewards.
                  </p>
                </div>
              </div>
            </section>

            {/* Prizes & rewards */}
            <section
              id="prizes"
              className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-zinc-800/80 bg-gradient-to-r from-emerald-500/15 via-transparent to-transparent px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Prizes &amp; rewards
                </h2>
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  What you can win and how we decide the legends.
                </p>
              </div>
              <div className="space-y-5 px-5 py-5 text-sm text-zinc-200 md:px-6 md:py-6 md:text-base">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    What can I win on STREAKr?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Prize details are listed on the{" "}
                    <span className="font-semibold">Rewards</span> page. For
                    example, we may advertise a cash or voucher prize pool for
                    the best streaks in a given round, or additional prizes for
                    sponsor promotions.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How are winners decided?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    At the end of a round we look at the{" "}
                    <span className="font-semibold">top current streaks</span>{" "}
                    for that round. If multiple players finish on the same top
                    streak, the advertised prize pool for that round is{" "}
                    <span className="font-semibold">
                      split between all tied players
                    </span>{" "}
                    (for example, evenly divided vouchers or cash amounts).
                    Exact details and examples will be listed on the Rewards
                    page.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    What is a sponsored question?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    From time to time you&apos;ll see a question marked as a{" "}
                    <span className="font-semibold">Sponsor Question</span>. If
                    you make a pick on that question and it settles correctly,
                    you may go into a{" "}
                    <span className="font-semibold">
                      separate sponsor prize draw
                    </span>{" "}
                    (for example, a gift card or major prize) as advertised on
                    the Rewards page and in the question banner.
                  </p>
                </div>
              </div>
            </section>

            {/* Private leagues */}
            <section
              id="leagues"
              className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-zinc-800/80 bg-gradient-to-r from-purple-500/20 via-transparent to-transparent px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Private leagues
                </h2>
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  Play with your crew on your own ladder (and still climb the
                  global one).
                </p>
              </div>
              <div className="space-y-5 px-5 py-5 text-sm text-zinc-200 md:px-6 md:py-6 md:text-base">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    What is a private league?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Private leagues let you play STREAKr with your mates, work
                    crew or fantasy league on your own ladder. Your streak still
                    counts towards the global leaderboard at the same time.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How do I create or join a league?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Go to the <span className="font-semibold">Leagues</span>{" "}
                    page. Create a league to become the League Manager and share
                    the invite code. If you have a code from a mate, use the{" "}
                    <span className="font-semibold">Join with a code</span>{" "}
                    option.
                  </p>
                </div>
              </div>
            </section>

            {/* Accounts & security */}
            <section
              id="accounts"
              className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-[0_0_40px_rgba(0,0,0,0.6)]"
            >
              <div className="border-b border-zinc-800/80 bg-gradient-to-r from-zinc-500/30 via-transparent to-transparent px-5 py-4 md:px-6">
                <h2 className="text-lg font-semibold md:text-xl">
                  Accounts, email &amp; security
                </h2>
                <p className="mt-1 text-xs text-zinc-400 md:text-sm">
                  Keeping your account, password and emails under control.
                </p>
              </div>
              <div className="space-y-5 px-5 py-5 text-sm text-zinc-200 md:px-6 md:py-6 md:text-base">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    I didn&apos;t receive my verification email.
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Check your{" "}
                    <span className="font-semibold">
                      spam / junk / promotions
                    </span>{" "}
                    folder and search for STREAKr. You can also log in and
                    request a new verification email from the Player area. To
                    help avoid spam filtering, add our from-address to your
                    contacts and mark the email as &quot;Not spam&quot;.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How do I reset my password?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    On the Log in tab, click{" "}
                    <span className="font-semibold">Forgot password</span> and
                    follow the instructions. We&apos;ll send a reset link to
                    your registered email.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-50 md:text-base">
                    How do I update my profile details?
                  </h3>
                  <p className="mt-1 text-sm text-zinc-400 md:text-[15px]">
                    Go to the <span className="font-semibold">Player</span> page
                    while logged in. From there you can update your suburb,
                    state, favourite team, avatar and more. Some fields like
                    username, date of birth and email are locked for security
                    reasons.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT – CONTACT + SPONSOR */}
          <aside className="space-y-4 md:space-y-6">
            {/* Intro box */}
            <div className="rounded-2xl border border-orange-500/50 bg-gradient-to-br from-orange-500/20 via-zinc-900 to-zinc-950 p-5 md:p-6 shadow-[0_0_40px_rgba(248,113,113,0.35)]">
              <h2 className="text-lg font-semibold md:text-xl">
                Still need help?
              </h2>
              <p className="mt-2 text-sm text-zinc-100/80 md:text-[15px]">
                Use the form below to send the STREAKr team a message about
                account issues, feedback, bug reports or sponsorship enquiries.
              </p>
              <p className="mt-3 rounded-xl bg-black/40 px-3 py-2 text-xs text-orange-100/90">
                Tip: include your browser, device and any error messages if
                you&apos;re reporting a bug. It helps us squash it faster.
              </p>
            </div>

            {/* Contact form */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 md:p-6 shadow-[0_0_40px_rgba(0,0,0,0.7)]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Your name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-black/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/40 focus:border-orange-400 focus:ring-2"
                      placeholder="e.g. Simon and username"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Your email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-black/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/40 focus:border-orange-400 focus:ring-2"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    What&apos;s this about?
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ContactCategory)
                    }
                    className="w-full rounded-md border border-zinc-700 bg-black/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/40 focus:border-orange-400 focus:ring-2"
                  >
                    <option value="general">General question / feedback</option>
                    <option value="account">Account or login issue</option>
                    <option value="prizes">Prizes &amp; rewards</option>
                    <option value="bugs">Bug or technical issue</option>
                    <option value="sponsorship">
                      Sponsorship / partnership
                    </option>
                    <option value="other">Something else</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Your message *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full rounded-md border border-zinc-700 bg-black/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-orange-500/40 focus:border-orange-400 focus:ring-2"
                    placeholder="Tell us what’s happening."
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    {success}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Sending..." : "Send message"}
                  </button>
                  <p className="max-w-[220px] text-right text-[11px] text-zinc-500">
                    We aim to respond as soon as possible during AFL season.
                  </p>
                </div>
              </form>
            </div>

            {/* BLUE SPONSOR BANNER */}
            <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-sky-500 to-sky-600 p-[1px] shadow-[0_0_40px_rgba(56,189,248,0.35)]">
              <div className="flex flex-col gap-4 rounded-2xl bg-sky-600/90 px-4 py-4 md:flex-row md:items-center md:px-6 md:py-5">
                {/* Text side */}
                <div className="flex-1">
                  <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-900" />
                    Official partner
                  </div>
                  <h3 className="mt-2 text-xl font-extrabold leading-tight text-white md:text-2xl">
                    Boost the banter,
                    <span className="block text-yellow-300">
                      power up your streak nights.
                    </span>
                  </h3>
                  <p className="mt-2 max-w-md text-xs text-sky-100 md:text-sm">
                    Our featured partner helps bring more stats, more prizes and
                    more fun match-day moments to STREAKr players all season
                    long.
                  </p>

                  <button className="mt-3 inline-flex items-center rounded-full bg-yellow-300 px-4 py-2 text-xs font-semibold text-sky-900 transition hover:bg-yellow-200 md:text-sm">
                    Learn more about our partner
                  </button>
                </div>

                {/* Right: mock image / phone area */}
                <div className="flex items-center justify-center md:w-40">
                  <div className="relative h-28 w-20 rotate-2 rounded-2xl bg-white/95 shadow-[0_10px_25px_rgba(15,23,42,0.5)]">
                    <div className="absolute inset-1 rounded-xl bg-sky-50/90 p-1 text-[8px] text-sky-900">
                      <div className="mb-1 flex items-center justify-between text-[7px] font-semibold">
                        <span>Tonight</span>
                        <span className="rounded-full bg-sky-600 px-1 py-[1px] text-[7px] text-white">
                          LIVE
                        </span>
                      </div>
                      <div className="h-[52px] rounded-md bg-gradient-to-br from-sky-200 to-sky-50" />
                      <div className="mt-1 space-y-[2px]">
                        <div className="flex items-center justify-between text-[7px]">
                          <span className="font-semibold">Streak tracker</span>
                          <span className="text-green-600 font-bold">✔</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-sky-200">
                          <div className="h-1.5 w-2/3 rounded-full bg-sky-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
