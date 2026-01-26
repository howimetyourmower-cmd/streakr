// /app/reversa/admin/seed/page.tsx

import { db } from "@/lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  reversaRounds,
  reversaGames,
} from "@/data/reversa-2026-opening-round";

export const dynamic = "force-dynamic";

async function seedReversa() {
  // ✅ Seed Opening Round
  for (const round of reversaRounds) {
    await db.collection("reversaRounds").doc(round.id).set(
      {
        ...round,
        seededAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ✅ Seed Opening Round games
  for (const game of reversaGames) {
    await db.collection("reversaGames").doc(game.id).set(
      {
        ...game,
        seededAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    rounds: reversaRounds.length,
    games: reversaGames.length,
  };
}

export default async function ReversaSeedPage() {
  const result = await seedReversa();

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-bold">REVERSA Seed Complete</h1>

        <div className="mt-4 space-y-2 text-sm text-white/70">
          <div>Rounds created: {result.rounds}</div>
          <div>Games created: {result.games}</div>
          <div className="text-white/50">Season: 2026</div>
          <div className="text-white/50">Round: Opening Round (OR)</div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black p-4 text-xs text-white/60">
          You can now safely delete or restrict this page.
        </div>
      </div>
    </main>
  );
}
