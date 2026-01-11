// /app/components/NavBar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import MobileNav from "./MobileNav";

type NavItem = { href: string; label: string };

const LOGO_SRC = "/joose-logo.png"; // confirmed

export default function NavBar() {
  const items: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/picks", label: "Picks" },
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/locker-room", label: "Locker Rooms" },
      { href: "/profile", label: "Profile" },
    ],
    []
  );

  return (
    <header className="sticky top-0 z-[80] w-full border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* LEFT: LOGO */}
        <Link
          href="/"
          aria-label="Joose Home"
          className="flex items-center"
          style={{ textDecoration: "none" }}
        >
          <div className="relative h-[80px] w-[200px]">
            <Image
              src={LOGO_SRC}
              alt="Joose"
              fill
              priority
              className="object-contain object-center"
            />
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-xl px-3 py-2 text-[14px] font-black text-black/80 hover:text-black hover:bg-black/5"
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

        {/* MOBILE: GO PICK + BURGER */}
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
