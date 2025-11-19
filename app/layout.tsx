// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { useState } from "react";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – AFL streak prediction game",
};

// A small client component inside layout for mobile toggle
function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* BURGER BUTTON */}
      <button
        className="md:hidden flex flex-col gap-[3px] p-2 rounded-md bg-slate-800"
        onClick={() => setOpen(true)}
      >
        <span className="w-6 h-[3px] bg-white rounded"></span>
        <span className="w-6 h-[3px] bg-white rounded"></span>
        <span className="w-6 h-[3px] bg-white rounded"></span>
      </button>

      {/* MOBILE DRAWER */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="w-64 bg-[#0F0F0F] border-l border-white/10 p-6 flex flex-col gap-6">

            {/* CLOSE BUTTON */}
            <button
              className="text-white text-right mb-4"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>

            <Link
              href="/picks"
              className="text-white text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              Picks
            </Link>

            <Link
              href="/leaderboards"
              className="text-white text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              Leaderboards
            </Link>

            <Link
              href="/leagues"
              className="text-white text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              Leagues
            </Link>

            <Link
              href="/rewards"
              className="text-white text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              Rewards
            </Link>

            <Link
              href="/faq"
              className="text-white text-lg font-semibold"
              onClick={() => setOpen(false)}
            >
              FAQ
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-3 mt-6"
              onClick={() => setOpen(false)}
            >
              <img
                src="/default-avatar.png"
                alt="Avatar"
                className="h-10 w-10 rounded-full border border-slate-700"
              />
              <span className="text-white text-lg font-semibold">Player</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">
        {/* NAVBAR */}
        <header className="w-full border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

            {/* LEFT LOGO (DOUBLE SIZE) */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/streakrlogo.jpg"
                alt="STREAKr"
                className="h-12 w-auto"  // DOUBLE SIZE
              />
              <span className="font-bold text-3xl tracking-tight">
                STREAK<span className="text-orange-400">r</span>
              </span>
            </Link>

            {/* DESKTOP NAV */}
            <div className="hidden md:flex items-center gap-8 text-sm">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboards" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/leagues" className="hover:text-orange-400">Leagues</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="/faq" className="hover:text-orange-400">FAQ</Link>

              <Link href="/profile" className="flex items-center gap-2">
                <img
                  src="/default-avatar.png"
                  alt="Avatar"
                  className="h-8 w-8 rounded-full border border-slate-700"
                />
                <span className="text-xs">Player</span>
              </Link>
            </div>

            {/* MOBILE NAV BURGER */}
            <div className="md:hidden">
              <MobileNav />
            </div>
          </nav>
        </header>

        {/* PAGE CONTENT */}
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
