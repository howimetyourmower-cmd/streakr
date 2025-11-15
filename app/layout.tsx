// app/layout.tsx
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "Keep your streak alive with AFL picks.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#050816] text-white min-h-screen">
        <NavBar />
        <main className="pt-4">{children}</main>
      </body>
    </html>
  );
}
