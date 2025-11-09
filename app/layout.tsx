// app/layout.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "../src/app/globals.css";

export const metadata: Metadata = {
  title: "STREAKr AFL",
  description: "Free-to-play AFL prediction streaks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f13] text-white antialiased">
        <header className="sticky top-0 z-40 w-full bg-[#0b0f13]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/streakrlogo.jpg"   // in /public
                alt="STREAKr AFL"
                width={180}
                height={180}
                priority
                className="h-12 w-auto md:h-16" // make bigger: increase to h-20 if you like
              />
              <span className="text-xl md:text-2xl font-extrabold tracking-wide">
                STREAK<span className="text-orange-500">r</span> AFL
              </span>
            </Link>

            <nav className="flex items-center gap-6 text-sm md:text-base">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="/how-to-play" className="hover:text-orange-400">How to Play</Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
