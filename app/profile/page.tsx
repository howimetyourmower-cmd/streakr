// /app/profile/page.tsx
"use client";

import {
  useEffect,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebaseClient";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";
import { useAuth } from "@/hooks/useAuth";

type ProfileData = {
  username?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  suburb?: string;
  state?: string;
  phone?: string;
  gender?: string;
  favouriteAflTeam?: string;
  avatarUrl?: string;

  // streak + stats
  currentStreak?: number;
  longestStreak?: number;
  lifetimeBestStreak?: number;
  lifetimeWins?: number;
  lifetimeLosses?: number;
  roundsPlayed?: number;

  // badges
  streakBadges?: Record<string, boolean>;
};

const AFL_TEAMS = [
  "Adelaide Crows",
  "Brisbane Lions",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle",
  "Geelong Cats",
  "Gold Coast Suns",
  "GWS Giants",
  "Hawthorn Hawks",
  "Melbourne Demons",
  "North Melbourne Kangaroos",
  "Port Adelaide Power",
  "Richmond Tigers",
  "St Kilda Saints",
  "Sydney Swans",
  "West Coast Eagles",
  "Western Bulldogs",
];

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<ProfileData>({});

  // extra: keep a local copy of badges so UI updates instantly
  const [localBadges, setLocalBadges] = useState<Record<
    string,
    boolean
  >>({});

  // Auth listener (safety net)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (!u) {
        router.push("/auth?mode=login&returnTo=/profile");
      }
    });
    return () => unsub();
  }, [router]);

  // Load profile
  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        let data: ProfileData;

        if (snap.exists()) {
          data = (snap.data() as ProfileData) || {};
        } else {
          // Create shell so fields exist
          data = {
            username: user.displayName || "",
            firstName: "",
            lastName: "",
            suburb: "",
            state: "",
            phone: "",
            gender: "",
            favouriteAflTeam: "",
            avatarUrl: user.photoURL || "",
            currentStreak: 0,
            longestStreak: 0,
            lifetimeBestStreak: 0,
            lifetimeWins: 0,
            lifetimeLosses: 0,
            roundsPlayed: 0,
            streakBadges: {},
          };
          await setDoc(userRef, data, { merge: true });
        }

        setProfile(data);
        setLocalBadges(data.streakBadges || {});
        setFormValues({
          username: data.username || "",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          dateOfBirth: data.dateOfBirth || "",
          suburb: data.suburb || "",
          state: data.state || "",
          phone: data.phone || "",
          gender: data.gender || "",
          favouriteAflTeam: data.favouriteAflTeam || "",
        });
      } catch (err) {
        console.error("Failed to load profile", err);
        setError("Could not load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleFieldChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const toggleEditing = () => {
    if (isEditing) {
      // reset form
      setFormValues({
        username: profile.username || "",
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        dateOfBirth: profile.dateOfBirth || "",
        suburb: profile.suburb || "",
        state: profile.state || "",
        phone: profile.phone || "",
        gender: profile.gender || "",
        favouriteAflTeam: profile.favouriteAflTeam || "",
      });
    }
    setIsEditing((prev) => !prev);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        username: formValues.username || "",
        firstName: formValues.firstName || "",
        lastName: formValues.lastName || "",
        dateOfBirth: formValues.dateOfBirth || "",
        suburb: formValues.suburb || "",
        state: formValues.state || "",
        phone: formValues.phone || "",
        gender: formValues.gender || "",
        favouriteAflTeam: formValues.favouriteAflTeam || "",
      });

      setProfile((prev) => ({
        ...prev,
        ...formValues,
      }));
      setIsEditing(false);
      setSuccessMessage("Profile updated.");
    } catch (err) {
      console.error("Failed to save profile", err);
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const storageRef = ref(
        storage,
        `avatars/${user.uid}/${file.name}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatarUrl: url });

      setProfile((prev) => ({
        ...prev,
        avatarUrl: url,
      }));
      setSuccessMessage("Profile picture updated.");
    } catch (err) {
      console.error("Avatar upload failed", err);
      setError("Could not upload picture. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // Derived stats
  const currentStreak = profile.currentStreak ?? 0;
  const longestStreak = profile.longestStreak ?? 0;
  const lifetimeBestStreak =
    profile.lifetimeBestStreak ?? longestStreak;
  const lifetimeWins = profile.lifetimeWins ?? 0;
  const lifetimeLosses = profile.lifetimeLosses ?? 0;
  const roundsPlayed = profile.roundsPlayed ?? 0;
  const totalPicks = lifetimeWins + lifetimeLosses;
  const correctPercent =
    totalPicks > 0
      ? Math.round((lifetimeWins / totalPicks) * 100)
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/70">Loading profile…</p>
      </div>
    );
  }

  if (!user || !authUser) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-sm text-white/70">
          You need to be logged in to view your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black text-white">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* PAGE TITLE */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold mb-1">
            Profile
          </h1>
          <p className="text-sm text-white/70">
            Welcome back,{" "}
            <span className="font-semibold">
              {authUser.displayName || profile.username || "Streaker"}
            </span>
            . Track your streak, lifetime record, badges and details
            here.
          </p>
        </div>

        {/* Logged in strip */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-full overflow-hidden border border-white/20 bg-slate-900">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt="Avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xl">
                  {authUser.displayName?.[0]?.toUpperCase() ?? "S"}
                </div>
              )}
            </div>
            <div className="text-xs">
              <p className="text-[11px] uppercase tracking-wide text-white/60">
                Logged in as
              </p>
              <p className="font-semibold">
                {authUser.email ?? "No email"}
              </p>
              {profile.favouriteAflTeam && (
                <p className="text-[11px] text-orange-300 mt-0.5">
                  Favourite team: {profile.favouriteAflTeam}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center justify-center rounded-full border border-white/20 px-3 py-1.5 text-[11px] cursor-pointer hover:border-orange-400 hover:text-orange-300">
              {uploadingAvatar ? "Uploading…" : "Change picture"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </label>
            <button
              type="button"
              onClick={toggleEditing}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-1.5 text-[11px] font-semibold text-black hover:bg-orange-400"
            >
              {isEditing ? "Cancel edit" : "Edit profile"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full border border-red-500/60 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-600/20"
            >
              Log out
            </button>
          </div>
        </div>

        {(error || successMessage) && (
          <div className="mb-4">
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {successMessage && (
              <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-md px-3 py-2">
                {successMessage}
              </p>
            )}
          </div>
        )}

        {/* PANEL 1 – STATS + LIFETIME + BADGES */}
        <section className="rounded-2xl bg-[#020617] border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-4 sm:p-6 mb-6">
          {/* Top three cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 text-sm">
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 px-4 py-3">
              <p className="text-[11px] text-white/60 mb-1">
                Current streak
              </p>
              <p className="text-3xl font-bold text-orange-400">
                {currentStreak}
              </p>
              <p className="text-[11px] text-white/60 mt-1">
                How many correct picks in a row you&apos;re on right now.
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 px-4 py-3">
              <p className="text-[11px] text-white/60 mb-1">
                Best streak
              </p>
              <p className="text-3xl font-bold text-sky-300">
                {lifetimeBestStreak}
              </p>
              <p className="text-[11px] text-white/60 mt-1">
                Your all-time longest STREAKr run.
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 px-4 py-3">
              <p className="text-[11px] text-white/60 mb-1">
                Rounds played
              </p>
              <p className="text-3xl font-bold text-emerald-300">
                {roundsPlayed}
              </p>
              <p className="text-[11px] text-white/60 mt-1">
                Total rounds you&apos;ve taken part in this season.
              </p>
            </div>
          </div>

          {/* Lifetime record (no win-rate %) */}
          <div className="rounded-2xl bg-slate-950/90 border border-slate-700 px-4 py-4 mb-6">
            <h2 className="text-sm font-semibold mb-1">
              Lifetime record
            </h2>
            <p className="text-[11px] text-white/60 mb-3">
              Every pick you&apos;ve ever made on STREAKr across all
              rounds and seasons.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-white/60 mb-0.5">
                  Best streak
                </p>
                <p className="text-xl font-bold text-orange-400">
                  {lifetimeBestStreak}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/60 mb-0.5">
                  Wins
                </p>
                <p className="text-xl font-bold text-emerald-300">
                  {lifetimeWins}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/60 mb-0.5">
                  Losses
                </p>
                <p className="text-xl font-bold text-red-300">
                  {lifetimeLosses}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-white/60 mb-0.5">
                  Total picks
                </p>
                <p className="text-xl font-bold text-sky-300">
                  {totalPicks}
                </p>
                {totalPicks > 0 && (
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Correct picks: {correctPercent}%.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Streak badges */}
          <div>
            <h2 className="text-sm font-semibold mb-1">
              Streak badges
            </h2>
            <p className="text-[11px] text-white/60 mb-3">
              Unlock footy card–style badges as your streak climbs.
              These match the big animation you see on the picks page.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <BadgeCard
                level={3}
                title="3 in a row"
                subtitle="Keep building 😎"
                unlocked={!!localBadges["3"]}
                imageSrc="/badges/streakr-3.png"
              />
              <BadgeCard
                level={5}
                title="On Fire"
                subtitle="Bang! You're on the money! 🔥"
                unlocked={!!localBadges["5"]}
                imageSrc="/badges/streakr-5.png"
              />
              <BadgeCard
                level={10}
                title="Elite"
                subtitle="That's elite. 10 straight 🏆"
                unlocked={!!localBadges["10"]}
                imageSrc="/badges/streakr-10.png"
              />
              <BadgeCard
                level={15}
                title="Dominance"
                subtitle="This run is getting ridiculous 💪"
                unlocked={!!localBadges["15"]}
                imageSrc="/badges/streakr-15.png"
              />
              <BadgeCard
                level={20}
                title="Legendary"
                subtitle="20 straight. GOAT status. 🐐"
                unlocked={!!localBadges["20"]}
                imageSrc="/badges/streakr-20.png"
              />
            </div>
          </div>
        </section>

        {/* PANEL 2 – PERSONAL DETAILS */}
        <section className="rounded-2xl bg-[#020617] border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-4 sm:p-6">
          <h2 className="text-lg font-semibold mb-1">
            Personal details
          </h2>
          <p className="text-xs text-white/60 mb-4">
            Update your details so we can personalise your STREAKr
            experience.
          </p>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"
          >
            <Field
              label="Username"
              name="username"
              value={formValues.username ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="First name"
              name="firstName"
              value={formValues.firstName ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="Surname"
              name="lastName"
              value={formValues.lastName ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              value={formValues.dateOfBirth ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="Suburb"
              name="suburb"
              value={formValues.suburb ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="State"
              name="state"
              value={formValues.state ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
              placeholder="VIC, NSW, QLD…"
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              value={formValues.phone ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
            />
            <Field
              label="Gender"
              name="gender"
              value={formValues.gender ?? ""}
              onChange={handleFieldChange}
              disabled={!isEditing}
              placeholder="Optional"
            />

            {/* Favourite AFL team */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-white/60 mb-1">
                Favourite AFL team
              </label>
              <select
                name="favouriteAflTeam"
                value={formValues.favouriteAflTeam ?? ""}
                onChange={handleFieldChange}
                disabled={!isEditing}
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-70"
              >
                <option value="">Select team…</option>
                {AFL_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>

            {isEditing && (
              <div className="sm:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}

/* ───────── Helper components ───────── */

type FieldProps = {
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
};

function Field({
  label,
  name,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: FieldProps) {
  return (
    <div>
      <label className="block text-[11px] text-white/60 mb-1">
        {label}
      </label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-70"
      />
    </div>
  );
}

type BadgeProps = {
  level: number;
  title: string;
  subtitle: string;
  unlocked: boolean;
  imageSrc: string;
};

function BadgeCard({
  level,
  title,
  subtitle,
  unlocked,
  imageSrc,
}: BadgeProps) {
  return (
    <div
      className={`relative rounded-2xl px-3 py-3 text-xs flex flex-col items-center text-center ${
        unlocked
          ? "border border-amber-400/70 bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          : "border border-slate-700 bg-slate-900/70 opacity-80"
      }`}
    >
      <div className="relative mb-2 h-24 w-20">
        <Image
          src={imageSrc}
          alt={`Streak badge level ${level}`}
          fill
          className={`object-contain ${
            unlocked ? "" : "grayscale opacity-70"
          }`}
        />
      </div>
      <p className="text-xs font-semibold mb-0.5">{title}</p>
      <p className="text-[11px] text-white/70 mb-1">{subtitle}</p>
      <p
        className={`text-[11px] font-semibold ${
          unlocked ? "text-emerald-300" : "text-slate-400"
        }`}
      >
        {unlocked ? "Unlocked" : "Locked"}
      </p>
    </div>
  );
}
