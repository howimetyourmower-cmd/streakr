// app/api/seed-rounds-2026/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
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

export async function GET() {
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { ok: false, message: "rounds-2026.json is empty" },
      { status: 400 }
    );
  }

  const roundMap = new Map<
    string,
    RoundDoc & { _gameIndex: Map<string, Game> }
  >();

  for (const row of rows as RawRow[]) {
    const roundLabel = get(row, "Round");
    const roundNumber = roundLabelToNumber(roundLabel);
    const roundKey = `${SEASON}-${roundNumber}`;

    const gameNo = String(get(row, "Game") ?? "").trim();
    const match = String(get(row, "Match") ?? "").trim();
    const venue = String(get(row, "Venue") ?? "").trim();
    const startTime = String(get(row, "StartTime") ?? "").trim();
    const questionText = String(get(row, "Question") ?? "").trim();
    const quarterVal = Number(get(row, "Quarter") ?? 1);
    const statusRaw = String(get(row, "Status") ?? "open").toLowerCase();

    if (!roundLabel || !gameNo || !match || !questionText || !startTime) {
      console.log("Skipping incomplete:", row);
      continue;
    }

    const status: QuestionStatus =
      statusRaw === "final" ||
      statusRaw === "pending" ||
      statusRaw === "void"
        ? (statusRaw as QuestionStatus)
        : "open";

    let round = roundMap.get(roundKey);
    if (!round) {
      round = {
        season: SEASON,
        roundNumber,
        label: roundNumber === 0 ? "Opening Round" : `Round ${roundNumber}`,
        games: [],
        _gameIndex: new Map(),
      };
      roundMap.set(roundKey, round);
    }

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
