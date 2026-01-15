// /app/components/NavBar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import MobileNav from "./MobileNav";

type NavItem = { href: string; label: string };

const LOGO_SRC = "/screamr/screamr-logo.png";

const COLORS = {
  border: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.88)",
  hoverBg: "rgba(255,255,255,0.06)",
  red: "#FF2E4D",
};

export default function NavBar() {
  const items: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Home" },
      { href: "/picks", label: "Picks" },
      { href: "/leaderboards", label: "Leaderboards" },
      { href: "/locker-room", label: "Locker Room" },
      { href: "/profile", label: "Profile" },
    ],
    []
  );

  return (
    <header
      className="sticky top-0 z-[80] w-full border-b"
      style={{
        borderColor: COLORS.border,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        {/* LOGO */}
        <Link
          href="/"
          aria-label="SCREAMR Home"
          className="flex items-center"
          style={{ textDecoration: "none" }}
        >
          <div
            className="
              relative
              h-[56px] w-[180px]
              md:h-[90px] md:w-[300px]
              lg:h-[100px] lg:w-[340px]
            "
          >
            <Image
              src={LOGO_SRC}
              alt="SCREAMR"
              fill
              priority
              className="object-contain object-left"
            />
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-xl px-3 py-2 text-[14px] font-black transition"
              style={{
                color: COLORS.text,
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.hoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {it.label}
            </Link>
          ))}

          <Link
            href="/picks"
            className="ml-2 inline-flex items-center justify-center rounded-2xl px-5 py-2 text-[12px] font-black text-white border"
            style={{
              borderColor: "rgba(255,46,77,0.35)",
              background:
                "linear-gradient(180deg, rgba(255,46,77,0.95), rgba(177,15,42,0.95))",
              boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
              textDecoration: "none",
            }}
          >
            GO PICK
          </Link>
        </nav>

        {/* MOBILE */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/picks"
            className="rounded-2xl px-3 py-2 text-[12px] font-black text-white"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,46,77,0.95), rgba(177,15,42,0.95))",
              textDecoration: "none",
            }}
          >
            GO PICK
          </Link>

          <MobileNav items={items} accent={COLORS.red} />
        </div>
      </div>
    </header>
  );
}
