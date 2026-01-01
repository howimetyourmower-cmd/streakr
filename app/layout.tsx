// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Torpie",
  description: "Torpie – Streak prediction game",
};

// NOTE: Your Navbar file is /components/Navbar.tsx (capital N, no extra folder)
// so the import should be "../components/Navbar" from app/layout.tsx.
const NavBar = dynamic(() => import("../components/Navbar"), {
  ssr: false,
  loading: () => (
    <div className="h-[52px] w-full border-b border-black/10 bg-white" />
  ),
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-[#0d1117]">
      <body className="min-h-screen bg-[#0d1117] text-white antialiased">
        {/* NAVIGATION */}
        <NavBar />

        {/* COMPACT GLOBAL SPONSOR BANNER (LOW HEIGHT) */}
        <div className="border-b border-white/10 bg-gradient-to-r from-sky-900 via-sky-700 to-sky-800 shadow-[0_0_40px_rgba(56,189,248,0.18)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1 sm:py-1">
            {/* Left badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-2.5 py-[2px] text-[9px] font-black uppercase tracking-wide text-sky-950 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-950" />
              Official Partner
            </div>

            {/* Middle text */}
            <p className="flex-1 text-right text-[11px] font-semibold text-white/95 sm:text-[12px]">
              Proudly supporting TORPIE all season long
            </p>

            {/* Optional CTA button */}
            <button className="hidden md:inline-flex rounded-full bg-yellow-300 px-3 py-[4px] text-[10px] font-black text-sky-950 hover:bg-yellow-200 transition">
              Learn more
            </button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <main className="w-full bg-[#0d1117]">{children}</main>
      </body>
    </html>
  );
}
