// app/admin/rounds/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { ROUND_OPTIONS, RoundKey } from "@/lib/rounds";

type SeasonConfig = {
  currentSeason?: number;
  currentRoundKey?: RoundKey;
};

const DEFAULT_SEASON = 2026 as const;
const DEFAULT_ROUND: RoundKey = "OR";

export default function AdminRoundsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [currentSeason, setCurrentSeason] = useState<number>(DEFAULT_SEASON);
  const [currentRoundKey, setCurrentRoundKey] =
    useState<RoundKey>(DEFAULT_ROUND);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Simple check for admin – for now just require login.
  // Later we can replace this with a proper isAdmin flag on the user doc.
  const isAdmin = !!user;

  useEffect(() => {
    if (!loading && !user) {
      // Not logged in → kick to auth
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadConfig = async () => {
      if (!user || initialLoaded) return;

      setError(null);
      try {
        const ref = doc(db, "config", "season");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as SeasonConfig;
          if (data.currentSeason) {
            setCurrentSeason(data.currentSeason);
          }
          if (data.currentRoundKey) {
            setCurrentRoundKey(data.currentRoundKey);
          }
        }
        setInitialLoaded(true);
      } catch (err) {
        console.error("Failed to load season config", err);
        setError("Failed to load current round. Please refresh.");
      }
    };

    loadConfig();
  }, [user, initialLoaded]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const ref = doc(db, "config", "season");
      await setDoc(
        ref,
        {
          currentSeason: currentSeason || DEFAULT_SEASON,
          currentRoundKey,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        },
        { merge: true }
      );

      setSuccess("Season settings updated. Frontend will now treat this as the current round.");
    } catch (err) {
      console.error("Failed to save season config", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        <p className="text-sm text-white/70">
          You must be logged in to view the admin rounds console.
        </p>
      </main>
    );
  }

  const currentRoundLabel =
    ROUND_OPTIONS.find((r) => r.key === currentRoundKey)?.label ?? "Unknown";

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Admin – Season & Rounds
            </h1>
            <p className="mt-1 text-sm text-white/70 max-w-2xl">
              Set which round the site treats as the{" "}
              <span className="font-semibold">current round</span>. This value
              will drive leaderboards, profile streak labels, marketing copy,
              and future auto-publishing of questions.
            </p>
          </div>
        </header>

        {/* Current summary */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <h2 className="text-lg font-semibold mb-3">Current settings</h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="bg-black/30 rounded-xl px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">
                Season
              </div>
              <div className="text-lg font-semibold">{currentSeason}</div>
            </div>
            <div className="bg-black/30 rounded-xl px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">
                Round key
              </div>
              <div className="text-lg font-semibold">{currentRoundKey}</div>
            </div>
            <div className="bg-black/30 rounded-xl px-4 py-3">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-1">
                Round label
              </div>
              <div className="text-lg font-semibold">{currentRoundLabel}</div>
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <h2 className="text-lg font-semibold">Update season</h2>
          <p className="text-xs text-white/60 mb-2">
            Changing these values is safe. We&apos;ll later wire everything so
            Picks, Leaderboards and Profile page read from this config.
          </p>

          {error && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
              {success}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Season year
              </label>
              <input
                type="number"
                className="w-full md:w-40 rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                value={currentSeason}
                onChange={(e) =>
                  setCurrentSeason(Number(e.target.value) || DEFAULT_SEASON)
                }
                min={2000}
                max={2100}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                Current round
              </label>
              <select
                className="w-full md:w-64 rounded-md bg-[#050816]/60 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70"
                value={currentRoundKey}
                onChange={(e) => setCurrentRoundKey(e.target.value as RoundKey)}
              >
                {ROUND_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-white/50 mt-1">
                Includes <strong>Opening Round</strong>, Rounds 1–23, and{" "}
                <strong>Finals</strong> (all 5 weeks combined).
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm px-5 py-2.5 transition disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save season settings"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
