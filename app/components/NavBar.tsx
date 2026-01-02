// /app/components/NavBar.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import MobileNav from "./MobileNav";

type NavItem = { href: string; label: string };

export default function NavBar() {
  const items: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/picks", label: "Picks" },
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/locker-room", label: "Locker Room" },
      { href: "/account", label: "Account" },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-[80] w-full border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* Left: Brand */}
        <Link
          href="/"
          className="select-none text-[16px] font-black tracking-wide text-white"
          style={{ textDecoration: "none" }}
          aria-label="Torpie Home"
        >
          TORPIE
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-xl px-3 py-2 text-[12px] font-black text-white/90 hover:text-white"
              style={{ textDecoration: "none" }}
            >
              {it.label}
            </Link>
          ))}
          <Link
            href="/picks"
            className="ml-2 rounded-xl px-4 py-2 text-[12px] font-black text-white"
            style={{
              background: "#FF2E4D",
              textDecoration: "none",
            }}
          >
            GO PICK
          </Link>
        </nav>

        {/* Mobile burger (ALWAYS visible on mobile) */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/picks"
            className="rounded-xl px-3 py-2 text-[12px] font-black text-white"
            style={{ background: "#FF2E4D", textDecoration: "none" }}
          >
            GO PICK
          </Link>

          <MobileNav items={items} accent="#FF2E4D" />
        </div>
      </div>
    </header>
  );
}
