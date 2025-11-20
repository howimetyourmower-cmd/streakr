"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

type MinimalUserDoc = {
  avatarUrl?: string;
  username?: string;
};

export default function Navbar() {
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
    profileDoc?.username || user?.displayName || (user?.email ?? "Player");

  return (
    <header className="w-full border-b border-white/10 bg-black">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/streakrlogo.jpg"
            alt="STREAKr"
            className="h-14 w-auto"
          />
          <span className="font-bold text-3xl tracking-tight">
            STREAK<span className="text-orange-400">r</span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8 text-sm">
          <Link href="/picks" className="hover:text-orange-400">Picks</Link>
          <Link href="/leaderboards" className="hover:text-orange-400">Leaderboards</Link>
          <Link href="/leagues" className="hover:text-orange-400">Leagues</Link>
          <Link href="/rewards" className="hover:text-orange-400">Rewards</Link>
          <Link href="/faq" className="hover:text-orange-400">FAQ</Link>

          {/* AVATAR + NAME */}
          <Link href={user ? "/profile" : "/auth"} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center">
              <img
                src={currentAvatarSrc}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
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
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-4 text-sm">
            <Link href="/picks" onClick={() => setMenuOpen(false)}>Picks</Link>
            <Link href="/leaderboards" onClick={() => setMenuOpen(false)}>Leaderboards</Link>
            <Link href="/leagues" onClick={() => setMenuOpen(false)}>Leagues</Link>
            <Link href="/rewards" onClick={() => setMenuOpen(false)}>Rewards</Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ</Link>

            {/* MOBILE PROFILE */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-white/20 bg-slate-800 flex items-center justify-center">
                  <img
                    src={currentAvatarSrc}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="text-xs truncate max-w-[120px]">{label}</span>
              </div>

              <Link
                href={user ? "/profile" : "/auth"}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-1 rounded-full border border-white/20 text-xs hover:border-orange-400 hover:text-orange-400"
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
