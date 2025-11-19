"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type RoundItem = {
  id: string;
  round: number;
  season: number;
  published: boolean;
  gameCount: number;
};

const CURRENT_SEASON = 2026;

export default function AdminRoundsPage() {
  const { user } = useAuth();

  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoundId, setSavingRoundId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadRounds = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const q = query(
          collection(db, "rounds"),
          where("season", "==", CURRENT_SEASON),
          orderBy("round", "asc")
        );

        const snap = await getDocs(q);

        const items: RoundItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            round: typeof data.round === "number" ? data.round : 0,
            season: typeof data.season === "number" ? data.season : CURRENT_SEASON,
            published: !!data.published,
            gameCount: Array.isArray(data.games) ? data.games.length : 0,
          };
        });

        setRounds(items);
      } catch (err: any) {
        console.error("Failed to load rounds", err);
        setError("Failed to load rounds. Check Vercel logs if this continues.");
      } finally {
        setLoading(false);
      }
    };

    loadRounds();
  }, []);

  const setAsCurrentRound = async (roundId: string) => {
    if (!roundId) return;

    setSavingRoundId(roundId);
    setError("");
    setSuccess("");

    try {
      await runTransaction(db, async (tx) => {
        // Get all rounds for this season inside the transaction
        const q = query(
          collection(db, "rounds"),
          where("season", "==", CURRENT_SEASON)
        );
        const snap = await getDocs(q);

        snap.docs.forEach((docSnap) => {
          const ref = doc(db, "rounds", docSnap.id);
          const isTarget = docSnap.id === roundId;
          tx.update(ref, { published: isTarget });
        });
      });

      // Update local state
      setRounds((prev) =>
        prev.map((r) => ({
          ...r,
          published: r.id === roundId,
        }))
      );

      setSuccess("Current round updated. Picks page will now use this round.");
    } catch (err: any) {
      console.error("Failed to set current round", err);
      setError("Failed to set current round. Check Vercel logs for more details.");
    } finally {
      setSavingRoundId(null);
    }
  };

  // Simple guard – later we can lock this down to admin only
  if (!user) {
    return (
      <div className="py-8">
        <h1 className="text-2xl font-bold mb-4">Admin – Rounds</h1>
        <p className="text-sm text-white/70">
          You must be logged in to manage rounds.
        </p>
      </div>
    );
  }

  return (
    <div className="py-8 max-w-4xl mx-auto text-white">
      <h1 className="text-2xl md:text-3xl font-bold mb-2">
        Admin – Rounds ({CURRENT_SEASON})
      </h1>
      <p className="text-sm text-white/70 mb-6">
        Set which round is currently published. Only the published round will
        appear on the Picks page and as the default round on the leaderboard.
      </p>

      {error && (
        <p className="mb-3 text-sm text-red-400 border border-red-500/40 rounded-md bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 text-sm text-emerald-400 border border-emerald-500/40 rounded-md bg-emerald-500/10 px-3 py-2">
          {success}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-white/70">Loading rounds…</p>
      ) : rounds.length === 0 ? (
        <p className="text-sm text-white/70">
          No rounds found for this season yet.
        </p>
      ) : (
        <div className="mt-4 border border-white/10 rounded-2xl overflow-hidden bg-black/40">
          <div className="grid grid-cols-[80px,1fr,140px,140px] gap-3 px-4 py-2 text-[11px] text-white/60 uppercase tracking-wide border-b border-white/10">
            <div>Round</div>
            <div>Games</div>
            <div>Published</div>
            <div>Actions</div>
          </div>

          {rounds.map((r) => (
            <div
              key={r.id}
              className={`grid grid-cols-[80px,1fr,140px,140px] gap-3 px-4 py-3 text-sm border-t border-white/10 ${
                r.published ? "bg-orange-500/10" : "bg-black/20"
              }`}
            >
              <div className="font-semibold">R{r.round}</div>
              <div className="text-white/80">
                {r.gameCount} game{r.gameCount === 1 ? "" : "s"}
              </div>
              <div className="text-white/80">
                {r.published ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold">
                    Current round
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-white/5 text-white/70 border border-white/20 px-2 py-0.5 text-[11px]">
                    Draft
                  </span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setAsCurrentRound(r.id)}
                  disabled={savingRoundId === r.id}
                  className="text-xs rounded-full px-3 py-1 border border-orange-500/60 text-orange-300 hover:bg-orange-500/10 disabled:opacity-60"
                >
                  {savingRoundId === r.id ? "Updating…" : "Set as current"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
