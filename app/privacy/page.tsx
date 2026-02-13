// /app/privacy/page.tsx
import Link from "next/link";

export const dynamic = "force-static";

const BRAND_BG = "#000000";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen text-white" style={{ background: BRAND_BG }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm text-white/70">
              Here’s what we collect, why we collect it, and how you can control it.
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
          <h2 className="text-lg font-black">1) What we collect</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>Account details (email, username, name) to create and manage your account.</li>
            <li>Profile details you provide (DOB, suburb, state, phone, team preference).</li>
            <li>Game activity (your picks, streaks, rankings) to run SCREAMR.</li>
            <li>Comments you post and related metadata (timestamps).</li>
            <li>Basic technical info (device/browser info, logs) to keep the site secure and working.</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">2) Why we collect it</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>To provide the Service (logins, picks, leaderboards, settlement).</li>
            <li>To prevent fraud and enforce rules (duplicate accounts, bots, abuse).</li>
            <li>To contact you about important account/service updates.</li>
            <li>If you opt in: to send SCREAMR news, tips, promos, and prize updates.</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">3) Marketing opt-in</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            If you opt in to marketing, you can opt out any time (we’ll provide a simple way, like an unsubscribe link or an in-app toggle).
          </p>

          <h2 className="mt-6 text-lg font-black">4) Who we share it with</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We use trusted providers to run SCREAMR (for example, hosting and database services). We don’t sell your personal info.
            We may disclose information if required by law or to protect the Service from fraud/abuse.
          </p>

          <h2 className="mt-6 text-lg font-black">5) Data storage &amp; security</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We take reasonable steps to protect your information, but no system is perfect. Keep your password secure and don’t reuse it elsewhere.
          </p>

          <h2 className="mt-6 text-lg font-black">6) How long we keep it</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            We keep your information for as long as needed to run SCREAMR and meet legal/security obligations. You can request deletion (subject to any legal requirements).
          </p>

          <h2 className="mt-6 text-lg font-black">7) Your choices</h2>
          <ul className="mt-2 space-y-2 text-sm text-white/75 leading-relaxed list-disc pl-5">
            <li>You can update some profile fields inside your account (where available).</li>
            <li>You can opt out of marketing any time.</li>
            <li>You can request access or deletion of your information (subject to verification).</li>
          </ul>

          <h2 className="mt-6 text-lg font-black">8) Contact</h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            For privacy requests, contact us via the details published on the website (or add your support email here).
          </p>

          <div className="mt-6 text-sm text-white/70">
            Also read our{" "}
            <Link href="/terms" className="underline text-white/90">
              Terms &amp; Conditions
            </Link>
            .
          </div>
        </div>
      </div>
    </main>
  );
}
