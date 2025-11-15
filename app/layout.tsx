// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import SponsorBanner from "./components/SponsorBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STREAKr",
  description: "Free-to-play AFL prediction streaks game.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#050816] text-white`}>
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#050816] via-[#050816] to-[#020617]">
          {/* Top nav */}
          <header className="border-b border-white/5 bg-gradient-to-b from-black/80 to-black/40 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
              {/* Logo / brand */}
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-pink-500 text-xs font-bold shadow-md">
                  S
                </div>
                <span className="text-xl font-semibold tracking-tight">
                  STREAK<span className="text-orange-500">r</span>
                </span>
              </Link>

              {/* Main nav */}
              <nav className="flex items-center gap-4 text-sm md:gap-6">
                <Link href="/picks" className="hover:text-orange-400">
                  Picks
                </Link>
                <Link href="/leaderboard" className="hover:text-orange-400">
                  Leaderboards
                </Link>
                <Link href="/rewards" className="hover:text-orange-400">
                  Rewards
                </Link>
                <Link href="/faq" className="hover:text-orange-400">
                  FAQ
                </Link>
                <Link
                  href="/auth"
                  className="rounded-full border border-white/15 px-3 py-1 text-xs md:text-sm hover:border-orange-500 hover:text-orange-400"
                >
                  Login / Sign Up
                </Link>
              </nav>
            </div>

            {/* Sponsor bar – shows on every page */}
            <SponsorBanner />
          </header>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-white/5 bg-black/70 py-4 text-center text-xs text-white/50">
            © 2026 STREAKr. All rights reserved.
          </footer>
        </div>
      </body>
    </html>
  );
}
