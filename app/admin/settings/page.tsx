// app/admin/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { ROUND_OPTIONS, RoundKey, CURRENT_SEASON } from "@/lib/rounds";

type SeasonConfig = {
  season: number;
  currentRoundKey: RoundKey;
  currentRoundNumber: number;
  currentRoundLabel: string;
  updatedAt?: string;
};

function roundKeyToNumber(key: RoundKey): number {
  if (key === "OR") return 0;
  if (key === "FINALS") return 99;
  const match = key.match(/^R(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function roundNumberToKey(num: number): RoundKey {
  if (num === 0) return "OR";
  if (num === 99) return "FINALS";
  const key = `R${num}` as RoundKey;
  return key;
}

export default function SettingsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<SeasonConfig | null>(null);
  const [selectedRoundKey, setSelectedRoundKey] = useState<RoundKey>("OR");

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const ref = doc(db, "config", `season-${CURRENT_SEASON}`);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() as any;
          const roundKey: RoundKey =
            data.currentRoundKey ?? roundNumberToKey(data.currentRoundNumber ?? 0);

          const cfg: SeasonConfig = {
            season: data.season ?? CURRENT_SEASON,
            currentRoundKey: roundKey,
            currentRoundNumber: data.currentRoundNumber ?? roundKeyToNumber(roundKey),
            currentRoundLabel:
              data.currentRoundLabel ??
              ROUND_OPTIONS.find((o) => o.key === roundKey)?.label ??
              roundKey,
            updatedAt: data.updatedAt,
          };

          setConfig(cfg);
          setSelectedRoundKey(cfg.currentRoundKey);
        } else {
          // No config yet – create a local default (not saved until user clicks Save)
          const defaultKey: RoundKey = "OR";
          const defaultCfg: SeasonConfig = {
            season: CURRENT_SEASON,
            currentRoundKey: defaultKey,
            currentRoundNumber: roundKeyToNumber(defaultKey),
            currentRoundLabel:
              ROUND_OPTIONS.find((o) => o.key === defaultKey)?.label ?? defaultKey,
          };
          setConfig(defaultCfg);
          setSelectedRoundKey(defaultKey);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load season settings");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const roundNumber = roundKeyToNumber(selectedRoundKey);
      const label =
        ROUND_OPTIONS.find((o) => o.key === selectedRoundKey)?.label ??
        selectedRoundKey;

      const payload: SeasonConfig = {
        season: CURRENT_SEASON,
        currentRoundKey: selectedRoundKey,
        currentRoundNumber: roundNumber,
        currentRoundLabel: label,
        updatedAt: new Date().toISOString(),
      };

      const ref = doc(db, "config", `season-${CURRENT_SEASON}`);
      await setDoc(ref, payload, { merge: true });

      setConfig(payload);
      setMessage(`Saved. Current round is now ${label}.`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold text-white">Season settings</h1>
          <p className="text-sm text-slate-300">
            Control which round is currently active on the Picks page. No
            redeploy needed – this updates live via Firestore.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-lg font-semibold text-white mb-3">
            Current round for AFL {CURRENT_SEASON}
          </h2>

          {loading ? (
            <p className="text-sm text-slate-300">Loading settings…</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Active round
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-50"
                    value={selectedRoundKey}
                    onChange={(e) =>
                      setSelectedRoundKey(e.target.value as RoundKey)
                    }
                  >
                    {ROUND_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    Players will see questions from this round on the Picks page,
                    as long as the round is also <span className="font-semibold">published</span>.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Save current round"}
                  </button>
                </div>
              </div>

              {config && (
                <div className="mt-4 rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-sm text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Currently live (from settings)
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {config.currentRoundLabel}{" "}
                        <span className="text-xs text-slate-400">
                          ({config.currentRoundKey})
                        </span>
                      </div>
                    </div>
                    {config.updatedAt && (
                      <div className="text-xs text-slate-400">
                        Last updated:{" "}
                        {new Date(config.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {message && (
                <p className="mt-3 text-sm text-emerald-300">{message}</p>
              )}
              {error && (
                <p className="mt-3 text-sm text-red-400">Error: {error}</p>
              )}

              <p className="mt-4 text-xs text-slate-500">
                This page writes to Firestore collection <code>config</code> with
                document ID <code>season-{CURRENT_SEASON}</code>. The Picks API
                reads this value to decide which round of questions to serve.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
