// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "AFL streak prediction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">
        {/* NAVIGATION BAR */}
        <header className="w-full border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            {/* LEFT LOGO */}
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/streakrlogo1.jpg"
                alt="STREAKr"
                className="h-6 w-auto"
              />
              <span className="font-bold text-xl tracking-tight">
                STREAK<span className="text-orange-400">r</span>
              </span>
            </Link>

            {/* LINKS */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/picks" className="hover:text-orange-400">
                Picks
              </Link>
              <Link href="/leaderboards" className="hover:text-orange-400">
                Leaderboards
              </Link>
              <Link href="/leagues" className="hover:text-orange-400">
                Leagues
              </Link>
              <Link href="/rewards" className="hover:text-orange-400">
                Rewards
              </Link>
              <Link href="/faq" className="hover:text-orange-400">
                FAQ
              </Link>

              <Link
                href="/profile"
                className="rounded-full bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
              >
                Player
              </Link>
            </div>
          </nav>
        </header>

        {/* PAGE CONTENT */}
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
