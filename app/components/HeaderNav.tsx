"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

export default function HeaderNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const isLoggedIn = !!user;

  const avatarUrl =
    profileAvatarUrl ||
    (user as any)?.avatarUrl ||
    (user as any)?.photoURL ||
    "/default-avatar.png";

  const displayName =
    profileName ||
    (user as any)?.username ||
    (user as any)?.displayName ||
    "Player";

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) {
        setProfileAvatarUrl(null);
        setProfileName(null);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as any;
          setProfileAvatarUrl(data.avatarUrl || null);
          setProfileName(data.username || null);
        }
      } catch (err) {
        console.error("Failed to load header profile", err);
      }
    };

    loadProfile();
  }, [user?.uid]);

  return (
    <header className="border-b border-white/10 bg-[#050816]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
          <img
            src="/streakrlogo.jpg"
            alt="STREAKr logo"
            className="h-14 w-auto rounded-md object-contain"
          />
          <span className="text-xl font-bold tracking-wide">
            STREAK<span className="lowercase text-orange-500">r</span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/picks" className="hover:text-orange-400 transition-colors">
            Picks
          </Link>

          <Link href="/leaderboards" className="hover:text-orange-400 transition-colors">
            Leaderboards
          </Link>

          <Link href="/leagues" className="hover:text-orange-400 transition-colors">
            Leagues
          </Link>

          <Link href="/rewards" className="hover:text-orange-400 transition-colors">
            Rewards
          </Link>

          <Link href="/faq" className="hover:text-orange-400 transition-colors">
            FAQ
          </Link>

          <div className="ml-4 flex items-center gap-3">
            {!isLoggedIn && (
              <>
                <Link
                  href="/auth"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-white/20 
                  hover:border-orange-400 hover:text-orange-400 transition-colors"
                >
                  Login / Sign up
                </Link>

                <Link
                  href="/profile"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-orange-500 
                  hover:bg-orange-400 text-black font-semibold transition-colors"
                >
                  Profile
                </Link>
              </>
            )}

            {isLoggedIn && (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 
                px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-100 hover:bg-white/10 transition-colors"
              >
                <div className="h-7 w-7 rounded-full overflow-hidden border border-white/30 bg-black">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="max-w-[120px] truncate">
                  {displayName}
                </span>
              </Link>
            )}
          </div>
        </nav>

        {/* MOBILE BURGER */}
        <button
          type="button"
          onClick={toggleMobile}
          className="md:hidden inline-flex items-center justify-center rounded-md border 
          border-white/20 px-2.5 py-2 text-white hover:border-orange-400 hover:text-orange-400 
          transition-colors"
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-5 bg-current rounded-full" />
            <span className="block h-0.5 w-5 bg-current rounded-full" />
            <span className="block h-0.5 w-5 bg-current rounded-full" />
          </div>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#050816]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-3 text-sm">
            <Link href="/picks" onClick={closeMobile} className="py-1 hover:text-orange-400">
              Picks
            </Link>

            <Link href="/leaderboards" onClick={closeMobile} className="py-1 hover:text-orange-400">
              Leaderboards
            </Link>

            <Link href="/leagues" onClick={closeMobile} className="py-1 hover:text-orange-400">
              Leagues
            </Link>

            <Link href="/rewards" onClick={closeMobile} className="py-1 hover:text-orange-400">
              Rewards
            </Link>

            <Link href="/faq" onClick={closeMobile} className="py-1 hover:text-orange-400">
              FAQ
            </Link>

            <div className="pt-2 flex flex-col gap-2">
              {!isLoggedIn && (
                <>
                  <Link
                    href="/auth"
                    onClick={closeMobile}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/20 
                    hover:border-orange-400 hover:text-orange-400 text-center"
                  >
                    Login / Sign up
                  </Link>

                  <Link
                    href="/profile"
                    onClick={closeMobile}
                    className="text-xs px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 
                    text-black font-semibold text-center"
                  >
                    Profile
                  </Link>
                </>
              )}

              {isLoggedIn && (
                <Link
                  href="/profile"
                  onClick={closeMobile}
                  className="text-xs px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-400 
                  text-black font-semibold text-center flex items-center justify-center gap-2"
                >
                  <div className="h-6 w-6 rounded-full overflow-hidden border border-black/20 bg-black">
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span>Profile</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
