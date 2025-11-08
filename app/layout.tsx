import "./../src/app/globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Streakr AFL",
  description: "One pick. One streak. Win the round."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-white">
        <header className="border-b border-white/10">
          <div className="container h-16 flex items-center justify-between">
            <Link href="/" className="font-extrabold tracking-tight text-xl">
              STREAKR <span className="text-streakr-orange">AFL</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/leaderboard" className="hover:text-streakr-orange">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-streakr-orange">Rewards</Link>
              <a href="/api/diag-admin" className="hover:text-streakr-orange">Check Backend</a>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-10 py-8 border-t border-white/10">
          <div className="container text-xs text-white/50 flex items-center justify-between">
            <div>© {new Date().getFullYear()} Streakr</div>
            <div className="flex gap-3">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
