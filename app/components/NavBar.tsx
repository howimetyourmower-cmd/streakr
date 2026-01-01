// /components/Navbar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import { usePathname } from "next/navigation";

type MinimalUserDoc = {
  avatarUrl?: string;
  username?: string;
};

const TORPIE_RED = "#CE2029";

export default function Navbar() {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [profileDoc, setProfileDoc] = useState<MinimalUserDoc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileDoc(null);
      return;
    }

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const d = snap.data() as any;
        setProfileDoc({
          avatarUrl: d.avatarUrl ?? "",
          username: d.username ?? "",
        });
      } catch (e) {
        console.error("Navbar: Failed to load user profile", e);
      }
    };

    load();
  }, [user]);

  const currentAvatarSrc = useMemo(() => {
    if (profileDoc?.avatarUrl) return profileDoc.avatarUrl;
    if (user?.photoURL) return user.photoURL;
    return "/default-avatar.png";
  }, [profileDoc?.avatarUrl, user?.photoURL]);

  const avatarInitial = useMemo(() => {
    if (profileDoc?.username) return profileDoc.username[0].toUpperCase();
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "T";
  }, [profileDoc?.username, user?.displayName, user?.email]);

  const label =
    profileDoc?.username || user?.displayName || user?.email || "Torpie";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const linkClass = (href: string) =>
    `transition-colors ${
      isActive(href)
        ? "text-[var(--torpie-red)]"
        : "text-black hover:text-[var(--torpie-red)]"
    }`;

  return (
    <header
      className="w-full border-b border-black/10 bg-white"
      style={{ ["--torpie-red" as any]: TORPIE_RED }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        {/* LOGO (LEFT) - keep height, increase width */}
        <Link href="/" className="flex items-center min-w-0">
          {/* Height stays the same, width grows with screen but is capped.
              This prevents pushing the right nav off-screen. */}
          <div className="relative h-[80px] w-[320px] sm:h-[80px] sm:w-[420px] md:w-[460px] lg:w-[520px] max-w-[60vw]">
            <Image
              src="/Torpielogo.png"
              alt="Torpie"
              fill
              priority
              className="object-contain object-centre origin-right-top scale-[1.28]"
              sizes="(max-width: 768px) 60vw, 520px"
            />
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/picks" className={linkClass("/picks")}>
            Picks
          </Link>
          <Link href="/leaderboards" className={linkClass("/leaderboards")}>
            Leaderboards
          </Link>
          <Link href="/locker-room" className={linkClass("/locker-room")}>
            Locker Room
          </Link>
          <Link
            href="/venue-locker-rooms"
            className={linkClass("/venue-locker-rooms")}
          >
            Venue Locker Rooms
          </Link>
          <Link href="/rewards" className={linkClass("/rewards")}>
            Rewards
          </Link>
          <Link href="/faq" className={linkClass("/faq")}>
            FAQ
          </Link>

          {/* PROFILE */}
          <Link
            href={user ? "/profile" : "/auth"}
            className="flex items-center gap-2 text-black"
          >
            <div className="h-8 w-8 rounded-full overflow-hidden border border-black/15 bg-black/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentAvatarSrc}
                alt={label}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs font-bold">{avatarInitial}</span>
            </div>
            <span className="text-xs max-w-[120px] truncate">{label}</span>
          </Link>
        </div>

        {/* MOBILE MENU BUTTON */}
        <div className="md:hidden">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded border border-black/20 px-3 py-2"
            aria-label="Open menu"
          >
            <div className="space-y-[5px]">
              <span className="block h-[2px] w-5 bg-black" />
              <span className="block h-[2px] w-5 bg-black" />
              <span className="block h-[2px] w-5 bg-black" />
            </div>
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="md:hidden border-t border-black/10 bg-white">
          <div className="px-4 py-4 flex flex-col gap-4 text-sm">
            {[
              ["/picks", "Picks"],
              ["/leaderboards", "Leaderboards"],
              ["/locker-room", "Locker Room"],
              ["/venue-locker-rooms", "Venue Locker Rooms"],
              ["/rewards", "Rewards"],
              ["/faq", "FAQ"],
            ].map(([href, txt]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={linkClass(href)}
              >
                {txt}
              </Link>
            ))}

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-black/15 bg-black/5 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentAvatarSrc}
                    alt={label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <span className="text-xs font-bold">{avatarInitial}</span>
                </div>
                <span className="text-xs max-w-[160px] truncate text-black">
                  {label}
                </span>
              </div>

              <Link
                href={user ? "/profile" : "/auth"}
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-black/20 px-4 py-2 text-xs hover:border-[var(--torpie-red)] hover:text-[var(--torpie-red)]"
              >
                {user ? "Profile" : "Login"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
