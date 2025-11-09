import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "STREAKr AFL",
  description: "One pick. One streak. Win the round.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800">
          <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between">
            <Link href="/" className="text-xl font-extrabold tracking-tight">
              <span className="text-zinc-200">STREAK</span>
              <span className="text-orange-500">r</span>
              <span className="ml-2 text-xs font-semibold text-orange-400">AFL</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboard" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="/faq" className="hover:text-orange-400">How to Play</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-zinc-800 text-center py-8 text-sm text-zinc-500">
          © {new Date().getFullYear()} STREAKr. Your Streak. Your Game. Your Glory.
        </footer>
      </body>
    </html>
  );
}
