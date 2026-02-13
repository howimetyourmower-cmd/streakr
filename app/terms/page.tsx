// /app/terms/page.tsx
import Link from "next/link";

export const dynamic = "force-static";

const BRAND_BG = "#000000";

export default function TermsPage() {
  return (
    <main className="min-h-screen text-white" style={{ background: BRAND_BG }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Terms &amp; Conditions</h1>
            <p className="mt-2 text-sm text-white/70">
              Friendly but clear rules for using SCREAMR. By creating an account or using the site, you agree to these Terms.
            </p>
            <p className="mt-2 text-xs text-white/45">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <Link
            href="/auth"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-black text-white/85 hover:bg-white/10"
            style={{ textDecoration: "none" }}
          >
            BACK TO SIGN UP
          </Link>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-black">1) Who we are</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            SCREAMR (“we”, “us”, “our”) provides a sports prediction game experience (the “Service”) via our website and
            related pages, features and tools.
          </p>

          <h2 className="mt-6 text-lg font-black">2) Eligibility (18+)</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            You must be at least 18 years old to create an account and use SCREAMR. By using SCREAMR, you confirm you’re 18+
            and that you can legally enter into this agreement.
          </p>

          <h2 className="mt-6 text-lg font-black">3) The game (how it works)</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>Each round is a new competition. Each match has a set of questions.</li>
            <li>You choose “YES” or “NO” on each question before the match locks (generally at bounce).</li>
            <li>If you get something wrong in a match, your streak for that match is cooked (game rules apply).</li>
            <li>Questions may be updated, corrected, voided, locked, or settled based on official outcomes or data quality.</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">4) Not gambling / no wagering</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            SCREAMR is not a wagering product. We don’t take bets on outcomes and we don’t hold funds on your behalf. If we run
            prizes or promotions, they are promotional competitions under these Terms and any specific promotion rules.
          </p>

          <h2 className="mt-6 text-lg font-black">5) Account rules</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>You’re responsible for your account and keeping your login secure.</li>
            <li>One person = one account (unless we explicitly allow otherwise).</li>
            <li>No bots, scripts, scraping, automated play, or attempts to manipulate leaderboards.</li>
            <li>We can require identity verification (reasonable proof) for prize claims or suspicious activity.</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">6) Fair play &amp; behaviour</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Keep it respectful. Don’t harass, abuse, dox, impersonate, or post illegal content. If you use comments, you agree
            your content won’t be defamatory, hateful, threatening, misleading, or spammy.
          </p>

          <h2 className="mt-6 text-lg font-black">7) Comments content</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>You own what you post, but you give us a licence to display it inside SCREAMR.</li>
            <li>We may remove content that breaks rules, creates risk, or ruins the vibe.</li>
            <li>Don’t share private info (yours or anyone else’s).</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">8) Prizes, promos and draws</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            If we run prizes, we’ll publish additional promo rules (dates, eligibility, how winners are decided, how to claim,
            etc.). Those promo rules form part of these Terms. If there’s a conflict, promo rules win for that promo.
          </p>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>We can verify winners before issuing prizes (including identity and eligibility).</li>
            <li>We may disqualify entries for fraud, manipulation, duplicate accounts, or rule breaches.</li>
            <li>Prizes aren’t transferable unless we say they are.</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">9) Data sources, scoring and errors</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We use match data to lock and settle questions. Sometimes data is delayed or wrong. If something breaks, we may:
            lock late, reopen, void a question, correct outcomes, or adjust settlement to keep things fair.
          </p>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Our decision on question settlement is final (unless we state otherwise).
          </p>

          <h2 className="mt-6 text-lg font-black">10) Service availability</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We aim to keep SCREAMR running, but outages happen. We’re not liable for downtime, delays, or failed submissions due
            to network, device or third-party issues.
          </p>

          <h2 className="mt-6 text-lg font-black">11) Intellectual property</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            SCREAMR branding, UI, text, and code are ours (or licensed to us). You can’t copy, resell, or use our brand without
            permission.
          </p>

          <h2 className="mt-6 text-lg font-black">12) Privacy</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We collect and use personal information as described in our{" "}
            <Link href="/privacy" className="underline text-white/90">
              Privacy Policy
            </Link>
            .
          </p>

          <h2 className="mt-6 text-lg font-black">13) Suspension / termination</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We can suspend or terminate accounts for rule breaches, suspected fraud, abuse, or to protect the Service and other
            players. You can stop using SCREAMR any time.
          </p>

          <h2 className="mt-6 text-lg font-black">14) Liability (plain English)</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            SCREAMR is provided “as is”. To the extent permitted by law, we exclude warranties and we’re not liable for indirect
            losses (lost profits, lost data, etc.). Nothing in these Terms limits your rights under Australian Consumer Law.
          </p>

          <h2 className="mt-6 text-lg font-black">15) Changes to these Terms</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We may update these Terms from time to time. If changes are material, we’ll try to make it obvious in the app/site.
            Continued use means you accept the updated Terms.
          </p>

          <h2 className="mt-6 text-lg font-black">16) Contact</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            Questions? Contact us via the details published on the website (or add your support email here).
          </p>
        </div>

        <div className="mt-6 text-xs text-white/50">
          Tip: put links to <span className="text-white/70 font-semibold">/terms</span> and{" "}
          <span className="text-white/70 font-semibold">/privacy</span> in your signup screen and (later) a footer.
        </div>
      </div>
    </main>
  );
}
