"use client";

import { useMemo, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/* ------------------ Templates ------------------ */

// ✅ Legacy "games" template (only use if you still rely on this collection somewhere)
const AFL_GAMES_LEGACY_TEMPLATE = {
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
          question:
            "Will Lachie Neale get 7 or more disposals in the 1st quarter?",
          status: "open",
          isSponsorQuestion: false,
        },
      ],
    },
  ],
};

// ✅ Proper AFL "rounds" template (matches your Rounds admin / Picks API world)
const AFL_ROUNDS_TEMPLATE = {
  season: 2026,
  roundNumber: 1,
  roundKey: "R1",
  label: "Round 1",
  published: false,
  games: [
    {
      match: "Carlton v Brisbane",
      venue: "MCG, Melbourne",
      startTime: "2026-03-05T19:30:00+11:00",
      questions: [
        {
          quarter: 1,
          question:
            "Will Lachie Neale get 7 or more disposals in the 1st quarter?",
          status: "open",
          isSponsorQuestion: false,
        },
      ],
    },
  ],
};

// ✅ BBL "cricketRounds" template (your Settlement page uses docId)
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
          isSponsorQuestion: false,
        },
      ],
    },
  ],
};

type SeedCollection = "games" | "rounds" | "cricketRounds";

function safeJsonParse(raw: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const value = JSON.parse(raw);
    return { ok: true, value };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

function inferRoundKey(roundNumber: number): string {
  if (roundNumber === 0) return "OR";
  if (roundNumber === 99) return "FINALS";
  return `R${roundNumber}`;
}

export default function SeedPage() {
  const [collectionName, setCollectionName] = useState<SeedCollection>("rounds");

  // Default to the correct template for the default collection
  const defaultJson = useMemo(() => {
    if (collectionName === "rounds") return JSON.stringify(AFL_ROUNDS_TEMPLATE, null, 2);
    if (collectionName === "cricketRounds") return JSON.stringify(BBL_TEMPLATE, null, 2);
    return JSON.stringify(AFL_GAMES_LEGACY_TEMPLATE, null, 2);
  }, [collectionName]);

  const [jsonText, setJsonText] = useState(defaultJson);
  const [docId, setDocId] = useState("afl-2026-r1");
  const [status, setStatus] = useState("");

  // When collection changes, load a sensible template + docId
  function loadTemplate(type: "AFL_ROUNDS" | "AFL_GAMES" | "BBL") {
    setStatus("");

    if (type === "AFL_ROUNDS") {
      setCollectionName("rounds");
      setJsonText(JSON.stringify(AFL_ROUNDS_TEMPLATE, null, 2));
      setDocId("afl-2026-r1");
      return;
    }

    if (type === "AFL_GAMES") {
      setCollectionName("games");
      setJsonText(JSON.stringify(AFL_GAMES_LEGACY_TEMPLATE, null, 2));
      setDocId("round-1");
      return;
    }

    setCollectionName("cricketRounds");
    setJsonText(JSON.stringify(BBL_TEMPLATE, null, 2));
    setDocId("BBL-2025-12-14-SCO-VS-SIX");
  }

  function validateForCollection(col: SeedCollection, data: any): string | null {
    if (!data || typeof data !== "object") return "JSON must be an object.";

    if (col === "rounds") {
      if (typeof data.season !== "number") return "rounds: season must be a number.";
      if (typeof data.roundNumber !== "number") return "rounds: roundNumber must be a number.";
      if (typeof data.roundKey !== "string" || !data.roundKey) {
        return "rounds: roundKey must be a string (e.g. OR, R1, R2).";
      }
      if (typeof data.label !== "string" || !data.label) return "rounds: label must be a string.";
      if (!Array.isArray(data.games)) return "rounds: games must be an array.";
      return null;
    }

    if (col === "cricketRounds") {
      if (data.sport !== "BBL") return "cricketRounds: sport must be 'BBL'.";
      if (typeof data.season !== "number") return "cricketRounds: season must be a number.";
      if (!Array.isArray(data.games)) return "cricketRounds: games must be an array.";
      return null;
    }

    // games (legacy)
    if (typeof data.season !== "number") return "games: season must be a number.";
    if (typeof data.round !== "number") return "games: round must be a number.";
    if (!Array.isArray(data.games)) return "games: games must be an array.";
    return null;
  }

  async function handleSeed() {
    setStatus("");

    const parsed = safeJsonParse(jsonText);
    if (!parsed.ok) {
      setStatus(`❌ JSON error: ${parsed.error}`);
      return;
    }

    const data = parsed.value;

    // Small quality-of-life: if seeding rounds and roundKey missing, infer it
    if (collectionName === "rounds" && data && typeof data === "object") {
      if (!data.roundKey && typeof data.roundNumber === "number") {
        data.roundKey = inferRoundKey(data.roundNumber);
      }
      if (!data.label && typeof data.roundNumber === "number") {
        data.label = data.roundNumber === 0 ? "Opening Round" : `Round ${data.roundNumber}`;
      }
      if (typeof data.published !== "boolean") {
        data.published = false;
      }
    }

    const validationError = validateForCollection(collectionName, data);
    if (validationError) {
      setStatus(`❌ Validation error: ${validationError}`);
      return;
    }

    if (!docId.trim()) {
      setStatus("❌ Please enter a Document ID.");
      return;
    }

    try {
      const ref = doc(db, collectionName, docId.trim());

      await setDoc(
        ref,
        {
          ...data,
          updatedAt: serverTimestamp(),
          // only set createdAt if it doesn't exist (merge true below handles this)
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus(`✅ Seeded to ${collectionName}/${docId.trim()}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Firestore error: ${err?.message || "Unknown error"}`);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-orange-500 mb-4">
          Seed Firestore Data
        </h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => loadTemplate("AFL_ROUNDS")}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg text-sm"
          >
            Load AFL (rounds)
          </button>
          <button
            onClick={() => loadTemplate("AFL_GAMES")}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-lg text-sm"
          >
            Load AFL (games legacy)
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
            onChange={(e) => {
              const next = e.target.value as SeedCollection;
              setCollectionName(next);

              // swap to a sensible default template when collection changes
              if (next === "rounds") {
                setJsonText(JSON.stringify(AFL_ROUNDS_TEMPLATE, null, 2));
                setDocId("afl-2026-r1");
              } else if (next === "cricketRounds") {
                setJsonText(JSON.stringify(BBL_TEMPLATE, null, 2));
                setDocId("BBL-2025-12-14-SCO-VS-SIX");
              } else {
                setJsonText(JSON.stringify(AFL_GAMES_LEGACY_TEMPLATE, null, 2));
                setDocId("round-1");
              }

              setStatus("");
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
          >
            <option value="rounds">rounds (AFL rounds)</option>
            <option value="cricketRounds">cricketRounds (BBL)</option>
            <option value="games">games (legacy)</option>
          </select>
        </div>

        <textarea
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl p-4 border border-zinc-700 h-96 font-mono text-[12px]"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
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

        <p className="mt-6 text-xs text-zinc-500">
          Tip: For AFL production flow, seed <code>rounds</code> docs then use the
          Rounds Admin page to Publish a round (writes <code>config/season-2026</code>).
        </p>
      </div>
    </main>
  );
}
