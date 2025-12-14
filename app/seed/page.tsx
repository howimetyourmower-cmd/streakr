"use client";

import { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/* ------------------ Templates ------------------ */

const AFL_TEMPLATE = {
  round: 1,
  season: 2026,
  games: [
    {
      match: "Carlton v Brisbane",
      venue: "MCG, Melbourne",
      startTime: "2026-03-05T19:30:00+11:00",
      questions: [
        {
          id: "carlton-brisbane-q1",
          quarter: 1,
          question: "Will Lachie Neale get 7 or more disposals in the 1st quarter?",
          status: "open",
          isSponsorQuestion: false
        }
      ]
    }
  ]
};

const BBL_TEMPLATE = {
  roundNumber: 0,
  season: 2025,
  label: "BBL Match",
  sport: "BBL",
  games: [
    {
      match: "Perth Scorchers v Sydney Sixers",
      venue: "Optus Stadium",
      startTime: "2025-12-14T19:15:00+08:00",
      questions: [
        {
          id: "BBL-Q01",
          quarter: 0,
          question: "Will the Perth Scorchers win the bat flip?",
          status: "open",
          isSponsorQuestion: false
        }
      ]
    }
  ]
};

type SeedCollection = "games" | "rounds" | "cricketRounds";

/* ------------------ Page ------------------ */

export default function SeedPage() {
  const [jsonText, setJsonText] = useState(
    JSON.stringify(AFL_TEMPLATE, null, 2)
  );
  const [docId, setDocId] = useState("round-1");
  const [collectionName, setCollectionName] =
    useState<SeedCollection>("games");
  const [status, setStatus] = useState("");

  function loadTemplate(type: "AFL" | "BBL") {
    if (type === "AFL") {
      setJsonText(JSON.stringify(AFL_TEMPLATE, null, 2));
      setCollectionName("games");
      setDocId("round-1");
    } else {
      setJsonText(JSON.stringify(BBL_TEMPLATE, null, 2));
      setCollectionName("cricketRounds");
      setDocId("BBL-2025-12-14-SCO-VS-SIX");
    }
    setStatus("");
  }

  async function handleSeed() {
    try {
      const parsed = JSON.parse(jsonText);

      await setDoc(
        doc(collection(db, collectionName), docId),
        {
          ...parsed,
          updatedAt: serverTimestamp()
        },
        { merge: false }
      );

      setStatus(`✅ Seeded to ${collectionName}/${docId}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-orange-500 mb-4">
          Seed Firestore Data
        </h1>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => loadTemplate("AFL")}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg text-sm"
          >
            Load AFL
          </button>
          <button
            onClick={() => loadTemplate("BBL")}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg text-sm"
          >
            Load BBL
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-zinc-300">Collection</label>
          <select
            value={collectionName}
            onChange={(e) =>
              setCollectionName(e.target.value as SeedCollection)
            }
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
          >
            <option value="games">games (legacy)</option>
            <option value="rounds">rounds (AFL rounds)</option>
            <option value="cricketRounds">cricketRounds (BBL)</option>
          </select>
        </div>

        <textarea
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl p-4 border border-zinc-700 h-96 font-mono"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />

        <div className="flex items-center gap-4 mt-4">
          <input
            type="text"
            placeholder="Document ID"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
          />
          <button
            onClick={handleSeed}
            className="bg-orange-500 text-black font-semibold px-6 py-2 rounded-xl hover:bg-orange-600"
          >
            Seed
          </button>
        </div>

        {status && <p className="mt-4 text-sm">{status}</p>}
      </div>
    </main>
  );
}
