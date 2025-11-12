import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import ToastHost from "@/components/Toast";
import FreeKickWatcher from "@/components/FreeKickWatcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STREAKr",
  description: "AFL prediction streaks — build your streak, win prizes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0b0f13] text-white antialiased`}>
        <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center space-x-2">
              <img
                src="/streakrlogo.jpg"
                alt="STREAKr"
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex space-x-6 text-sm font-medium">
              <Link href="/picks">Picks</Link>
              <Link href="/leaderboard">Leaderboards</Link>
              <Link href="/rewards">Rewards</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/login">Login / Sign Up</Link>
            </nav>
          </div>
        </header>

        <main className="min-h-screen">{children}</main>

        {/* Global components */}
        <FreeKickWatcher />
        <ToastHost />
      </body>
    </html>
  );
}
