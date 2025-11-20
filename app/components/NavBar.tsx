"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function NavBar() {
  const { user, profile } = useAuth() as any;

  // Try profile avatar first (like your Profile page), then Firebase photoURL, then default
  const avatarUrl: string =
    profile?.avatarUrl ||
    user?.photoURL ||
    "/default-avatar.png";

  const displayName: string =
    profile?.username ||
    user?.displayName ||
    user?.email ||
    "Player";

  const avatarInitial: string =
    displayName?.trim()?.[0]?.toUpperCase() ?? "P";

  return (
    <header className="w-full border-b border-white/10 bg-black">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* LOGO (double size) */}
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

          {/* PROFILE + AVATAR */}
          <Link href="/profile" className="flex items-center gap-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-700 text-xs font-bold">
                {avatarInitial}
              </div>
            )}

            <span className="text-xs truncate max-w-[120px]">
              {displayName}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
