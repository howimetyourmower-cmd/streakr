// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "Keep your streak alive – sports prediction game.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050816] text-white min-h-screen">
        {/* Top nav / header */}
        <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
            {/* Logo + brand */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/streakrlogo.jpg" // <= change to /Streakrlogo.jpg if needed
                alt="STREAKr logo"
                className="h-14 w-auto rounded-md object-contain"
              />
              <span className="text-xl font-bold tracking-wide">
                STREAK<span className="lowercase text-orange-500">r</span>
              </span>
            </Link>

            {/* Main nav links */}
            <nav className="flex items-center gap-8 text-sm">
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
          </div>
        </header>

        {/* Page content */}
        <main className="pt-4 pb-12">
          <div className="max-w-7xl mx-auto px-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
