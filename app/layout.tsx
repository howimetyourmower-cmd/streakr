// /app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SCREAMR",
  description: "SCREAMR – Streak prediction game",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
