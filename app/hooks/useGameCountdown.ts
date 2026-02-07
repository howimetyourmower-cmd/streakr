// /app/hooks/useGameCountdown.ts
"use client";

import { useEffect, useRef, useState } from "react";

type ResolvedGameState = {
  startTimeUtc: string;
  nowUtc: string;
  countdownMs: number;
  isLocked: boolean;
  source: "manual" | "squiggle";
};

export function useGameCountdown(params: {
  season: number;
  roundNumber: number;
  gameId: string;
  pollMs?: number;
}) {
  const { season, roundNumber, gameId, pollMs = 15000 } = params;

  const [state, setState] = useState<ResolvedGameState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchState() {
      try {
        const res = await fetch("/api/games/resolve-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season, roundNumber, gameId }),
        });

        if (!res.ok) return;

        const json = (await res.json()) as ResolvedGameState;
        if (mounted) setState(json);
      } catch {
        // silent fail — countdown continues locally
      }
    }

    fetchState();

    timerRef.current = window.setInterval(fetchState, pollMs);

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
