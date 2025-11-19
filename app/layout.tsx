// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import MobileNav from "app/components/MobileNav";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – AFL streak prediction game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">

        {/* NAVBAR */}
        <header className="w-full border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

            {/* LOGO (DOUBLE SIZE) */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/streakrlogo.jpg"
                alt="STREAKr"
                className="h-12 w-auto"
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

            {/* MOBILE NAV */}
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
