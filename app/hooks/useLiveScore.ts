// /app/hooks/useLiveScore.ts
"use client";

import { useEffect, useRef, useState } from "react";

type LiveScoreState = {
  status: "scheduled" | "live" | "final";
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  updatedAtUtc: string;
};

export function useLiveScore(params: {
  season: number;
  roundNumber: number;
  gameId: string;
  pollMs?: number;
}) {
  const { season, roundNumber, gameId, pollMs = 20000 } = params;

  const [state, setState] = useState<LiveScoreState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchScore() {
      try {
        const res = await fetch("/api/games/live-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season, roundNumber, gameId }),
        });

        if (!res.ok) return;

        const json = (await res.json()) as LiveScoreState;

        if (mounted) {
          setState((prev) => {
            // Prevent pointless re-renders
            if (
              prev &&
              prev.homeScore === json.homeScore &&
              prev.awayScore === json.awayScore &&
              prev.status === json.status
            ) {
              return prev;
            }
            return json;
          });
        }
      } catch {
        // Silent failure – keep last known score
      }
    }

    fetchScore();
    timerRef.current = window.setInterval(fetchScore, pollMs);

    return () => {
      mounted = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [season, roundNumber, gameId, pollMs]);

  return state;
}
