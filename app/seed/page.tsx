"use client";

import { useState } from "react";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import Link from "next/link";

type Question = { quarter: number; question: string };
type Game = {
  match: string;
  startTime?: any;   // Firestore Timestamp or ISO string
  venue?: string;
  questions: Question[];
};
type RoundDoc = { games: Game[] };

const DEFAULT_JSON: RoundDoc = {
  games: [
    {
      match: "Carlton v Brisbane",
      // You can keep ISO strings; app formats both. Or paste real Firestore Timestamps after seeding if you prefer.
      startTime: "2026-03-19T19:50:00+11:00",
      venue: "MCG, Melbourne",
      questions: [
        { quarter: 1, question: "Will Lachie Neale get 7 or more disposals in the 1st quarter?" },
        { quarter: 2, question: "Will Charlie Curnow kick a goal in the 2nd quarter?" },
        { quarter: 3, question: "Will Patrick Cripps get 6 or more disposals in the 3rd quarter?" },
        { quarter: 4, question: "Will Joe Daniher kick a goal in the last quarter?" },
      ],
    },
    {
      match: "Collingwood v Sydney",
      startTime: "2026-03-20T19:20:00+11:00",
      venue: "MCG, Melbourne",
      questions: [
        { quarter: 1, question: "Will Nick Daicos get 8 or more disposals in the 1st quarter?" },
        { quarter: 2, question: "Will Isaac Heeney kick a goal in the 2nd quarter?" },
        { quarter: 3, question: "Will Jordan De Goey get 6 or more disposals in the 3rd quarter?" },
        { quarter: 4, question: "Will Errol Gulden kick a goal in the last quarter?" },
      ],
    },
  ],
};

export default function SeedPage() {
  const db = getFirestore(app);
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(DEFAULT_JSON, null, 2));
  const [docId, setDocId] = useState<string>("round-1"); // change to round-2 etc as needed
  const [status, setStatus] = useState<string>("");

  async function handleSeed() {
    setStatus("Seeding…");
    try {
      const parsed = JSON.parse(jsonText) as RoundDoc;

      // Very light validation
      if (!parsed?.games || !Array.isArray(parsed.games) || parsed.games.length === 0) {
        throw new Error("JSON must have a 'games' array with at least one game.");
      }
      parsed.games.forEach((g, i) => {
        if (!g.match) throw new Error(`Game ${i + 1} missing 'match'`);
        if (!g.questions || !Array.isArray(g.questions) || g.questions.length === 0) {
          throw new Error(`Game ${i + 1} must include a 'questions' array with items.`);
        }
      });

      await setDoc(doc(db, "rounds", docId), parsed, { merge: false });
      setStatus(`✅ Seeded '${docId}' successfully.`);
    } catch (err: any) {
      setStatus(`❌ ${err?.message || String(err)}`);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0f13] to-[#0b0f13]/60 text-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">Seed Round Data</h1>

        <label className="block text-sm mb-2">Document ID (rounds/&nbsp;…)</label>
        <input
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          className="w-full rounded-lg bg-[#11161b] border border-white/10 px-3 py-2 mb-4"
          placeholder="round-1"
        />

        <label className="block text-sm mb-2">Round JSON</label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full h-[360px] rounded-lg bg-[#11161b] border border-white/10 px-3 py-2 font-mono text-sm"
        />

        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={handleSeed}
            className="rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2 font-semibold"
          >
            Seed Now
          </button>
          <Link href="/" className="text-white/70 hover:text-white underline">
            Back to Home
          </Link>
        </div>

        {status && <p className="mt-4 text-sm">{status}</p>}

        <p className="mt-8 text-xs text-white/60">
          Tip: After seeding, delete this page (<code>/app/seed/page.tsx</code>) so no one else can seed.
        </p>
      </div>
    </main>
  );
}
