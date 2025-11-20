"use client";

import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import MobileNav from "app/components/MobileNav";
import { useAuth } from "@/hooks/useAuth";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – AFL streak prediction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const avatarUrl =
    user?.photoURL ||
    "/default-avatar.png"; // fallback but now only when user has no photoURL

  const avatarInitial =
    user?.displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">

        {/* NAVBAR */}
        <header className="w-full border-b border-white/10 bg-black">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">

            {/* LOGO (DOUBLE SIZE) */}
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
              <Link href="/picks" className="hover:text-orange-400">Picks</Link>
              <Link href="/leaderboards" className="hover:text-orange-400">Leaderboards</Link>
              <Link href="/leagues" className="hover:text-orange-400">Leagues</Link>
              <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
              <Link href="/faq" className="hover:text-orange-400">FAQ</Link>

              {/* PROFILE + AVATAR */}
              <Link href="/profile" className="flex items-center gap-2">

                {/* REAL AVATAR IF LOGGED IN */}
                {user && user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="Avatar"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover border border-slate-700"
                  />
                ) : user ? (
                  // FALLBACK WITH INITIAL
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-700 text-xs font-bold">
                    {avatarInitial}
                  </div>
                ) : (
                  // LOGGED OUT DEFAULT AVATAR
                  <Image
                    src="/default-avatar.png"
                    alt="Avatar"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full border border-slate-700"
                  />
                )}

                <span className="text-xs">
                  {user?.displayName ?? "Player"}
                </span>
              </Link>
            </div>

            {/* MOBILE NAV */}
            <div className="md:hidden">
              <MobileNav user={user} avatarUrl={avatarUrl} avatarInitial={avatarInitial} />
            </div>
          </nav>
        </header>

        {/* PAGE CONTENT */}
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
