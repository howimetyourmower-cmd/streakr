// /app/profile/ProfileClient.tsx
"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebaseClient";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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
  avatarUrl?: string; // preferred
  photoURL?: string; // legacy

  // stats (UI now, computed later)
  currentStreak?: number;
  longestStreak?: number;
  lifetimeBestStreak?: number;
  lifetimeWins?: number;
  lifetimeLosses?: number;
  roundsPlayed?: number;

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

const JOOSE = {
  bg: "#000000",
  red: "#d11b2f",
  red2: "#FF2E4D",
  white: "#FFFFFF",
};

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProfileClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<ProfileData>({});
  const [localBadges, setLocalBadges] = useState<Record<string, boolean>>({});

  // Auth listener (keeps redirect logic you had)
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
          const firestoreData = (snap.data() as Record<string, unknown>) || {};

          // Map existing boolean fields like badges_level3 etc
          const levelBadges: Record<string, boolean> = {};
          [3, 5, 10, 15, 20].forEach((lvl) => {
            const key = `badges_level${lvl}`;
            if (firestoreData[key] === true) {
              levelBadges[String(lvl)] = true;
            }
          });

          const streakBadges = (firestoreData.streakBadges as Record<string, boolean>) || {};
          const mergedBadges = { ...streakBadges, ...levelBadges };

          data = {
            ...(firestoreData as any),
            streakBadges: mergedBadges,
          } as ProfileData;

          setLocalBadges(mergedBadges);
        } else {
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
          setLocalBadges({});
        }

        setProfile(data);
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

  const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const toggleEditing = () => {
    if (isEditing) {
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

      // DO NOT allow username or DOB to change from UI
      await updateDoc(userRef, {
        firstName: formValues.firstName || "",
        lastName: formValues.lastName || "",
        suburb: formValues.suburb || "",
        state: formValues.state || "",
        phone: formValues.phone || "",
        gender: formValues.gender || "",
        favouriteAflTeam: formValues.favouriteAflTeam || "",
      });

      setProfile((prev) => ({
        ...prev,
        firstName: formValues.firstName || "",
        lastName: formValues.lastName || "",
        suburb: formValues.suburb || "",
        state: formValues.state || "",
        phone: formValues.phone || "",
        gender: formValues.gender || "",
        favouriteAflTeam: formValues.favouriteAflTeam || "",
      }));

      setIsEditing(false);
      setSuccessMessage("Profile updated.");
      window.setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      console.error("Failed to save profile", err);
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // quick client validation (UI-only)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image too large. Please use an image under 6MB.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { avatarUrl: url });

      setProfile((prev) => ({
        ...prev,
        avatarUrl: url,
      }));

      setSuccessMessage("Profile picture updated.");
      window.setTimeout(() => setSuccessMessage(null), 2500);
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

  // Derived stats (UI-only — backend comes later)
  const currentStreak = toNum(profile.currentStreak, 0);
  const longestStreak = toNum(profile.longestStreak, 0);
  const lifetimeBestStreak = toNum(profile.lifetimeBestStreak, 0);

  // ✅ IMPORTANT:
  // - Current streak = live streak right now.
  // - Best streak = all-time peak (and should never display lower than current).
  const bestStreakDisplay = Math.max(currentStreak, lifetimeBestStreak, longestStreak);

  const lifetimeWins = toNum(profile.lifetimeWins, 0);
  const lifetimeLosses = toNum(profile.lifetimeLosses, 0);
  const roundsPlayed = toNum(profile.roundsPlayed, 0);
  const totalPicks = lifetimeWins + lifetimeLosses;
  const correctPercent = totalPicks > 0 ? Math.round((lifetimeWins / totalPicks) * 100) : 0;

  // Avatar source
  const avatarUrl = profile.avatarUrl || profile.photoURL || authUser?.photoURL || "";

  const displayName = useMemo(() => {
    const name =
      authUser?.displayName ||
      profile.username ||
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    return name || "Joose Player";
  }, [authUser?.displayName, profile.username, profile.firstName, profile.lastName]);

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
        <p className="text-sm text-white/70">You need to be logged in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: JOOSE.bg }}>
      {/* top sponsor strip */}
      <div
        className="w-full border-b"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.00) 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] tracking-[0.18em] font-semibold text-white/55">OFFICIAL PARTNER</div>
          <div className="text-[11px] tracking-[0.12em] text-white/35 truncate">
            Proudly supporting JOOSE all season long
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black tracking-[0.10em]">PROFILE</h1>
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.14em]"
                style={{
                  borderColor: "rgba(209,27,47,0.35)",
                  background: "rgba(209,27,47,0.12)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                JOOSE
              </span>
            </div>
            <p className="mt-1 text-sm text-white/65">
              Welcome back, <span className="font-semibold text-white">{displayName}</span>. Track streaks, badges and
              details here.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/picks"
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
              }}
            >
              Go to Picks
            </a>

            <a
              href="/leaderboards"
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-black"
              style={{
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
              }}
            >
              Leaderboards
            </a>

            <button
              type="button"
              onClick={toggleEditing}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-black border"
              style={{
                borderColor: isEditing ? "rgba(255,255,255,0.18)" : "rgba(209,27,47,0.35)",
                background: isEditing ? "rgba(255,255,255,0.06)" : "rgba(209,27,47,0.14)",
                color: "rgba(255,255,255,0.95)",
              }}
            >
              {isEditing ? "Cancel" : "Edit profile"}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-black border"
              style={{
                borderColor: "rgba(255,46,77,0.45)",
                background: "rgba(255,46,77,0.12)",
                color: "rgba(255,255,255,0.92)",
              }}
            >
              Log out
            </button>
          </div>
        </div>

        {(error || successMessage) && (
          <div className="mb-5 space-y-2">
            {error && (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(255,46,77,0.40)",
                  background: "rgba(255,46,77,0.10)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {error}
              </div>
            )}
            {successMessage && (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "rgba(45,255,122,0.28)",
                  background: "rgba(45,255,122,0.10)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {successMessage}
              </div>
            )}
          </div>
        )}

        {/* Identity strip */}
        <div
          className="rounded-3xl border p-4 sm:p-5 mb-6"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="h-14 w-14 rounded-2xl p-[3px]"
                  style={{
                    background: "linear-gradient(180deg, rgba(209,27,47,0.95) 0%, rgba(209,27,47,0.55) 100%)",
                    boxShadow: "0 12px 28px rgba(209,27,47,0.18)",
                  }}
                >
                  <div
                    className="h-full w-full overflow-hidden rounded-[14px]"
                    style={{
                      background: "rgba(0,0,0,0.40)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xl font-black">
                        {(displayName?.[0] || "J").toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {uploadingAvatar && (
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center text-[11px] font-black"
                    style={{
                      background: "rgba(0,0,0,0.65)",
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  >
                    Uploading…
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Logged in as</div>
                <div className="mt-1 text-[14px] font-black text-white truncate">{authUser.email ?? "No email"}</div>
                <div className="mt-1 text-[12px] text-white/55 font-semibold truncate">
                  {profile.favouriteAflTeam ? `Favourite: ${profile.favouriteAflTeam}` : "Set your favourite team below"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <label
                className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-black cursor-pointer"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {uploadingAvatar ? "Uploading…" : "Change picture"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Stats + Badges */}
        <section
          className="rounded-3xl border p-4 sm:p-6 mb-6"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Match stats</div>
              <div className="mt-1 text-[14px] font-black text-white">Your season snapshot</div>
            </div>

            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black"
              style={{
                borderColor: "rgba(209,27,47,0.32)",
                background: "rgba(209,27,47,0.10)",
                color: "rgba(255,255,255,0.92)",
              }}
              title="Joose theme"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: JOOSE.red,
                  boxShadow: "0 0 14px rgba(209,27,47,0.55)",
                }}
              />
              LIVE
            </span>
          </div>

          {/* top cards */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Current streak" value={String(currentStreak)} hint="Your live streak right now." accent="red" />
            <StatCard label="Best streak" value={String(bestStreakDisplay)} hint="Your all-time peak streak." accent="white" />
            <StatCard label="Rounds played" value={String(roundsPlayed)} hint="How many rounds you've played." accent="white" />
          </div>

          {/* lifetime record */}
          <div
            className="mt-4 rounded-3xl border p-4 sm:p-5"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.28)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Lifetime record</div>
                <div className="mt-1 text-[14px] font-black text-white">All-time picks</div>
                <div className="mt-1 text-[12px] text-white/60 font-semibold">
                  (UI-only for now — we’ll wire real computed stats in step 2)
                </div>
              </div>

              <div
                className="rounded-2xl border px-3 py-2 text-center"
                style={{
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-black">Correct</div>
                <div className="text-[18px] font-black" style={{ color: JOOSE.red }}>
                  {correctPercent}%
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Best streak" value={String(bestStreakDisplay)} />
              <MiniStat label="Wins" value={String(lifetimeWins)} good />
              <MiniStat label="Losses" value={String(lifetimeLosses)} bad />
              <MiniStat label="Total picks" value={String(totalPicks)} />
            </div>
          </div>

          {/* badges */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Streak badges</div>
                <div className="mt-1 text-[14px] font-black text-white">Unlock as you climb</div>
              </div>

              <div className="text-[11px] text-white/55 font-semibold">Tip: badges match the streak animation</div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <BadgeCard level={3} title="3 in a row" subtitle="Keep building 😎" unlocked={!!localBadges["3"]} />
              <BadgeCard level={5} title="On Fire" subtitle="Bang! You're on 🔥" unlocked={!!localBadges["5"]} />
              <BadgeCard level={10} title="Elite" subtitle="10 straight 🏆" unlocked={!!localBadges["10"]} />
              <BadgeCard level={15} title="Dominance" subtitle="Ridiculous run 💪" unlocked={!!localBadges["15"]} />
              <BadgeCard level={20} title="Legendary" subtitle="GOAT status 🐐" unlocked={!!localBadges["20"]} />
            </div>
          </div>
        </section>

        {/* Personal details */}
        <section
          className="rounded-3xl border p-4 sm:p-6"
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Personal details</div>
              <div className="mt-1 text-[18px] font-black text-white">Your info</div>
              <div className="mt-1 text-[12px] text-white/60 font-semibold">Username & DOB are locked here.</div>
            </div>

            {isEditing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleEditing}
                  className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-black"
                  style={{
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="profile-form"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] font-black"
                  style={{
                    borderColor: "rgba(209,27,47,0.35)",
                    background: "rgba(209,27,47,0.18)",
                    color: "rgba(255,255,255,0.95)",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            ) : null}
          </div>

          {/* locked rows */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadOnlyRow label="Username" value={profile.username || authUser.displayName || "—"} />
            <ReadOnlyRow label="Date of birth" value={profile.dateOfBirth || "—"} />
          </div>

          <form id="profile-form" onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field
              label="First name"
              name="firstName"
              value={String(formValues.firstName ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              tone={isEditing ? "edit" : "view"}
            />
            <Field
              label="Surname"
              name="lastName"
              value={String(formValues.lastName ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              tone={isEditing ? "edit" : "view"}
            />
            <Field
              label="Suburb"
              name="suburb"
              value={String(formValues.suburb ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              tone={isEditing ? "edit" : "view"}
            />
            <Field
              label="State"
              name="state"
              value={String(formValues.state ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              placeholder="VIC, NSW, QLD…"
              tone={isEditing ? "edit" : "view"}
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              value={String(formValues.phone ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              tone={isEditing ? "edit" : "view"}
            />
            <Field
              label="Gender"
              name="gender"
              value={String(formValues.gender ?? "")}
              onChange={handleFieldChange}
              disabled={!isEditing}
              placeholder="Optional"
              tone={isEditing ? "edit" : "view"}
            />

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-white/60 mb-1">Favourite AFL team</label>
              <select
                name="favouriteAflTeam"
                value={String(formValues.favouriteAflTeam ?? "")}
                onChange={handleFieldChange}
                disabled={!isEditing}
                className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold focus:outline-none disabled:opacity-70"
                style={{
                  borderColor: isEditing ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.10)",
                  background: isEditing ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.28)",
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                <option value="">Select team…</option>
                {AFL_TEAMS.map((team) => (
                  <option key={team} value={team} style={{ color: "#000" }}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {/* Sponsor placeholder */}
          <div
            className="mt-6 rounded-3xl border p-4 text-center"
            style={{
              borderColor: "rgba(209,27,47,0.28)",
              background:
                "radial-gradient(900px 140px at 50% 0%, rgba(209,27,47,0.22) 0%, rgba(0,0,0,0.00) 70%), rgba(255,255,255,0.03)",
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/60 font-semibold">Sponsor banner placeholder</div>
            <div className="mt-1 text-[13px] font-black text-white">Put your major partner here</div>
            <div className="mt-1 text-[12px] text-white/55 font-semibold">(Clickable image / CTA in phase 2)</div>
          </div>

          <div className="mt-8 pb-2 text-center text-[11px] text-white/50 font-semibold">JOOSE © 2026</div>
        </section>
      </div>
    </div>
  );
}

/* ───────── Helper components ───────── */

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "red" | "white";
}) {
  const vColor = accent === "red" ? JOOSE.red : "rgba(255,255,255,0.92)";

  return (
    <div
      className="rounded-3xl border p-4"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.28)",
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
      <div className="mt-2 text-4xl font-black" style={{ color: vColor }}>
        {value}
      </div>
      <div className="mt-1 text-[12px] text-white/55 font-semibold">{hint}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}) {
  const color = good ? "rgba(45,255,122,0.92)" : bad ? "rgba(255,46,77,0.92)" : "rgba(255,255,255,0.92)";

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
      <div className="mt-1 text-[18px] font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-3xl border p-4"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.28)",
      }}
    >
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
      <div className="mt-2 text-[14px] font-black text-white">{value}</div>
      <div className="mt-1 text-[11px] text-white/45 font-semibold">Locked</div>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  tone: "edit" | "view";
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

function Field({ label, name, value, onChange, disabled, type = "text", placeholder, tone }: FieldProps) {
  const borderColor = tone === "edit" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.10)";
  const bg = tone === "edit" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.28)";

  return (
    <div>
      <label className="block text-[11px] text-white/60 mb-1 font-semibold tracking-wide">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold focus:outline-none disabled:opacity-70"
        style={{
          borderColor,
          background: bg,
          color: "rgba(255,255,255,0.92)",
        }}
      />
    </div>
  );
}

type BadgeProps = {
  level: number;
  title: string;
  subtitle: string;
  unlocked: boolean;
};

function BadgeCard({ level, title, subtitle, unlocked }: BadgeProps) {
  const imageSrc = `/badges/streak-${level}.png`;

  return (
    <div
      className="relative rounded-3xl border p-3 flex flex-col items-center text-center overflow-hidden"
      style={{
        borderColor: unlocked ? "rgba(209,27,47,0.40)" : "rgba(255,255,255,0.10)",
        background: unlocked
          ? "radial-gradient(900px 140px at 50% 0%, rgba(209,27,47,0.18) 0%, rgba(0,0,0,0.00) 70%), rgba(0,0,0,0.28)"
          : "rgba(0,0,0,0.28)",
        boxShadow: unlocked ? "0 18px 60px rgba(209,27,47,0.10)" : "none",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.10]">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.00) 100%)",
          }}
        />
      </div>

      <div className="relative mb-2 h-24 w-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={`Streak badge level ${level}`}
          className={`h-full w-full object-contain ${unlocked ? "" : "grayscale opacity-70"}`}
        />
        {!unlocked && (
          <div
            className="absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-[0.18em]"
            style={{
              color: "rgba(255,255,255,0.75)",
              textShadow: "0 2px 12px rgba(0,0,0,0.70)",
            }}
          >
            LOCKED
          </div>
        )}
      </div>

      <p className="relative text-[12px] font-black text-white">{title}</p>
      <p className="relative text-[11px] text-white/65 font-semibold mt-0.5">{subtitle}</p>

      <div
        className="relative mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.18em]"
        style={{
          borderColor: unlocked ? "rgba(45,255,122,0.22)" : "rgba(255,255,255,0.12)",
          background: unlocked ? "rgba(45,255,122,0.10)" : "rgba(255,255,255,0.06)",
          color: unlocked ? "rgba(45,255,122,0.92)" : "rgba(255,255,255,0.75)",
        }}
      >
        {unlocked ? "UNLOCKED" : "LOCKED"}
      </div>
    </div>
  );
}
