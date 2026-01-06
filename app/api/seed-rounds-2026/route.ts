export const dynamic = "force-dynamic";

// app/api/seed-rounds-2026/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import rows from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";

type RawRow = {
  [key: string]: any;
};

const SEASON = 2026;

// ---------- helpers ----------

function normKey(k: string) {
  return k.toLowerCase().replace(/[\s_.]/g, "");
}

function get(row: RawRow, key: string): any {
  const target = normKey(key);
  for (const [k, v] of Object.entries(row)) {
    if (normKey(k) === target) return v;
  }
  return undefined;
}

function roundLabelToNumber(labelRaw: any): number {
  const label = String(labelRaw ?? "").trim().toUpperCase();
  if (label === "OR" || label === "OPENING" || label === "OPENING ROUND") return 0;
  const n = Number(label);
  return Number.isFinite(n) ? n : 0;
}

// ---------- handler ----------

export async function GET() {
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "rounds-2026.json is empty" },
      { status: 400 }
    );
  }

  const batch = db.batch();

  // Track per-round + per-game question index
  const questionIndex: Record<string, number> = {};

  for (const row of rows as RawRow[]) {
    const roundLabel = get(row, "Round");
    const roundNumber = roundLabelToNumber(roundLabel);
    const roundCode = roundNumber === 0 ? "OR" : `R${roundNumber}`;

    const gameNo = Number(get(row, "Game"));
    const match = String(get(row, "Match") ?? "").trim();
    const venue = String(get(row, "Venue") ?? "").trim();
    const startTime = String(get(row, "StartTime") ?? "").trim();
    const questionText = String(get(row, "Question") ?? "").trim();
    const quarter = Number(get(row, "Quarter") ?? 1);
    const statusRaw = String(get(row, "Status") ?? "open").toLowerCase();

    if (!roundLabel || !gameNo || !match || !questionText || !startTime) continue;

    const status: QuestionStatus =
      statusRaw === "final" || statusRaw === "pending" || statusRaw === "void"
        ? (statusRaw as QuestionStatus)
        : "open";

    const gameId = `${roundCode}-G${gameNo}`;

    // Stable per-game index
    const key = `${roundCode}-${gameNo}`;
    if (!questionIndex[key]) questionIndex[key] = 0;
    questionIndex[key] += 1;

    const questionId = `${gameId}-Q${questionIndex[key]}`;

    const questionRef = db.collection("questions").doc(questionId);

    batch.set(
      questionRef,
      {
        id: questionId,
        roundNumber,
        gameId,
        match,
        venue,
        startTime,
        quarter,
        question: questionText, // ✅ THIS WILL UPDATE SPELLING
        status,
        season: SEASON,
        updatedAt: new Date(),
      },
      { merge: true } // 🔥 critical
    );
  }

  await batch.commit();

  return NextResponse.json({
    ok: true,
    message: "Questions seeded (safe overwrite)",
  });
}
