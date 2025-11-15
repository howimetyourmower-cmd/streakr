// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import SponsorBanner from "./components/SponsorBanner";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "AFL prediction streaks – build your streak, climb the ladder, win prizes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] text-white">
        <div className="min-h-screen flex flex-col">
          {/* TOP NAVBAR */}
          <header className="border-b border-white/5 bg-gradient-to-b from-black/80 via-black/60 to-transparent">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              {/* Logo / Brand */}
              <Link href="/" className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-gradient-to-tr from-orange-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                  S
                </div>
                <span className="text-lg font-extrabold tracking-wide">
                  STREAK<span className="text-orange-500">r</span>
                </span>
              </Link>

              {/* Nav links */}
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                <Link
                  href="/picks"
                  className="hover:text-orange-400 transition-colors"
                >
                  Picks
                </Link>
                <Link
                  href="/leaderboard"
                  className="hover:text-orange-400 transition-colors"
                >
                  Leaderboards
                </Link>
                <Link
                  href="/rewards"
                  className="hover:text-orange-400 transition-colors"
                >
                  Rewards
                </Link>
                <Link
                  href="/faq"
                  className="hover:text-orange-400 transition-colors"
                >
                  FAQ
                </Link>
                <Link
                  href="/auth"
                  className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10 transition-colors"
                >
                  Login / Sign Up
                </Link>
              </nav>
            </div>

            {/* SPONSOR BANNER – shows on ALL pages */}
            <SponsorBanner />
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1">
            {children}
          </main>

          {/* (Optional) Footer */}
          <footer className="border-t border-white/5 bg-black/80">
            <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-white/60 flex flex-col md:flex-row items-center justify-between gap-2">
              <span>© {new Date().getFullYear()} STREAKr. All rights reserved.</span>
              <span className="text-[11px]">
                Real Streakr&apos;s don&apos;t get caught!
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
