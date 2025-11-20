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

        {/* PAGE CONTENT */}
        <main className="bg-black w-full">{children}</main>

      </body>
    </html>
  );
}
