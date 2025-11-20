// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import HeaderNav from "./app/components/HeaderNav";

export const metadata: Metadata = {
  title: "STREAKr",
  description: "STREAKr – AFL streak prediction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-black">
      <body className="min-h-screen bg-black text-white antialiased">
        {/* GLOBAL NAVBAR */}
        <NavBar />

        {/* PAGE CONTENT */}
        <main className="w-full bg-black">{children}</main>
      </body>
    </html>
  );
}
