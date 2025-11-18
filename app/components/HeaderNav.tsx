"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type HeaderProfile = {
  displayName: string;
  avatarUrl?: string;
};

export default function HeaderNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const { user } = useAuth();

  const isLoggedIn = !!user;

  // Load avatar + display name from Firestore users collection
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) {
        setProfile(null);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as any;
          setProfile({
            displayName:
              data.username ||
              data.displayName ||
              user.displayName ||
              "Player",
            avatarUrl: data.avatarUrl || user.photoURL || undefined,
          });
        } else {
          // Fallback to auth user if no Firestore doc yet
          setProfile({
            displayName: user.displayName || "Player",
            avatarUrl: (user as any).photoURL || undefined,
          });
        }
      } catch (err) {
        console.error("Failed to load header profile", err);
        // Still show something instead of breaking the header
        setProfile({
          displayName: user.displayName || "Player",
          avatarUrl: (user as any).photoURL || undefined,
        });
      }
    };

    loadProfile();
  }, [user?.uid, user?.displayName]);

  const avatarUrl =
    profile?.avatarUrl || "/default-avatar.png";
  const displayName =
    profile?.displayName || "Player";

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

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

          {/* AUTH / PROFILE AREA */}
          <div className="ml-4 flex items-center gap-3">
            {/* NOT LOGGED IN: Login / Sign up + Profile buttons */}
            {!isLoggedIn && (
              <>
                <Link
                  href="/auth"
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full border
