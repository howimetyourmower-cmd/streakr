// app/layout.tsx
import "../src/app/globals.css";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "STREAKr AFL",
  description: "One pick. One streak. Win the round.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f13] text-white antialiased">
        <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0b0f13]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/streakrlogo.jpg"
                alt="STREAKr AFL"
                width={150}
                height={40}
                priority
                className="h-8 w-auto"
              />
            </Link>

            <nav className="flex items-center gap-6 text-sm">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
