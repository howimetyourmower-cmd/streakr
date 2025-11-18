"use client";

import {
  useEffect,
  useState,
  useMemo,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebaseClient";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
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

type RecentPick = {
  id: string;
  match: string;
  question: string;
  quarter?: number;
  pick?: "yes" | "no";
  result?: "win" | "loss" | "void";
  settledAt: Date | null;
  round?: number;
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

  const [recentPicks, setRecentPicks] = useState<RecentPick[]>([]);
  const [recentPicksLoading, setRecentPicksLoading] = useState(false);
  const [recentPicksError, setRecentPicksError] = useState("");

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

  // Load current round (from meta doc, or default to 1)
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

  // Load last 5 *settled* streak picks
  useEffect(() => {
    if (!user) return;

    const loadRecent = async () => {
      setRecentPicksLoading(true);
      setRecentPicksError("");

      try {
        const picksRef = collection(db, "picks");

        // Simple query: all picks for this user
        const q = query(
          picksRef,
          where("userId", "==", user.uid),
          limit(20)
        );

        const snap = await getDocs(q);

        const allPicks: RecentPick[] = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          const ts = data.settledAt;
          const settledDate: Date | null =
            ts && typeof ts.toDate === "function" ? ts.toDate() : null;

          return {
            id: docSnap.id,
            match: data.match ?? "",
            question: data.question ?? "",
            quarter:
              typeof data.quarter === "number" ? data.quarter : undefined,
            pick:
              data.pick === "yes" || data.pick === "no"
                ? data.pick
                : undefined,
            result:
              data.result === "win" ||
              data.result === "loss" ||
              data.result === "void"
                ? data.result
                : undefined,
            settledAt: settledDate,
            round:
              typeof data.round === "number" ? data.round : undefined,
          };
        });

        // Only keep settled picks, sort by settledAt DESC, take last 5
        const settled = allPicks
          .filter(
            (p) =>
              p.result === "win" ||
              p.result === "loss" ||
              p.result === "void"
          )
          .sort(
            (a, b) =>
              (b.settledAt?.getTime() ?? 0) -
              (a.settledAt?.getTime() ?? 0)
          )
          .slice(0, 5);

        setRecentPicks(settled);
      } catch (err) {
        console.error("Failed to load recent picks", err);
        setRecentPicksError("Failed to load your recent picks.");
      } finally {
        setRecentPicksLoading(false);
      }
    };

    loadRecent();
  }, [user]);

  if (!user) return null;

  const currentRoundLabel =
    currentRound && currentRound > 0
      ? `Active in Round ${currentRound}`
      : "Active this season";

  const longestRoundLabel =
    currentRound && currentRound > 0
      ? `This season • Round ${currentRound}`
      : "This season";

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-6">Profile</h1>

      {/* HEADER: avatar + email + edit button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
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

        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="self-start px-4 py-2 rounded-full border border-white/20 text-xs sm:text-sm hover:border-orange-400 hover:text-orange-400 transition-colors"
        >
          {isEditing ? "Stop editing" : "Edit profile"}
        </button>
      </div>

      {/* AVATAR UPLOAD (only when editing) */}
      {isEditing && (
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
      )}

      {/* FORM GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Username */}
        <div>
          <label className="block mb-1 text-sm">Username</label>
          <input
            className="w-full bg-black/20 border border-white/10 p-2 rounded text-gray-400"
            disabled
            value={form.username ?? ""}
            readOnly
          />
        </div>

        {/* First name */}
        <div>
          <label className="block mb-1 text-sm">First name</label>
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
            className={`w-full p-2 rounded border ${
              isEditing
                ? "bg-black/40 border-white/10"
                : "bg-black/20 border-white/10 text-gray-400"
            }`}
            value={form.surname ?? ""}
            onChange={(e) => update("surname", e.target.value)}
            disabled={!isEditing}
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block mb-1 text-sm">Date of birth</label>
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
            className={`w-full p-2 rounded border ${
              isEditing
                ? "bg-black/40 border-white/10"
                : "bg-black/20 border-white/10 text-gray-400"
            }`}
            value={form.suburb ?? ""}
            onChange={(e) => update("suburb", e.target.value)}
            disabled={!isEditing}
          />
        </div>

        {/* State */}
        <div>
          <label className="block mb-1 text-sm">State</label>
          <input
            className={`w-full p-2 rounded border ${
              isEditing
                ? "bg-black/40 border-white/10"
                : "bg-black/20 border-white/10 text-gray-400"
            }`}
            value={form.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
            disabled={!isEditing}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1 text-sm">Phone</label>
          <input
            className={`w-full p-2 rounded border ${
              isEditing
                ? "bg-black/40 border-white/10"
                : "bg-black/20 border-white/10 text-gray-400"
            }`}
            value={form.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            disabled={!isEditing}
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block mb-1 text-sm">Gender</label>
          <select
            className={`w-full p-2 rounded border ${
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
          <label className="block mb-1 text-sm">Favourite AFL team</label>
          <select
            className={`w-full p-2 rounded border ${
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

      {/* STREAK CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">CURRENT STREAK</p>
          <p className="text-2xl font-bold">
            {form.currentStreak ?? 0}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {currentRoundLabel}
          </p>
        </div>
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">LONGEST STREAK</p>
          <p className="text-2xl font-bold">
            {form.longestStreak ?? 0}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {longestRoundLabel}
          </p>
        </div>
      </div>

      {/* PASSWORD + SAVE (only when editing) */}
      {isEditing && (
        <div className="mb-6">
          <label className="block mb-1 text-sm">
            Current password (required to save changes)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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
      )}

      {saveError && <p className="text-red-400 mb-3">{saveError}</p>}
      {saveSuccess && <p className="text-green-400 mb-3">{saveSuccess}</p>}

      {isEditing && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded font-semibold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      )}

      {/* LAST 5 PICKS */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-2">Last 5 picks</h2>

        {recentPicksLoading && (
          <p className="text-sm text-gray-300">
            Loading your recent picks…
          </p>
        )}

        {!recentPicksLoading && recentPicksError && (
          <p className="text-sm text-red-400">
            {recentPicksError}
          </p>
        )}

        {!recentPicksLoading &&
          !recentPicksError &&
          recentPicks.length === 0 && (
            <p className="text-sm text-gray-300">
              You haven&apos;t had any streak picks settled yet. Once your
              locked questions are settled, they&apos;ll appear here.
            </p>
          )}

        {!recentPicksLoading &&
          !recentPicksError &&
          recentPicks.length > 0 && (
            <div className="mt-3 space-y-3">
              {recentPicks.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-semibold">
                      {p.match}
                      {typeof p.quarter === "number" && (
                        <span className="ml-1 text-[11px] text-gray-400">
                          (Q{p.quarter})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {p.settledAt
                        ? p.settledAt.toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 mb-1">
                    {p.question}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      Your pick{" "}
                      <span className="font-semibold">
                        {p.pick === "yes" ? "YES" : p.pick === "no" ? "NO" : "-"}
                      </span>
                    </span>
                    <span>
                      Result:{" "}
                      <span
                        className={
                          p.result === "win"
                            ? "text-emerald-400 font-semibold"
                            : p.result === "loss"
                            ? "text-red-400 font-semibold"
                            : "text-gray-300 font-semibold"
                        }
                      >
                        {p.result
                          ? p.result.toUpperCase()
                          : "Pending"}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

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
