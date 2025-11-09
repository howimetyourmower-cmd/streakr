import type { Metadata } from "next";
import "./global.css";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "STREAKr AFL",
  description: "Build your streak. Win the round.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f13] text-white antialiased">
        <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/streakrlogo.jpg" alt="STREAKr AFL" width={200} height={200} className="h-3 w-auto" />
              <span className="text-xl font-extrabold tracking-wide">
                STREAK<span className="text-orange-500">r</span> AFL
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="/faq" className="hover:text-orange-400">FAQ</Link>
              <Link href="/auth" className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
                Login / Sign Up
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
