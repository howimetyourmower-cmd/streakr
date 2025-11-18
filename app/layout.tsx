import "./globals.css";
import type { ReactNode } from "react";
import HeaderNav from "./components/HeaderNav";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050816] text-white min-h-screen">
        {/* ---------- HEADER ---------- */}
        <HeaderNav />

        {/* ---------- SPONSOR BANNER ---------- */}
        <div className="border-b border-black/20 bg-[#005AC8]">
          <div className="max-w-7xl mx-auto px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#003F8A] px-2 py-1 rounded-md shadow-sm">
                <span className="text-[#FFD200] text-xs font-extrabold tracking-wide">
                  SPONSOR
                </span>
              </div>
              <span className="text-white font-semibold text-sm sm:text-base">
                Proudly backed by our official partner
              </span>
            </div>

            <span className="text-white/80 text-[10px] sm:text-xs font-medium">
              Free game of skill • No gambling • 18+ only
            </span>
          </div>
        </div>

        {/* ---------- CONTENT ---------- */}
        <main className="pt-4 pb-12">
          <div className="max-w-7xl mx-auto px-6">{children}</div>
        </main>
      </body>
    </html>
  );
}
