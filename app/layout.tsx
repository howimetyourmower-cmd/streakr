// app/layout.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// must match the actual file name (singular)
import "./globals.css";

// use relative paths (no "@")
import Toast from "./components/Toast";
import FreeKickWatcher from "./components/FreeKickWatcher";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "Free-to-play AFL prediction streaks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f13] text-white antialiased">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/streakrlogo.jpg"
                alt="STREAKr"
                width={36}
                height={36}
                priority
                className="rounded"
              />
              <span className="text-xl font-extrabold tracking-wide">
                STREAK<span className="text-orange-400">r</span>
              </span>
            </Link>

            <nav className="flex items-center gap-6 text-sm">
              <Link href="/picks" className="hover:text-orange-300">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-300">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-300">Rewards</Link>
              <Link href="/faq" className="hover:text-orange-300">FAQ</Link>
              <Link href="/auth" className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">
                Login / Sign Up
              </Link>
            </nav>
          </div>
        </header>

        {/* Page */}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

        {/* Global helpers */}
        <Toast />
        <FreeKickWatcher />
      </body>
    </html>
  );
}
