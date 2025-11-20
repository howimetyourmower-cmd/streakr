// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import NavBar from "./components/NavBar";
import SponsorBanner from "./components/SponsorBanner"; // ⬅️ make sure this path/name matches your file

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

        {/* SPONSOR BANNER – SHOWS ON EVERY PAGE */}
        <div className="border-b border-zinc-800 bg-zinc-900/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-zinc-200">
            <SponsorBanner />
          </div>
        </div>

        {/* PAGE CONTENT */}
        <main className="bg-black w-full">{children}</main>
      </body>
    </html>
  );
}
