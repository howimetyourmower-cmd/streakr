// /app/profile/ProfileClient.tsx
"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebaseClient";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  DocumentData,
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

const SCREAMR = {
  bg: "#000000",
  red: "#FF2E4D",
  cyan: "#00E5FF",
  green: "#2DFF7A",
  white: "#FFFFFF",

  panel: "rgba(10,10,12,0.90)",
  panel2: "rgba(0,0,0,0.28)",
  border: "rgba(255,255,255,0.10)",
  soft: "rgba(255,255,255,0.06)",
  soft2: "rgba(255,255,255,0.03)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.70)",
  muted2: "rgba(255,255,255,0.55)",
};

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function heatLabel(streak: number): { label: string; tone: "cold" | "warm" | "hot" | "nuclear" } {
  if (streak >= 15) return { label: "NUCLEAR", tone: "nuclear" };
  if (streak >= 10) return { label: "ON FIRE", tone: "hot" };
  if (streak >= 5) return { label: "HEATING UP", tone: "warm" };
  return { label: "ALIVE", tone: "cold" };
}

type RoundInfo = {
  id: string;
  number: number | null; // 0 = Opening Round
  label: string; // "Opening Round" | "Round X" | fallback
};

function roundLabelFromNumber(n: number | null): string {
  if (n === null) return "Round —";
  if (n === 0) return "Opening Round";
  return `Round ${n}`;
}

function parseRoundNumberFromId(id: string): number | null {
  const s = (id || "").toLowerCase();

  if (s.includes("opening")) return 0;
  if (s.includes("round-0") || s.includes("round_0") || s.includes("r0")) return 0;

  // afl-2026-r2, afl-2026-r23
  const m1 = s.match(/(?:^|-)r(\d+)(?:$|-)/);
  if (m1?.[1]) return Number(m1[1]);

  // round-2
  const m2 = s.match(/round[-_](\d+)/);
  if (m2?.[1]) return Number(m2[1]);

  // 2026-2, afl-2026-2
  const m3 = s.match(/(?:^|-)20\d{2}-(\d+)(?:$|-)/);
  if (m3?.[1]) return Number(m3[1]);

  // trailing -2
  const m4 = s.match(/-(\d+)$/);
  if (m4?.[1]) return Number(m4[1]);

  return null;
}

function pickBestCurrentRound(candidates: Array<{ id: string; data: DocumentData }>): RoundInfo | null {
  if (!candidates.length) return null;

  const currentish = candidates.filter(({ data }) => {
    const status = String(data?.status ?? "").toLowerCase();
    const isCurrent = data?.isCurrent === true;
    const isActive = data?.isActive === true;
    const isOpen = data?.isOpen === true;
    return isCurrent || isActive || isOpen || status === "current" || status === "active" || status === "open";
  });

  const pool = currentish.length ? currentish : candidates;

  let best: { id: string; n: number | null } | null = null;
  for (const r of pool) {
    const n = parseRoundNumberFromId(r.id);
    if (best === null) best = { id: r.id, n };
    else {
      const a = best.n ?? -9999;
      const b = n ?? -9999;
      if (b > a) best = { id: r.id, n };
    }
  }

  if (!best) return null;
  return { id: best.id, number: best.n, label: roundLabelFromNumber(best.n) };
}

/**
 * ✅ Load current round from Firestore.
 * Priority:
 * 1) config/season-2026 (matches your screenshot)
 * 2) other config docs (season/settings/etc)
 * 3) fallback scan of rounds collection
 */
async function loadCurrentRound(): Promise<RoundInfo | null> {
  // 1) Direct hit: your actual doc
  try {
    const snap = await getDoc(doc(db, "config", "season-2026"));
    if (snap.exists()) {
      const d = snap.data() as any;

      const id = String(d?.currentRoundId ?? "").trim();
      const label = String(d?.currentRoundLabel ?? "").trim();
      const numRaw = d?.currentRoundNumber;

      const number =
        typeof numRaw === "number"
          ? numRaw
          : typeof numRaw === "string" && numRaw.trim().length
          ? Number(numRaw)
          : (id ? parseRoundNumberFromId(id) : null);

      const finalLabel = label || roundLabelFromNumber(Number.isFinite(number as number) ? (number as number) : null);

      if (id || label || typeof numRaw !== "undefined") {
        return {
          id: id || "season-2026",
          number: Number.isFinite(number as number) ? (number as number) : null,
          label: finalLabel,
        };
      }
    }
  } catch {
    // ignore
  }

  // 2) Try other common config doc IDs
  const configDocIds = ["season", "settings", "app", "currentRound", "season-2025"];
  const roundFieldCandidates = ["currentRoundId", "activeRoundId", "roundId", "currentRound", "activeRound"];

  for (const docId of configDocIds) {
    try {
      const snap = await getDoc(doc(db, "config", docId));
      if (!snap.exists()) continue;
      const d = snap.data() as any;

      const label = String(d?.currentRoundLabel ?? "").trim();
      const numRaw = d?.currentRoundNumber;
      const num =
        typeof numRaw === "number"
          ? numRaw
          : typeof numRaw === "string" && numRaw.trim().length
          ? Number(numRaw)
          : undefined;

      for (const key of roundFieldCandidates) {
        const v = d?.[key];
        if (typeof v === "string" && v.trim().length) {
          const id = v.trim();
          const n = typeof num === "number" && Number.isFinite(num) ? num : parseRoundNumberFromId(id);
          return { id, number: Number.isFinite(n as number) ? (n as number) : null, label: label || roundLabelFromNumber(n) };
        }
      }

      const afl = d?.afl;
      if (afl && typeof afl === "object") {
        for (const key of roundFieldCandidates) {
          const v = afl?.[key];
          if (typeof v === "string" && v.trim().length) {
            const id = v.trim();
            const n = typeof num === "number" && Number.isFinite(num) ? num : parseRoundNumberFromId(id);
            return { id, number: Number.isFinite(n as number) ? (n as number) : null, label: label || roundLabelFromNumber(n) };
          }
        }
      }
    } catch {
      // ignore and continue
    }
  }

  // 3) Fallback: scan rounds collection and infer
  try {
    const snap = await getDocs(collection(db, "rounds"));
    const candidates: Array<{ id: string; data: DocumentData }> = [];
    snap.forEach((d) => candidates.push({ id: d.id, data: d.data() }));

    const filtered = candidates.filter(({ id }) => {
      const s = id.toLowerCase();
      return s.includes("afl") || s.includes("round") || s.includes("2026") || s.includes("-r");
    });

    const best = pickBestCurrentRound(filtered.length ? filtered : candidates);
    return best;
  } catch {
    return null;
  }
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

  // ✅ actual current round (derived from config/rounds)
  const [currentRound, setCurrentRound] = useState<RoundInfo | null>(null);
  const [roundLoading, setRoundLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (!u) {
        router.push("/auth?mode=login&returnTo=/profile");
      }
    });
    return () => unsub();
  }, [router]);

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

          const levelBadges: Record<string, boolean> = {};
          [3, 5, 10, 15, 20].forEach((lvl) => {
            const key = `badges_level${lvl}`;
            if ((firestoreData as any)[key] === true) {
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
            avatarUrl: (user as any).photoURL || "",
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

  // ✅ Load "current round" from the same Firestore area your app already has
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setRoundLoading(true);
      try {
        const r = await loadCurrentRound();
        setCurrentRound(r);
      } catch (e) {
        console.error("Failed to load current round", e);
      } finally {
        setRoundLoading(false);
      }
    };
    run();
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

  const currentStreak = toNum(profile.currentStreak, 0);
  const longestStreak = toNum(profile.longestStreak, 0);
  const lifetimeBestStreak = toNum(profile.lifetimeBestStreak, 0);
  const bestStreakDisplay = Math.max(currentStreak, lifetimeBestStreak, longestStreak);

  const lifetimeWins = toNum(profile.lifetimeWins, 0);
  const lifetimeLosses = toNum(profile.lifetimeLosses, 0);
  const roundsPlayed = toNum(profile.roundsPlayed, 0);
  const totalPicks = lifetimeWins + lifetimeLosses;
  const correctPercent = totalPicks > 0 ? Math.round((lifetimeWins / totalPicks) * 100) : 0;

  const avatarUrl = profile.avatarUrl || profile.photoURL || authUser?.photoURL || "";

  const displayName = useMemo(() => {
    const name =
      authUser?.displayName ||
      profile.username ||
      [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    return name || "SCREAMR Player";
  }, [authUser?.displayName, profile.username, profile.firstName, profile.lastName]);

  const heat = useMemo(() => heatLabel(currentStreak), [currentStreak]);
  const heatPct = useMemo(() => clamp(Math.round((currentStreak / 20) * 100), 0, 100), [currentStreak]);

  const uiRoundLabel = useMemo(() => {
    if (roundLoading) return "Round …";
    if (currentRound?.label) return currentRound.label;
    return "Round —";
  }, [currentRound?.label, roundLoading]);

  const uiLastMatch = useMemo(() => {
    return roundsPlayed > 0 ? "Last match: Coming soon" : "No match played yet";
  }, [roundsPlayed]);

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

  const TonePill = ({ text, tone }: { text: string; tone: "cold" | "warm" | "hot" | "nuclear" }) => {
    const base =
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.14em]";
    if (tone === "nuclear") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(0,229,255,0.28)",
            background:
              "linear-gradient(180deg, rgba(0,229,255,0.18) 0%, rgba(255,46,77,0.14) 100%)",
            boxShadow: "0 10px 26px rgba(0,229,255,0.10)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: SCREAMR.cyan, boxShadow: "0 0 16px rgba(0,229,255,0.65)" }}
          />
          {text}
        </span>
      );
    }
    if (tone === "hot") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,46,77,0.35)",
            background: "rgba(255,46,77,0.16)",
            boxShadow: "0 10px 26px rgba(255,46,77,0.12)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: SCREAMR.red, boxShadow: "0 0 16px rgba(255,46,77,0.65)" }}
          />
          {text}
        </span>
      );
    }
    if (tone === "warm") {
      return (
        <span
          className={base}
          style={{
            borderColor: "rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 0 14px rgba(255,255,255,0.35)",
            }}
          />
          {text}
        </span>
      );
    }
    return (
      <span
        className={base}
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.32)",
        }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "rgba(255,255,255,0.35)" }} />
        {text}
      </span>
    );
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: SCREAMR.bg }}>
      <style>{`
        .screamr-sparks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.16;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(circle at 12% 78%, rgba(0,229,255,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 22%, rgba(255,46,77,0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 55% 62%, rgba(255,255,255,0.20) 0 1px, transparent 2px);
          background-size: 220px 220px;
          animation: sparksMove 6.5s linear infinite;
        }
        @keyframes sparksMove {
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-220px, -220px, 0); }
        }

        .screamr-spotlights {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: 0.55;
          background:
            radial-gradient(700px 260px at 20% 0%, rgba(0,229,255,0.14) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(700px 260px at 80% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0) 70%),
            radial-gradient(900px 340px at 50% 110%, rgba(255,46,77,0.08) 0%, rgba(0,0,0,0) 70%);
        }

        .screamr-cardBorder {
          background: linear-gradient(135deg,
            rgba(255,46,77,0.52) 0%,
            rgba(255,46,77,0.10) 25%,
            rgba(0,229,255,0.10) 55%,
            rgba(255,46,77,0.40) 100%);
          box-shadow: 0 24px 80px rgba(0,0,0,0.75);
        }

        .screamr-pill {
          position: relative;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
          color: rgba(255,255,255,0.92);
          box-shadow:
            0 10px 26px rgba(0,0,0,0.35),
            0 0 0 1px rgba(0,0,0,0.12) inset;
          overflow: hidden;
        }
        .screamr-pill::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -35%;
          width: 60%;
          height: 200%;
          transform: rotate(22deg);
          background: linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.16), rgba(255,255,255,0.00));
          animation: pillShine 3.6s ease-in-out infinite;
        }
        @keyframes pillShine {
          0% { transform: translateX(-40%) rotate(22deg); opacity: 0; }
          18% { opacity: 0.65; }
          40% { transform: translateX(210%) rotate(22deg); opacity: 0; }
          100% { transform: translateX(210%) rotate(22deg); opacity: 0; }
        }

        .heatTrack {
          position: relative;
          height: 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          overflow: hidden;
        }
        .heatFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg,
            rgba(0,229,255,0.85) 0%,
            rgba(255,46,77,0.90) 55%,
            rgba(255,46,77,1.00) 100%);
          box-shadow: 0 0 24px rgba(255,46,77,0.18);
          animation: heatPulse 1.8s ease-in-out infinite;
        }
        @keyframes heatPulse {
          0% { filter: brightness(0.95); }
          50% { filter: brightness(1.10); }
          100% { filter: brightness(0.95); }
        }

        .badgeUnlocked {
          animation: popIn 420ms ease-out both;
          box-shadow: 0 18px 60px rgba(255,46,77,0.12);
        }
        @keyframes popIn {
          0% { transform: scale(0.92); opacity: 0.0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* top sponsor strip */}
      <div
        className="w-full border-b"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(255,46,77,0.10) 0%, rgba(0,0,0,0.00) 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] tracking-[0.18em] font-semibold text-white/55">OFFICIAL PARTNER</div>
          <div className="text-[11px] tracking-[0.12em] text-white/35 truncate">
            Proudly supporting SCREAMR all season long
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-black tracking-[0.10em] uppercase">Player HQ</h1>

              <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black tracking-[0.14em]">
                SCREAMR
              </span>

              <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: SCREAMR.red, boxShadow: "0 0 14px rgba(255,46,77,0.55)" }}
                />
                LIVE
              </span>

              <TonePill text={heat.label} tone={heat.tone} />
            </div>

            <p className="mt-2 text-sm text-white/65">
              Welcome back, <span className="font-semibold text-white">{displayName}</span>. Your identity card, streak heat and badges live here.
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
                borderColor: isEditing ? "rgba(255,255,255,0.18)" : "rgba(255,46,77,0.35)",
                background: isEditing ? "rgba(255,255,255,0.06)" : "rgba(255,46,77,0.14)",
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

        {/* PLAYER CARD HERO */}
        <div className="relative rounded-3xl overflow-hidden mb-4">
          <div className="absolute inset-0 screamr-sparks" />
          <div className="absolute inset-0 screamr-spotlights" />
          <div className="relative p-[1px] rounded-3xl screamr-cardBorder">
            <div
              className="rounded-3xl border overflow-hidden"
              style={{
                borderColor: "rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.55)",
              }}
            >
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className="h-16 w-16 rounded-[22px] p-[3px]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,46,77,0.85) 0%, rgba(0,229,255,0.18) 60%, rgba(255,46,77,0.55) 100%)",
                        boxShadow: "0 16px 34px rgba(255,46,77,0.16)",
                      }}
                    >
                      <div
                        className="h-full w-full overflow-hidden rounded-[18px]"
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
                            {(displayName?.[0] || "S").toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    {uploadingAvatar && (
                      <div
                        className="absolute inset-0 rounded-[22px] flex items-center justify-center text-[11px] font-black"
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
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-semibold">Player card</div>
                    <div className="mt-1 text-[16px] font-black text-white truncate">{displayName}</div>
                    <div className="mt-1 text-[12px] text-white/55 font-semibold truncate">{authUser.email ?? "No email"}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black">
                        {profile.favouriteAflTeam ? `⭐ ${profile.favouriteAflTeam}` : "⭐ Set favourite team"}
                      </span>

                      <span
                        className="screamr-pill inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black"
                        style={{ borderColor: "rgba(0,229,255,0.20)" }}
                      >
                        ID: {user.uid.slice(0, 6).toUpperCase()}
                      </span>

                      <span
                        className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black"
                        style={{
                          borderColor: "rgba(255,46,77,0.25)",
                          background: "rgba(255,46,77,0.10)",
                        }}
                        title={currentRound?.id ? `Source: ${currentRound.id}` : "Current round"}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: roundLoading ? "rgba(255,255,255,0.35)" : SCREAMR.red,
                            boxShadow: roundLoading ? "none" : "0 0 14px rgba(255,46,77,0.55)",
                          }}
                        />
                        {uiRoundLabel}
                      </span>
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
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                  </label>
                </div>
              </div>

              {/* HEAT METER STRIP */}
              <div className="px-5 sm:px-6 pb-5 sm:pb-6">
                <div className="rounded-3xl border p-4" style={{ borderColor: SCREAMR.border, background: "rgba(0,0,0,0.30)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Streak heat meter</div>
                      <div className="mt-1 text-[14px] font-black text-white">
                        Current streak: <span style={{ color: SCREAMR.red }}>{currentStreak}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-white/55 font-semibold">{uiLastMatch}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-black">Heat</div>
                      <div className="mt-1 text-[18px] font-black" style={{ color: SCREAMR.cyan }}>
                        {heatPct}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 heatTrack">
                    <div className="heatFill" style={{ width: `${heatPct}%` }} />
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <LockerTile label="This round" value={uiRoundLabel} hint="Pulled from Firestore config/season-2026." accent="cyan" />
                    <LockerTile label="Best streak" value={String(bestStreakDisplay)} hint="Your all-time peak." accent="red" />
                    <LockerTile label="Rounds played" value={String(roundsPlayed)} hint="Total rounds you’ve joined." accent="white" />
                  </div>
                </div>
              </div>
              {/* /HEAT METER STRIP */}
            </div>
          </div>
        </div>

        {/* Stats + Badges */}
        <section
          className="rounded-3xl border p-4 sm:p-6 mb-6"
          style={{
            borderColor: SCREAMR.border,
            background: SCREAMR.soft2,
            boxShadow: "0 18px 60px rgba(0,0,0,0.65)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Match stats</div>
              <div className="mt-1 text-[14px] font-black text-white">Your season snapshot</div>
            </div>

            <span className="screamr-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black" title="Live">
              <span className="h-2 w-2 rounded-full" style={{ background: SCREAMR.red, boxShadow: "0 0 14px rgba(255,46,77,0.55)" }} />
              LIVE
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Current streak" value={String(currentStreak)} hint="Your live streak right now." accent="red" />
            <StatCard label="Best streak" value={String(bestStreakDisplay)} hint="Your all-time peak streak." accent="white" />
            <StatCard label="Rounds played" value={String(roundsPlayed)} hint="How many rounds you've played." accent="white" />
          </div>

          <div className="mt-4 rounded-3xl border p-4 sm:p-5" style={{ borderColor: SCREAMR.border, background: "rgba(0,0,0,0.28)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Lifetime record</div>
                <div className="mt-1 text-[14px] font-black text-white">All-time picks</div>
                <div className="mt-1 text-[12px] text-white/60 font-semibold">(UI-only for now — real computed stats later)</div>
              </div>

              <div className="rounded-2xl border px-3 py-2 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-black">Correct</div>
                <div className="text-[18px] font-black" style={{ color: SCREAMR.red }}>
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

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-semibold">Streak badges</div>
                <div className="mt-1 text-[14px] font-black text-white">Unlock as you climb</div>
              </div>

              <div className="text-[11px] text-white/55 font-semibold">Unlocked badges animate</div>
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
            borderColor: SCREAMR.border,
            background: SCREAMR.soft2,
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
                    borderColor: "rgba(255,46,77,0.35)",
                    background: "rgba(255,46,77,0.18)",
                    color: "rgba(255,255,255,0.95)",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReadOnlyRow label="Username" value={profile.username || authUser.displayName || "—"} />
            <ReadOnlyRow label="Date of birth" value={profile.dateOfBirth || "—"} />
          </div>

          <form id="profile-form" onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="First name" name="firstName" value={String(formValues.firstName ?? "")} onChange={handleFieldChange} disabled={!isEditing} tone={isEditing ? "edit" : "view"} />
            <Field label="Surname" name="lastName" value={String(formValues.lastName ?? "")} onChange={handleFieldChange} disabled={!isEditing} tone={isEditing ? "edit" : "view"} />
            <Field label="Suburb" name="suburb" value={String(formValues.suburb ?? "")} onChange={handleFieldChange} disabled={!isEditing} tone={isEditing ? "edit" : "view"} />
            <Field label="State" name="state" value={String(formValues.state ?? "")} onChange={handleFieldChange} disabled={!isEditing} placeholder="VIC, NSW, QLD…" tone={isEditing ? "edit" : "view"} />
            <Field label="Phone" name="phone" type="tel" value={String(formValues.phone ?? "")} onChange={handleFieldChange} disabled={!isEditing} tone={isEditing ? "edit" : "view"} />
            <Field label="Gender" name="gender" value={String(formValues.gender ?? "")} onChange={handleFieldChange} disabled={!isEditing} placeholder="Optional" tone={isEditing ? "edit" : "view"} />

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

          <div
            className="mt-6 rounded-3xl border p-4 text-center"
            style={{
              borderColor: "rgba(255,46,77,0.28)",
              background: "radial-gradient(900px 140px at 50% 0%, rgba(255,46,77,0.22) 0%, rgba(0,0,0,0.00) 70%), rgba(255,255,255,0.03)",
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/60 font-semibold">Sponsor banner placeholder</div>
            <div className="mt-1 text-[13px] font-black text-white">Put your major partner here</div>
            <div className="mt-1 text-[12px] text-white/55 font-semibold">(Clickable image / CTA in phase 2)</div>
          </div>

          <div className="mt-8 pb-2 text-center text-[11px] text-white/50 font-semibold">SCREAMR © 2026</div>
        </section>
      </div>
    </div>
  );
}

/* ───────── Helper components ───────── */

function LockerTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "red" | "cyan" | "white";
}) {
  const glow = accent === "red" ? SCREAMR.red : accent === "cyan" ? SCREAMR.cyan : "rgba(255,255,255,0.35)";
  const border =
    accent === "red"
      ? "rgba(255,46,77,0.22)"
      : accent === "cyan"
      ? "rgba(0,229,255,0.18)"
      : "rgba(255,255,255,0.12)";

  return (
    <div className="rounded-3xl border p-4 relative overflow-hidden" style={{ borderColor: border, background: "rgba(255,255,255,0.04)" }}>
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl opacity-35" style={{ background: glow }} />
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
        <div className="mt-2 text-[22px] font-black" style={{ color: accent === "white" ? "rgba(255,255,255,0.92)" : glow }}>
          {value}
        </div>
        <div className="mt-1 text-[11px] text-white/55 font-semibold">{hint}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: "red" | "white" }) {
  const vColor = accent === "red" ? SCREAMR.red : "rgba(255,255,255,0.92)";

  return (
    <div className="rounded-3xl border p-4 relative overflow-hidden" style={{ borderColor: SCREAMR.border, background: "rgba(0,0,0,0.28)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl" style={{ background: accent === "red" ? SCREAMR.red : SCREAMR.cyan }} />
      </div>

      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
        <div className="mt-2 text-4xl font-black" style={{ color: vColor }}>
          {value}
        </div>
        <div className="mt-1 text-[12px] text-white/55 font-semibold">{hint}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  const color = good ? "rgba(45,255,122,0.92)" : bad ? "rgba(255,46,77,0.92)" : "rgba(255,255,255,0.92)";

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: SCREAMR.border, background: "rgba(255,255,255,0.04)" }}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/55 font-semibold">{label}</div>
      <div className="mt-1 text-[18px] font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: SCREAMR.border, background: "rgba(0,0,0,0.28)" }}>
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
        style={{ borderColor, background: bg, color: SCREAMR.text }}
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
      className={`relative rounded-3xl border p-3 flex flex-col items-center text-center overflow-hidden ${
        unlocked ? "badgeUnlocked" : ""
      }`}
      style={{
        borderColor: unlocked ? "rgba(255,46,77,0.40)" : SCREAMR.border,
        background: unlocked
          ? "radial-gradient(900px 140px at 50% 0%, rgba(255,46,77,0.18) 0%, rgba(0,0,0,0.00) 70%), rgba(0,0,0,0.28)"
          : "rgba(0,0,0,0.28)",
      }}
    >
      {unlocked ? (
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-30" style={{ background: SCREAMR.red }} />
      ) : null}

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
              color: "rgba(255,255,255,0.80)",
              textShadow: "0 2px 12px rgba(0,0,0,0.70)",
              background: "rgba(0,0,0,0.30)",
            }}
          >
            LOCKED
          </div>
        )}
        {unlocked ? (
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.16em]"
            style={{
              border: "1px solid rgba(0,229,255,0.22)",
              background: "rgba(0,229,255,0.10)",
              color: "rgba(255,255,255,0.92)",
              boxShadow: "0 10px 26px rgba(0,229,255,0.10)",
            }}
          >
            NEW
          </div>
        ) : null}
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
