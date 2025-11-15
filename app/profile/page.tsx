// app/profile/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { signOut, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

type UserDoc = {
  name?: string;
  email?: string;
  dob?: string;
  suburb?: string;
  state?: string;
  team?: string;
  currentStreak?: number;
  longestStreak?: number;
};

type FormState = {
  name: string;
  dob: string;
  suburb: string;
  state: string;
  team: string;
};

const AFL_TEAMS = [
  "Adelaide Crows",
  "Brisbane Lions",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle Dockers",
  "Geelong Cats",
  "Gold Coast Suns",
  "GWS Giants",
  "Hawthorn",
  "Melbourne",
  "North Melbourne",
  "Port Adelaide",
  "Richmond",
  "St Kilda",
  "Sydney Swans",
  "West Coast Eagles",
  "Western Bulldogs",
];

function getInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "ST";
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "ST";

  if (trimmed.includes(" ")) {
    const parts = trimmed.split(" ").filter(Boolean);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  if (trimmed.includes("@")) {
    return trimmed[0].toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  const [form, setForm] = useState<FormState>({
    name: "",
    dob: "",
    suburb: "",
    state: "",
    team: "",
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [verifMessage, setVerifMessage] = useState("");
  const [verifError, setVerifError] = useState("");
  const [sendingVerif, setSendingVerif] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  // Load Firestore user doc
  useEffect(() => {
    const loadUserDoc = async () => {
      if (!user) return;
      setDocLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        let data: UserDoc;
        if (snap.exists()) {
          data = snap.data() as UserDoc;
        } else {
          data = {
            email: user.email || "",
            name: user.displayName || "",
            currentStreak: 0,
            longestStreak: 0,
          };
        }

        setUserDoc(data);
        setForm({
          name: data.name || user.displayName || "",
          dob: data.dob || "",
          suburb: data.suburb || "",
          state: data.state || "",
          team: data.team || "",
        });
      } finally {
        setDocLoading(false);
      }
    };

    loadUserDoc();
  }, [user]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          name: form.name.trim(),
          dob: form.dob.trim() || null,
          suburb: form.suburb.trim() || null,
          state: form.state.trim() || null,
          team: form.team || null,
          email: user.email || userDoc?.email || null,
          currentStreak: userDoc?.currentStreak ?? 0,
          longestStreak: userDoc?.longestStreak ?? 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSaveMessage("Profile updated.");
      setUserDoc((prev) =>
        prev
          ? {
              ...prev,
              name: form.name.trim(),
              dob: form.dob.trim() || undefined,
              suburb: form.suburb.trim() || undefined,
              state: form.state.trim() || undefined,
              team: form.team || undefined,
            }
          : {
              name: form.name.trim(),
              dob: form.dob.trim() || undefined,
              suburb: form.suburb.trim() || undefined,
              state: form.state.trim() || undefined,
              team: form.team || undefined,
            }
      );
    } catch (err: any) {
      console.error(err);
      setSaveError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  const handleSendVerification = async () => {
    if (!user || user.emailVerified || !user.email) return;

    setVerifError("");
    setVerifMessage("");
    setSendingVerif(true);

    try {
      await sendEmailVerification(user);
      setVerifMessage("Verification email sent. Check your inbox.");
    } catch (err: any) {
      console.error(err);
      setVerifError("Could not send verification email.");
    } finally {
      setSendingVerif(false);
      setTimeout(() => {
        setVerifMessage("");
        setVerifError("");
      }, 5000);
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm text-gray-300">Loading profile…</p>
      </div>
    );
  }

  const displayEmail = user?.email || userDoc?.email || "";

  const initials = getInitials(userDoc?.name || displayEmail);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Profile</h1>

      <div className="grid gap-6 md:grid-cols-[2.1fr,1fr]">
        {/* LEFT – account & streaks */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl bg-[#050818] border border-white/10 p-5 sm:p-6 shadow-xl flex flex-col gap-5"
        >
          {/* Top row: avatar + basic info */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-lg sm:text-xl font-bold">
              {initials}
            </div>
            <div>
              <div className="text-sm text-gray-400">Logged in as</div>
              <div className="text-base font-semibold break-all">
                {displayEmail}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                {user?.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    Email verified
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-yellow-300">
                      <span className="h-2 w-2 rounded-full bg-yellow-400" />
                      Email not verified
                    </span>
                    <button
                      type="button"
                      onClick={handleSendVerification}
                      disabled={sendingVerif}
                      className="underline text-orange-400 disabled:text-gray-500"
                    >
                      {sendingVerif ? "Sending…" : "Send verification link"}
                    </button>
                  </>
                )}
              </div>
              {verifMessage && (
                <p className="text-[11px] text-green-400 mt-1">
                  {verifMessage}
                </p>
              )}
              {verifError && (
                <p className="text-[11px] text-red-400 mt-1">{verifError}</p>
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 grid gap-4 md:grid-cols-2">
            {/* Name */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Display name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Your name / nickname"
              />
            </div>

            {/* DOB */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Date of birth
              </label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => handleChange("dob", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Suburb */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">Suburb</label>
              <input
                type="text"
                value={form.suburb}
                onChange={(e) => handleChange("suburb", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. Bentleigh"
              />
            </div>

            {/* State */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="e.g. VIC"
              />
            </div>

            {/* Favourite team */}
            <div className="md:col-span-2">
              <label className="block text-xs mb-1 text-gray-400">
                Favourite AFL team
              </label>
              <select
                value={form.team}
                onChange={(e) => handleChange("team", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a team</option>
                {AFL_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Streak stats */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl bg-black/35 border border-white/10 p-3 sm:p-4">
              <div className="text-[11px] text-gray-400 uppercase">
                Current streak
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold">
                {userDoc?.currentStreak ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-black/35 border border-white/10 p-3 sm:p-4">
              <div className="text-[11px] text-gray-400 uppercase">
                Longest streak
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold">
                {userDoc?.longestStreak ?? 0}
              </div>
            </div>
          </div>

          {/* Save profile */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-4 py-2 text-sm font-semibold"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            {saveMessage && (
              <span className="text-xs text-green-400">{saveMessage}</span>
            )}
            {saveError && (
              <span className="text-xs text-red-400">{saveError}</span>
            )}
          </div>
        </form>

        {/* RIGHT – session / logout */}
        <div className="rounded-2xl bg-[#050818] border border-white/10 p-5 sm:p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h2 className="text-lg font-semibold mb-2">Session</h2>
            <p className="text-xs text-gray-400 mb-4">
              You&apos;re logged in as{" "}
              <span className="font-semibold break-all">{displayEmail}</span>.
            </p>
            <p className="text-xs text-gray-500">
              Use this account across web and mobile (when we launch the app) to
              keep your streaks in sync.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 w-full rounded-md bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
