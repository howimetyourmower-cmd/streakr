// /app/components/NavBar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Go Pick", href: "/picks" },
  { label: "Leaderboards", href: "/leaderboards" },
  { label: "How to Play", href: "/how-to-play" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    // Hide current route from list (keeps drawer clean)
    return NAV_ITEMS.filter((i) => i.href !== pathname);
  }, [pathname]);

  // lock body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header
        className="sticky top-0 z-[60] w-full"
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid rgba(0,0,0,0.10)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex h-[74px] items-center justify-between gap-3">
            {/* LOGO (bigger + consistent) */}
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl"
              style={{ textDecoration: "none" }}
              aria-label="Torpie Home"
            >
              <div
                className="relative"
                style={{
                  width: 168, // desktop-ish
                  height: 44,
                }}
              >
                <Image
                  src="/Torpielogo.png"
                  alt="TORPIE"
                  fill
                  priority
                  sizes="(max-width: 640px) 150px, 168px"
                  style={{ objectFit: "contain" }}
                />
              </div>

              {/* optional wordmark fallback if image ever fails */}
              <span className="sr-only">TORPIE</span>
            </Link>

            {/* RIGHT ACTIONS */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/picks"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] sm:text-[13px] font-black"
                style={{
                  background: "linear-gradient(180deg, rgba(255,46,77,0.98) 0%, rgba(255,46,77,0.78) 100%)",
                  color: "#FFFFFF",
                  boxShadow: "0 12px 28px rgba(255,46,77,0.22)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  textDecoration: "none",
                  letterSpacing: "0.5px",
                }}
              >
                GO PICK
              </Link>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-[44px] w-[56px] items-center justify-center rounded-full"
                aria-label="Open menu"
                style={{
                  background: "rgba(0,0,0,0.06)",
                  border: "1px solid rgba(0,0,0,0.10)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16" stroke="rgba(0,0,0,0.85)" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M4 12h16" stroke="rgba(0,0,0,0.85)" strokeWidth="2.4" strokeLinecap="round" />
                  <path d="M4 17h16" stroke="rgba(0,0,0,0.85)" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DRAWER */}
      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => setOpen(false)}
            style={{ background: "rgba(0,0,0,0.55)" }}
          />

          {/* Panel */}
          <div
            className="absolute right-0 top-0 h-full w-[86%] max-w-[360px] p-4"
            style={{
              background: "#0A0A0A",
              borderLeft: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "-25px 0 80px rgba(0,0,0,0.65)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="relative" style={{ width: 168, height: 44 }}>
                <Image
                  src="/Torpielogo.png"
                  alt="TORPIE"
                  fill
                  priority={false}
                  sizes="168px"
                  style={{ objectFit: "contain", filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.45))" }}
                />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-full"
                aria-label="Close menu"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-5 rounded-2xl border p-3" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
              <Link
                href="/picks"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,46,77,0.98) 0%, rgba(255,46,77,0.78) 100%)",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontWeight: 900,
                  letterSpacing: "0.5px",
                }}
              >
                <span>GO PICK</span>
                <span style={{ opacity: 0.9 }}>→</span>
              </Link>

              <div className="mt-3 space-y-2">
                {items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-[14px] font-semibold"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.92)",
                      textDecoration: "none",
                    }}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-4 text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              TORPIE © 2026
            </div>
          </div>
        </div>
      )}
    </>
  );
}
