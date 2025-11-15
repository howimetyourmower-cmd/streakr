// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useAuth } from "@/streakr/hooks/useAuth";

type UserDoc = {
  uid?: string;
  name?: string;
  email?: string;
  dob?: string;
  suburb?: string;
  state?: string;
  team?: string;
  currentStreak?: number;
  longestStreak?: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  // Load Firestore profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setDocLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setProfile(snap.data() as UserDoc);
        } else {
          // fallback from auth if doc missing
          setProfile({
            uid: user.uid,
            name: user.displayName || "",
            email: user.email || "",
          });
        }
      } finally {
        setDocLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-gray-300">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 text-white">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Profile</h1>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        {/* Main card */}
        <div className="rounded-2xl bg-[#050818] border border-white/10 p-5 shadow-xl space-y-4">
          <h2 className="text-xl font-semibold">Account details</h2>

          {docLoading ? (
            <p className="text-sm text-gray-400">Loading details…</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-gray-400">Name</div>
                <div className="text-base font-medium">
                  {profile?.name || "—"}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Email</div>
                <div className="text-base font-medium">
                  {profile?.email || user?.email || "—"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400">Suburb</div>
                  <div className="text-base font-medium">
                    {profile?.suburb || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">State</div>
                  <div className="text-base font-medium">
                    {profile?.state || "—"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Favourite team</div>
                <div className="text-base font-medium">
                  {profile?.team || "—"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                  <div className="text-[11px] text-gray-400 uppercase">
                    Current streak
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {profile?.currentStreak ?? 0}
                  </div>
                </div>
                <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                  <div className="text-[11px] text-gray-400 uppercase">
                    Longest streak
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {profile?.longestStreak ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side card */}
        <div className="rounded-2xl bg-[#050818] border border-white/10 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Session</h2>
            <p className="text-xs text-gray-400 mb-4">
              You&apos;re logged in as{" "}
              <span className="font-semibold">
                {user?.email || profile?.email || "Unknown"}
              </span>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md bg-red-600 hover:bg-red-700 px-3 py-2 text-sm font-semibold"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
