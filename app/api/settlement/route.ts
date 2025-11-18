export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/admin";
import { Timestamp } from "firebase-admin/firestore";

type QuestionStatus = "open" | "final" | "pending" | "void";
type Outcome = "yes" | "no" | "void";

type RoundDoc = {
  season?: number;
  games?: any[];
};

const CURRENT_SEASON = 2026;

// Same ID logic as /api/picks
function buildQuestionId(
  roundId: string,
  gameIndex: number,
  questionIndex: number,
  rawQuestion: any
): string {
  const gameId = `${roundId}_game_${gameIndex}`;
  const fallbackId = `${gameId}_q${questionIndex + 1}`;
  return typeof rawQuestion.id === "string" && rawQuestion.id.trim()
    ? rawQuestion.id
    : fallbackId;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const questionId = body?.questionId as string | undefined;
    const outcome = body?.outcome as Outcome | undefined;

    if (!questionId || typeof questionId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid questionId" },
        { status: 400 }
      );
    }

    if (!outcome || !["yes", "no", "void"].includes(outcome)) {
      return NextResponse.json(
        { error: "Missing or invalid outcome (must be 'yes' | 'no' | 'void')" },
        { status: 400 }
      );
    }

    // 1) Find the question inside rounds for CURRENT_SEASON
    const roundsSnap = await db
      .collection("rounds")
      .where("season", "==", CURRENT_SEASON)
      .get();

    let targetRoundRef: FirebaseFirestore.DocumentReference | null = null;
    let targetRoundData: RoundDoc | null = null;
    let targetGameIndex = -1;
    let targetQuestionIndex = -1;
    let originalQuestion: any = null;

    for (const roundDoc of roundsSnap.docs) {
      const data = roundDoc.data() as RoundDoc;
      const gamesArr = data.games ?? [];

      for (let gIndex = 0; gIndex < gamesArr.length; gIndex++) {
        const g = gamesArr[gIndex] ?? {};
        const questionsArr = g.questions ?? [];

        for (let qIndex = 0; qIndex < questionsArr.length; qIndex++) {
          const q = questionsArr[qIndex] ?? {};
          const thisQuestionId = buildQuestionId(
            roundDoc.id,
            gIndex,
            qIndex,
            q
          );

          if (thisQuestionId === questionId) {
            targetRoundRef = roundDoc.ref;
            targetRoundData = data;
            targetGameIndex = gIndex;
            targetQuestionIndex = qIndex;
            originalQuestion = q;
            break;
          }
        }

        if (targetRoundRef) break;
      }

      if (targetRoundRef) break;
    }

    if (!targetRoundRef || !targetRoundData) {
      return NextResponse.json(
        { error: "Question not found in any round for current season" },
        { status: 404 }
      );
    }

    const gamesArr = targetRoundData.games ?? [];
    const game = gamesArr[targetGameIndex] ?? {};
    const questionsArr = game.questions ?? [];

    const status: QuestionStatus = outcome === "void" ? "void" : "final";

    const updatedQuestion = {
      ...originalQuestion,
      status,
      correctOutcome: outcome,
      settledAt: Timestamp.now(),
    };

    questionsArr[targetQuestionIndex] = updatedQuestion;
    gamesArr[targetGameIndex] = {
      ...game,
      questions: questionsArr,
    };

    // 2) Update the round doc with the modified games array
    await targetRoundRef.update({
      games: gamesArr,
    });

    // 3) Update all picks for this questionId
    const picksSnap = await db
      .collection("picks")
      .where("questionId", "==", questionId)
      .get();

    if (!picksSnap.empty) {
      const batch = db.batch();
      picksSnap.forEach((pickDoc) => {
        const data = pickDoc.data() as any;
        const pick = data.pick as Outcome | undefined;

        let isCorrect: boolean | null = null;
        if (outcome !== "void") {
          isCorrect = pick === outcome;
        }

        batch.update(pickDoc.ref, {
          settled: true,
          outcome,
          isCorrect,
          settledAt: Timestamp.now(),
        });
      });

      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      questionId,
      outcome,
      status,
      picksUpdated: picksSnap.size,
    });
  } catch (err) {
    console.error("Error in /api/settlement:", err);
    return NextResponse.json(
      { error: "Failed to settle question" },
      { status: 500 }
    );
  }
}
