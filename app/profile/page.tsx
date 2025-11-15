// app/profile/page.tsx
"use client";

import {
  useEffect,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { auth, db, storage } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type UserDoc = {
  uid: string;
  email?: string;
  username?: string;
  firstName?: string;
  surname?: string;
  dob?: string;
  suburb?: string;
  state?: string;
  phone?: string;
  gender?: string;
  team?: string;
  avatarUrl?: string;
  currentStreak?: number;
  longestStreak?: number;
};

const teamOptions = [
  "Adelaide",
  "Brisbane Lions",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle",
  "Geelong",
  "Gold Coast",
  "GWS Giants",
  "Hawthorn",
  "Melbourne",
  "North Melbourne",
  "Port Adelaide",
  "Richmond",
  "St Kilda",
  "Sydney",
  "West Coast",
  "Western Bulldogs",
];

const genderOptions = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [form, setForm] = useState<UserDoc | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  // Load user profile from Firestore
  useEffect(() => {
    const load = async () => {
      if (!user) return;

      try {
        const refDoc = doc(db, "users", user.uid);
        const snap = await getDoc(refDoc);

        const data = snap.exists() ? (snap.data() as UserDoc) : {};

        const merged: UserDoc = {
          uid: user.uid,
          email: user.email ?? "",
          username: data.username ?? "",
          firstName: data.firstName ?? "",
          surname: data.surname ?? "",
          dob: data.dob ?? "",
          suburb: data.suburb ?? "",
          state: data.state ?? "",
          phone: data.phone ?? "",
          gender: data.gender ?? "Prefer not to say",
          team: data.team ?? "",
          avatarUrl: data.avatarUrl ?? user.photoURL ?? undefined,
          currentStreak: data.currentStreak ?? 0,
          longestStreak: data.longestStreak ?? 0,
        };

        setForm(merged);
        setAvatarPreview(merged.avatarUrl ?? null);
        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load profile", err);
        setSaveError("Failed to load your profile. Please refresh.");
      }
    };

    if (user && !initialLoaded) {
      load();
    }
  }, [user, initialLoaded]);

  const onFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!form) return;
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    setSaveError(null);
    setSaveSuccess(null);

    if (file) {
      // quick client-side validation: 3MB & jpg/png
      if (
        !["image/jpeg", "image/png"].includes(file.type) ||
        file.size > 3 * 1024 * 1024
      ) {
        setSaveError("Avatar must be JPG/PNG and smaller than 3MB.");
        setAvatarFile(null);
        return;
      }
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    } else {
      setAvatarPreview(form?.avatarUrl ?? null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !form) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      // Re-auth with current password
      if (!currentPassword) {
        throw new Error("Please enter your current password to save changes.");
      }

      const credential = EmailAuthProvider.credential(
        user.email ?? "",
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      let avatarUrl = form.avatarUrl ?? null;

      // If a new avatar file is selected, upload it
      if (avatarFile) {
        const ext = avatarFile.type === "image/png" ? "png" : "jpg";
        const storageRef = ref(
          storage,
          `avatars/${user.uid}/avatar.${ext}`
        );
        await uploadBytes(storageRef, avatarFile);
        avatarUrl = await getDownloadURL(storageRef);
      }

      const payload: UserDoc = {
        uid: user.uid,
        email: form.email,
        username: form.username,
        firstName: form.firstName,
        surname: form.surname,
        dob: form.dob,
        suburb: form.suburb,
        state: form.state,
        phone: form.phone,
        gender: form.gender,
        team: form.team,
        avatarUrl: avatarUrl ?? undefined,
        currentStreak: form.currentStreak ?? 0,
        longestStreak: form.longestStreak ?? 0,
      };

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });

      setForm({ ...form, avatarUrl: avatarUrl ?? undefined });
      setAvatarFile(null);
      setSaveSuccess("Profile updated successfully.");
      setCurrentPassword("");
    } catch (err: any) {
      console.error("Failed to save profile", err);
      setSaveError(
        err?.message || "Failed to save profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const displayAvatar =
    avatarPreview ||
    form?.avatarUrl ||
    "https://ui-avatars.com/api/?name=S&background=FF7A00&color=ffffff";

  if (loading || !form) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-300">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 text-white">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6">Profile</h1>

      <div className="grid gap-6 lg:grid-cols-[2fr,1.1fr]">
        {/* Left: account details */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[#050816] border border-white/10 p-5 sm:p-6 shadow-xl"
        >
          {/* Header with avatar and email */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <img
                src={displayAvatar}
                alt="Avatar"
                className="h-16 w-16 rounded-full object-cover border border-white/20"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Logged in as</p>
              <p className="text-sm font-semibold">
                {form.email ?? user.email}
              </p>
              {user.emailVerified && (
                <p className="text-[11px] text-emerald-400 mt-1">
                  ● Email verified
                </p>
              )}
            </div>
          </div>

          {/* Avatar upload */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              Avatar (optional)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={onAvatarChange}
              className="block w-full text-xs text-gray-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              JPG/PNG, max 3MB. This will show on leaderboards and around the
              site.
            </p>
          </div>

          {/* Grid of fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Locked fields */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Username (locked)
              </label>
              <input
                type="text"
                name="username"
                value={form.username ?? ""}
                disabled
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                First name (locked)
              </label>
              <input
                type="text"
                name="firstName"
                value={form.firstName ?? ""}
                disabled
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Surname
              </label>
              <input
                type="text"
                name="surname"
                value={form.surname ?? ""}
                onChange={onFieldChange}
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Date of birth (locked)
              </label>
              <input
                type="text"
                name="dob"
                value={form.dob ?? ""}
                disabled
                placeholder="dd/mm/yyyy"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Suburb
              </label>
              <input
                type="text"
                name="suburb"
                value={form.suburb ?? ""}
                onChange={onFieldChange}
                placeholder="e.g. Bentleigh"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={form.state ?? ""}
                onChange={onFieldChange}
                placeholder="e.g. VIC"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Phone
              </label>
              <input
                type="text"
                name="phone"
                value={form.phone ?? ""}
                onChange={onFieldChange}
                placeholder="Optional"
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={form.gender ?? "Prefer not to say"}
                onChange={onFieldChange}
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {genderOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-300 mb-1">
                Favourite AFL team
              </label>
              <select
                name="team"
                value={form.team ?? ""}
                onChange={onFieldChange}
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select a team</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Streak summary (read only) */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-3">
              <p className="text-[11px] text-gray-400 mb-1">
                CURRENT STREAK
              </p>
              <p className="text-2xl font-bold">
                {form.currentStreak ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-3">
              <p className="text-[11px] text-gray-400 mb-1">
                LONGEST STREAK
              </p>
              <p className="text-2xl font-bold">
                {form.longestStreak ?? 0}
              </p>
            </div>
          </div>

          {/* Password confirm */}
          <div className="mb-3">
            <label className="block text-xs text-gray-300 mb-1">
              Current password (required to save changes)
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-[11px] text-gray-300 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Status messages */}
          {saveError && (
            <p className="text-xs text-red-400 mb-2">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-xs text-emerald-400 mb-2">
              {saveSuccess}
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-md text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        {/* Right: session / log out */}
        <div className="rounded-2xl bg-[#050816] border border-white/10 p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Session</h2>
            <p className="text-sm text-gray-300 mb-1">
              You&apos;re logged in as
            </p>
            <p className="text-sm font-semibold mb-3">
              {form.email ?? user.email}
            </p>
            <p className="text-xs text-gray-400">
              Use this account across web & app (when we launch it) to keep
              your streaks in sync.
            </p>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md bg-red-500 hover:bg-red-600 text-sm font-semibold py-2"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
