"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signOut, User } from "firebase/auth";
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

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  // Load Firestore data
  useEffect(() => {
    async function load() {
      try {
        if (!user) return;

        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        const data = snap.exists() ? snap.data() : {};

        setForm({
          uid: user.uid,
          email: user.email ?? "",
          username: data.username ?? "",
          firstName: data.firstName ?? "",
          surname: data.surname ?? "",
          dob: data.dob ?? "",
          suburb: data.suburb ?? "",
          state: data.state ?? "",
          phone: data.phone ?? "",
          gender: data.gender ?? "",
          team: data.team ?? "",
          avatarUrl: data.avatarUrl ?? "",
          currentStreak: data.currentStreak ?? 0,
          longestStreak: data.longestStreak ?? 0,
        });

        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load profile", err);
        setSaveError("Failed to load your profile. Please refresh.");
      }
    }

    if (user && !initialLoaded) load();
  }, [user, initialLoaded]);

  // Save profile
  async function handleSave() {
    if (!user) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      // BASIC SAVE (NO AVATAR UPLOAD YET)
      const ref = doc(db, "users", user.uid);

      await setDoc(
        ref,
        {
          surname: form.surname ?? "",
          suburb: form.suburb ?? "",
          state: form.state ?? "",
          phone: form.phone ?? "",
          gender: form.gender ?? "",
          team: form.team ?? "",
        },
        { merge: true }
      );

      setSaveSuccess("Profile saved successfully.");

    } catch (err) {
      console.error("Save error:", err);
      setSaveError("Failed to save profile. Please try again.");
    }

    setSaving(false);
  }

  // Input helper
  const update = (key: keyof UserDoc, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Avatar selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-6">Profile</h1>

      {/* ---- LOGGED IN HEADER ---- */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src={form.avatarUrl || "/default-avatar.png"}
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

      {/* ---- AVATAR UPLOAD (COMING SOON) ---- */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">Avatar (optional)</label>
        <input type="file" accept="image/*" onChange={handleAvatarSelect} />
        {avatarFile && (
          <p className="text-xs text-gray-400 mt-1 truncate">{avatarFile.name}</p>
        )}
        <p className="text-red-400 text-xs mt-1">
          Avatar upload is coming soon. Your profile details were saved.
        </p>
      </div>

      {/* ---- FORM GRID ---- */}
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

        {/* First Name */}
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

      {/* STREAKS */}
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

      {/* PASSWORD */}
      <div className="mb-6">
        <label className="block mb-1 text-sm">
          Current password (required to save changes)
        </label>
        <input
          type="password"
          className="w-full bg-black/40 border border-white/10 p-2 rounded"
          placeholder="Enter password"
        />
      </div>

      {saveError && <p className="text-red-400 mb-3">{saveError}</p>}
      {saveSuccess && <p className="text-green-400 mb-3">{saveSuccess}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded font-semibold"
      >
        {saving ? "Saving..." : "Save profile"}
      </button>

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
