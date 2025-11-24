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

/** Firestore user document fields you can edit on this page */
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
  marketingOptIn?: boolean; // 👈 NEW
};

/** What /api/profile returns in the stats block */
type ApiProfileStats = {
  displayName: string;
  username: string;
  favouriteTeam: string;
  suburb2: string;
  state?: string;
  currentStreak: number;
  bestStreak: number;
  correctPercentage: number; // 0–100
  roundsPlayed: number;
};

/** What /api/profile returns for each recent pick */
type ApiRecentPick = {
  id: string;
  round: string | number;
  match: string;
  question: string;
  userPick: "yes" | "no";
  result: "correct" | "wrong" | "pending" | "void";
  settledAt?: string; // ISO string
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<UserDoc>({});
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentRound, setCurrentRound] = useState<number | null>(1);

  // Stats + recent picks from /api/profile
  const [stats, setStats] = useState<ApiProfileStats | null>(null);
  const [recentPicks, setRecentPicks] = useState<ApiRecentPick[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

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
          marketingOptIn: (data as any).marketingOptIn ?? false, // 👈 NEW
        });

        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load profile", err);
        setSaveError("Failed to load your profile. Please refresh.");
      }
    }

    if (user && !initialLoaded) load();
  }, [user, initialLoaded]);

  // Load current round from meta doc (for label only)
  useEffect(() => {
    async function loadRound() {
      try {
        const metaRef = doc(db, "meta", "currentSeason");
        const snap = await getDoc(metaRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (typeof data.currentRound === "number") {
            setCurrentRound(data.currentRound);
            return;
          }
        }
        setCurrentRound(1);
      } catch (err) {
        console.error("Failed to load current round", err);
        setCurrentRound(1);
      }
    }

    loadRound();
  }, []);

  // Load stats + recent picks from /api/profile
  useEffect(() => {
    const loadStats = async () => {
      try {
        setStatsLoading(true);
        setStatsError("");

        const res = await fetch("/api/profile");
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const json = await res.json();
        setStats(json.stats as ApiProfileStats);
        setRecentPicks(json.recentPicks as ApiRecentPick[]);
      } catch (err) {
        console.error("Failed to load profile stats", err);
        setStatsError("Failed to load your streak stats.");
      } finally {
        setStatsLoading(false);
      }
    };

    if (user) {
      loadStats();
    }
  }, [user]);

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
    return "/default-avatar.png";
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
          marketingOptIn: form.marketingOptIn ?? false, // 👈 NEW
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
      setIsEditing(false);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const currentRoundLabel =
    currentRound && currentRound > 0
      ? `Active in Round ${currentRound}`
      : "Active this season";

  const longestRoundLabel =
    currentRound && currentRound > 0
      ? `This season • Round ${currentRound}`
      : "This season";

  const displayCurrentStreak =
    stats?.currentStreak ?? form.currentStreak ?? 0;

  const displayBestStreak = stats?.bestStreak ?? form.longestStreak ?? 0;

  const formatSettledAt = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const resultClass = (result: ApiRecentPick["result"]) => {
    switch (result) {
      case "correct":
        return "text-emerald-400 font-semibold";
      case "wrong":
        return "text-red-400 font-semibold";
      case "void":
        return "text-gray-300 font-semibold";
      case "pending":
      default:
        return "text-amber-300 font-semibold";
    }
  };

  return (
    <div className="px-4 py-8 sm:px-8 lg:px-16 max-w-5xl mx-auto text-white space-y-8">
      {/* PAGE TITLE */}
      <h1 className="text-3xl font-bold tracking-tight mb-2">Profile</h1>

      {/* HEADER: avatar + email + edit button */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/60 border border-slate-700/80 px-5 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={currentAvatarSrc}
            alt="Avatar"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/20 object-cover"
          />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
              Logged in as
            </p>
            <p className="text-sm font-semibold">
              {form.username || stats?.username || form.email || user.email}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-300">
                {form.email ?? user.email}
              </span>
              {user.emailVerified && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40">
                  ● Email verified
                </span>
              )}
              {(form.team || stats?.favouriteTeam) && (
                <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-300 border border-orange-500/40">
                  Favourite team: {form.team || stats?.favouriteTeam}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="hidden sm:inline-flex items-center rounded-full border border-slate-600 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800/80 transition"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="inline-flex items-center rounded-full bg-orange-500 px-4 py-1.5 text-xs sm:text-sm font-semibold text-black shadow-sm hover:bg-orange-400 transition"
          >
            {isEditing ? "Stop editing" : "Edit profile"}
          </button>
        </div>
      </section>

      {/* AVATAR UPLOAD (only when editing) */}
      {isEditing && (
        <section className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-5 py-4 sm:px-7 sm:py-5">
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
        </section>
      )}

      {/* DETAILS + STATS */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)]">
        {/* FORM GRID (details card) */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-5 py-5 sm:px-7 sm:py-6">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            Personal details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Username */}
            <div>
              <label className="block mb-1 text-xs font-semibold text-slate-400">
                Username
              </label>
              <input
                className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400 text-sm"
                disabled
                value={form.username ?? ""}
                readOnly
              />
            </div>

            {/* First name */}
            <div>
              <label className="block mb-1 text-xs font-semibold text-slate-400">
                First name
              </label>
              <input
                className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400 text-sm"
                disabled
                value={form.firstName ?? ""}
                readOnly
              />
            </div>

            {/* Surname */}
            <FieldInput
              label="Surname"
              value={form.surname ?? ""}
              editable={isEditing}
              onChange={(v) => update("surname", v)}
            />

            {/* DOB */}
            <div>
              <label className="block mb-1 text-xs font-semibold text-slate-400">
                Date of birth
              </label>
              <input
                className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400 text-sm"
                value={form.dob ?? ""}
                readOnly
                disabled
              />
            </div>

            {/* Suburb */}
            <FieldInput
              label="Suburb"
              value={form.suburb ?? ""}
              editable={isEditing}
              onChange={(v) => update("suburb", v)}
            />

            {/* State */}
            <FieldInput
              label="State"
              value={form.state ?? ""}
              editable={isEditing}
              onChange={(v) => update("state", v)}
            />

            {/* Phone */}
            <FieldInput
              label="Phone"
              value={form.phone ?? ""}
              editable={isEditing}
              onChange={(v) => update("phone", v)}
            />

            {/* Gender */}
            <div>
              <label className="block mb-1 text-xs font-semibold text-slate-400">
                Gender
              </label>
              <select
                className={`w-full p-2 rounded border text-sm ${
                  isEditing
                    ? "bg-black/40 border-white/10"
                    : "bg-black/20 border-white/10 text-gray-400"
                }`}
                value={form.gender ?? ""}
                onChange={(e) => update("gender", e.target.value)}
                disabled={!isEditing}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Team */}
            <div className="sm:col-span-2">
              <label className="block mb-1 text-xs font-semibold text-slate-400">
                Favourite AFL team
              </label>
              <select
                className={`w-full p-2 rounded border text-sm ${
                  isEditing
                    ? "bg-black/40 border-white/10"
                    : "bg-black/20 border-white/10 text-gray-400"
                }`}
                value={form.team ?? ""}
                onChange={(e) => update("team", e.target.value)}
                disabled={!isEditing}
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

          {/* EMAIL PREFERENCES – marketing opt in/out */}
          <div className="mt-4 border-t border-slate-700/80 pt-4">
            <p className="text-xs font-semibold text-slate-300 mb-2">
              Email preferences
            </p>
            <label className="flex items-start gap-2 text-[11px] text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-white/40 bg-black/40"
                checked={!!form.marketingOptIn}
                disabled={!isEditing}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    marketingOptIn: e.target.checked,
                  }))
                }
              />
              <span>
                Send me STREAKr news, tips and prize updates. You can opt out
                any time from this profile page.
              </span>
            </label>
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Some fields (like username and date of birth) can&apos;t be changed
            yet. Contact support if you need updates there.
          </p>
        </div>

        {/* STREAK STATS CARD */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-5 py-5 sm:px-6 sm:py-6">
            <h2 className="text-sm font-semibold text-slate-100 mb-4">
              Streak summary
            </h2>

            {statsLoading && (
              <p className="text-xs text-slate-300">Loading stats…</p>
            )}

            {!statsLoading && statsError && (
              <p className="text-xs text-red-400">{statsError}</p>
            )}

            {!statsLoading && !statsError && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-4 text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                      Current streak
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {displayCurrentStreak}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {currentRoundLabel}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-4 text-center">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                      Longest streak
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {displayBestStreak}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {longestRoundLabel}
                    </p>
                  </div>
                </div>

                {stats && (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Correct picks
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {stats.correctPercentage}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        Rounds played
                      </p>
                      <p className="mt-0.5 font-semibold">
                        {stats.roundsPlayed}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PASSWORD + SAVE (only when editing) */}
      {isEditing && (
        <section className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-5 py-5 sm:px-7 sm:py-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm">
              Current password (required to save changes)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                className="flex-1 bg-black/40 border border-white/10 p-2 rounded text-sm"
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

          {saveError && (
            <p className="text-sm text-red-400">{saveError}</p>
          )}
          {saveSuccess && (
            <p className="text-sm text-emerald-400">{saveSuccess}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-full font-semibold text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </section>
      )}

      {/* SPONSOR BANNER – between profile info and Last 5 picks */}
      <section className="mt-2">
        <div className="rounded-2xl bg-gradient-to-r from-sky-700 via-sky-500 to-sky-600 p-[1px] shadow-[0_0_40px_rgba(56,189,248,0.35)]">
          <div className="flex flex-col gap-4 rounded-2xl bg-sky-600/90 px-4 py-4 md:flex-row md:items-center md:px-6 md:py-5">
            {/* Text side */}
            <div className="flex-1">
              <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-900">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-900" />
                Official Partner
              </div>
              <h3 className="mt-2 text-xl font-extrabold leading-tight text-white md:text-2xl">
                Boost the banter,
                <span className="block text-yellow-300">
                  power up your streak nights.
                </span>
              </h3>
              <p className="mt-2 max-w-md text-xs text-sky-100 md:text-sm">
                Our featured partner helps bring more stats, more prizes and
                more fun match-day moments to STREAKr players all season long.
              </p>

              <button className="mt-3 inline-flex items-center rounded-full bg-yellow-300 px-4 py-2 text-xs font-semibold text-sky-900 transition hover:bg-yellow-200 md:text-sm">
                Learn more about our partner
              </button>
            </div>

            {/* Optional logo side */}
            <div className="flex justify-center md:justify-end">
              <img
                src="/sponsor-placeholder.png" // replace with real logo when ready
                alt="Sponsor logo"
                className="w-28 opacity-90 md:w-32"
              />
            </div>
          </div>
        </div>
      </section>

      {/* LAST 5 PICKS */}
      <section className="rounded-2xl bg-slate-900/80 border border-slate-700/80 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Last 5 picks</h2>
          {!statsLoading && (
            <span className="text-[11px] text-slate-400">
              {recentPicks.length > 0
                ? `Showing ${recentPicks.length} most recent`
                : "No settled picks yet"}
            </span>
          )}
        </div>

        {statsLoading && (
          <p className="text-sm text-slate-300">
            Loading your recent picks…
          </p>
        )}

        {!statsLoading && !statsError && recentPicks.length === 0 && (
          <p className="text-sm text-slate-300">
            You haven&apos;t had any streak picks settled yet. Once your
            locked questions are settled, they&apos;ll appear here.
          </p>
        )}

        {!statsLoading && !statsError && recentPicks.length > 0 && (
          <div className="mt-3 space-y-3">
            {recentPicks.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold">
                    {p.match}
                    {p.round && (
                      <span className="ml-1 text-[11px] text-gray-400">
                        (Round {p.round})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {formatSettledAt(p.settledAt)}
                  </div>
                </div>
                <div className="text-xs text-gray-300 mb-1">
                  {p.question}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>
                    Your pick{" "}
                    <span className="font-semibold">
                      {p.userPick === "yes"
                        ? "YES"
                        : p.userPick === "no"
                        ? "NO"
                        : "-"}
                    </span>
                  </span>
                  <span>
                    Result:{" "}
                    <span className={resultClass(p.result)}>
                      {p.result === "correct"
                        ? "WIN"
                        : p.result === "wrong"
                        ? "LOSS"
                        : p.result === "void"
                        ? "VOID"
                        : "PENDING"}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!statsLoading && statsError && (
          <p className="text-sm text-red-400">{statsError}</p>
        )}
      </section>

      {/* LOG OUT (mobile / fallback) */}
      <div className="mt-4 sm:hidden">
        <button
          onClick={() => signOut(auth)}
          className="w-full px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-semibold text-sm"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

/** Small helper for editable / read-only inputs */
function FieldInput({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block mb-1 text-xs font-semibold text-slate-400">
        {label}
      </label>
      <input
        className={`w-full p-2 rounded border text-sm ${
          editable
            ? "bg-black/40 border-white/10"
            : "bg-black/20 border-white/10 text-gray-400"
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!editable}
      />
    </div>
  );
}
