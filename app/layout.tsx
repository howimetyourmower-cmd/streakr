// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – AFL streak prediction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">
        {/* GLOBAL NAVBAR */}
        <header className="w-full border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            {/* LEFT: LOGO */}
            <Link href="/" className="flex items-center gap-2">
              {/* Uses /public/streakrlogo.jpg */}
              <img
                src="/streakrlogo.jpg"
                alt="STREAKr"
                className="h-6 w-auto"
              />
              <span className="font-bold text-xl tracking-tight">
                STREAK<span className="text-orange-400">r</span>
              </span>
            </Link>

            {/* RIGHT: NAV LINKS + AVATAR */}
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

              <Link href="/profile" className="flex items-center gap-2">
                {/* Uses /public/default-avatar.png */}
                <img
                  src="/default-avatar.png"
                  alt="Player avatar"
                  className="h-6 w-6 rounded-full border border-slate-700"
                />
                <span className="text-xs">Player</span>
              </Link>
            </div>
          </nav>
        </header>

        {/* PAGE CONTENT */}
        {/* If you had extra providers (AuthProvider, Toaster, etc.),
            wrap <main> or {children} with them here. */}
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
