"use client";

import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode, useState } from "react";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "Keep your streak alive – sports prediction game.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  return (
    <html lang="en">
      <body className="bg-[#050816] text-white min-h-screen">
        {/* Top nav / header */}
        <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            {/* Logo + brand */}
            <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
              <img
                src="/streakrlogo.jpg"
                alt="STREAKr logo"
                className="h-14 w-auto rounded-md object-contain"
              />
              <span className="text-xl font-bold tracking-wide">
                STREAK<span className="lowercase text-orange-500">r</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8 text-sm">
              <Link
                href="/picks"
                className="hover:text-orange-400 transition-colors"
              >
                Picks
              </Link>

              <Link
                href="/leaderboards"
                className="hover:text-orange-400 transition-colors"
              >
                Leaderboards
              </Link>

              <Link
                href="/leagues"
                className="hover:text-orange-400 transition-colors"
              >
                Leagues
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

              {/* Right-hand auth / profile buttons */}
              <div className="ml-4 flex items-center gap-3">
                <Link
                  href="/auth"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-400 transition-colors"
                >
                  Login / Sign up
                </Link>
                <Link
                  href="/profile"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold transition-colors"
                >
                  Profile
                </Link>
              </div>
            </nav>

            {/* Mobile burger */}
            <button
              type="button"
              onClick={toggleMobile}
              className="md:hidden inline-flex items-center justify-center rounded-md border border-white/20 px-2.5 py-2 text-white hover:border-orange-400 hover:text-orange-400 transition-colors"
              aria-label="Toggle navigation"
            >
              <span className="sr-only">Open main menu</span>
              <div className="space-y-1.5">
                <span className="block h-0.5 w-5 bg-current rounded-full" />
                <span className="block h-0.5 w-5 bg-current rounded-full" />
                <span className="block h-0.5 w-5 bg-current rounded-full" />
              </div>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/10 bg-[#050816]">
              <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-3 text-sm">
                <Link
                  href="/picks"
                  onClick={closeMobile}
                  className="py-1 hover:text-orange-400 transition-colors"
                >
                  Picks
                </Link>
                <Link
                  href="/leaderboards"
                  onClick={closeMobile}
                  className="py-1 hover:text-orange-400 transition-colors"
                >
                  Leaderboards
                </Link>
                <Link
                  href="/leagues"
                  onClick={closeMobile}
                  className="py-1 hover:text-orange-400 transition-colors"
                >
                  Leagues
                </Link>
                <Link
                  href="/rewards"
                  onClick={closeMobile}
                  className="py-1 hover:text-orange-400 transition-colors"
                >
                  Rewards
                </Link>
                <Link
                  href="/faq"
                  onClick={closeMobile}
                  className="py-1 hover:text-orange-400 transition-colors"
                >
                  FAQ
                </Link>

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href="/auth"
                    onClick={closeMobile}
                    className="w-full text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-orange-400 hover:text-orange-400 transition-colors text-center"
                  >
                    Login / Sign up
                  </Link>
                  <Link
                    href="/profile"
                    onClick={closeMobile}
                    className="w-full text-xs px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold transition-colors text-center"
                  >
                    Profile
                  </Link>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* SPORTS BET–STYLE SPONSOR BANNER */}
        <div className="border-b border-black/20 bg-[#005AC8]">
          <div className="max-w-7xl mx-auto px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* LEFT SIDE — Faux sponsor logo / text */}
            <div className="flex items-center gap-2">
              <div className="bg-[#003F8A] px-2 py-1 rounded-md flex items-center shadow-sm">
                <span className="text-[#FFD200] text-xs font-extrabold tracking-wide">
                  SPONSOR
                </span>
              </div>

              <span className="text-white font-semibold text-sm sm:text-base">
                Proudly backed by our official partner
              </span>
            </div>

            {/* RIGHT SIDE — Disclaimer */}
            <span className="text-white/80 text-[10px] sm:text-xs font-medium text-right">
              Free game of skill • No gambling • 18+ only
            </span>
          </div>
        </div>

        {/* Page content */}
        <main className="pt-4 pb-12">
          <div className="max-w-7xl mx-auto px-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
