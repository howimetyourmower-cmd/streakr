"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import Link from "next/link";
import Image from "next/image";

type MobileNavProps = {
  user: User | null;
  avatarUrl: string;
  avatarInitial: string;
};

export default function MobileNav({
  user,
  avatarUrl,
  avatarInitial,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  return (
    <>
      {/* BURGER BUTTON */}
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white"
        aria-label="Toggle navigation"
      >
        <span className="sr-only">Toggle navigation</span>
        <div className="space-y-1">
          <span className="block h-0.5 w-5 bg-white" />
          <span className="block h-0.5 w-5 bg-white" />
          <span className="block h-0.5 w-5 bg-white" />
        </div>
      </button>

      {/* SLIDE-OUT PANEL */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/70" onClick={close}>
          <div
            className="ml-auto flex h-full w-72 flex-col bg-[#020617] border-l border-white/10 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER / USER */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={close}
                className="text-sm text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-6 flex items-center gap-3">
              {user ? (
                avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Avatar"
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center border border-slate-700 text-xs font-bold">
                    {avatarInitial}
                  </div>
                )
              ) : (
                <Image
                  src="/default-avatar.png"
                  alt="Avatar"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border border-slate-700"
                />
              )}

              <div className="flex flex-col">
                <span className="text-xs text-gray-300">
                  {user ? "Logged in as" : "Welcome to STREAKr"}
                </span>
                <span className="text-sm font-semibold">
                  {user?.displayName ?? "Player"}
                </span>
              </div>
            </div>

            {/* NAV LINKS */}
            <nav className="flex flex-col gap-3 text-sm">
              <Link href="/picks" onClick={close} className="hover:text-orange-400">
                Picks
              </Link>
              <Link
                href="/leaderboards"
                onClick={close}
                className="hover:text-orange-400"
              >
                Leaderboards
              </Link>
              <Link href="/leagues" onClick={close} className="hover:text-orange-400">
                Leagues
              </Link>
              <Link href="/rewards" onClick={close} className="hover:text-orange-400">
                Rewards
              </Link>
              <Link href="/faq" onClick={close} className="hover:text-orange-400">
                FAQ
              </Link>
              <Link href="/profile" onClick={close} className="hover:text-orange-400">
                Profile
              </Link>
            </nav>

            {/* FOOTER */}
            <div className="mt-auto pt-4 text-[11px] text-gray-500">
              STREAKr is a free game of skill. No gambling. 18+ only.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
