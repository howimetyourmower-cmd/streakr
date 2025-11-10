// app/seed/page.tsx
"use client";

import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

const DEFAULT_JSON = {
  round: 1,
  season: 2026,
  games: [
    {
      match: "Carlton v Brisbane",
      questions: [
        { quarter: 1, question: "Will Lachie Neale get 7 or more disposals in the 1st quarter?" },
        { quarter: 2, question: "Will Charlie Curnow kick a goal in the 2nd quarter?" },
        { quarter: 3, question: "Will Patrick Cripps get 6 or more disposals in the 3rd quarter?" },
        { quarter: 4, question: "Will Brisbane win the match?" },
      ],
    },
  ],
};

export default function SeedPage() {
  const [jsonText, setJsonText] = useState(JSON.stringify(DEFAULT_JSON, null, 2));
  const [status, setStatus] = useState("");
  const [docId, setDocId] = useState("round-1");

  async function handleSeed() {
    try {
      const parsed = JSON.parse(jsonText);
      await setDoc(doc(collection(db, "games"), docId), parsed);
      setStatus("✅ Data seeded successfully!");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-orange-500 mb-6">Seed Firestore Data</h1>
        <p className="text-sm text-zinc-400 mb-4">
          Paste JSON below and click <b>Seed</b> to upload to Firestore.
        </p>

        <textarea
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl p-4 border border-zinc-700 h-96 font-mono"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="flex items-center gap-4 mt-4">
          <input
            type="text"
            placeholder="Document ID (e.g., round-1)"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 outline-none"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
          />
          <button
            onClick={handleSeed}
            className="bg-orange-500 text-black font-semibold px-6 py-2 rounded-xl hover:bg-orange-600 transition"
          >
            Seed
          </button>
        </div>

        {status && <p className="mt-4 text-sm">{status}</p>}
      </div>
    </main>
  );
}
