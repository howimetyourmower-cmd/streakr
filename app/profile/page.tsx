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
  orderBy,
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
  quarter: number;
  pick: "yes" | "no";
  result?: string; // e.g. "Win", "Loss", "Pending", "Void"
  createdAtLabel?: string;
};

type PicksApiResponse = {
  games: { id: string }[];
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<UserDoc>({});
  const [loadedForm, setLoadedForm] = useState<UserDoc | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // streak + round context
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  // recent picks
  const [recentPicks, setRecentPicks] = useState<RecentPick[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState("");

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

        const nextForm: UserDoc = {
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
        };

        setForm(nextForm);
        setLoadedForm(nextForm);
        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load profile", err);
        setSaveError("Failed to load your profile. Please refresh.");
      }
    }

    if (user && !initialLoaded) load();
  }, [user, initialLoaded]);

  // Fetch current round (same logic as Picks page)
  useEffect(() => {
    const loadRound = async () => {
      try {
        const res = await fetch("/api/picks");
        if (!res.ok) return;
        const data: PicksApiResponse = await res.json();
        if (!data.games || data.games.length === 0) return;

        const firstId = data.games[0].id ?? "";
        let match = firstId.match(/round[_-]?(\d+)/i);
        if (!match) match = firstId.match(/(\d+)/);
        if (match) {
          const num = Number(match[1]);
          if (!Number.isNaN(num)) setCurrentRound(num);
        }
      } catch (err) {
        console.error("Failed to load round for profile", err);
      }
    };

    loadRound();
  }, []);

  // Load recent picks (last 5) for this user
  useEffect(() => {
    const loadRecentPicks = async () => {
      if (!user) return;
      setRecentLoading(true);
      setRecentError("");

      try {
        const picksRef = collection(db, "picks");
        const q = query(
          picksRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const snap = await getDocs(q);

        const list: RecentPick[] = snap.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          const createdAt =
            d.createdAt && d.createdAt.toDate
              ? d.createdAt.toDate()
              : null;

          const createdAtLabel = createdAt
            ? createdAt.toLocaleString("en-AU", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined;

          // Try to infer a friendly result label
          const rawResult: string | undefined =
            d.result || d.outcome || d.status;

          let resultLabel: string | undefined;
          if (!rawResult) {
            resultLabel = "Pending";
          } else {
            const lower = String(rawResult).toLowerCase();
            if (lower === "win" || lower === "correct" || lower === "yes") {
              resultLabel = "Win";
            } else if (
              lower === "loss" ||
              lower === "incorrect" ||
              lower === "no"
            ) {
              resultLabel = "Loss";
            } else if (lower === "void") {
              resultLabel = "Void";
            } else if (lower === "pending" || lower === "open") {
              resultLabel = "Pending";
            } else {
              resultLabel = rawResult;
            }
          }

          return {
            id: docSnap.id,
            match: d.match ?? "Unknown match",
            question: d.question ?? "",
            quarter: Number(d.quarter ?? 1),
            pick: (d.pick === "no" ? "no" : "yes") as "yes" | "no",
            result: resultLabel,
            createdAtLabel,
          };
        });

        setRecentPicks(list);
      } catch (err) {
        console.error("Failed to load recent picks", err);
        setRecentError("Failed to load your recent picks.");
      } finally {
        setRecentLoading(false);
      }
    };

    loadRecentPicks();
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
    if (!isEditing) return;

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

  const handleStartEdit = () => {
    setSaveError("");
    setSaveSuccess("");
    setPassword("");
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setSaveError("");
    setSaveSuccess("");
    setPassword("");
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    if (loadedForm) setForm(loadedForm);
    setIsEditing(false);
  };

  async function handleSave() {
    if (!user || !isEditing) return;

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

      const updated: UserDoc = {
        ...form,
        avatarUrl: avatarUrlToSave ?? form.avatarUrl,
      };
      setForm(updated);
      setLoadedForm(updated);

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

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-4xl font-bold">Profile</h1>
          {currentRound !== null && (
            <p className="text-sm text-orange-300 mt-1">
              Season 2026 • Round {currentRound}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded font-semibold text-sm"
            >
              Edit profile
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                type="button"
                className="px-4 py-2 bg-black/40 border border-white/20 rounded font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded font-semibold text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* AVATAR UPLOAD (only active in edit mode) */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-1">
          Avatar (optional)
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleAvatarSelect}
          className="text-sm"
          disabled={!isEditing}
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
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
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
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
            value={form.suburb ?? ""}
            onChange={(e) => update("suburb", e.target.value)}
          />
        </div>

        {/* State */}
        <div>
          <label className="block mb-1 text-sm">State</label>
          <input
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
            value={form.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1 text-sm">Phone</label>
          <input
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
            value={form.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block mb-1 text-sm">Gender</label>
          <select
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
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
            className={`w-full border border-white/10 p-2 rounded ${
              isEditing ? "bg-black/40" : "bg-black/20 text-gray-400"
            }`}
            disabled={!isEditing}
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
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">CURRENT STREAK</p>
          <p className="text-2xl font-bold">{form.currentStreak ?? 0}</p>
          {currentRound !== null && (
            <p className="text-[11px] text-gray-400 mt-1">
              Active in Round {currentRound}
            </p>
          )}
        </div>
        <div className="bg-black/30 p-4 rounded text-center">
          <p className="text-xs text-gray-400 mb-1">LONGEST STREAK</p>
          <p className="text-2xl font-bold">{form.longestStreak ?? 0}</p>
          {currentRound !== null && (
            <p className="text-[11px] text-gray-400 mt-1">
              This season • Round {currentRound}
            </p>
          )}
        </div>
      </div>

      {/* PASSWORD + MESSAGES (only when editing) */}
      {isEditing && (
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
      )}

      {saveError && <p className="text-red-400 mb-3">{saveError}</p>}
      {saveSuccess && <p className="text-green-400 mb-3">{saveSuccess}</p>}

      {/* RECENT PICKS */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Last 5 picks</h2>

        {recentLoading && (
          <p className="text-sm text-gray-400">Loading your picks…</p>
        )}

        {recentError && (
          <p className="text-sm text-red-400">{recentError}</p>
        )}

        {!recentLoading && !recentError && recentPicks.length === 0 && (
          <p className="text-sm text-gray-400">
            You haven&apos;t made any picks yet. Head to the Picks page to start
            your streak.
          </p>
        )}

        {!recentLoading && !recentError && recentPicks.length > 0 && (
          <ul className="space-y-2">
            {recentPicks.map((p) => (
              <li
                key={p.id}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">
                    {p.match}{" "}
                    <span className="text-[11px] text-gray-400 ml-1">
                      (Q{p.quarter})
                    </span>
                  </div>
                  {p.createdAtLabel && (
                    <span className="text-[11px] text-gray-400">
                      {p.createdAtLabel}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-gray-200">
                  {p.question}
                </div>
                <div className="flex items-center justify-between gap-2 text-[12px] mt-1">
                  <span>
                    Your pick:{" "}
                    <span
                      className={
                        p.pick === "yes" ? "text-emerald-300" : "text-red-300"
                      }
                    >
                      {p.pick.toUpperCase()}
                    </span>
                  </span>
                  <span>
                    Result:{" "}
                    <span
                      className={
                        p.result === "Win"
                          ? "text-emerald-300"
                          : p.result === "Loss"
                          ? "text-red-300"
                          : p.result === "Void"
                          ? "text-yellow-300"
                          : "text-gray-300"
                      }
                    >
                      {p.result ?? "Pending"}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
