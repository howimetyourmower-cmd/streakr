"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function HeaderNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const isLoggedIn = !!user;
  const avatarUrl = (user as any)?.photoURL || "/default-avatar.png";
  const displayName = (user as any)?.displayName || "Player";

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
          <img
            src="/streakrlogo.jpg"
            alt="STREAKr logo"
            className="h-14 w-auto rounded-md object-contain"
          />
          <span className="text-xl font-bold tracking-wide">
            STREAK<span className="lowercase text-orange-500">r</span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/picks" className="hover:text-orange-400">Picks</Link>
          <Link href="/leaderboards" className="hover:text-orange-400">Leaderboards</Link>
          <Link href="/leagues" className="hover:text-orange-400">Leagues</Link>
          <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
          <Link href="/faq" className="hover:text-orange-400">FAQ</Link>

          <div className="ml-4 flex items-center gap-3">
            {!isLoggedIn && (
              <>
                <Link
                  href="/auth"
                  className="px-3 py-1.5 text-xs rounded-full border border-white/20 hover:border-orange-400"
                >
                  Login / Sign up
                </Link>

                <Link
                  href="/profile"
                  className="px-3 py-1.5 text-xs rounded-full bg-orange-500 text-black font-semibold"
                >
                  Profile
                </Link>
              </>
            )}

            {isLoggedIn && (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5"
              >
                <img
                  src={avatarUrl}
                  className="h-7 w-7 rounded-full object-cover border border-white/30"
                />
                <span className="max-w-[100px] truncate">{displayName}</span>
              </Link>
            )}
          </div>
        </nav>

        {/* MOBILE BURGER */}
        <button
          onClick={toggleMobile}
          className="md:hidden border border-white/20 px-2.5 py-2 rounded-md"
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-5 bg-current rounded-full" />
            <span className="block h-0.5 w-5 bg-current rounded-full" />
            <span className="block h-0.5 w-5 bg-current rounded-full" />
          </div>
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#050816]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-3 text-sm">

            <Link href="/picks" onClick={closeMobile}>Picks</Link>
            <Link href="/leaderboards" onClick={closeMobile}>Leaderboards</Link>
            <Link href="/leagues" onClick={closeMobile}>Leagues</Link>
            <Link href="/rewards" onClick={closeMobile}>Rewards</Link>
            <Link href="/faq" onClick={closeMobile}>FAQ</Link>

            <div className="pt-2 flex flex-col gap-2">
              {!isLoggedIn && (
                <>
                  <Link href="/auth" onClick={closeMobile} className="text-center border border-white/20 rounded-full px-3 py-1.5">Login / Sign up</Link>
                  <Link href="/profile" onClick={closeMobile} className="text-center bg-orange-500 text-black rounded-full px-3 py-1.5">Profile</Link>
                </>
              )}

              {isLoggedIn && (
                <Link href="/profile" onClick={closeMobile} className="flex items-center justify-center gap-2 bg-orange-500 text-black rounded-full px-3 py-1.5">
                  <img src={avatarUrl} className="h-6 w-6 rounded-full border border-black/20" />
                  <span>Profile</span>
                </Link>
              )}
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
