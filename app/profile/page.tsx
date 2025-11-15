// app/profile/page.tsx
"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import {
  signOut,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
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
  username?: string;
  firstName?: string;
  surname?: string;
  phone?: string;
  gender?: string;
  avatarUrl?: string; // future use
};

type FormState = {
  username: string;
  firstName: string;
  surname: string;
  dob: string;
  suburb: string;
  state: string;
  team: string;
  phone: string;
  gender: string;
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
    username: "",
    firstName: "",
    surname: "",
    dob: "",
    suburb: "",
    state: "",
    team: "",
    phone: "",
    gender: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [verifMessage, setVerifMessage] = useState("");
  const [verifError, setVerifError] = useState("");
  const [sendingVerif, setSendingVerif] = useState(false);

  // Avatar UI state (preview only for now)
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");

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
        const refDoc = doc(db, "users", user.uid);
        const snap = await getDoc(refDoc);

        let data: UserDoc;
        if (snap.exists()) {
          data = snap.data() as UserDoc;
        } else {
          data = {
            email: user.email || "",
            name: user.displayName || "",
            username: user.displayName || "",
            currentStreak: 0,
            longestStreak: 0,
          };
        }

        setUserDoc(data);

        setForm({
          username: data.username || user.displayName || "",
          firstName: data.firstName || "",
          surname: data.surname || "",
          dob: data.dob || "",
          suburb: data.suburb || "",
          state: data.state || "",
          team: data.team || "",
          phone: data.phone || "",
          gender: data.gender || "",
        });

        setAvatarPreview(data.avatarUrl || null);
      } finally {
        setDocLoading(false);
      }
    };

    loadUserDoc();
  }, [user, db]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAvatarError("");
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file (JPG/PNG).");
      setAvatarFile(null);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setAvatarError("Image too large. Please use a file under 3MB.");
      setAvatarFile(null);
      return;
    }

    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    setAvatarError("");

    try {
      if (!currentPassword) {
        setSaveError("Please enter your current password to save changes.");
        setSaving(false);
        return;
      }

      if (!user.email) {
        setSaveError("No email associated with this account.");
        setSaving(false);
        return;
      }

      // Reauthenticate user with current password
      const cred = EmailAuthProvider.credential(
        user.email,
        currentPassword.trim()
      );
      await reauthenticateWithCredential(user, cred);

      // NOTE: for now we do NOT upload avatar to Storage.
      // We just save text fields, so nothing here can hang.
      if (avatarFile) {
        setAvatarError(
          "Avatar upload coming soon. Your profile details were saved."
        );
      }

      // Prepare updated fields (only editable ones)
      const updatedSurname = form.surname.trim() || null;

      let updatedName: string | undefined;
      if (userDoc?.firstName || userDoc?.surname || userDoc?.name) {
        const baseFirst = (userDoc?.firstName ?? "").trim();
        const baseSurname = updatedSurname ?? userDoc?.surname ?? "";
        const combined = `${baseFirst} ${baseSurname}`.trim();
        if (combined) updatedName = combined;
      }

      const refDoc = doc(db, "users", user.uid);

      const updateData: any = {
        surname: updatedSurname,
        phone: form.phone.trim() || null,
        suburb: form.suburb.trim() || null,
        state: form.state.trim() || null,
        gender: form.gender || null,
        team: form.team || null,
        email: user.email || userDoc?.email || null,
        currentStreak: userDoc?.currentStreak ?? 0,
        longestStreak: userDoc?.longestStreak ?? 0,
        updatedAt: serverTimestamp(),
      };

      if (updatedName) {
        updateData.name = updatedName;
      }

      await setDoc(refDoc, updateData, { merge: true });

      setSaveMessage("Profile updated.");

      setUserDoc((prev) =>
        prev
          ? {
              ...prev,
              surname: updatedSurname || undefined,
              phone: form.phone.trim() || undefined,
              suburb: form.suburb.trim() || undefined,
              state: form.state.trim() || undefined,
              gender: form.gender || undefined,
              team: form.team || undefined,
              name: updatedName ?? prev.name,
            }
          : {
              surname: updatedSurname || undefined,
              phone: form.phone.trim() || undefined,
              suburb: form.suburb.trim() || undefined,
              state: form.state.trim() || undefined,
              gender: form.gender || undefined,
              team: form.team || undefined,
              name: updatedName,
            }
      );

      setCurrentPassword("");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/wrong-password") {
        setSaveError("Password is incorrect. Please try again.");
      } else {
        setSaveError("Failed to save profile. Please try again.");
      }
    } finally {
      setSaving(false);
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
  const displayNameForInitials =
    userDoc?.name || form.username || displayEmail;

  const initials = getInitials(displayNameForInitials);
  const avatarToShow = avatarPreview || userDoc?.avatarUrl || null;

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
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              {avatarToShow ? (
                <img
                  src={avatarToShow}
                  alt="Avatar"
                  className="h-full w-full rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-lg sm:text-2xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm text-gray-400">Logged in as</div>
              <div className="text-base font-semibold break-all">
                {displayEmail}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
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

          {/* Avatar upload (preview only) */}
          <div className="border-t border-white/5 pt-4">
            <label className="block text-xs mb-1 text-gray-400">
              Avatar (optional)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="text-xs text-gray-300"
              />
              <span className="text-[11px] text-gray-500">
                JPG/PNG, max 3MB. Avatars will be fully enabled soon.
              </span>
            </div>
            {avatarError && (
              <p className="text-[11px] text-red-400 mt-1">{avatarError}</p>
            )}
          </div>

          {/* Account fields */}
          <div className="border-t border-white/5 pt-4 grid gap-4 md:grid-cols-2">
            {/* Username (locked) */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Username (locked)
              </label>
              <input
                type="text"
                value={form.username}
                disabled
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm text-gray-400"
              />
            </div>

            {/* First name (locked) */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                First name (locked)
              </label>
              <input
                type="text"
                value={form.firstName}
                disabled
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm text-gray-400"
              />
            </div>

            {/* Surname (editable) */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Surname
              </label>
              <input
                type="text"
                value={form.surname}
                onChange={(e) => handleChange("surname", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* DOB (locked) */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Date of birth (locked)
              </label>
              <input
                type="date"
                value={form.dob}
                disabled
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm text-gray-400"
              />
            </div>

            {/* Suburb */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Suburb
              </label>
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

            {/* Phone */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Optional"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs mb-1 text-gray-400">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="other">Other</option>
              </select>
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

          {/* Current password + Save */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="grid gap-3 md:grid-cols-[1.2fr,auto] items-center">
              <div>
                <label className="block text-xs mb-1 text-gray-400">
                  Current password (required to save changes)
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md bg-[#0b1020] border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto rounded-md bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 px-4 py-2 text-sm font-semibold"
                >
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </div>
            <div className="min-h-[18px]">
              {saveMessage && (
                <span className="text-xs text-green-400">{saveMessage}</span>
              )}
              {saveError && (
                <span className="text-xs text-red-400">{saveError}</span>
              )}
            </div>
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
