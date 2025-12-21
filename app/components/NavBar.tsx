// components/Navbar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import { usePathname, useSearchParams } from "next/navigation";

type MinimalUserDoc = {
  avatarUrl?: string;
  username?: string;
};

type SportKey = "AFL" | "BBL";

const LAST_SPORT_KEY = "streakr_last_sport_v1";
const LAST_BBL_DOCID_KEY = "streakr_last_bbl_docid_v1";

function safeUpper(s: string) {
  return (s || "").trim().toUpperCase();
}

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [profileDoc, setProfileDoc] = useState<MinimalUserDoc | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Persisted "last known" BBL context for Navbar
  const [lastSport, setLastSport] = useState<SportKey>("AFL");
  const [lastBblDocId, setLastBblDocId] = useState<string>("");

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

  // ---- Sport context detection (from URL) ----
  const sportFromUrl = safeUpper(searchParams.get("sport") || "");
  const docIdFromUrl = (searchParams.get("docId") || "").trim();

  // Consider these paths as "BBL area" even if they forget params (helps fallback)
  const isLikelyBblArea = useMemo(() => {
    const p = (pathname || "").toLowerCase();
    if (sportFromUrl === "BBL") return true;
    if (p.includes("/bbl")) return true;
    if (p.includes("/cricket")) return true;
    if (p.includes("/play/bbl")) return true;
    return false;
  }, [pathname, sportFromUrl]);

  // Load last sport/docId from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lsSport = safeUpper(window.localStorage.getItem(LAST_SPORT_KEY) || "");
      const lsDoc = (window.localStorage.getItem(LAST_BBL_DOCID_KEY) || "").trim();

      if (lsSport === "BBL" || lsSport === "AFL") setLastSport(lsSport as SportKey);
      if (lsDoc) setLastBblDocId(lsDoc);
    } catch (e) {
      console.error("Navbar: failed to read last sport/docId", e);
    }
  }, []);

  // Update last sport/docId whenever URL context changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If we have explicit sport param:
    if (sportFromUrl === "BBL") {
      setLastSport("BBL");
      try {
        window.localStorage.setItem(LAST_SPORT_KEY, "BBL");
      } catch {}

      if (docIdFromUrl) {
        setLastBblDocId(docIdFromUrl);
        try {
          window.localStorage.setItem(LAST_BBL_DOCID_KEY, docIdFromUrl);
        } catch {}
      }
      return;
    }

    if (sportFromUrl === "AFL") {
      setLastSport("AFL");
      try {
        window.localStorage.setItem(LAST_SPORT_KEY, "AFL");
      } catch {}
      return;
    }

    // If no sport param, but the user is clearly in BBL area AND has docId param, store it.
    if (isLikelyBblArea && docIdFromUrl) {
      setLastSport("BBL");
      setLastBblDocId(docIdFromUrl);
      try {
        window.localStorage.setItem(LAST_SPORT_KEY, "BBL");
        window.localStorage.setItem(LAST_BBL_DOCID_KEY, docIdFromUrl);
      } catch {}
    }
  }, [sportFromUrl, docIdFromUrl, isLikelyBblArea]);

  // ---- Build correct Picks link ----
  const picksHref = useMemo(() => {
    // 1) If URL explicitly says BBL and has docId -> always use it
    if (sportFromUrl === "BBL" && docIdFromUrl) {
      return `/picks?sport=BBL&docId=${encodeURIComponent(docIdFromUrl)}`;
    }

    // 2) If URL explicitly says BBL but docId missing -> fallback to last known docId
    if (sportFromUrl === "BBL" && !docIdFromUrl && lastBblDocId) {
      return `/picks?sport=BBL&docId=${encodeURIComponent(lastBblDocId)}`;
    }

    // 3) If we are in a "BBL area" page (like /play/bbl/...) -> go to last known BBL match if possible
    if (isLikelyBblArea && lastSport === "BBL" && lastBblDocId) {
      return `/picks?sport=BBL&docId=${encodeURIComponent(lastBblDocId)}`;
    }

    // 4) Otherwise AFL default
    return "/picks";
  }, [sportFromUrl, docIdFromUrl, lastSport, lastBblDocId, isLikelyBblArea]);

  // Optional: you can also make leaderboards/leagues context-aware later. For now, just fix Picks.
  // If you want, we can add a master hub link like /play (AFL/BBL selector) and point the logo there.

  return (
    <header className="w-full border-b border-white/10 bg-black">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        {/* LOGO / WORDMARK */}
        <Link href="/" className="flex items-center gap-3">
          <span className="font-bold text-3xl tracking-tight">
            STREAK<span className="text-orange-400">r</span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex items-center gap-8 text-sm">
          <Link href={picksHref} className="hover:text-orange-400">
            Picks
          </Link>
          <Link href="/leaderboards" className="hover:text-orange-400">
            Leaderboards
          </Link>
          <Link href="/leagues" className="hover:text-orange-400">
            Leagues
          </Link>
          <Link href="/venues" className="hover:text-orange-400">
            Venue Leagues
          </Link>
          <Link href="/rewards" className="hover:text-orange-400">
            Rewards
          </Link>
          <Link href="/faq" className="hover:text-orange-400">
            FAQ
          </Link>

          {/* AVATAR + NAME */}
          <Link
            href={user ? "/profile" : "/auth"}
            className="flex items-center gap-2"
          >
            <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentAvatarSrc}
                alt={label}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // fallback to initial if image fails
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs font-bold text-white/80">
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
            <Link href={picksHref} onClick={() => setMenuOpen(false)}>
              Picks
            </Link>
            <Link href="/leaderboards" onClick={() => setMenuOpen(false)}>
              Leaderboards
            </Link>
            <Link href="/leagues" onClick={() => setMenuOpen(false)}>
              Leagues
            </Link>
            <Link href="/venues" onClick={() => setMenuOpen(false)}>
              Venue Leagues
            </Link>
            <Link href="/rewards" onClick={() => setMenuOpen(false)}>
              Rewards
            </Link>
            <Link href="/faq" onClick={() => setMenuOpen(false)}>
              FAQ
            </Link>

            {/* MOBILE PROFILE */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-white/20 bg-slate-800 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentAvatarSrc}
                    alt={label}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs font-bold text-white/80">
                    {avatarInitial}
                  </span>
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
