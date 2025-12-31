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

// Fire engine red (matches Torpie palette)
const FIRE_RED = "#CE2029";

export default function Navbar() {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [profileDoc, setProfileDoc] = useState<MinimalUserDoc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // 🔹 Keep local auth state inside Navbar (do NOT rely on useAuth)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsub();
  }, []);

  // 🔹 Load avatar + username from Firestore
  useEffect(() => {
    if (!user) {
      setProfileDoc(null);
      return;
    }

    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;

        const data = snap.data() as any;
        setProfileDoc({
          avatarUrl: data.avatarUrl ?? "",
          username: data.username ?? "",
        });
      } catch (err) {
        console.error("Navbar: Failed to load user profile", err);
      }
    };

    loadProfile();
  }, [user]);

  // 🔹 Avatar src: Firestore avatar → Auth photoURL → default
  const currentAvatarSrc = useMemo(() => {
    if (profileDoc?.avatarUrl) return profileDoc.avatarUrl;
    if (user?.photoURL) return user.photoURL;
    return "/default-avatar.png";
  }, [profileDoc?.avatarUrl, user?.photoURL]);

  // 🔹 Avatar fallback initial
  const avatarInitial = useMemo(() => {
    if (profileDoc?.username) return profileDoc.username[0].toUpperCase();
    if (user?.displayName) return user.displayName[0].toUpperCase();
    if (user?.email) return user.email[0].toUpperCase();
    return "P";
  }, [profileDoc?.username, user?.displayName, user?.email]);

  const label =
    profileDoc?.username || user?.displayName || (user?.email ?? "Torpie");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Keep one place to control active/hover red
  const linkClass = (href: string) =>
    isActive(href) ? "text-[var(--torpie-red)]" : "hover:text-[var(--torpie-red)]";

  return (
    <header
      className="w-full border-b border-white/10 bg-black"
      style={{ ["--torpie-red" as any]: FIRE_RED }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-9 w-[132px] sm:h-10 sm:w-[150px]">
            <Image
              src="/Torpielogo.png"
              alt="Torpie"
              fill
              priority
              className="object-contain"
              sizes="150px"
            />
          </div>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8 text-sm text-white/90">
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

          {/* AVATAR + NAME */}
          <Link
            href={user ? "/profile" : "/auth"}
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentAvatarSrc}
                alt={label}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs font-bold text-white/85">
                {avatarInitial}
              </span>
            </div>
            <span className="text-xs truncate max-w-[120px]">{label}</span>
          </Link>
        </div>

        {/* MOBILE BURGER */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded border border-white/20 px-3 py-2"
            aria-label="Open menu"
          >
            <div className="space-y-[5px]">
              <span className="block h-[2px] w-5 bg-white" />
              <span className="block h-[2px] w-5 bg-white" />
              <span className="block h-[2px] w-5 bg-white" />
            </div>
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="md:hidden bg-black/95 border-t border-white/10">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4 text-sm text-white/90">
            <Link
              href="/picks"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/picks")}
            >
              Picks
            </Link>

            <Link
              href="/leaderboards"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/leaderboards")}
            >
              Leaderboards
            </Link>

            <Link
              href="/locker-room"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/locker-room")}
            >
              Locker Room
            </Link>

            <Link
              href="/venue-locker-rooms"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/venue-locker-rooms")}
            >
              Venue Locker Rooms
            </Link>

            <Link
              href="/rewards"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/rewards")}
            >
              Rewards
            </Link>

            <Link
              href="/faq"
              onClick={() => setMenuOpen(false)}
              className={linkClass("/faq")}
            >
              FAQ
            </Link>

            {/* MOBILE PROFILE */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center">
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
                  <span className="text-xs font-bold text-white/85">
                    {avatarInitial}
                  </span>
                </div>
                <span className="text-xs truncate max-w-[140px]">{label}</span>
              </div>

              <Link
                href={user ? "/profile" : "/auth"}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-1 rounded-full border border-white/20 text-xs transition-colors hover:border-[var(--torpie-red)] hover:text-[var(--torpie-red)]"
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
