// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import NavBar from "./components/NavBar";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – Streak prediction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">

        {/* NAVIGATION */}
        <NavBar />

        {/* GLOBAL SPONSOR BANNER – BLUE/YELLOW LIKE SPORTSBET */}
        <div className="bg-gradient-to-r from-sky-800 via-sky-600 to-sky-700 border-b border-sky-400/30 shadow-[0_0_40px_rgba(56,189,248,0.25)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">

            {/* Left badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-3 py-[3px] text-[10px] font-bold uppercase tracking-wide text-sky-900 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-900" />
              Official Partner
            </div>

            {/* Middle text */}
            <p className="flex-1 text-right text-[12px] font-semibold text-white md:text-[13px]">
              Proudly supporting STREAK<span className="text-yellow-300">r</span> all season long
            </p>

            {/* Optional CTA button */}
            <button className="hidden md:inline-flex rounded-full bg-yellow-300 px-3 py-[5px] text-[11px] font-bold text-sky-900 hover:bg-yellow-200 transition">
              Learn more
            </button>

          </div>
        </div>

        {/* PAGE CONTENT */}
        <main className="bg-black w-full">
          {children}
        </main>

      </body>
    </html>
  );
}
