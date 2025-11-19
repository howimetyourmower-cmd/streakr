"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* BURGER BUTTON */}
      <button
        className="md:hidden flex flex-col gap-[3px] p-2 rounded-md bg-slate-800"
        onClick={() => setOpen(true)}
      >
        <span className="w-6 h-[3px] bg-white rounded"></span>
        <span className="w-6 h-[3px] bg-white rounded"></span>
        <span className="w-6 h-[3px] bg-white rounded"></span>
      </button>

      {/* DRAWER */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="w-64 bg-[#0F0F0F] border-l border-white/10 p-6 flex flex-col gap-6">

            <button
              className="text-white text-right mb-4"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>

            <Link href="/picks" className="text-white text-lg" onClick={() => setOpen(false)}>Picks</Link>
            <Link href="/leaderboards" className="text-white text-lg" onClick={() => setOpen(false)}>Leaderboards</Link>
            <Link href="/leagues" className="text-white text-lg" onClick={() => setOpen(false)}>Leagues</Link>
            <Link href="/rewards" className="text-white text-lg" onClick={() => setOpen(false)}>Rewards</Link>
            <Link href="/faq" className="text-white text-lg" onClick={() => setOpen(false)}>FAQ</Link>

            <Link
              href="/profile"
              className="flex items-center gap-3 mt-6"
              onClick={() => setOpen(false)}
            >
              <img
                src="/default-avatar.png"
                alt="Avatar"
                className="h-10 w-10 rounded-full border border-slate-700"
              />
              <span className="text-white text-lg">Player</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
