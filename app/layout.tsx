import "./globals.css";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  const isLoggedIn = !!user;
  const avatarUrl = (user as any)?.photoURL || "/default-avatar.png";
  const displayName = (user as any)?.displayName || "Player";

  return (
    <html lang="en">
      <body className="bg-[#050816] text-white min-h-screen">
        {/* ---------- HEADER ---------- */}
        <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            {/* LOGO */}
            <Link
              href="/"
              className="flex items-center gap-3"
              onClick={closeMobile}
            >
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
              <Link
                href="/picks"
                className="hover:text-orange-400 transition-colors"
              >
                Picks
              </Link>

              <Link
                href="/leaderboards"
                className="hover:text-orange-400 transition-colors"
              >
                Leaderboards
              </Link>

              <Link
                href="/leagues"
                className="hover:text-orange-400 transition-colors"
              >
                Leagues
              </Link>

              <Link
                href="/rewards"
                className="hover:text-orange-400 transition-colors"
              >
                Rewards
              </Link>

              <Link
                h
