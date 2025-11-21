// app/api/seed-rounds-2026/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import rows from "@/data/rounds-2026.json";

type QuestionStatus = "open" | "final" | "pending" | "void";

type Question = {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
};

type Game = {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: "AFL";
  questions: Question[];
};

type RoundDoc = {
  season: number;
  roundNumber: number;
  label: string;
  games: Game[];
};

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
  const label = String(labelRaw ?? "").trim();
  const up = label.toUpperCase();
  if (up === "OR" || up === "OPENING" || up === "OPENING ROUND") return 0;

  const n = Number(label);
  return Number.isFinite(n) ? n : 0;
}

function slugifyMatch(match: string): string {
  return match
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------- handler ----------

export async function GET() {
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "rounds-2026.json is empty" },
      { status: 400 }
    );
  }

  type RoundInternal = RoundDoc & { _gameIndex: Map<string, Game> };

  const roundMap = new Map<string, RoundInternal>();

  for (const row of rows as RawRow[]) {
    const roundLabel = get(row, "Round");
    const roundNumber = roundLabelToNumber(roundLabel);
    const roundKey = `${SEASON}-${roundNumber}`;

    const gameNo = String(get(row, "Game") ?? "").trim();
    const match = String(get(row, "Match") ?? "").trim();
    const venue = String(get(row, "Venue") ?? "").trim();
    const startTime = String(get(row, "StartTime") ?? "").trim();
    const questionText = String(get(row, "Question") ?? "").trim();
    const quarterRaw = get(row, "Quarter");
    const quarterVal = Number(quarterRaw ?? 1);
    const statusRaw = String(get(row, "Status") ?? "open").toLowerCase();

    if (!roundLabel || !gameNo || !match || !questionText || !startTime) {
      console.log("Skipping incomplete row:", row);
      continue;
    }

    const status: QuestionStatus =
      statusRaw === "final" ||
      statusRaw === "pending" ||
      statusRaw === "void"
        ? (statusRaw as QuestionStatus)
        : "open";

    // get or create round
    let round = roundMap.get(roundKey);
    if (!round) {
      round = {
        season: SEASON,
        roundNumber,
        label: roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`,
        games: [],
        _gameIndex: new Map<string, Game>(),
      };
      roundMap.set(roundKey, round);
    }

    // get or create game within round
    let game = round._gameIndex.get(gameNo);
    if (!game) {
      game = {
        id: slugifyMatch(match),
        match,
        venue,
        startTime,
        sport: "AFL",
        questions: [],
      };
      round._gameIndex.set(gameNo, game);
      round.games.push(game);
    }

    const quarter = quarterVal > 0 ? quarterVal : 1;
    const questionId = `${game.id}-q${quarter}-${game.questions.length + 1}`;

    game.questions.push({
      id: questionId,
      quarter,
      question: questionText,
      status,
    });
  }

  // write to Firestore in a batch
  const batch = db.batch();
  const roundsCol = db.collection("rounds");

  for (const [docId, data] of roundMap.entries()) {
    const { _gameIndex, ...rest } = data;
    batch.set(roundsCol.doc(docId), rest, { merge: false });
  }

  await batch.commit();

  return NextResponse.json({
    ok: true,
    message: "Rounds seeded",
    docs: Array.from(roundMap.keys()),
  });
}
