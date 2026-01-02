// /src/components/MobileNav.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NavItem = { href: string; label: string };

export default function MobileNav({
  items,
  accent = "#FF2E4D",
}: {
  items: NavItem[];
  accent?: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="md:hidden">
      {/* Burger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-xl border px-3 py-2"
        style={{
          borderColor: "rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.35)",
        }}
        aria-label="Open menu"
        aria-expanded={open}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Overlay */}
      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[90] cursor-default"
          style={{ background: "rgba(0,0,0,0.55)" }}
        />
      ) : null}

      {/* Panel */}
      <div
        className={`fixed left-0 right-0 top-0 z-[100] transition-transform duration-200 ${
          open ? "translate-y-0" : "-translate-y-[120%]"
        }`}
      >
        <div
          className="mx-3 mt-3 rounded-3xl border p-4 shadow-2xl"
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(10,10,10,0.96)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-white font-black text-[14px]">TORPIE</div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border px-3 py-2 text-[12px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              Close
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className="rounded-2xl border px-4 py-3 text-[14px] font-black"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.95)",
                  textDecoration: "none",
                }}
              >
                {it.label}
              </Link>
            ))}
          </div>

          <div
            className="mt-3 h-[10px] w-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accent} 0%, rgba(255,46,77,0.25) 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
