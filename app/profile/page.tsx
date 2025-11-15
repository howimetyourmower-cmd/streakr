"use client";

import {
  useEffect,
  useState,
  useMemo,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";

type UserDoc = {
  uid?: string;
  username?: string;
  firstName?: string;
  surname?: string;
  email?: string;
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

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<UserDoc>({});
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  // Load profile from Firestore
  useEffect(() => {
    async function load() {
      try {
        if (!user) return;

        const refDoc = doc(db, "users", user.uid);
        const snap = await getDoc(refDoc);
        const data = snap.exists() ? snap.data() : {};

        setForm({
          uid: user.uid,
          email: user.email ?? "",
          username: (data as any).username ?? "",
          firstName: (data as any).firstName ?? "",
          surname: (data as any).surname ?? "",
          dob: (data as any).dob ?? "",
          suburb: (data as any).suburb ?? "",
          state: (data as any).state ?? "",
          phone: (data as any).phone ?? "",
          gender: (data as any).gender ?? "",
          team: (data as any).team ?? "",
          avatarUrl: (data as any).avatarUrl ?? "",
          currentStreak: (data as any).currentStreak ?? 0,
          longestStreak: (data as any).longestStreak ?? 0,
        });

        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load profile", err);
        setSaveError("Failed to load your profile. Please refresh.");
      }
    }

    if (user && !initialLoaded) load();
  }, [user, initialLoaded]);

  // Avatar preview URL handling
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const currentAvatarSrc = useMemo(() => {
    if (avatarPreviewUrl) return avatarPreviewUrl;
    if (form.avatarUrl) return form.avatarUrl;
    return "/default-avatar.png"; // your placeholder
  }, [avatarPreviewUrl, form.avatarUrl]);

  const update = (key: keyof UserDoc, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleAvatarSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setAvatarFile(null);
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["jpg", "jpeg", "png"];

    if (!ext || !allowed.includes(ext)) {
      setSaveError("Avatar must be a JPG or PNG file.");
      setAvatarFile(null);
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setSaveError("Avatar must be smaller than 3MB.");
      setAvatarFile(null);
      return;
    }

    setSaveError("");
    setAvatarFile(file);
  };

  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      // 1) Re-auth with password
      if (!password) {
        throw new Error("Please enter your current password to save changes.");
      }

      if (!user.email) {
        throw new Error("Missing email on your account.");
      }

      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);

      // 2) If avatar file selected, upload to Storage
      let avatarUrlToSave: string | undefined = form.avatarUrl;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const storageRef = ref(storage, `avatars/${user.uid}/avatar.${ext}`);

        await uploadBytes(storageRef, avatarFile);
        avatarUrlToSave = await getDownloadURL(storageRef);
      }

      // 3) Save profile fields to Firestore
      const refDoc = doc(db, "users", user.uid);
      await setDoc(
        refDoc,
        {
          surname: form.surname ?? "",
          suburb: form.suburb ?? "",
          state: form.state ?? "",
          phone: form.phone ?? "",
          gender: form.gender ?? "",
          team: form.team ?? "",
          avatarUrl: avatarUrlToSave ?? "",
        },
        { merge: true }
      );

      setForm((prev) => ({
        ...prev,
        avatarUrl: avatarUrlToSave ?? prev.avatarUrl,
      }));

      setSaveSuccess("Profile saved successfully.");
      setPassword("");
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-6">Profile</h1>

      {/* HEADER: avatar + email */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src={currentAvatarSrc}
          alt="Avatar"
          className="w-20 h-20 rounded-full border border-white/20 object-cover"
        />
        <div>
          <p className="text-xs text-gray-400 mb-1">Logged in as</p>
          <p className="text-sm font-semibold">
            {form.email ?? user?.email ?? ""}
          </p>
          {user?.emailVerified && (
            <p className="text-[11px] text-emerald-400 mt-1">
              ● Email verified
            </p>
          )}
        </div>
      </div>

      {/* AVATAR UPLOAD */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">
          Avatar (optional)
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleAvatarSelect}
          className="text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">
          JPG/PNG, max 3MB. This will show on leaderboards.
        </p>
        {avatarFile && (
          <p className="text-xs text-gray-300 mt-1 truncate">
            Selected: {avatarFile.name}
          </p>
        )}
      </div>

      {/* FORM GRID */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Username */}
        <div>
          <label className="block mb-1 text-sm">Username (locked)</label>
          <input
            className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400"
            disabled
            value={form.username ?? ""}
            readOnly
          />
        </div>

        {/* First name */}
        <div>
          <label className="block mb-1 text-sm">First name (locked)</label>
          <input
            className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400"
            disabled
            value={form.firstName ?? ""}
            readOnly
          />
        </div>

        {/* Surname */}
        <div>
          <label className="block mb-1 text-sm">Surname</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.surname ?? ""}
            onChange={(e) => update("surname", e.target.value)}
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block mb-1 text-sm">Date of birth (locked)</label>
          <input
            className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400"
            value={form.dob ?? ""}
            readOnly
            disabled
          />
        </div>

        {/* Suburb */}
        <div>
          <label className="block mb-1 text-sm">Suburb</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.suburb ?? ""}
            onChange={(e) => update("suburb", e.target.value)}
          />
        </div>

        {/* State */}
        <div>
          <label className="block mb-1 text-sm">State</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1 text-sm">Phone</label>
          <input
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block mb-1 text-sm">Gender</label>
          <select
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.gender ?? ""}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Team */}
        <div className="col-span-2">
          <label className="block mb-1 text-sm">Favourite AFL team</label>
          <select
            className="w-full bg-black/40 border border-white/10 p-2 rounded"
            value={form.team ?? ""}
            onChange={(e) => update("team", e.target.value)}
          >
            <option value="">Select a team</option>
            <option>Adelaide Crows</option>
            <option>Brisbane Lions</option>
            <option>Carlton</option>
            <option>Collingwood</option>
            <option>Essendon</option>
            <option>Fremantle</option>
            <option>Geelong Cats</option>
            <option>Gold Coast Suns</option>
            <option>GWS Giants</option>
            <option>Hawthorn</option>
            <option>Melbourne</option>
            <option>North Melbourne</option>
            <option>Port Adelaide</option>
            <option>Richmond</option>
            <option>St Kilda</option>
            <option>Sydney Swans</option>
            <option>West Coast Eagles</option>
            <option>Western Bulldogs</option>
          </select>
        </div>
      </div>

      {/* STREAK CARDS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">CURRENT STREAK</p>
          <p className="text-2xl font-bold">{form.currentStreak ?? 0}</p>
        </div>
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">LONGEST STREAK</p>
          <p className="text-2xl font-bold">{form.longestStreak ?? 0}</p>
        </div>
      </div>

      {/* PASSWORD + SAVE */}
      <div className="mb-6">
        <label className="block mb-1 text-sm">
          Current password (required to save changes)
        </label>
        <div className="flex items-center gap-2">
          <input
            type={showPassword ? "text" : "password"}
            className="flex-1 bg-black/40 border border-white/10 p-2 rounded"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="px-3 py-2 text-xs bg-white/10 rounded border border-white/20"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {saveError && <p className="text-red-400 mb-3">{saveError}</p>}
      {saveSuccess && <p className="text-green-400 mb-3">{saveSuccess}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded font-semibold disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save profile"}
      </button>

      {/* LOG OUT */}
      <div className="mt-10">
        <button
          onClick={() => signOut(auth)}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
