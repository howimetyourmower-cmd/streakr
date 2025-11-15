// src/components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/picks", label: "Picks" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/rewards", label: "Rewards" },
  { href: "/faq", label: "FAQ" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo / home */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-md bg-orange-500 text-xs font-bold px-2 py-1">
            S
          </span>
          <span className="font-bold tracking-wide">STREAKr</span>
        </Link>

        {/* Links + auth */}
        <div className="flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "hover:text-orange-400 transition-colors " +
                (isActive(item.href)
                  ? "text-orange-400 font-semibold"
                  : "text-gray-200")
              }
            >
              {item.label}
            </Link>
          ))}

          {/* Right side: auth */}
          {!loading && (
            user ? (
              <Link
                href="/profile"
                className="ml-4 rounded-full bg-orange-500 hover:bg-orange-600 px-4 py-1.5 text-xs font-semibold"
              >
                Profile
              </Link>
            ) : (
              <Link
                href="/auth"
                className="ml-4 rounded-full border border-orange-500 px-4 py-1.5 text-xs font-semibold text-orange-400 hover:bg-orange-500/10"
              >
                Login / Sign Up
              </Link>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
