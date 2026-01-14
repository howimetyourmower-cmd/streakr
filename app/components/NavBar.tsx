// /app/components/NavBar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import MobileNav from "./MobileNav";

type NavItem = { href: string; label: string };

/**
 * ✅ Next/Image path rule:
 * Anything inside /public is referenced from the root.
 * So /public/screamr/screamr-logo.png => "/screamr/screamr-logo.png"
 */
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
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* subtle top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(255,46,77,0.55) 50%, rgba(0,0,0,0) 100%)",
          opacity: 0.55,
        }}
      />

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        {/* LEFT: LOGO */}
        <Link
          href="/"
          aria-label="SCREAMR Home"
          className="flex items-center"
          style={{ textDecoration: "none" }}
        >
          <div className="relative h-[52px] w-[170px] sm:h-[58px] sm:w-[190px]">
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
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="rounded-xl px-3 py-2 text-[13px] font-black transition"
              style={{
                textDecoration: "none",
                color: COLORS.text,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = COLORS.hoverBg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              {it.label}
            </Link>
          ))}

          <Link
            href="/picks"
            className="ml-2 inline-flex items-center justify-center rounded-2xl px-4 py-2 text-[12px] font-black text-white border transition active:scale-[0.99]"
            style={{
              borderColor: "rgba(255,46,77,0.35)",
              background:
                "linear-gradient(180deg, rgba(255,46,77,0.95) 0%, rgba(177,15,42,0.95) 100%)",
              boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
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
            className="inline-flex items-center justify-center rounded-2xl px-3 py-2 text-[12px] font-black text-white border active:scale-[0.99] transition"
            style={{
              borderColor: "rgba(255,46,77,0.35)",
              background:
                "linear-gradient(180deg, rgba(255,46,77,0.95) 0%, rgba(177,15,42,0.95) 100%)",
              boxShadow: "0 10px 26px rgba(255,46,77,0.18)",
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
